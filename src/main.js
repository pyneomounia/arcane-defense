(() => {
  // Tamanho da janela do jogo. O mundo não possui largura ou altura fixa.
  const VIEW_WIDTH = 960;
  const VIEW_HEIGHT = 540;
  const PLAYER_SPEED = 260; // pixels por segundo
  const ENEMY_SPEED = 92; // inimigos perseguem mais devagar que o mago
  const ENEMY_MAX_COUNT = 10;
  const ENEMY_SPAWN_INTERVAL = 2800;
  const ENEMY_STOP_DISTANCE = 40;
  const GROUND_TILE_SIZE = 384;

  const message = document.getElementById('message');

  // Evita uma tela vazia se a biblioteca Phaser não carregar.
  if (typeof Phaser === 'undefined') {
    message.textContent = 'Não foi possível carregar a engine Phaser. Verifique sua conexão com a internet e recarregue a página.';
    document.body.classList.add('startup-error');
    return;
  }

  class TrainingScene extends Phaser.Scene {
    constructor() {
      super('TrainingScene');
      this.wizardFacing = 'front';
      this.selectedElement = null;
      this.spellTimer = null;
      this.wizardReady = false;
      this.enemies = [];
      this.enemySpawnTimer = null;
    }

    preload() {
      // Os ciclos de caminhada estão divididos em pequenos arquivos de texto.
      // Cada direção é uma imagem WebP com oito quadros lado a lado.
      const chunks = {
        front: ['front-0', 'front-1', 'front-2'],
        left: ['left-0', 'left-1'],
        right: ['right-0', 'right-1'],
        back: ['back-0', 'back-1']
      };

      Object.entries(chunks).forEach(([direction, parts]) => {
        parts.forEach((part, index) => {
          const key = 'wizard-walk-data-' + direction + '-' + index;
          const path = 'assets/characters/wizard/walk/' + part + '.txt';
          this.load.text(key, path);
        });
      });

      // As quatro magias usam sprites pixel art separados.
      ['fire', 'ice', 'water', 'earth'].forEach(element => {
        this.load.image('projectile-' + element, 'assets/projectiles/' + element + '.webp');
      });
    }

    create() {
      this.drawWorld();
      this.createEnemyTexture();
      this.createControls();

      // Os cliques são registrados imediatamente, sem depender das animações.
      this.bindElementSelection();
      message.textContent = 'Carregando as animações do mago...';

      // A câmera não recebe limites: pode acompanhar o mago em qualquer direção.
      this.loadWizardAnimations()
        .then(() => {
          this.createWizardAnimations();
          this.createWizard();
          this.cameras.main.startFollow(this.wizard, true, 0.08, 0.08);
          this.wizardReady = true;
          message.textContent = 'Escolha um elemento para começar sua jornada.';
          if (this.selectedElement) this.startElementCasting();
        })
        .catch(error => {
          console.error('Falha ao carregar as animações do mago:', error);
          message.textContent = 'Falha ao carregar o mago: ' + (error?.message || error) + '. Recarregue a página.';
          document.body.classList.add('startup-error');
        });
    }

    loadWizardAnimations() {
      const directions = ['front', 'left', 'right', 'back'];

      return Promise.all(directions.map(direction => {
        const chunkCount = direction === 'front' ? 3 : 2;
        let base64 = '';

        for (let index = 0; index < chunkCount; index++) {
          const key = 'wizard-walk-data-' + direction + '-' + index;
          const part = this.cache.text.get(key);

          if (!part) {
            return Promise.reject(new Error('Parte ausente do sprite: ' + key));
          }

          base64 += part;
        }

        return new Promise((resolve, reject) => {
          const image = new Image();

          image.onload = () => {
            if (image.width !== 512 || image.height !== 72) {
              reject(new Error('Dimensão inesperada na animação: ' + direction));
              return;
            }

            // Cada tira possui oito quadros de 64 por 72 pixels.
            this.textures.addSpriteSheet('wizard-' + direction, image, {
              frameWidth: 64,
              frameHeight: 72
            });

            resolve(direction);
          };

          image.onerror = () => reject(
            new Error('Não foi possível decodificar a animação: ' + direction)
          );

          image.src = 'data:image/webp;base64,' + base64;
        });
      }));
    }

    createWizardAnimations() {
      const directions = ['front', 'left', 'right', 'back'];

      directions.forEach(direction => {
        const key = 'wizard-walk-' + direction;

        if (this.anims.exists(key)) return;

        this.anims.create({
          key,
          frames: this.anims.generateFrameNumbers('wizard-' + direction, {
            start: 0,
            end: 7
          }),
          frameRate: 10,
          repeat: -1
        });
      });
    }

    createGroundTexture() {
      // Criamos um pequeno padrão de chão uma única vez.
      // O TileSprite repete esse padrão para preencher uma área sem fim.
      const size = GROUND_TILE_SIZE;
      const texture = this.textures.createCanvas('arcane-ground', size, size);
      const context = texture.getContext();

      context.imageSmoothingEnabled = false;
      context.fillStyle = '#192820';
      context.fillRect(0, 0, size, size);

      // Gerador pseudoaleatório com semente fixa:
      // o padrão do chão será igual em todas as partidas.
      let seed = 20261104;
      const random = () => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 4294967296;
      };

      // Desenha detalhes que atravessam as bordas também do outro lado.
      // Isso evita cortes visuais quando a textura se repete.
      const drawWrappedRect = (x, y, width, height, color) => {
        const positionsX = [x];
        const positionsY = [y];

        if (x + width > size) positionsX.push(x - size);
        if (y + height > size) positionsY.push(y - size);

        positionsX.forEach(px => {
          positionsY.forEach(py => {
            context.fillStyle = color;
            context.fillRect(px, py, width, height);
          });
        });
      };

      // Manchas suaves de terra e vegetação.
      const groundColors = ['#1d2d23', '#203025', '#1b2a22', '#223127'];

      for (let i = 0; i < 75; i++) {
        const x = Math.floor(random() * size);
        const y = Math.floor(random() * size);
        const width = 10 + Math.floor(random() * 34);
        const height = 5 + Math.floor(random() * 18);
        const color = groundColors[Math.floor(random() * groundColors.length)];
        drawWrappedRect(x, y, width, height, color);
      }

      // Pequenos pixels de musgo e folhas.
      const mossColors = ['#2b3b29', '#31402d', '#26382b', '#35432f'];

      for (let i = 0; i < 420; i++) {
        const x = Math.floor(random() * size);
        const y = Math.floor(random() * size);
        const width = 1 + Math.floor(random() * 3);
        const height = 1 + Math.floor(random() * 3);
        const color = mossColors[Math.floor(random() * mossColors.length)];
        drawWrappedRect(x, y, width, height, color);
      }

      // Pequenos fragmentos de pedra, integrados ao chão (não são obstáculos).
      for (let i = 0; i < 28; i++) {
        const x = Math.floor(random() * size);
        const y = Math.floor(random() * size);
        const stoneWidth = 4 + Math.floor(random() * 8);
        const stoneHeight = 2 + Math.floor(random() * 5);

        drawWrappedRect(x, y, stoneWidth, stoneHeight, '#29362f');
        drawWrappedRect(x + 1, y, Math.max(2, stoneWidth - 3), 1, '#3a463c');
        drawWrappedRect(x, y + stoneHeight, stoneWidth, 1, '#14221c');
      }

      texture.refresh();
    }

    drawWorld() {
      this.createGroundTexture();

      // O chão fica preso à tela enquanto sua textura acompanha a câmera.
      // Como o padrão se repete, nunca aparece uma borda do mapa.
      this.ground = this.add.tileSprite(
        0,
        0,
        VIEW_WIDTH,
        VIEW_HEIGHT,
        'arcane-ground'
      )
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setDepth(-100);
    }

    bindElementSelection() {
      // Cada botão da tela inicial seleciona a escola mágica da partida.
      document.querySelectorAll('.element-option').forEach(button => {
        button.addEventListener('click', () => {
          this.selectElement(button.dataset.element);
        });
      });
    }

    selectElement(element) {
      const allowedElements = ['ice', 'fire', 'water', 'earth'];
      if (!allowedElements.includes(element) || this.selectedElement) return;

      this.selectedElement = element;

      const labels = {
        ice: 'GELO',
        fire: 'FOGO',
        water: 'ÁGUA',
        earth: 'TERRA'
      };

      const selectedLabel = document.getElementById('selected-element');
      if (selectedLabel) selectedLabel.textContent = labels[element];

      const selectionScreen = document.getElementById('element-select');
      if (selectionScreen) selectionScreen.classList.add('is-hidden');

      // Ao iniciar, devolvemos a tela ao layout normal da partida.
      document.body.classList.remove('element-menu-open');

      if (this.wizardReady) {
        this.startElementCasting();
      } else {
        message.textContent = 'Elemento escolhido: ' + labels[element] + '. Preparando o mago...';
      }
    }

    startElementCasting() {
      if (!this.wizardReady || !this.selectedElement || this.spellTimer) return;

      const labels = {
        ice: 'GELO',
        fire: 'FOGO',
        water: 'ÁGUA',
        earth: 'TERRA'
      };

      message.textContent = 'Afinidade escolhida: ' + labels[this.selectedElement] + '. O mago lançará a magia a cada 1,8 segundo.';

      // Primeiro disparo imediato; os próximos acontecem a cada 1,8 segundo.
      this.castElementSpell();
      this.spellTimer = this.time.addEvent({
        delay: 1800,
        loop: true,
        callback: this.castElementSpell,
        callbackScope: this
      });

      this.startEnemySpawning();
    }

    createEnemyTexture() {
      // Slime sombrio em pixel art, desenhado em baixa resolução.
      // Assim o protótipo não depende de um arquivo externo para os inimigos.
      const size = 32;
      const texture = this.textures.createCanvas('enemy-shadow-slime', size, size);
      const context = texture.getContext();
      context.imageSmoothingEnabled = false;
      context.clearRect(0, 0, size, size);

      const pixel = (x, y, width, height, color) => {
        context.fillStyle = color;
        context.fillRect(x, y, width, height);
      };

      // Silhueta escura e irregular.
      pixel(10, 4, 12, 3, '#101a20');
      pixel(7, 7, 18, 4, '#101a20');
      pixel(4, 10, 24, 8, '#101a20');
      pixel(5, 18, 22, 5, '#101a20');
      pixel(9, 23, 14, 3, '#101a20');
      pixel(3, 13, 3, 5, '#101a20');
      pixel(26, 13, 3, 5, '#101a20');

      // Corpo verde-musgo com sombras.
      pixel(10, 7, 12, 3, '#344d3b');
      pixel(7, 10, 18, 8, '#3d6246');
      pixel(8, 18, 16, 4, '#31533d');
      pixel(11, 22, 10, 2, '#233c31');
      pixel(8, 10, 5, 3, '#55734a');
      pixel(7, 14, 3, 3, '#4b7048');
      pixel(17, 9, 7, 3, '#496a43');

      // Pequenas saliências para dar uma silhueta monstruosa.
      pixel(7, 6, 4, 3, '#1d342b');
      pixel(22, 6, 4, 3, '#1d342b');
      pixel(2, 12, 3, 3, '#243b30');
      pixel(27, 12, 3, 3, '#243b30');

      // Olhos amarelo-esverdeados.
      pixel(10, 13, 4, 4, '#17251c');
      pixel(18, 13, 4, 4, '#17251c');
      pixel(11, 14, 2, 2, '#f4d879');
      pixel(19, 14, 2, 2, '#f4d879');
      pixel(12, 14, 1, 1, '#fff4c0');
      pixel(20, 14, 1, 1, '#fff4c0');

      // Base mais escura para separar o corpo do chão.
      pixel(10, 23, 12, 2, '#17271f');
      texture.refresh();
    }

    startEnemySpawning() {
      if (this.enemySpawnTimer) return;

      // Dois inimigos iniciam a perseguição; outros entram aos poucos.
      this.spawnEnemy();
      this.spawnEnemy();

      this.enemySpawnTimer = this.time.addEvent({
        delay: ENEMY_SPAWN_INTERVAL,
        loop: true,
        callback: () => {
          if (this.enemies.length < ENEMY_MAX_COUNT) this.spawnEnemy();
        }
      });
    }

    spawnEnemy() {
      if (!this.wizard || this.enemies.length >= ENEMY_MAX_COUNT) return;

      const camera = this.cameras.main;
      const view = camera.worldView;
      const margin = 72;
      const side = Phaser.Math.Between(0, 3);
      let x;
      let y;

      // O inimigo sempre nasce fora da tela, vindo de uma das quatro bordas.
      if (side === 0) {
        x = view.x - margin;
        y = Phaser.Math.Between(Math.floor(view.y), Math.floor(view.bottom));
      } else if (side === 1) {
        x = view.right + margin;
        y = Phaser.Math.Between(Math.floor(view.y), Math.floor(view.bottom));
      } else if (side === 2) {
        x = Phaser.Math.Between(Math.floor(view.x), Math.floor(view.right));
        y = view.y - margin;
      } else {
        x = Phaser.Math.Between(Math.floor(view.x), Math.floor(view.right));
        y = view.bottom + margin;
      }

      const shadow = this.add.ellipse(x, y + 4, 31, 11, 0x05070c, 0.48)
        .setDepth(9);

      const sprite = this.add.image(x, y, 'enemy-shadow-slime')
        .setOrigin(0.5, 0.82)
        .setDisplaySize(46, 46)
        .setDepth(10.1);

      this.enemies.push({ sprite, shadow });
      this.updateEnemyCounter();
    }

    updateEnemyCounter() {
      const counter = document.getElementById('enemy-count');
      if (counter) counter.textContent = String(this.enemies.length);
    }

    updateEnemies(delta) {
      if (!this.wizard || this.enemies.length === 0) return;

      const step = ENEMY_SPEED * (delta / 1000);

      this.enemies.forEach(enemy => {
        const dx = this.wizard.x - enemy.sprite.x;
        const dy = this.wizard.y - enemy.sprite.y;
        const distance = Math.hypot(dx, dy);

        // Os inimigos se aproximam do mago, mas não se sobrepõem a ele.
        if (distance > ENEMY_STOP_DISTANCE) {
          const move = Math.min(step, distance - ENEMY_STOP_DISTANCE);
          enemy.sprite.x += (dx / distance) * move;
          enemy.sprite.y += (dy / distance) * move;
          enemy.sprite.setFlipX(dx < 0);
        }

        enemy.shadow.setPosition(enemy.sprite.x, enemy.sprite.y + 4);

        // Profundidade acompanha a posição vertical para manter a leitura top-down.
        enemy.shadow.setDepth(9 + enemy.sprite.y * 0.0001);
        enemy.sprite.setDepth(10 + enemy.sprite.y * 0.0001);
      });
    }

    getSpellOrigin(facing) {
      // Ponto aproximado da mão em cada orientação do sprite.
      const handOffsets = {
        front: { x: 17, y: -51 },
        back: { x: 17, y: -61 },
        left: { x: -25, y: -58 },
        right: { x: 25, y: -58 }
      };

      const offset = handOffsets[facing] || handOffsets.front;
      return {
        x: this.wizard.x + offset.x,
        y: this.wizard.y + offset.y
      };
    }

    getFacingVector() {
      const directions = {
        front: new Phaser.Math.Vector2(0, 1),
        back: new Phaser.Math.Vector2(0, -1),
        left: new Phaser.Math.Vector2(-1, 0),
        right: new Phaser.Math.Vector2(1, 0)
      };

      return directions[this.wizardFacing].clone();
    }

    castElementSpell() {
      if (!this.wizard || !this.selectedElement) return;

      const element = this.selectedElement;
      const facing = this.wizardFacing;
      const direction = this.getFacingVector();
      const origin = this.getSpellOrigin(facing);

      // Pequena preparação visual na mão antes de liberar o projétil.
      this.createCastingAnimation(element, origin.x, origin.y, direction);

      // O projétil sai da mão depois da breve animação de conjuração.
      this.time.delayedCall(150, () => {
        if (!this.wizard) return;

        const projectile = this.createElementProjectile(
          element,
          origin.x,
          origin.y,
          direction
        );

        // Os projéteis são demonstrações visuais até existir um sistema de inimigos.
        const travelDistance = 360;
        this.tweens.add({
          targets: projectile,
          x: origin.x + direction.x * travelDistance,
          y: origin.y + direction.y * travelDistance,
          duration: 1200,
          ease: 'Linear',
          onComplete: () => {
            const impactX = projectile.x;
            const impactY = projectile.y;
            projectile.destroy();
            this.createElementImpact(element, impactX, impactY);
          }
        });
      });
    }

    createCastingAnimation(element, x, y, direction) {
      const colors = {
        fire: 0xff8a3d,
        ice: 0x8deeff,
        water: 0x4bcfff,
        earth: 0xb58a58
      };
      const color = colors[element] || 0xc5a7ff;

      // O mago dá um pequeno impulso corporal ao canalizar a magia.
      this.tweens.add({
        targets: this.wizard,
        scaleX: 1.68,
        scaleY: 1.53,
        duration: 95,
        yoyo: true,
        ease: 'Sine.easeOut'
      });

      // Núcleo luminoso que cresce na mão e desaparece no lançamento.
      const charge = this.add.circle(x, y, 4, color, 0.72).setDepth(14);
      this.tweens.add({
        targets: charge,
        scale: 1.9,
        alpha: 0,
        duration: 240,
        ease: 'Quad.easeOut',
        onComplete: () => charge.destroy()
      });

      // Anel de energia se expandindo ao redor da mão.
      const ring = this.add.circle(x, y, 7, color, 0)
        .setStrokeStyle(1.5, color, 0.9)
        .setDepth(13);
      this.tweens.add({
        targets: ring,
        scale: 2.15,
        alpha: 0,
        duration: 270,
        ease: 'Quad.easeOut',
        onComplete: () => ring.destroy()
      });

      // Pequenas partículas acompanham o impulso na direção do disparo.
      const perpendicularX = -direction.y;
      const perpendicularY = direction.x;

      for (let i = 0; i < 5; i++) {
        const spread = (i - 2) * 3;
        const particle = this.add.circle(
          x + perpendicularX * spread,
          y + perpendicularY * spread,
          1.5,
          color,
          0.95
        ).setDepth(14);

        this.tweens.add({
          targets: particle,
          x: particle.x + direction.x * 11 + perpendicularX * spread * 0.45,
          y: particle.y + direction.y * 11 + perpendicularY * spread * 0.45,
          alpha: 0,
          scale: 0.2,
          duration: 180 + i * 18,
          ease: 'Quad.easeOut',
          onComplete: () => particle.destroy()
        });
      }
    }

    createElementProjectile(element, x, y, direction) {
      // O núcleo do projétil agora fica próximo ao tamanho da mão do mago.
      // Mantemos um rastro curto para que a magia continue legível em movimento.
      const sizes = {
        fire: [42, 19],
        ice: [38, 21],
        water: [34, 22],
        earth: [36, 21]
      };

      const [width, height] = sizes[element] || [38, 21];
      const angle = Math.atan2(direction.y, direction.x);

      return this.add.image(x, y, 'projectile-' + element)
        .setOrigin(0.5, 0.5)
        .setDisplaySize(width, height)
        .setRotation(angle)
        .setDepth(12);
    }

    createElementImpact(element, x, y) {
      const colors = {
        ice: 0x8deeff,
        fire: 0xff8a3d,
        water: 0x4bcfff,
        earth: 0xb58a58
      };

      const color = colors[element];
      const ring = this.add.circle(x, y, 8, color, 0.08)
        .setStrokeStyle(2, color, 0.9)
        .setDepth(11);

      this.tweens.add({
        targets: ring,
        scale: 2.2,
        alpha: 0,
        duration: 260,
        ease: 'Quad.easeOut',
        onComplete: () => ring.destroy()
      });
    }

    createWizard() {
      // O mago começa na origem. Não há bordas para alcançar ou atravessar.
      const startX = 0;
      const startY = 0;

      this.wizardShadow = this.add.ellipse(
        startX,
        startY + 4,
        48,
        13,
        0x05070c,
        0.42
      ).setDepth(9);

      this.wizard = this.add.sprite(startX, startY, 'wizard-front', 0)
        .setOrigin(0.5, 0.9)
        .setScale(1.6)
        .setDepth(10);
    }

    createControls() {
      // Duas opções de controle: WASD e as setas do teclado.
      this.cursors = this.input.keyboard.createCursorKeys();
      this.wasd = this.input.keyboard.addKeys('W,A,S,D');
    }

    updateWizardFacing(moveX, moveY) {
      if (moveX === 0 && moveY === 0) return;

      // Em movimentos diagonais, usamos o eixo dominante para escolher a direção.
      let nextFacing;

      if (Math.abs(moveX) > Math.abs(moveY)) {
        nextFacing = moveX < 0 ? 'left' : 'right';
      } else {
        nextFacing = moveY < 0 ? 'back' : 'front';
      }

      if (nextFacing !== this.wizardFacing) {
        this.wizardFacing = nextFacing;
        this.wizard.setTexture('wizard-' + nextFacing, 0);
      }
    }

    update(_time, delta) {
      // O personagem só fica disponível depois que os quatro sprites forem carregados.
      if (!this.wizard) return;

      // O chão acompanha o deslocamento da câmera para simular o movimento do terreno.
      this.ground.tilePositionX = this.cameras.main.scrollX;
      this.ground.tilePositionY = this.cameras.main.scrollY;

      // Antes de escolher um elemento, o jogador permanece na tela inicial.
      if (!this.selectedElement) return;

      let moveX = 0;
      let moveY = 0;

      if (this.cursors.left.isDown || this.wasd.A.isDown) moveX -= 1;
      if (this.cursors.right.isDown || this.wasd.D.isDown) moveX += 1;
      if (this.cursors.up.isDown || this.wasd.W.isDown) moveY -= 1;
      if (this.cursors.down.isDown || this.wasd.S.isDown) moveY += 1;

      // Normalizar evita que andar na diagonal seja mais rápido.
      const direction = new Phaser.Math.Vector2(moveX, moveY);

      if (direction.length() > 0) {
        direction.normalize();
        this.updateWizardFacing(moveX, moveY);

        const animationKey = 'wizard-walk-' + this.wizardFacing;

        // Não reinicia a animação a cada quadro; ela continua seu ciclo normalmente.
        if (
          !this.wizard.anims.isPlaying ||
          this.wizard.anims.currentAnim?.key !== animationKey
        ) {
          this.wizard.play(animationKey);
        }

        // delta é o tempo desde o último quadro, em milissegundos.
        const distance = PLAYER_SPEED * (delta / 1000);
        this.wizard.x += direction.x * distance;
        this.wizard.y += direction.y * distance;
      } else {
        // Parado, o mago mostra o primeiro quadro da direção em que está olhando.
        this.wizard.anims.stop();
        this.wizard.setTexture('wizard-' + this.wizardFacing, 0);
      }

      this.wizardShadow.setPosition(this.wizard.x, this.wizard.y + 4);
      this.updateEnemies(delta);
    }
  }

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game-container',
    width: VIEW_WIDTH,
    height: VIEW_HEIGHT,
    backgroundColor: '#192820',
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH
    },
    scene: [TrainingScene]
  });

  // Mantém uma referência explícita à instância durante o protótipo.
  window.arcaneGame = game;
})();
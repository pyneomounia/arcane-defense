(() => {
  // Tamanho da janela do jogo. O mundo não possui largura ou altura fixa.
  const VIEW_WIDTH = 960;
  const VIEW_HEIGHT = 540;
  const PLAYER_SPEED = 260; // pixels por segundo
  const GROUND_TILE_SIZE = 384;

  const message = document.getElementById('message');

  // Evita uma tela vazia se a biblioteca Phaser não carregar.
  if (typeof Phaser === 'undefined') {
    message.textContent = 'Não foi possível carregar o Phaser. Verifique sua conexão e atualize a página.';
    return;
  }

  class TrainingScene extends Phaser.Scene {
    constructor() {
      super('TrainingScene');
      this.wizardFacing = 'front';
      this.selectedElement = null;
      this.spellTimer = null;
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
      this.createControls();

      message.textContent = 'Carregando as animações do mago...';

      // A câmera não recebe limites: pode acompanhar o mago em qualquer direção.
      this.loadWizardAnimations()
        .then(() => {
          this.createWizardAnimations();
          this.createWizard();
          this.cameras.main.startFollow(this.wizard, true, 0.08, 0.08);
          this.bindElementSelection();
          message.textContent = 'Escolha um elemento para começar sua jornada.';
        })
        .catch(error => {
          console.error('Falha ao carregar as animações do mago:', error);
          message.textContent = 'Não foi possível carregar o mago. Atualize a página e tente novamente.';
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
      document.querySelectorAll('.element-hitbox').forEach(button => {
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

      message.textContent = 'Afinidade escolhida: ' + labels[element] + '. O mago lançará a magia a cada 1 segundo.';

      // Primeiro disparo imediato; os próximos acontecem a cada 1 segundo.
      this.castElementSpell();
      this.spellTimer = this.time.addEvent({
        delay: 1000,
        loop: true,
        callback: this.castElementSpell,
        callbackScope: this
      });
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

      const direction = this.getFacingVector();
      const startX = this.wizard.x + direction.x * 30;
      const startY = this.wizard.y - 18 + direction.y * 30;
      const projectile = this.createElementProjectile(
        this.selectedElement,
        startX,
        startY,
        direction
      );

      // Os projéteis são demonstrações visuais até existir um sistema de inimigos.
      const travelDistance = 360;
      this.tweens.add({
        targets: projectile,
        x: startX + direction.x * travelDistance,
        y: startY + direction.y * travelDistance,
        duration: 1200,
        ease: 'Linear',
        onComplete: () => {
          const impactX = projectile.x;
          const impactY = projectile.y;
          projectile.destroy();
          this.createElementImpact(this.selectedElement, impactX, impactY);
        }
      });
    }

    createElementProjectile(element, x, y, direction) {
      // As imagens já incluem brilho, núcleo e rastro, como na arte da seleção.
      // Todas apontam para a direita; a rotação acompanha a direção do mago.
      const sizes = {
        fire: [150, 68],
        ice: [150, 83],
        water: [150, 98],
        earth: [150, 86]
      };

      const [width, height] = sizes[element] || [150, 80];
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
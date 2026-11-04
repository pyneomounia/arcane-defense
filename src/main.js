(() => {
  // Tamanho da janela do jogo e tamanho total do mundo.
  const VIEW_WIDTH = 960;
  const VIEW_HEIGHT = 540;
  const WORLD_WIDTH = 1800;
  const WORLD_HEIGHT = 1200;
  const PLAYER_SPEED = 260; // pixels por segundo

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
    }

    create() {
      this.drawWorld();
      this.createControls();

      this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
      message.textContent = 'Carregando as animações do mago...';

      // As imagens são montadas a partir dos dados carregados no preload.
      this.loadWizardAnimations()
        .then(() => {
          this.createWizardAnimations();
          this.createWizard();
          this.cameras.main.startFollow(this.wizard, true, 0.08, 0.08);
          message.textContent = 'Treino 01: caminhe pela arena e explore o cenário.';
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

    drawWorld() {
      const background = this.add.graphics();

      background.fillStyle(0x111a2a, 1);
      background.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

      // Grade visual para ajudar a perceber o movimento.
      background.lineStyle(1, 0x293750, 0.48);

      const gridSize = 60;

      for (let x = 0; x <= WORLD_WIDTH; x += gridSize) {
        background.lineBetween(x, 0, x, WORLD_HEIGHT);
      }

      for (let y = 0; y <= WORLD_HEIGHT; y += gridSize) {
        background.lineBetween(0, y, WORLD_WIDTH, y);
      }

      // Borda da arena.
      background.lineStyle(5, 0x66789b, 0.8);
      background.strokeRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

      // Alguns círculos no chão servem como referências de distância.
      background.lineStyle(2, 0x40516d, 0.38);
      background.strokeCircle(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, 180);
      background.strokeCircle(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, 360);

      this.add.text(35, 30, 'ARENA DE TREINAMENTO', {
        fontFamily: 'Arial',
        fontSize: '15px',
        color: '#8d9dbb',
        letterSpacing: 3
      });
    }

    createWizard() {
      const startX = WORLD_WIDTH / 2;
      const startY = WORLD_HEIGHT / 2;

      // Sombra separada para manter o mago visualmente ligado ao chão.
      this.wizardShadow = this.add.ellipse(
        startX,
        startY + 4,
        48,
        13,
        0x05070c,
        0.42
      ).setDepth(9);

      // Sprite animado com oito quadros por direção.
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

      // Impede que o personagem saia dos limites do mundo.
      const margin = 55;
      this.wizard.x = Phaser.Math.Clamp(
        this.wizard.x,
        margin,
        WORLD_WIDTH - margin
      );
      this.wizard.y = Phaser.Math.Clamp(
        this.wizard.y,
        margin,
        WORLD_HEIGHT - margin
      );

      this.wizardShadow.setPosition(this.wizard.x, this.wizard.y + 4);
    }
  }

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game-container',
    width: VIEW_WIDTH,
    height: VIEW_HEIGHT,
    backgroundColor: '#111a2a',
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH
    },
    scene: [TrainingScene]
  });

  // Mantém uma referência explícita à instância durante o protótipo.
  window.arcaneGame = game;
})();
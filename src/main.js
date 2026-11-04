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
    }

    preload() {
      // Carrega os dados compactados do personagem.
      this.load.json('wizardSpriteData', 'assets/characters/wizard/wizard-sprite.json');
    }

    create() {
      this.createWizardTextures();
      this.drawWorld();
      this.createWizard();
      this.createControls();

      // Define os limites da câmera e faz ela acompanhar o mago.
      this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
      this.cameras.main.startFollow(this.wizard, true, 0.08, 0.08);

      message.textContent = 'Treino 01: caminhe pela arena e explore o cenário.';
    }

    createWizardTextures() {
      const spriteData = this.cache.json.get('wizardSpriteData');

      if (!spriteData || spriteData.format !== 'arcane-pixel-indexed-4bit-v1') {
        throw new Error('Os dados do personagem não foram carregados corretamente.');
      }

      // O desenho foi salvo como índices de uma paleta de cores.
      // Dois pixels ocupam um byte, reduzindo bastante o tamanho do arquivo.
      const binary = window.atob(spriteData.pixels);
      const packedPixels = new Uint8Array(binary.length);

      for (let i = 0; i < binary.length; i++) {
        packedPixels[i] = binary.charCodeAt(i);
      }

      const frameWidth = spriteData.frameWidth;
      const frameHeight = spriteData.frameHeight;
      const pixelsPerFrame = frameWidth * frameHeight;
      const expectedBytes = (pixelsPerFrame * spriteData.frameCount) / 2;

      if (packedPixels.length !== expectedBytes) {
        throw new Error('O arquivo do personagem está incompleto.');
      }

      // Cada direção vira uma textura própria do Phaser.
      spriteData.frameOrder.forEach((direction, frameIndex) => {
        const canvas = document.createElement('canvas');
        canvas.width = frameWidth;
        canvas.height = frameHeight;

        const context = canvas.getContext('2d');
        const frameImage = context.createImageData(frameWidth, frameHeight);

        for (let pixel = 0; pixel < pixelsPerFrame; pixel++) {
          const globalPixel = frameIndex * pixelsPerFrame + pixel;
          const packedByte = packedPixels[Math.floor(globalPixel / 2)];
          const paletteIndex = globalPixel % 2 === 0
            ? (packedByte >> 4) & 0x0f
            : packedByte & 0x0f;

          const offset = pixel * 4;

          if (paletteIndex === spriteData.transparentIndex) {
            frameImage.data[offset + 3] = 0;
            continue;
          }

          const color = spriteData.palette[paletteIndex];
          frameImage.data[offset] = color[0];
          frameImage.data[offset + 1] = color[1];
          frameImage.data[offset + 2] = color[2];
          frameImage.data[offset + 3] = 255;
        }

        context.putImageData(frameImage, 0, 0);
        context.imageSmoothingEnabled = false;
        this.textures.addCanvas('wizard-' + direction, canvas);
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

      // O personagem agora usa o pixel art extraído da referência visual.
      // As quatro imagens representam frente, esquerda, direita e costas.
      this.wizardFacing = 'front';
      this.wizard = this.add.image(startX, startY, 'wizard-front')
        .setOrigin(0.5, 0.82)
        .setScale(1.8)
        .setDepth(10);
    }

    createControls() {
      // Duas opções de controle: WASD e as setas do teclado.
      this.cursors = this.input.keyboard.createCursorKeys();
      this.wasd = this.input.keyboard.addKeys('W,A,S,D');
    }

    updateWizardFacing(moveX, moveY) {
      if (moveX === 0 && moveY === 0) return;

      // Em movimentos diagonais, usamos o eixo dominante para escolher a pose.
      let nextFacing;

      if (Math.abs(moveX) > Math.abs(moveY)) {
        nextFacing = moveX < 0 ? 'left' : 'right';
      } else {
        nextFacing = moveY < 0 ? 'back' : 'front';
      }

      if (nextFacing !== this.wizardFacing) {
        this.wizardFacing = nextFacing;
        this.wizard.setTexture('wizard-' + nextFacing);
      }
    }

    update(_time, delta) {
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

        // delta é o tempo desde o último quadro, em milissegundos.
        // Multiplicamos pela velocidade para manter o movimento consistente.
        const distance = PLAYER_SPEED * (delta / 1000);

        this.wizard.x += direction.x * distance;
        this.wizard.y += direction.y * distance;
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
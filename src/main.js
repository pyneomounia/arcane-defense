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

    create() {
      this.drawWorld();
      this.createWizard();
      this.createControls();

      // Define os limites da câmera e faz ela acompanhar o mago.
      this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
      this.cameras.main.startFollow(this.wizard, true, 0.08, 0.08);

      message.textContent = 'Treino 01: caminhe pela arena e explore o cenário.';
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

      // Por enquanto, o personagem é feito com formas simples do Phaser.
      // Depois podemos substituir essas formas por uma imagem ou animação.
      this.wizard = this.add.container(startX, startY);

      const shadow = this.add.ellipse(0, 18, 34, 14, 0x05070c, 0.42);
      const robe = this.add.ellipse(0, 9, 29, 34, 0x514080);
      const robeTrim = this.add.ellipse(0, 13, 21, 23, 0x7560b0);
      const hood = this.add.circle(0, -13, 15, 0x37294f);
      const face = this.add.circle(0, -11, 9, 0xe5bd94);
      const staff = this.add.rectangle(19, 5, 4, 43, 0x96704d).setAngle(18);
      const staffGem = this.add.circle(26, -17, 6, 0x8be4ff).setStrokeStyle(2, 0xd8f8ff);
      const title = this.add.text(0, 37, 'MAGO', {
        fontFamily: 'Arial',
        fontSize: '10px',
        color: '#e4d8ff',
        letterSpacing: 2
      }).setOrigin(0.5, 0);

      this.wizard.add([
        shadow,
        staff,
        robe,
        robeTrim,
        hood,
        face,
        staffGem,
        title
      ]);

      this.wizard.setDepth(10);
    }

    createControls() {
      // Duas opções de controle: WASD e as setas do teclado.
      this.cursors = this.input.keyboard.createCursorKeys();
      this.wasd = this.input.keyboard.addKeys('W,A,S,D');
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

        // delta é o tempo desde o último quadro, em milissegundos.
        // Multiplicamos pela velocidade para manter o movimento consistente.
        const distance = PLAYER_SPEED * (delta / 1000);

        this.wizard.x += direction.x * distance;
        this.wizard.y += direction.y * distance;
      }

      // Impede que o personagem saia dos limites do mundo.
      const margin = 24;
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
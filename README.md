# Arcane Survival

Protótipo de um jogo de sobrevivência com tema de mago e progressão elemental.

## Etapa atual: movimentação e animação do personagem

Nesta etapa, o objetivo é aprender o básico do Phaser:
- Criar uma cena e desenhar um cenário.
- Carregar spritesheets em WebP.
- Criar animações com oito quadros por direção.
- Ler entradas do teclado (WASD e setas).
- Mover o personagem com velocidade baseada no tempo.
- Alternar entre animações de frente, costas, esquerda e direita.
- Voltar à pose parada quando o jogador solta as teclas.
- Fazer a câmera acompanhar o personagem.
- Restringir o personagem aos limites do mundo.

## Como jogar

- **W, A, S, D:** movimentar o mago.
- **Setas:** alternativa para movimentação.

## Estrutura

- `index.html`: página e elementos da interface.
- `src/style.css`: estilos da página.
- `src/main.js`: cena, cenário, personagem, teclado, animações e câmera.
- `assets/characters/wizard/wizard-walk-front.webp`: caminhada de frente.
- `assets/characters/wizard/wizard-walk-back.webp`: caminhada de costas.
- `assets/characters/wizard/wizard-walk-left.webp`: caminhada para a esquerda.
- `assets/characters/wizard/wizard-walk-right.webp`: caminhada para a direita.

As animações usam oito quadros por direção, a 10 quadros por segundo. O sprite continua parado no primeiro quadro da direção atual quando o jogador solta o teclado.

## Próximas etapas

1. Adicionar inimigos que perseguem o jogador.
2. Criar a primeira magia automática.
3. Adicionar vida, dano e experiência.
4. Criar escolhas de evolução.
5. Desenvolver as escolas elementais: fogo, água, terra e raio.
# Arcane Survival

Protótipo de um jogo de sobrevivência com tema de mago e progressão elemental.

## Etapa atual: mundo sem bordas

Nesta etapa, o objetivo é aprender como criar um mundo que parece infinito:
- Criar uma textura procedural de chão com uma semente fixa.
- Repetir essa textura com um TileSprite do Phaser.
- Prender o chão à câmera e deslocar o padrão conforme o jogador anda.
- Remover limites fixos da câmera e do mapa.
- Manter o controle, a velocidade e a animação do mago.

O chão atual é um padrão pixelado de terra, musgo e pequenos fragmentos de pedra. Ele é desenhado uma vez no navegador e repetido sem emendas. Não existe uma imagem de mapa gigante nem uma borda para alcançar.

## Como jogar

- **W, A, S, D:** movimentar o mago.
- **Setas:** alternativa para movimentação.
- Caminhe em qualquer direção: a câmera acompanha o personagem e o chão continua.

## Estrutura

- `index.html`: página e elementos da interface.
- `src/style.css`: estilos da página.
- `src/main.js`: cena, chão procedural, personagem, teclado, animações e câmera.
- `assets/characters/wizard/wizard-walk-front.webp`: caminhada de frente.
- `assets/characters/wizard/wizard-walk-back.webp`: caminhada de costas.
- `assets/characters/wizard/wizard-walk-left.webp`: caminhada para a esquerda.
- `assets/characters/wizard/wizard-walk-right.webp`: caminhada para a direita.

## Próxima evolução do mapa

A repetição do chão resolve a continuidade visual. Em uma próxima etapa, podemos gerar blocos (*chunks*) ao redor do jogador com árvores, pedras, ruínas e outros elementos. Cada bloco poderá usar uma semente baseada em sua coordenada, fazendo com que o mundo seja consistente mesmo quando o jogador voltar a uma região.

## Próximas etapas do jogo

1. Adicionar elementos do cenário e obstáculos.
2. Adicionar inimigos que perseguem o jogador.
3. Criar a primeira magia automática.
4. Adicionar vida, dano e experiência.
5. Criar escolhas de evolução e as escolas elementais: fogo, água, terra e raio.

As animações do mago usam oito quadros por direção, a 10 quadros por segundo. Quando o jogador solta o teclado, o personagem volta à pose parada da direção atual.
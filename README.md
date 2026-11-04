# Arcane Survival

Protótipo de um jogo de sobrevivência com tema de mago e progressão elemental.

## Etapa atual: movimentação e personagem

Nesta etapa, o objetivo é aprender o básico do Phaser:
- Criar uma cena e desenhar um cenário.
- Carregar um recurso visual do personagem.
- Ler entradas do teclado (WASD e setas).
- Mover o personagem com velocidade baseada no tempo.
- Alterar a pose do mago conforme a direção do movimento.
- Fazer a câmera acompanhar o personagem.
- Restringir o personagem aos limites do mundo.

## Como jogar

Abra a página publicada ou execute o projeto por um servidor local.

- **W, A, S, D:** movimentar o mago.
- **Setas:** alternativa para movimentação.

## Estrutura

- `index.html`: página e elementos da interface.
- `src/style.css`: estilos da página.
- `src/main.js`: cena, cenário, personagem, teclado e câmera.
- `assets/characters/wizard/wizard-sprite.json`: arte pixelada do mago em quatro direções.

## Sobre o personagem

O mago usa um visual provisório em pixel art: capuz roxo, detalhes dourados, manto e gema azul. Nesta versão há uma pose para cada direção; a animação de caminhada será adicionada em uma etapa posterior.

## Próximas etapas

1. Adicionar inimigos que perseguem o jogador.
2. Criar a primeira magia automática.
3. Adicionar vida, dano e experiência.
4. Criar escolhas de evolução.
5. Desenvolver as escolas elementais: fogo, água, terra e raio.
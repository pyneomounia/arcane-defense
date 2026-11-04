# Arcane Survival

Protótipo de um jogo de sobrevivência com tema de mago e progressão elemental.

## Etapa atual: seleção em pixel art e projéteis elementais

A tela inicial usa uma composição pixel art completa, com quatro áreas de seleção sobre os botões desenhados: Fogo, Gelo, Água e Terra. Ao escolher, a composição desaparece e a arena começa.

Cada magia usa uma imagem pixel art própria, incluindo brilho e rastro:
- **Fogo:** chama alongada com núcleo incandescente.
- **Gelo:** cristal azul luminoso.
- **Água:** orbe azul com corrente e partículas.
- **Terra:** projétil rochoso com fragmentos.

O mago dispara imediatamente após a escolha e repete a cada 1 segundo. Os projéteis percorrem 360 pixels em 1,2 segundo, com velocidade constante, girando para acompanhar a direção em que o mago está olhando.

Ainda não existe colisão ou dano: os projéteis são visuais e atravessam a arena.

## Mundo e controles

O chão é uma textura procedural repetida, sem bordas fixas.
- **W, A, S, D:** movimentar o mago.
- **Setas:** alternativa para movimentação.

## Estrutura

- `index.html`: página, HUD e áreas clicáveis da seleção inicial.
- `src/style.css`: layout da arena e tela inicial.
- `src/main.js`: cena, chão procedural, personagem, seleção, animações e disparos.
- `assets/ui/element-selection.webp`: arte completa da seleção inicial.
- `assets/projectiles/`: sprites das quatro magias.
- `assets/characters/wizard/`: sprites do mago.

## Próximas etapas

1. Adicionar inimigos que perseguem o jogador.
2. Fazer as magias causarem dano e reagirem aos inimigos.
3. Adicionar vida, experiência e evolução.
4. Criar melhorias e combinações elementais.
5. Expandir o cenário com objetos e blocos (*chunks*).
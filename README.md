# Arcane Survival

Protótipo de um jogo de sobrevivência com tema de mago e progressão elemental.

## Etapa atual: seleção elemental e magias iniciais

A tela inicial apresenta quatro afinidades em cartões com arte pixelada:
- **Gelo:** projétil cristalino azul-claro.
- **Fogo:** esfera incandescente com cauda de chama.
- **Água:** orbe aquático com bolhas.
- **Terra:** fragmento rochoso angular.

Depois da escolha, o mago lança automaticamente a magia selecionada:
- Primeiro disparo imediato.
- Próximos disparos a cada 1 segundo.
- Cada projétil percorre a arena a uma velocidade menor (360 pixels em 1,2 segundo).
- A magia segue a última direção cardinal para a qual o mago está olhando.

Como ainda não existe sistema de inimigos, os projéteis são demonstrações visuais e atravessam a arena. O objetivo desta etapa é validar a seleção elemental, a cadência e a aparência das magias.

## Mundo e controles

O chão é uma textura procedural repetida, sem bordas fixas.
- **W, A, S, D:** movimentar o mago.
- **Setas:** alternativa para movimentação.

## Estrutura

- `index.html`: página, HUD e seleção de elemento.
- `src/style.css`: estilos da interface pixel art.
- `src/main.js`: cena, chão procedural, personagem, animações, seleção elemental e projéteis.
- `assets/elemental/`: ilustrações pixel art das quatro afinidades.
- `assets/characters/wizard/`: sprites do mago.

## Próximas etapas

1. Adicionar inimigos que perseguem o jogador.
2. Fazer as magias causarem dano e reagirem aos inimigos.
3. Adicionar vida, experiência e evolução.
4. Criar melhorias e combinações elementais.
5. Expandir o cenário com objetos e blocos (*chunks*).
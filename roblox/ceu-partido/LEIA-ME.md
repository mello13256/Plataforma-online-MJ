# Céu Partido — versão Roblox

RPG de ação souls-like, cooperativo até 4 jogadores, passado num arquipélago de ilhas flutuantes.

## Abrir e testar

1. Descarrega **`CeuPartido.rbxlx`** e abre-o no **Roblox Studio** (*File → Open from File*).
2. Carrega em **Play** (F5). O servidor demora alguns segundos a erguer as ilhas (aparece «A erguer as ilhas…»).
3. Para testar o cooperativo: separador **Test → Clients and Servers**, escolhe 2 a 4 jogadores e carrega em **Start**.
4. Se algo falhar, a janela **Output** (*View → Output*) mostra o erro. Envia-o para o corrigirmos.

## Publicar

1. *File → Publish to Roblox* e dá um nome à experiência.
2. Em *Game Settings → Places*, põe o tamanho do servidor (**Server Size**) em **4**.
3. Para o progresso ficar guardado: *Game Settings → Security → Enable Studio Access to API Services* (o jogo usa DataStore).
   Sem isto, o jogo funciona na mesma, mas o progresso só dura a sessão.
4. O avatar é forçado a **R15** (as animações do jogo são feitas por código sobre o esqueleto R15).

## O jogo

- **Mundo**: 9 ilhas flutuantes sobre um mar de nuvens — Ilha do Despertar, Jardins Suspensos, Pináculos da Ventania,
  Observatório Partido, Limiar da Tempestade, Olho da Tempestade e um Refúgio secreto — ligadas por pontes e **correntes de vento**.
  Salta e carrega outra vez no salto, no ar, para **planar**. Cair nas nuvens é morte certa.
- **Combate exigente**: ataques leves em combo e fortes, bloqueio com escudo, esquiva com invulnerabilidade, energia,
  equilíbrio (atordoar inimigos) e fixar alvo. Três armas: Lâmina dos Ventos, Martelo Celeste e Lança do Horizonte.
- **Faróis**: acendê-los e descansar enche a vida e o **Orvalho Celeste** (cura), mas faz regressar os inimigos.
  Junto a um farol podes **subir de nível** (Vigor, Fôlego, Força) e **viajar** para outros faróis acesos.
- **Morte**: o teu **Éter** fica num **Eco** onde caíste — volta lá para o recuperar.
- **Chefes** atrás de barreiras de vento: *Ormund, o Guardião de Pedra* e *Tempestor, o Coração Partido* (com segunda fase de raios).
  A vida dos chefes aumenta com o número de jogadores na arena; todos os que participam recebem o Éter.

## Controlos

| Ação | Teclado e rato | Comando |
| --- | --- | --- |
| Mover / saltar | WASD / Espaço | Manípulo esq. / A |
| Planar (no ar) | Espaço outra vez | A outra vez |
| Ataque leve / forte | Botão esquerdo / F | RB / RT |
| Bloquear | Botão direito | LB |
| Esquivar / correr | Shift (tocar / manter) | B (tocar / manter) |
| Orvalho (curar) | R | X |
| Fixar alvo | Q ou botão do meio | R3 |
| Trocar de arma | X | Cruz para cima |
| Interagir | E | Y |
| Ajuda | H | — |

No telemóvel aparecem botões no ecrã.

## Para programadores

O código está em `src/` e é montado com [Rojo](https://rojo.space):

```
src/compartilhado/   Config (ilhas, armas, inimigos, faróis) e Poses (animações)   → ReplicatedStorage
src/servidor/        Main, Mundo (terreno), Personagens, Jogadores, Inimigos, Dados  → ServerScriptService
src/cliente/         Main, Camara, Controles, Animador, Hud, Efeitos                 → StarterPlayerScripts
src/personagem/      substitui as animações e a regeneração padrão do Roblox        → StarterCharacterScripts
```

`rojo build -o CeuPartido.rbxlx` gera o ficheiro do Studio; `rojo serve` sincroniza o código com o Studio em tempo real.

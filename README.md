# Jogos MJ — plataforma de jogos online

Site para publicarmos os nossos jogos e qualquer pessoa os jogar diretamente no browser.
Toda a interface está em **português de Portugal**.

Funciona 100% no plano gratuito do Firebase (Spark):

- **Firebase Hosting** — aloja o site e os ficheiros dos jogos;
- **Firebase Authentication** — início de sessão dos autores (email e palavra-passe);
- **Cloud Firestore** — títulos, descrições, categorias, visibilidade e contador de jogadas;
- **GitHub Actions** — sempre que há alterações no repositório, o site é republicado automaticamente.

## Funcionalidades

**Para quem joga (sem conta, como convidado):**
- Página inicial com jogo em destaque, **pesquisa instantânea**, categorias e ordenação (recentes, mais jogados, **mais gostados**).
- **Continuar a jogar** e **Os teus favoritos** (guardados no browser de cada pessoa).
- Página do jogo: jogar no browser (com ecrã inteiro) e/ou transferir, **gostos ❤**, **partilhar**,
  **galeria de imagens** com ampliação, **comentários** e jogos semelhantes.
- Selos **Novo** (primeira semana) e **Atualizado**.
- Tema claro por omissão, com tema escuro opcional. **Instalável como app** no telemóvel e no computador.

**Para os autores:**
- Publicar arrastando o jogo (pasta, `.zip`, `.html`) e as transferências (`.exe`, `.apk`…), com teste antes de publicar.
- Capa e até 4 imagens de galeria arrastadas; categoria livre.
- Visibilidade de cada jogo: **Público** ou **Privado** (só administradores e o próprio autor).
- Apagar comentários dos próprios jogos.

**Para o administrador (`/admin`):**
- Estatísticas (jogos, jogadas, gostos, autores) e **espaço usado** face ao limite gratuito de 1 GB.
- Todos os jogos com filtro (incluindo públicos/privados), **editar, transferir em .zip** e remover — também os jogos dos outros autores; criar contas; permissões de cada utilizador.
- Fila **Privados** na página inicial, visível apenas para administradores.

## Jogos incluídos no repositório

### Cinzas de Valdoria — RPG souls-like 3D de mundo aberto

[`jogos/cinzas-de-valdoria/`](jogos/cinzas-de-valdoria/) é um RPG de ação para um jogador, inspirado em *Dark Souls* e *Elden Ring*,
que corre diretamente no browser (Three.js, sem instalar nada). Tudo é gerado por código: terreno, texturas, árvores, personagens, animações e sons.

- **Mundo aberto** de 1,4 × 1,4 km com 6 regiões: Cemitério das Cinzas, Planície Esquecida, Pântano dos Afogados,
  Ruínas de Aldermoor, Estrada dos Reis e Fortaleza do Rei Caído — com montanhas, lagos, relva ao vento, nevoeiro e a Árvore Áurea no horizonte.
- **Combate souls-like**: ataques leves em combo e fortes, bloqueio com escudo, rolamentos com invulnerabilidade, energia,
  equilíbrio (atordoar inimigos), fixar alvo, frasco de cura e três armas (espada longa, machado de guerra, espadão).
- **Primeira pessoa** (por omissão): braços com manoplas articuladas, braçal de placas e malha de aço, espada, machado e espadão
  detalhados, escudo pintado e frasco a brilhar — animados para cada golpe, bloqueio, gole, rolamento e queda, com rasto da lâmina.
  O corpo continua a projetar sombra. A terceira pessoa continua disponível nas Opções.
- **Mundo**: pinheiros e árvores douradas com folhagem, arbustos, fetos, troncos caídos, juncos e nenúfares no pântano turvo;
  estátuas gigantes de pedra, círculo de menires, cripta, forca, carroças, atalaia, torre de menagem e lanternas ao longo dos caminhos.
- **Níveis de detalhe**: quanto mais longe do jogador, mais simples ficam árvores, vegetação, sombras e inimigos;
  a distância ajusta-se em Opções → Distância de detalhe (sem recarregar).
- **Fogueiras**: acender, descansar (os inimigos regressam), subir de nível (Vitalidade, Resistência, Força) e viajar entre fogueiras.
- **Morte**: as almas ficam no local onde morreste — volta lá para as recuperar antes de morreres outra vez.
- **Inimigos** com armaduras de placas, malha de aço, brasões pintados, trapos rasgados e pelo — esvaziados, lobos sombrios, cavaleiros caídos e dois chefes — *Fenrath, o Lobo Ancestral* e
  *Valdor, o Rei Caído* (atrás de uma porta de nevoeiro, com segunda fase em chamas).
- Mapa, bússola, mensagens no chão, gravação automática no browser, teclado e rato, **comando** e controlos táteis.
- Opções de câmara (primeira/terceira pessoa), qualidade gráfica (baixa/média/alta), sensibilidade, volume e eixo invertido.

Para o publicar no site: **Painel → Publicar jogo → Pasta do GitHub** e escolher `cinzas-de-valdoria` (a capa é detetada automaticamente).
A pasta está reservada à conta do dono da plataforma (`jogos/reservas.json` e `firestore.rules`): as outras contas não a veem no painel
e a base de dados recusa qualquer jogo delas que use esta pasta ou uma ligação para os mesmos ficheiros.

Para o experimentar localmente: `npx serve jogos/cinzas-de-valdoria` (ou qualquer servidor estático) e abrir o endereço indicado.
O código está em `jogos/cinzas-de-valdoria/js/` (um módulo por área: `mundo.js`, `folhagem.js`, `atores.js`, `modelos.js`, `primeira-pessoa.js`, `principal.js`…).

### Céu Partido — versão Roblox

[`roblox/ceu-partido/`](roblox/ceu-partido/) é a versão para Roblox: ilhas flutuantes, combate souls-like exigente e cooperativo até 4 jogadores.
Abre `roblox/ceu-partido/CeuPartido.rbxlx` no Roblox Studio — instruções em [`roblox/ceu-partido/LEIA-ME.md`](roblox/ceu-partido/LEIA-ME.md).

## Cópias de segurança

Antes de grandes alterações é guardada uma cópia do código num ramo `backup/AAAA-MM-DD` no GitHub
(ex.: [`backup/2026-10-03`](https://github.com/mello13256/Plataforma-online-MJ/tree/backup/2026-10-03)).
Para voltar a essa versão, pede para repor o ramo principal a partir desse ramo.

---

## Onde está o site

- **Site:** <https://plataforma-web-mj.web.app>
- **Projeto Firebase:** `plataforma-web-mj` (plano gratuito Spark) — <https://console.firebase.google.com/project/plataforma-web-mj>
- **Publicação:** cada alteração no ramo principal do GitHub republica o site (separador **Actions**).
  O GitHub identifica-se no Google sem chaves (Workload Identity Federation): só este repositório tem autorização.

## Utilizadores e permissões

O dono da plataforma (Miguel) é sempre administrador. Em **Administração → Utilizadores** escolhe-se o que cada pessoa pode fazer:

| Permissão | O que permite |
| --- | --- |
| Publicar jogos | Publicar jogos novos e editar/eliminar os próprios |
| Editar jogos de todos | Alterar jogos de outros autores |
| Eliminar jogos de todos | Remover jogos de outros autores |
| Administrador | Tudo o que está acima + gerir utilizadores e permissões |

**Criar uma conta:** em **Administração → Utilizadores → Criar conta**, indica o email, o nome e as permissões.
A palavra-passe inicial é gerada automaticamente (podes mudá-la). A conta fica logo ativa e aparece uma mensagem
pronta a copiar e enviar à pessoa, que depois muda a palavra-passe em **A minha conta**.

**Remover alguém:** botão **Remover** na mesma página (os jogos dessa pessoa continuam publicados).

---

## Publicar um jogo

Tudo é feito no site, em **Painel → Publicar jogo**:

1. **Arrasta o jogo** para a zona «O jogo»: a pasta exportada para Web, um `.zip` ou um `.html` (até 50 MB).
   O título é preenchido a partir do nome e, se o jogo tiver uma imagem `capa.png`/`cover.png` (ou o `index.png` do Godot), passa a ser a capa.
2. Carrega em **Testar** para jogar antes de publicar.
3. Para jogos que se instalam, arrasta o `.exe`, `.apk`, `.zip`… para **Transferências** (até 50 MB cada),
   ou escolhe **Só para transferir**. Ficheiros maiores: usa os [Releases do GitHub](https://github.com/mello13256/Plataforma-online-MJ/releases/new) e adiciona a ligação.
4. Escolhe a categoria (ou escreve outra), arrasta uma capa se quiseres e carrega em **Publicar jogo**.

Os ficheiros carregados ficam guardados no Firestore em blocos de ~900 KB e são servidos por um *service worker* (`site/sw.js`),
que os guarda em cache no browser de quem joga.

Alternativas (separador ao lado de «Carregar ficheiros»):
- **Ligação externa** — jogo alojado noutro site (ex.: endereço de incorporação do itch.io).
- **Pasta do GitHub** — para jogos com mais de 50 MB: coloca a pasta (ou `.zip`) em [`jogos/`](jogos/) no GitHub;
  1 a 2 minutos depois aparece na lista.

| Motor | Como exportar |
| --- | --- |
| **Godot 4** | *Projeto → Exportar → Web*, com «Thread Support» desativado. Comprime a pasta exportada em `.zip`. |
| **Unity** | *Build Settings → WebGL*. Em *Player Settings → Publishing Settings*, põe **Compression Format: Disabled** (o Firebase já comprime). |
| **GameMaker** | Exporta para *HTML5/GX.games* e comprime a pasta em `.zip`. |
| **Construct / Phaser / JavaScript** | Comprime a pasta que tem o `index.html` em `.zip`. |
| **Scratch** | Usa o [TurboWarp Packager](https://packager.turbowarp.org/) para gerar um `.html` e põe-no numa pasta. |

Para jogos que não estão no repositório (ex.: no itch.io), escolhe **Ligação externa** e cola o endereço de incorporação.

### Limites do plano gratuito

- Jogos e transferências carregados no site: até **50 MB por ficheiro**. Firestore gratuito: **1 GB** de espaço e **10 GB/mês** de tráfego
  (cada pessoa transfere o jogo uma vez; depois fica em cache no browser).
- Pasta `jogos/` pelo site do GitHub: até **25 MB por ficheiro** (com o GitHub Desktop, até 100 MB). Os Releases aceitam até 2 GB.
- Firebase Hosting (Spark): **10 GB** de armazenamento e **360 MB por dia** de tráfego.
  Jogos pequenos (Godot, Phaser, GameMaker) aguentam muitas jogadas por dia; jogos Unity grandes gastam a quota depressa.
  Se for preciso, o plano Blaze cobra só o que passar da quota gratuita.

---

## Para programadores

```bash
npm install
npm test         # testes do script de preparação e das regras do Firestore (precisa de Java 21)
npm run local    # site em http://localhost:5000 com os emuladores do Firebase
```

```
site/                páginas, CSS e JavaScript do site
  js/firebase.js     ligação ao Firebase (em localhost usa os emuladores)
  js/comum.js        topo, rodapé e funções partilhadas
jogos/               ficheiros dos jogos (pastas ou .zip)
capas/               imagens de capa opcionais
scripts/preparar-site.mjs   gera a pasta publicar/ e o índice de jogos do repositório
firestore.rules      regras de segurança da base de dados
firebase.json        configuração do Hosting (endereços, cabeçalhos)
.github/workflows/publicar.yml   publicação automática
```

### Segurança

- Cada ação é verificada pelas regras do Firestore conforme as permissões do utilizador; o dono nunca perde a administração.
- Jogos privados só são visíveis para administradores e para o autor; os convidados só podem somar +1 ao contador de jogadas.
- Contas novas só ganham acesso quando o administrador lhes atribui um perfil; uma conta sem perfil vê o mesmo que um convidado.
- As regras validam todos os campos (categorias, tamanhos, caminhos e ligações `http(s)`).
- Os jogos do repositório correm no mesmo domínio do site. Como só quem tem acesso ao repositório os pode adicionar, isto é seguro — não dês acesso ao repositório a quem não confias.

# Jogos MJ — plataforma de jogos online

Site para publicarmos os nossos jogos e qualquer pessoa os jogar diretamente no browser.
Toda a interface está em **português de Portugal**.

Funciona 100% no plano gratuito do Firebase (Spark):

- **Firebase Hosting** — aloja o site e os ficheiros dos jogos;
- **Firebase Authentication** — início de sessão dos autores (email e palavra-passe);
- **Cloud Firestore** — títulos, descrições, categorias, rascunhos e contador de jogadas;
- **GitHub Actions** — sempre que há alterações no repositório, o site é republicado automaticamente.

## Funcionalidades

- Página inicial com pesquisa, categorias e ordenação (mais recentes / mais jogados).
- Página de cada jogo com leitor integrado, ecrã inteiro, «Como jogar», contador de jogadas e mais jogos do autor.
- Página de autor (`/autor/<utilizador>`).
- Painel de autor: publicar, editar, eliminar e guardar jogos como rascunho.
- Os jogos ficam na pasta [`jogos/`](jogos/) do repositório (pastas ou `.zip`), ou podem ser uma ligação externa (ex.: itch.io).
- Sem registo público: só as contas que criarem na consola do Firebase conseguem publicar.

---

## Onde está o site

- **Site:** <https://plataforma-web-mj.web.app>
- **Projeto Firebase:** `plataforma-web-mj` (plano gratuito Spark) — <https://console.firebase.google.com/project/plataforma-web-mj>
- **Publicação:** cada alteração no ramo principal do GitHub republica o site (separador **Actions**).
  O GitHub identifica-se no Google sem chaves (Workload Identity Federation): só este repositório tem autorização.

### Adicionar um autor

O registo público está desligado: as contas são criadas na consola.

1. **Authentication → Utilizadores → Adicionar utilizador** (email e palavra-passe) e copia o **UID**.
2. **Firestore Database → coleção `autores` → Adicionar documento**:
   - **ID do documento**: o UID;
   - campo `nome` (string): o nome que aparece no site, ex.: `Mello`;
   - campo `utilizador` (string): nome curto sem espaços, usado em `/autor/...`, ex.: `mello`.

Cada autor pode depois mudar o nome e a palavra-passe em **Painel → A minha conta**.

---

## Publicar um jogo

1. **Exporta o jogo para HTML5/Web** (ver tabela abaixo).
2. No GitHub, abre a pasta [`jogos/`](jogos/) → **Add file → Upload files** → arrasta a pasta do jogo ou o `.zip` → **Commit changes**.
   Se quiseres capa, põe um `capa.png` dentro do jogo (ou uma imagem na pasta [`capas/`](capas/)).
3. Espera 1 a 3 minutos (podes acompanhar em **Actions**).
4. No site, entra em **Painel → Publicar novo jogo**, escolhe o jogo na lista, preenche o título e a descrição e publica.

| Motor | Como exportar |
| --- | --- |
| **Godot 4** | *Projeto → Exportar → Web*, com «Thread Support» desativado. Comprime a pasta exportada em `.zip`. |
| **Unity** | *Build Settings → WebGL*. Em *Player Settings → Publishing Settings*, põe **Compression Format: Disabled** (o Firebase já comprime). |
| **GameMaker** | Exporta para *HTML5/GX.games* e comprime a pasta em `.zip`. |
| **Construct / Phaser / JavaScript** | Comprime a pasta que tem o `index.html` em `.zip`. |
| **Scratch** | Usa o [TurboWarp Packager](https://packager.turbowarp.org/) para gerar um `.html` e põe-no numa pasta. |

Para jogos que não estão no repositório (ex.: no itch.io), escolhe **Ligação externa** e cola o endereço de incorporação.

### Limites do plano gratuito

- Upload pelo site do GitHub: até **25 MB por ficheiro** (com o GitHub Desktop, até 100 MB).
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

- Só quem tem documento em `autores/` publica ou edita; cada autor só mexe nos seus jogos.
- Os rascunhos só são visíveis para os autores; os visitantes só podem somar +1 ao contador de jogadas.
- As regras validam todos os campos (categorias, tamanhos, caminhos e ligações `http(s)`).
- Os jogos do repositório correm no mesmo domínio do site. Como só quem tem acesso ao repositório os pode adicionar, isto é seguro — não dês acesso ao repositório a quem não confias.

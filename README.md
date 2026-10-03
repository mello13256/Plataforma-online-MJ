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

## Ligar ao Firebase (fazer uma vez)

### 1. Criar o projeto

1. Abre <https://console.firebase.google.com> e carrega em **Criar projeto**.
2. Dá-lhe um nome (ex.: `jogos-mj`). O Google Analytics não é preciso.
3. Aponta o **ID do projeto** (aparece por baixo do nome, ex.: `jogos-mj-1a2b3`).

### 2. Registar a app Web

Na página inicial do projeto, carrega no ícone **`</>`** (Web), dá um nome (ex.: `site`) e conclui.
Não é preciso copiar nada: o site lê a configuração sozinho.

### 3. Ativar o início de sessão

1. **Authentication → Começar → Email/palavra-passe → Ativar → Guardar.**
2. Separador **Utilizadores → Adicionar utilizador**: cria uma conta para ti e outra para o teu amigo.
3. Copia o **UID** de cada utilizador (coluna «UID do utilizador»).
4. (Opcional) **Modelos → idioma** → Português (Portugal), para os emails de recuperação de palavra-passe.

### 4. Criar a base de dados

1. **Firestore Database → Criar base de dados** → localização na Europa (ex.: `eur3`) → **modo de produção**.
2. **Iniciar coleção** com o ID `autores`.
3. Para cada um de vocês, cria um documento:
   - **ID do documento**: o UID copiado no passo 3;
   - campo `nome` (string): o nome que aparece no site, ex.: `Mello`;
   - campo `utilizador` (string): nome curto sem espaços, usado no endereço `/autor/...`, ex.: `mello`.

> As regras de segurança são publicadas automaticamente pelo GitHub (ficheiro `firestore.rules`).

### 5. Ativar o Hosting

**Hosting → Começar** e avança até ao fim (não precisas de correr nenhum comando).

### 6. Criar a chave para o GitHub publicar

1. Abre <https://console.cloud.google.com/iam-admin/serviceaccounts> e escolhe o teu projeto.
2. **Criar conta de serviço** → nome `github-publicar` → **Criar e continuar**.
3. Adiciona as funções **Administrador do Firebase** e **Consumidor do Service Usage** → **Concluído**.
4. Abre a conta criada → **Chaves → Adicionar chave → Criar nova chave → JSON**. É transferido um ficheiro `.json`.

> Este ficheiro dá acesso ao teu projeto: não o partilhes nem o coloques no repositório.

### 7. Configurar o GitHub

No repositório: **Settings → Secrets and variables → Actions**.

1. Separador **Secrets → New repository secret**:
   nome `FIREBASE_SERVICE_ACCOUNT`, valor = todo o conteúdo do ficheiro `.json`.
2. Separador **Variables → New repository variable**:
   nome `FIREBASE_PROJECT_ID`, valor = o ID do projeto (passo 1).

### 8. Publicar

Vai a **Actions → Publicar no Firebase → Run workflow**. Daqui para a frente, cada alteração no ramo principal
republica o site sozinha. O site fica em **`https://<ID-do-projeto>.web.app`**.

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

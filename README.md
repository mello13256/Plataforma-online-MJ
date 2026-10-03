# Jogos MJ — plataforma de jogos online

Site para publicarmos os nossos jogos e qualquer pessoa os jogar diretamente no browser.
Toda a interface está em **português de Portugal**.

Funciona 100% no plano gratuito do Firebase (Spark):

- **Firebase Hosting** — aloja o site e os ficheiros dos jogos;
- **Firebase Authentication** — início de sessão dos autores (email e palavra-passe);
- **Cloud Firestore** — títulos, descrições, categorias, rascunhos e contador de jogadas;
- **GitHub Actions** — sempre que há alterações no repositório, o site é republicado automaticamente.

## Funcionalidades

- **Sem conta para jogar:** os visitantes entram como **convidados**. Só os autores precisam de entrar.
- Tema **claro** por omissão, com botão para o tema escuro (fica guardado no browser).
- Página inicial com jogo em destaque, pesquisa, categorias e ordenação (mais recentes / mais jogados).
- Página de cada jogo: jogar no browser (com ecrã inteiro) e/ou **transferir** (`.exe`, `.zip`, `.apk`…).
- **Capa arrastada** diretamente no formulário (a imagem é reduzida automaticamente).
- **Categoria livre**: escolhe uma sugestão ou escreve qualquer estilo.
- **Administração** (`/admin`): ver, editar e remover os jogos de todos, gerir utilizadores e as permissões de cada um.

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

**No browser (HTML5):**
1. Exporta o jogo para HTML5/Web (ver tabela abaixo).
2. No GitHub, abre a pasta [`jogos/`](jogos/) → **Add file → Upload files** → arrasta a pasta do jogo ou o `.zip` → **Commit changes**.
3. Espera 1 a 2 minutos (podes acompanhar em **Actions**).
4. No site: **Painel → Publicar jogo** → «No browser (repositório)» → escolhe o jogo, arrasta a capa e publica.

**Para transferir (`.exe` e outros):**
1. Abre os [Releases do GitHub](https://github.com/mello13256/Plataforma-online-MJ/releases/new), arrasta o `.exe` (até 2 GB, transferências sem limite) e publica.
2. Copia a ligação do ficheiro (botão direito → «Copiar endereço da ligação»).
3. No site: **Painel → Publicar jogo** → «Só transferência» (ou junta a transferência a um jogo de browser) → cola a ligação.

Também podes usar ligações do Google Drive, itch.io, MEGA, etc.

| Motor | Como exportar |
| --- | --- |
| **Godot 4** | *Projeto → Exportar → Web*, com «Thread Support» desativado. Comprime a pasta exportada em `.zip`. |
| **Unity** | *Build Settings → WebGL*. Em *Player Settings → Publishing Settings*, põe **Compression Format: Disabled** (o Firebase já comprime). |
| **GameMaker** | Exporta para *HTML5/GX.games* e comprime a pasta em `.zip`. |
| **Construct / Phaser / JavaScript** | Comprime a pasta que tem o `index.html` em `.zip`. |
| **Scratch** | Usa o [TurboWarp Packager](https://packager.turbowarp.org/) para gerar um `.html` e põe-no numa pasta. |

Para jogos que não estão no repositório (ex.: no itch.io), escolhe **Ligação externa** e cola o endereço de incorporação.

### Limites do plano gratuito

- Upload pelo site do GitHub para a pasta `jogos/`: até **25 MB por ficheiro** (com o GitHub Desktop, até 100 MB). Os Releases aceitam até 2 GB.
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
- Os rascunhos só são visíveis para os autores; os convidados só podem somar +1 ao contador de jogadas.
- Contas novas só ganham acesso quando o administrador lhes atribui um perfil; uma conta sem perfil vê o mesmo que um convidado.
- As regras validam todos os campos (categorias, tamanhos, caminhos e ligações `http(s)`).
- Os jogos do repositório correm no mesmo domínio do site. Como só quem tem acesso ao repositório os pode adicionar, isto é seguro — não dês acesso ao repositório a quem não confias.

# Jogos MJ — plataforma de jogos online

Plataforma web para publicarmos os nossos jogos e qualquer pessoa os poder jogar diretamente no browser.
Toda a interface está em **português de Portugal**.

## Funcionalidades

- **Página inicial** com todos os jogos, pesquisa, filtro por categoria e ordenação (mais recentes / mais jogados).
- **Página de cada jogo** com leitor integrado (o jogo só carrega ao carregar em «Jogar»), botão de ecrã inteiro,
  descrição, instruções «Como jogar», contador de jogadas e mais jogos do mesmo autor.
- **Página de autor** com os jogos publicados por cada um.
- **Painel de autor** (só para quem tem conta) para publicar, editar, eliminar e guardar jogos como rascunho.
- Os jogos podem ser:
  - um **ficheiro .zip** com a exportação HTML5/Web do jogo (tem de ter um `index.html`);
  - um **ficheiro .html** único;
  - uma **ligação externa** (por exemplo, o endereço de incorporação do itch.io).
- **Sem registo público**: as contas são criadas por nós no servidor. Cada autor só gere os seus próprios jogos.
- Funciona bem em computador e telemóvel.

## Requisitos

- [Node.js](https://nodejs.org/) 22.13 ou mais recente (usa o SQLite incluído no Node — não é preciso instalar base de dados).

## Correr no teu computador

```bash
npm install
npm run criar-conta -- mello "Mello"     # pede a palavra-passe no terminal
npm run criar-conta -- amigo "Nome do Amigo"
npm start
```

Abre <http://localhost:3000> e entra em **Entrar** com a conta criada.

Para testar, há um jogo de exemplo em `exemplos/apanha-as-estrelas/`: comprime a pasta em `.zip` e publica-o no painel.

> O mesmo comando `criar-conta` serve para **repor a palavra-passe** de uma conta que já existe.
> A palavra-passe também pode ser alterada no painel, em «A minha conta».

## Preparar um jogo para publicar

| Motor | Como exportar |
| --- | --- |
| **Godot 4** | *Projeto → Exportar → Web*. Desativa «Thread Support» (assim não precisa de cabeçalhos especiais). Comprime a pasta exportada em `.zip`. |
| **Unity** | *Build Settings → WebGL*. Pode usar compressão Brotli ou Gzip — a plataforma envia os cabeçalhos certos. Comprime a pasta da build em `.zip`. |
| **GameMaker** | Exporta para *HTML5/GX.games* e comprime a pasta em `.zip`. |
| **Construct / Phaser / JavaScript** | Comprime a pasta que tem o `index.html` em `.zip`. |
| **Scratch** | Usa o [TurboWarp Packager](https://packager.turbowarp.org/) para gerar um `.html` e carrega esse ficheiro. |

O `index.html` pode estar na raiz do `.zip` ou dentro de uma pasta.

## Pôr a plataforma online

A plataforma guarda tudo (base de dados, jogos e capas) na pasta definida em `PASTA_DADOS` (por omissão `./dados`).
Por isso precisa de um alojamento com **disco persistente**. Algumas opções:

- **Um servidor (VPS)** — por exemplo Hetzner, OVH ou DigitalOcean — com Docker:

  ```bash
  docker build -t jogos-mj .
  docker run -d --name jogos-mj --restart unless-stopped \
    -p 3000:3000 -v jogos-mj-dados:/dados \
    -e NOME_SITE="Jogos MJ" -e TRAS_DE_PROXY=1 jogos-mj
  docker exec -it jogos-mj npm run criar-conta -- mello "Mello"
  ```

  Coloca à frente um proxy com HTTPS (por exemplo [Caddy](https://caddyserver.com/): `reverse_proxy localhost:3000`).
- **Railway, Render ou Fly.io** — usa o `Dockerfile` e associa um volume persistente montado em `/dados`.

Faz **cópias de segurança** regulares da pasta de dados.

### Configuração

| Variável | Por omissão | Descrição |
| --- | --- | --- |
| `NOME_SITE` | `Jogos MJ` | Nome que aparece no topo e no título das páginas. |
| `PORTA` | `3000` | Porta onde o servidor escuta. |
| `PASTA_DADOS` | `./dados` | Onde ficam a base de dados, os jogos e as capas. |
| `LIMITE_UPLOAD_MB` | `300` | Tamanho máximo de cada ficheiro carregado. |
| `TRAS_DE_PROXY` | `0` | Põe `1` quando estiver atrás de um proxy com HTTPS (cookies seguros e IP real). |

## Estrutura do projeto

```
src/
  index.js          arranque do servidor
  app.js            configuração do Express
  bd.js             base de dados SQLite
  auth.js           sessões, palavras-passe e proteção CSRF
  jogos.js          tratamento dos ficheiros dos jogos e das capas
  vistas.js         todas as páginas HTML
  rotas/publico.js  páginas públicas e início de sessão
  rotas/painel.js   painel dos autores
public/             CSS, JavaScript do browser e ícone
scripts/            criar-conta.js
exemplos/           jogo de exemplo para testar
test/               testes automáticos (npm test)
```

## Segurança

- Palavras-passe guardadas com bcrypt; sessões em cookie `HttpOnly`; limite de tentativas de início de sessão.
- Pedidos vindos de outros sites são recusados (proteção CSRF).
- Os ficheiros `.zip` são verificados contra caminhos maliciosos e tamanho excessivo.
- Os jogos carregados são servidos a partir do mesmo domínio para poderem guardar o progresso.
  Isto é seguro porque só nós, os autores, conseguimos publicar jogos — não dês contas a pessoas em quem não confias.

## Testes

```bash
npm test
```

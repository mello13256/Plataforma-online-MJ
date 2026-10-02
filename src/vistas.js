import { CATEGORIAS, urlJogo } from './jogos.js';

// --- Modelos HTML com escape automático --------------------------------------

class Seguro {
  constructor(texto) {
    this.texto = texto;
  }
  toString() {
    return this.texto;
  }
}

export function escapar(texto) {
  return String(texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderizar(valor) {
  if (valor == null || valor === false) return '';
  if (valor instanceof Seguro) return valor.texto;
  if (Array.isArray(valor)) return valor.map(renderizar).join('');
  return escapar(valor);
}

export function html(partes, ...valores) {
  let saida = partes[0];
  valores.forEach((valor, i) => {
    saida += renderizar(valor) + partes[i + 1];
  });
  return new Seguro(saida);
}

// --- Utilitários de apresentação ---------------------------------------------

const formatoData = new Intl.DateTimeFormat('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' });
const formatoNumero = new Intl.NumberFormat('pt-PT');

export function data(ms) {
  return formatoData.format(new Date(ms));
}

function jogadas(n) {
  return n === 1 ? '1 jogada' : `${formatoNumero.format(n)} jogadas`;
}

function paragrafos(texto) {
  return texto
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => html`<p>${p.split('\n').map((linha, i) => (i ? html`<br>${linha}` : linha))}</p>`);
}

function capa(jogo, classe = 'capa') {
  if (jogo.capa) {
    return html`<img class="${classe}" src="/ficheiros/capas/${jogo.capa}" alt="" loading="lazy">`;
  }
  return html`<div class="${classe} capa-vazia" aria-hidden="true">${jogo.titulo.slice(0, 1).toUpperCase()}</div>`;
}

// --- Estrutura base -----------------------------------------------------------

export function pagina({ titulo, conteudo, utilizador, nomeSite, descricao }) {
  const tituloCompleto = titulo ? `${titulo} · ${nomeSite}` : nomeSite;
  return html`<!doctype html>
<html lang="pt-PT">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${tituloCompleto}</title>
  <meta name="description" content="${descricao || `${nomeSite}: jogos para jogar diretamente no browser.`}">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/estilo.css">
  <script src="/app.js" defer></script>
</head>
<body>
  <a class="saltar" href="#conteudo">Saltar para o conteúdo</a>
  <header class="topo">
    <div class="contentor topo-interior">
      <a class="marca" href="/"><span class="marca-icone" aria-hidden="true">🎮</span>${nomeSite}</a>
      <form class="pesquisa-topo" action="/" method="get" role="search">
        <label class="oculto" for="pesquisa-topo">Pesquisar jogos</label>
        <input id="pesquisa-topo" type="search" name="q" placeholder="Pesquisar jogos…">
      </form>
      <nav class="menu" aria-label="Menu principal">
        <a href="/">Jogos</a>
        ${utilizador
          ? html`<a href="/painel">Painel</a>
            <form action="/sair" method="post" class="em-linha"><button class="ligacao" type="submit">Terminar sessão</button></form>`
          : html`<a href="/entrar">Entrar</a>`}
      </nav>
    </div>
  </header>
  <main id="conteudo" class="contentor">
    ${conteudo}
  </main>
  <footer class="rodape">
    <div class="contentor">© ${new Date().getFullYear()} ${nomeSite} · Feito em Portugal 🇵🇹</div>
  </footer>
</body>
</html>`.texto;
}

// --- Páginas públicas ---------------------------------------------------------

function cartaoJogo(jogo) {
  return html`<article class="cartao">
    <a href="/jogo/${jogo.slug}" class="cartao-ligacao">
      ${capa(jogo)}
      <div class="cartao-corpo">
        <h3>${jogo.titulo}</h3>
        <p class="meta">${jogo.categoria} · ${jogo.autor_nome}</p>
      </div>
    </a>
  </article>`;
}

function grelha(jogos, vazio) {
  if (!jogos.length) return html`<p class="vazio">${vazio}</p>`;
  return html`<div class="grelha">${jogos.map(cartaoJogo)}</div>`;
}

export function vistaInicio({ jogos, q, categoria, ordem, nomeSite, total }) {
  const filtros = q || categoria;
  const ligacaoCategoria = (c) => {
    const p = new URLSearchParams();
    if (q) p.set('q', q);
    if (c) p.set('categoria', c);
    if (ordem === 'populares') p.set('ordem', 'populares');
    const s = p.toString();
    return s ? `/?${s}` : '/';
  };
  const ligacaoOrdem = (o) => {
    const p = new URLSearchParams();
    if (q) p.set('q', q);
    if (categoria) p.set('categoria', categoria);
    if (o === 'populares') p.set('ordem', 'populares');
    const s = p.toString();
    return s ? `/?${s}` : '/';
  };
  return html`
    ${filtros
      ? null
      : html`<section class="destaque">
          <h1>Bem-vindo ao ${nomeSite}</h1>
          <p>Jogos feitos por nós, prontos a jogar no browser. Sem instalações, sem complicações: escolhe um e carrega em <strong>Jogar</strong>.</p>
        </section>`}
    <section class="filtros">
      <form action="/" method="get" class="pesquisa" role="search">
        <label class="oculto" for="q">Pesquisar jogos</label>
        <input id="q" type="search" name="q" value="${q}" placeholder="Pesquisar por nome ou descrição…">
        ${categoria ? html`<input type="hidden" name="categoria" value="${categoria}">` : null}
        <button type="submit" class="botao">Pesquisar</button>
      </form>
      <nav class="categorias" aria-label="Categorias">
        <a href="${ligacaoCategoria('')}" class="${categoria ? 'etiqueta' : 'etiqueta ativa'}">Todas</a>
        ${CATEGORIAS.map(
          (c) => html`<a href="${ligacaoCategoria(c)}" class="${c === categoria ? 'etiqueta ativa' : 'etiqueta'}">${c}</a>`,
        )}
      </nav>
    </section>
    <section>
      <div class="cabecalho-seccao">
        <h2>${filtros ? `Resultados (${total})` : 'Todos os jogos'}</h2>
        <div class="ordenar">
          <a href="${ligacaoOrdem('recentes')}" class="${ordem === 'populares' ? '' : 'ativo'}">Mais recentes</a>
          <a href="${ligacaoOrdem('populares')}" class="${ordem === 'populares' ? 'ativo' : ''}">Mais jogados</a>
        </div>
      </div>
      ${grelha(jogos, filtros ? 'Não foram encontrados jogos com esses critérios.' : 'Ainda não há jogos publicados. Volta em breve!')}
    </section>`;
}

export function vistaJogo({ jogo, maisDoAutor, eDono }) {
  const externo = jogo.tipo === 'ligacao';
  return html`
    ${jogo.publicado ? null : html`<p class="aviso">Este jogo é um rascunho: só tu o consegues ver.</p>`}
    <section class="jogo">
      <div class="leitor" id="leitor" data-url="${urlJogo(jogo)}" data-jogada="/jogo/${jogo.slug}/jogada" data-externo="${externo ? '1' : ''}">
        <div class="leitor-capa">
          ${capa(jogo, 'leitor-fundo')}
          <button type="button" class="botao botao-jogar" id="botao-jogar">▶ Jogar</button>
        </div>
      </div>
      <div class="leitor-acoes">
        <button type="button" class="botao secundario" id="botao-ecra-inteiro">⛶ Ecrã inteiro</button>
        <a class="botao secundario" href="${urlJogo(jogo)}" target="_blank" rel="noopener">Abrir numa nova janela</a>
        ${eDono ? html`<a class="botao secundario" href="/painel/jogo/${jogo.id}/editar">Editar jogo</a>` : null}
      </div>
    </section>
    <section class="info-jogo">
      <div>
        <h1>${jogo.titulo}</h1>
        <p class="meta">
          <a class="etiqueta" href="/?categoria=${encodeURIComponent(jogo.categoria)}">${jogo.categoria}</a>
          por <a href="/autor/${jogo.autor_utilizador}">${jogo.autor_nome}</a>
          · publicado a ${data(jogo.criado_em)}
          · ${jogadas(jogo.jogadas)}
        </p>
        ${jogo.descricao ? html`<div class="texto">${paragrafos(jogo.descricao)}</div>` : null}
      </div>
      ${jogo.instrucoes
        ? html`<aside class="caixa">
            <h2>Como jogar</h2>
            <div class="texto">${paragrafos(jogo.instrucoes)}</div>
          </aside>`
        : null}
    </section>
    ${maisDoAutor.length
      ? html`<section>
          <h2>Mais jogos de ${jogo.autor_nome}</h2>
          <div class="grelha">${maisDoAutor.map(cartaoJogo)}</div>
        </section>`
      : null}`;
}

export function vistaAutor({ autor, jogos }) {
  return html`
    <section class="destaque pequeno">
      <h1>${autor.nome}</h1>
      <p>@${autor.utilizador} · ${jogos.length === 1 ? '1 jogo publicado' : `${jogos.length} jogos publicados`}</p>
    </section>
    ${grelha(jogos, 'Este autor ainda não publicou nenhum jogo.')}`;
}

export function vistaErro({ codigo, mensagem }) {
  return html`
    <section class="erro">
      <p class="erro-codigo">${codigo}</p>
      <h1>${mensagem}</h1>
      <p><a class="botao" href="/">Voltar à página inicial</a></p>
    </section>`;
}

// --- Sessão -------------------------------------------------------------------

export function vistaEntrar({ erro, utilizador = '', seguinte = '' }) {
  return html`
    <section class="formulario-estreito">
      <h1>Iniciar sessão</h1>
      <p class="ajuda">Área reservada aos autores da plataforma.</p>
      ${erro ? html`<p class="erro-form" role="alert">${erro}</p>` : null}
      <form method="post" action="/entrar" class="formulario">
        <input type="hidden" name="seguinte" value="${seguinte}">
        <label>Nome de utilizador
          <input name="utilizador" value="${utilizador}" autocomplete="username" required autofocus>
        </label>
        <label>Palavra-passe
          <input type="password" name="palavra_passe" autocomplete="current-password" required>
        </label>
        <button class="botao" type="submit">Entrar</button>
      </form>
    </section>`;
}

// --- Painel -------------------------------------------------------------------

const MENSAGENS = {
  publicado: 'Jogo publicado com sucesso!',
  guardado: 'Alterações guardadas.',
  eliminado: 'Jogo eliminado.',
  conta: 'Dados da conta atualizados.',
};

export function vistaPainel({ utilizador, jogos, mensagem }) {
  return html`
    <div class="cabecalho-seccao">
      <h1>Olá, ${utilizador.nome}!</h1>
      <div class="acoes">
        <a class="botao secundario" href="/painel/conta">A minha conta</a>
        <a class="botao" href="/painel/novo">+ Publicar novo jogo</a>
      </div>
    </div>
    ${MENSAGENS[mensagem] ? html`<p class="sucesso" role="status">${MENSAGENS[mensagem]}</p>` : null}
    <h2>Os meus jogos</h2>
    ${jogos.length
      ? html`<div class="tabela-contentor"><table class="tabela">
          <thead><tr><th>Jogo</th><th>Estado</th><th>Jogadas</th><th>Atualizado</th><th><span class="oculto">Ações</span></th></tr></thead>
          <tbody>
            ${jogos.map(
              (j) => html`<tr>
                <td><a href="/jogo/${j.slug}">${j.titulo}</a><br><small class="meta">${j.categoria}</small></td>
                <td>${j.publicado ? html`<span class="estado publico">Público</span>` : html`<span class="estado rascunho">Rascunho</span>`}</td>
                <td>${formatoNumero.format(j.jogadas)}</td>
                <td>${data(j.atualizado_em)}</td>
                <td class="acoes-linha">
                  <a class="botao pequeno secundario" href="/painel/jogo/${j.id}/editar">Editar</a>
                  <form method="post" action="/painel/jogo/${j.id}/eliminar" class="em-linha" data-confirmar="Tens a certeza de que queres eliminar «${j.titulo}»? Esta ação não pode ser desfeita.">
                    <button class="botao pequeno perigo" type="submit">Eliminar</button>
                  </form>
                </td>
              </tr>`,
            )}
          </tbody>
        </table></div>`
      : html`<p class="vazio">Ainda não publicaste nenhum jogo. <a href="/painel/novo">Publica o primeiro!</a></p>`}`;
}

// Seletor de ficheiros com texto em português (o botão nativo segue a língua do browser).
function seletorFicheiro(nome, aceitar) {
  return html`<label class="seletor-ficheiro">
    <input type="file" name="${nome}" accept="${aceitar}" class="oculto">
    <span class="botao secundario pequeno">Escolher ficheiro</span>
    <span class="nome-ficheiro">Nenhum ficheiro escolhido</span>
  </label>`;
}

export function vistaFormularioJogo({ jogo, valores, erro, limiteUploadMb }) {
  const editar = Boolean(jogo);
  const v = valores;
  const tipo = v.tipo || 'ficheiro';
  const acao = editar ? `/painel/jogo/${jogo.id}/editar` : '/painel/novo';
  return html`
    <section class="formulario-largo">
      <p><a href="/painel">← Voltar ao painel</a></p>
      <h1>${editar ? `Editar «${jogo.titulo}»` : 'Publicar novo jogo'}</h1>
      ${erro ? html`<p class="erro-form" role="alert">${erro}</p>` : null}
      <form method="post" action="${acao}" enctype="multipart/form-data" class="formulario" id="formulario-jogo">
        <label>Título
          <input name="titulo" value="${v.titulo}" maxlength="80" required>
        </label>
        <label>Categoria
          <select name="categoria" required>
            ${CATEGORIAS.map((c) => html`<option ${c === v.categoria ? 'selected' : ''}>${c}</option>`)}
          </select>
        </label>
        <label>Descrição
          <textarea name="descricao" rows="5" maxlength="5000" placeholder="Do que trata o jogo?">${v.descricao}</textarea>
        </label>
        <label><span>Como jogar <span class="opcional">(opcional)</span></span>
          <textarea name="instrucoes" rows="3" maxlength="2000" placeholder="Ex.: setas para mover, espaço para saltar.">${v.instrucoes}</textarea>
        </label>

        <fieldset>
          <legend>Onde está o jogo?</legend>
          <label class="opcao"><input type="radio" name="tipo" value="ficheiro" ${tipo === 'ficheiro' ? 'checked' : ''}> Carregar ficheiro (.zip ou .html)</label>
          <label class="opcao"><input type="radio" name="tipo" value="ligacao" ${tipo === 'ligacao' ? 'checked' : ''}> Ligação externa (ex.: itch.io)</label>

          <div class="campo-tipo" data-tipo="ficheiro">
            <div class="campo">
              <span class="rotulo">Ficheiro do jogo ${editar && jogo.tipo === 'ficheiro' ? html`<span class="opcional">(deixa vazio para manter o atual)</span>` : null}</span>
              ${seletorFicheiro('ficheiro_jogo', '.zip,.html,.htm')}
            </div>
            <p class="ajuda">Exporta o jogo para HTML5/Web (Godot, Unity WebGL, GameMaker, Construct, Phaser…) e carrega a pasta comprimida em .zip. Tem de conter um <code>index.html</code>. Máximo ${limiteUploadMb} MB.</p>
          </div>
          <div class="campo-tipo" data-tipo="ligacao">
            <label>Endereço do jogo
              <input type="url" name="url_externo" value="${v.url_externo}" placeholder="https://…">
            </label>
            <p class="ajuda">Alguns sites não permitem ser incorporados. No itch.io, usa o endereço de incorporação («Embed game»).</p>
          </div>
        </fieldset>

        <div class="campo">
          <span class="rotulo">Imagem de capa ${editar && jogo.capa ? html`<span class="opcional">(deixa vazio para manter a atual)</span>` : html`<span class="opcional">(opcional)</span>`}</span>
          ${seletorFicheiro('capa', 'image/png,image/jpeg,image/webp,image/gif')}
        </div>
        ${editar && jogo.capa
          ? html`<div class="capa-atual">
              <img src="/ficheiros/capas/${jogo.capa}" alt="Capa atual">
              <label class="opcao"><input type="checkbox" name="remover_capa" value="1"> Remover capa</label>
            </div>`
          : null}
        <p class="ajuda">Recomendado: 16:9, por exemplo 1280×720.</p>

        <label class="opcao"><input type="checkbox" name="publicado" value="1" ${v.publicado ? 'checked' : ''}> Visível para todos (desmarca para guardar como rascunho)</label>

        <button class="botao" type="submit" data-a-enviar="A enviar…">${editar ? 'Guardar alterações' : 'Publicar jogo'}</button>
      </form>
    </section>`;
}

export function vistaConta({ utilizador, erro }) {
  return html`
    <section class="formulario-estreito">
      <p><a href="/painel">← Voltar ao painel</a></p>
      <h1>A minha conta</h1>
      ${erro ? html`<p class="erro-form" role="alert">${erro}</p>` : null}
      <form method="post" action="/painel/conta" class="formulario">
        <label>Nome a apresentar
          <input name="nome" value="${utilizador.nome}" maxlength="40" required>
        </label>
        <label>Palavra-passe atual
          <input type="password" name="palavra_passe_atual" autocomplete="current-password" required>
        </label>
        <label><span>Nova palavra-passe <span class="opcional">(deixa vazio para não alterar)</span></span>
          <input type="password" name="palavra_passe_nova" autocomplete="new-password" minlength="8">
        </label>
        <label>Confirmar nova palavra-passe
          <input type="password" name="palavra_passe_confirmar" autocomplete="new-password" minlength="8">
        </label>
        <button class="botao" type="submit">Guardar</button>
      </form>
    </section>`;
}

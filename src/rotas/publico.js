import express from 'express';
import {
  criarLimitadorTentativas,
  iniciarSessao,
  terminarSessao,
  verificarPalavraPasse,
} from '../auth.js';
import { CATEGORIAS } from '../jogos.js';
import { vistaAutor, vistaEntrar, vistaInicio, vistaJogo } from '../vistas.js';

const SELECIONAR_JOGO = `
  SELECT j.*, u.nome AS autor_nome, u.utilizador AS autor_utilizador
  FROM jogos j JOIN utilizadores u ON u.id = j.autor_id`;

function texto(valor, max = 200) {
  return typeof valor === 'string' ? valor.trim().slice(0, max) : '';
}

// Só permite redirecionar para caminhos internos.
function caminhoSeguro(valor) {
  return typeof valor === 'string' && /^\/(?![/\\])/.test(valor) ? valor : '/painel';
}

export function rotasPublicas({ bd, responder, naoEncontrado }) {
  const rotas = express.Router();
  const limitador = criarLimitadorTentativas();

  rotas.get('/', (req, res) => {
    const q = texto(req.query.q, 100);
    const categoria = CATEGORIAS.includes(req.query.categoria) ? req.query.categoria : '';
    const ordem = req.query.ordem === 'populares' ? 'populares' : 'recentes';

    const condicoes = ['j.publicado = 1'];
    const parametros = [];
    if (q) {
      const padrao = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      condicoes.push("(j.titulo LIKE ? ESCAPE '\\' OR j.descricao LIKE ? ESCAPE '\\')");
      parametros.push(padrao, padrao);
    }
    if (categoria) {
      condicoes.push('j.categoria = ?');
      parametros.push(categoria);
    }
    const ordenacao = ordem === 'populares' ? 'j.jogadas DESC, j.criado_em DESC' : 'j.criado_em DESC';
    const jogos = bd
      .prepare(`${SELECIONAR_JOGO} WHERE ${condicoes.join(' AND ')} ORDER BY ${ordenacao}`)
      .all(...parametros);

    responder(req, res, {
      titulo: q ? `Pesquisa: ${q}` : categoria || null,
      conteudo: vistaInicio({ jogos, q, categoria, ordem, nomeSite: res.locals.nomeSite, total: jogos.length }),
    });
  });

  rotas.get('/jogo/:slug', (req, res) => {
    const jogo = bd.prepare(`${SELECIONAR_JOGO} WHERE j.slug = ?`).get(req.params.slug);
    const eDono = Boolean(jogo && req.utilizador && req.utilizador.id === jogo.autor_id);
    if (!jogo || (!jogo.publicado && !eDono)) return naoEncontrado(req, res);

    const maisDoAutor = bd
      .prepare(`${SELECIONAR_JOGO} WHERE j.autor_id = ? AND j.id != ? AND j.publicado = 1 ORDER BY j.criado_em DESC LIMIT 4`)
      .all(jogo.autor_id, jogo.id);

    responder(req, res, {
      titulo: jogo.titulo,
      descricao: jogo.descricao.slice(0, 160) || undefined,
      conteudo: vistaJogo({ jogo, maisDoAutor, eDono }),
    });
  });

  rotas.post('/jogo/:slug/jogada', (req, res) => {
    bd.prepare('UPDATE jogos SET jogadas = jogadas + 1 WHERE slug = ? AND publicado = 1').run(req.params.slug);
    res.status(204).end();
  });

  rotas.get('/autor/:utilizador', (req, res) => {
    const autor = bd.prepare('SELECT id, utilizador, nome FROM utilizadores WHERE utilizador = ?').get(req.params.utilizador);
    if (!autor) return naoEncontrado(req, res);
    const jogos = bd.prepare(`${SELECIONAR_JOGO} WHERE j.autor_id = ? AND j.publicado = 1 ORDER BY j.criado_em DESC`).all(autor.id);
    responder(req, res, { titulo: autor.nome, conteudo: vistaAutor({ autor, jogos }) });
  });

  rotas.get('/entrar', (req, res) => {
    const seguinte = caminhoSeguro(req.query.seguinte);
    if (req.utilizador) return res.redirect(seguinte);
    responder(req, res, { titulo: 'Iniciar sessão', conteudo: vistaEntrar({ seguinte }) });
  });

  rotas.post('/entrar', express.urlencoded({ extended: false, limit: '10kb' }), async (req, res) => {
    const corpo = req.body || {};
    const utilizador = texto(corpo.utilizador, 40);
    const palavraPasse = typeof corpo.palavra_passe === 'string' ? corpo.palavra_passe : '';
    const seguinte = caminhoSeguro(corpo.seguinte);
    const falhar = (erro, estado = 401) =>
      responder(req, res, { titulo: 'Iniciar sessão', conteudo: vistaEntrar({ erro, utilizador, seguinte }) }, estado);

    if (limitador.bloqueado(req.ip)) {
      return falhar('Demasiadas tentativas falhadas. Tenta novamente daqui a 15 minutos.', 429);
    }
    const conta = bd.prepare('SELECT id, hash FROM utilizadores WHERE utilizador = ?').get(utilizador);
    if (!conta || !(await verificarPalavraPasse(palavraPasse, conta.hash))) {
      limitador.falhou(req.ip);
      return falhar('Nome de utilizador ou palavra-passe incorretos.');
    }
    limitador.limpar(req.ip);
    iniciarSessao(bd, req, res, conta.id);
    res.redirect(seguinte);
  });

  rotas.post('/sair', (req, res) => {
    terminarSessao(bd, req, res);
    res.redirect('/');
  });

  return rotas;
}

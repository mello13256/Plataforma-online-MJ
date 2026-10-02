import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { middlewareSessao, verificarOrigem } from './auth.js';
import { abrirBD } from './bd.js';
import { cabecalhosFicheirosJogo } from './jogos.js';
import { rotasPainel } from './rotas/painel.js';
import { rotasPublicas } from './rotas/publico.js';
import { pagina, vistaErro } from './vistas.js';

const pastaPublica = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');

export function criarApp(config) {
  for (const sub of ['jogos', 'capas', 'temp']) {
    fs.mkdirSync(path.join(config.pastaDados, sub), { recursive: true });
  }
  const bd = abrirBD(path.join(config.pastaDados, 'plataforma.db'));
  const app = express();

  app.disable('x-powered-by');
  if (config.trasDeProxy) app.set('trust proxy', 1);

  const responder = (req, res, { titulo, conteudo, descricao }, estado = 200) => {
    res.status(estado).type('html').send(
      pagina({ titulo, conteudo, descricao, utilizador: req.utilizador, nomeSite: config.nomeSite }),
    );
  };
  const naoEncontrado = (req, res) =>
    responder(req, res, { titulo: 'Página não encontrada', conteudo: vistaErro({ codigo: 404, mensagem: 'Esta página não existe.' }) }, 404);

  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.locals.nomeSite = config.nomeSite;
    next();
  });

  app.use(express.static(pastaPublica, { maxAge: '1h' }));
  app.use('/ficheiros/capas', express.static(path.join(config.pastaDados, 'capas'), { maxAge: '7d', fallthrough: false }));
  app.use(
    '/ficheiros/jogos',
    express.static(path.join(config.pastaDados, 'jogos'), {
      fallthrough: false,
      setHeaders: (res, caminho) => cabecalhosFicheirosJogo(res, caminho),
    }),
  );

  app.use(middlewareSessao(bd));
  app.use(verificarOrigem);
  app.use('/', rotasPublicas({ bd, responder, naoEncontrado }));
  app.use('/painel', rotasPainel({ bd, config, responder, naoEncontrado }));

  app.use(naoEncontrado);
  // eslint-disable-next-line no-unused-vars
  app.use((erro, req, res, next) => {
    if (erro.status === 404 || erro.statusCode === 404) return naoEncontrado(req, res);
    console.error(erro);
    responder(req, res, { titulo: 'Erro', conteudo: vistaErro({ codigo: 500, mensagem: 'Ocorreu um erro inesperado.' }) }, 500);
  });

  return { app, bd };
}

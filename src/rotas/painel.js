import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import multer from 'multer';
import { exigirSessao, gerarHash, terminarOutrasSessoes, verificarPalavraPasse } from '../auth.js';
import {
  CATEGORIAS,
  ErroValidacao,
  apagarFicheirosJogo,
  guardarCapa,
  guardarFicheiroJogo,
  slugUnico,
  validarUrl,
} from '../jogos.js';
import { vistaConta, vistaFormularioJogo, vistaPainel } from '../vistas.js';

function texto(valor, max) {
  return typeof valor === 'string' ? valor.replace(/\r\n/g, '\n').trim().slice(0, max) : '';
}

function lerValores(corpo = {}) {
  return {
    titulo: texto(corpo.titulo, 80),
    categoria: CATEGORIAS.includes(corpo.categoria) ? corpo.categoria : '',
    descricao: texto(corpo.descricao, 5000),
    instrucoes: texto(corpo.instrucoes, 2000),
    tipo: corpo.tipo === 'ligacao' ? 'ligacao' : 'ficheiro',
    url_externo: texto(corpo.url_externo, 500),
    publicado: corpo.publicado === '1',
    remover_capa: corpo.remover_capa === '1',
  };
}

function valoresDoJogo(jogo) {
  return { ...jogo, url_externo: jogo.url_externo || '', publicado: Boolean(jogo.publicado) };
}

export function rotasPainel({ bd, config, responder, naoEncontrado }) {
  const rotas = express.Router();
  const pastaJogos = path.join(config.pastaDados, 'jogos');
  const pastaCapas = path.join(config.pastaDados, 'capas');
  const pastaTemp = path.join(config.pastaDados, 'temp');

  const carregar = multer({
    dest: pastaTemp,
    limits: { fileSize: config.limiteUploadMb * 1024 * 1024, files: 2, fields: 20 },
  }).fields([
    { name: 'ficheiro_jogo', maxCount: 1 },
    { name: 'capa', maxCount: 1 },
  ]);

  // Executa o multer e converte os seus erros em mensagens em português.
  function receberFormulario(req, res) {
    return new Promise((resolver) => {
      carregar(req, res, (erro) => {
        if (!erro) return resolver(null);
        if (erro.code === 'LIMIT_FILE_SIZE') return resolver(`O ficheiro excede o limite de ${config.limiteUploadMb} MB.`);
        resolver('Não foi possível receber o formulário. Tenta novamente.');
      });
    });
  }

  function limparTemporarios(req) {
    for (const lista of Object.values(req.files || {})) {
      for (const f of lista) fs.rmSync(f.path, { force: true });
    }
  }

  function jogoDoUtilizador(req) {
    const jogo = bd.prepare('SELECT * FROM jogos WHERE id = ?').get(Number(req.params.id));
    return jogo && jogo.autor_id === req.utilizador.id ? jogo : null;
  }

  rotas.use(exigirSessao);

  rotas.get('/', (req, res) => {
    const jogos = bd.prepare('SELECT * FROM jogos WHERE autor_id = ? ORDER BY atualizado_em DESC').all(req.utilizador.id);
    responder(req, res, {
      titulo: 'Painel',
      conteudo: vistaPainel({ utilizador: req.utilizador, jogos, mensagem: req.query.ok }),
    });
  });

  // --- Publicar e editar jogos ------------------------------------------------

  const mostrarFormulario = (req, res, { jogo = null, valores, erro = null, estado = 200 }) =>
    responder(
      req,
      res,
      {
        titulo: jogo ? `Editar ${jogo.titulo}` : 'Publicar novo jogo',
        conteudo: vistaFormularioJogo({ jogo, valores, erro, limiteUploadMb: config.limiteUploadMb }),
      },
      estado,
    );

  rotas.get('/novo', (req, res) => {
    mostrarFormulario(req, res, { valores: { categoria: CATEGORIAS[0], publicado: true } });
  });

  rotas.get('/jogo/:id/editar', (req, res) => {
    const jogo = jogoDoUtilizador(req);
    if (!jogo) return naoEncontrado(req, res);
    mostrarFormulario(req, res, { jogo, valores: valoresDoJogo(jogo) });
  });

  // Trata a submissão de um jogo novo (jogo = null) ou de uma edição.
  async function guardarJogo(req, res, jogo) {
    const erroEnvio = await receberFormulario(req, res);
    const v = lerValores(req.body);
    const ficheiroJogo = req.files?.ficheiro_jogo?.[0];
    const ficheiroCapa = req.files?.capa?.[0];
    const novos = { pasta: null, capa: null };

    try {
      if (erroEnvio) throw new ErroValidacao(erroEnvio);
      if (!v.titulo) throw new ErroValidacao('O jogo precisa de um título.');
      if (!v.categoria) throw new ErroValidacao('Escolhe uma categoria válida.');

      let url = null;
      if (v.tipo === 'ligacao') {
        url = validarUrl(v.url_externo);
        if (!url) throw new ErroValidacao('Indica um endereço válido, começado por https://');
      } else if (!ficheiroJogo && !(jogo && jogo.tipo === 'ficheiro')) {
        throw new ErroValidacao('Escolhe o ficheiro do jogo (.zip ou .html).');
      }

      if (v.tipo === 'ficheiro' && ficheiroJogo) {
        Object.assign(novos, guardarFicheiroJogo(ficheiroJogo, pastaJogos));
      }
      if (ficheiroCapa) novos.capa = guardarCapa(ficheiroCapa, pastaCapas);

      const agora = Date.now();
      const antigos = { pasta: null, capa: null };
      let pasta = jogo?.pasta ?? null;
      let entrada = jogo?.entrada ?? null;
      let capa = jogo?.capa ?? null;

      if (novos.pasta) {
        antigos.pasta = pasta;
        pasta = novos.pasta;
        entrada = novos.entrada;
      } else if (v.tipo === 'ligacao') {
        antigos.pasta = pasta;
        pasta = null;
        entrada = null;
      }
      if (novos.capa || v.remover_capa) {
        antigos.capa = capa;
        capa = novos.capa;
      }

      let id = jogo?.id;
      if (jogo) {
        bd.prepare(
          `UPDATE jogos SET titulo = ?, descricao = ?, instrucoes = ?, categoria = ?, tipo = ?, pasta = ?, entrada = ?,
             url_externo = ?, capa = ?, publicado = ?, atualizado_em = ? WHERE id = ?`,
        ).run(v.titulo, v.descricao, v.instrucoes, v.categoria, v.tipo, pasta, entrada, url, capa, v.publicado ? 1 : 0, agora, jogo.id);
      } else {
        id = bd
          .prepare(
            `INSERT INTO jogos (slug, titulo, descricao, instrucoes, categoria, tipo, pasta, entrada, url_externo, capa,
               publicado, autor_id, criado_em, atualizado_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(slugUnico(bd, v.titulo), v.titulo, v.descricao, v.instrucoes, v.categoria, v.tipo, pasta, entrada, url, capa,
            v.publicado ? 1 : 0, req.utilizador.id, agora, agora).lastInsertRowid;
      }
      apagarFicheirosJogo(antigos, { pastaJogos, pastaCapas });

      const slug = bd.prepare('SELECT slug FROM jogos WHERE id = ?').get(id).slug;
      res.redirect(jogo ? '/painel?ok=guardado' : `/jogo/${slug}`);
    } catch (erro) {
      apagarFicheirosJogo(novos, { pastaJogos, pastaCapas });
      if (!(erro instanceof ErroValidacao)) throw erro;
      mostrarFormulario(req, res, { jogo, valores: v, erro: erro.message, estado: 400 });
    } finally {
      limparTemporarios(req);
    }
  }

  rotas.post('/novo', (req, res) => guardarJogo(req, res, null));

  rotas.post('/jogo/:id/editar', (req, res) => {
    const jogo = jogoDoUtilizador(req);
    if (!jogo) return naoEncontrado(req, res);
    return guardarJogo(req, res, jogo);
  });

  rotas.post('/jogo/:id/eliminar', (req, res) => {
    const jogo = jogoDoUtilizador(req);
    if (!jogo) return naoEncontrado(req, res);
    bd.prepare('DELETE FROM jogos WHERE id = ?').run(jogo.id);
    apagarFicheirosJogo(jogo, { pastaJogos, pastaCapas });
    res.redirect('/painel?ok=eliminado');
  });

  // --- Conta --------------------------------------------------------------------

  rotas.get('/conta', (req, res) => {
    responder(req, res, { titulo: 'A minha conta', conteudo: vistaConta({ utilizador: req.utilizador }) });
  });

  rotas.post('/conta', express.urlencoded({ extended: false, limit: '10kb' }), async (req, res) => {
    const corpo = req.body || {};
    const nome = texto(corpo.nome, 40);
    const atual = typeof corpo.palavra_passe_atual === 'string' ? corpo.palavra_passe_atual : '';
    const nova = typeof corpo.palavra_passe_nova === 'string' ? corpo.palavra_passe_nova : '';
    const confirmar = typeof corpo.palavra_passe_confirmar === 'string' ? corpo.palavra_passe_confirmar : '';
    const falhar = (erro) =>
      responder(req, res, { titulo: 'A minha conta', conteudo: vistaConta({ utilizador: { ...req.utilizador, nome }, erro }) }, 400);

    const { hash } = bd.prepare('SELECT hash FROM utilizadores WHERE id = ?').get(req.utilizador.id);
    if (!nome) return falhar('O nome não pode ficar vazio.');
    if (!(await verificarPalavraPasse(atual, hash))) return falhar('A palavra-passe atual está incorreta.');
    if (nova && nova.length < 8) return falhar('A nova palavra-passe tem de ter pelo menos 8 caracteres.');
    if (nova !== confirmar) return falhar('As novas palavras-passe não coincidem.');

    bd.prepare('UPDATE utilizadores SET nome = ? WHERE id = ?').run(nome, req.utilizador.id);
    if (nova) {
      bd.prepare('UPDATE utilizadores SET hash = ? WHERE id = ?').run(await gerarHash(nova), req.utilizador.id);
      terminarOutrasSessoes(bd, req, req.utilizador.id);
    }
    res.redirect('/painel?ok=conta');
  });

  return rotas;
}

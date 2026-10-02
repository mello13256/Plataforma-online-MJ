import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';

const NOME_COOKIE = 'sessao';
const DURACAO_SESSAO_MS = 30 * 24 * 60 * 60 * 1000;

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function lerCookies(req) {
  const cookies = {};
  for (const parte of (req.headers.cookie || '').split(';')) {
    const i = parte.indexOf('=');
    if (i === -1) continue;
    const nome = parte.slice(0, i).trim();
    try {
      cookies[nome] = decodeURIComponent(parte.slice(i + 1).trim());
    } catch {
      // cookie mal formado: ignorar
    }
  }
  return cookies;
}

export async function gerarHash(palavraPasse) {
  return bcrypt.hash(palavraPasse, 12);
}

export async function verificarPalavraPasse(palavraPasse, hash) {
  return bcrypt.compare(palavraPasse, hash);
}

export function criarUtilizador(bd, { utilizador, nome, hash }) {
  return bd
    .prepare('INSERT INTO utilizadores (utilizador, nome, hash, criado_em) VALUES (?, ?, ?, ?)')
    .run(utilizador, nome, hash, Date.now());
}

export function middlewareSessao(bd) {
  const procurar = bd.prepare(`
    SELECT u.id, u.utilizador, u.nome
    FROM sessoes s JOIN utilizadores u ON u.id = s.utilizador_id
    WHERE s.token_hash = ? AND s.expira_em > ?
  `);
  return (req, res, next) => {
    const token = lerCookies(req)[NOME_COOKIE];
    req.utilizador = token ? procurar.get(hashToken(token), Date.now()) || null : null;
    next();
  };
}

export function iniciarSessao(bd, req, res, utilizadorId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const agora = Date.now();
  bd.prepare('DELETE FROM sessoes WHERE expira_em <= ?').run(agora);
  bd.prepare('INSERT INTO sessoes (token_hash, utilizador_id, expira_em) VALUES (?, ?, ?)')
    .run(hashToken(token), utilizadorId, agora + DURACAO_SESSAO_MS);
  res.cookie(NOME_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: req.secure,
    maxAge: DURACAO_SESSAO_MS,
    path: '/',
  });
}

export function terminarSessao(bd, req, res) {
  const token = lerCookies(req)[NOME_COOKIE];
  if (token) bd.prepare('DELETE FROM sessoes WHERE token_hash = ?').run(hashToken(token));
  res.clearCookie(NOME_COOKIE, { path: '/' });
}

export function terminarOutrasSessoes(bd, req, utilizadorId) {
  const token = lerCookies(req)[NOME_COOKIE];
  bd.prepare('DELETE FROM sessoes WHERE utilizador_id = ? AND token_hash != ?')
    .run(utilizadorId, token ? hashToken(token) : '');
}

export function exigirSessao(req, res, next) {
  if (req.utilizador) return next();
  res.redirect(`/entrar?seguinte=${encodeURIComponent(req.originalUrl)}`);
}

// Bloqueia pedidos POST vindos de outros sites (proteção CSRF).
export function verificarOrigem(req, res, next) {
  if (req.method === 'GET' || req.method === 'HEAD') return next();
  const origem = req.headers.origin || req.headers.referer;
  if (!origem) return next();
  let host;
  try {
    host = new URL(origem).host;
  } catch {
    host = null;
  }
  if (host && host === req.headers.host) return next();
  res.status(403).type('text/plain; charset=utf-8').send('Pedido recusado: origem inválida.');
}

// Limita tentativas de início de sessão falhadas por IP.
export function criarLimitadorTentativas({ maximo = 10, janelaMs = 15 * 60 * 1000 } = {}) {
  const tentativas = new Map();
  return {
    bloqueado(ip) {
      const t = tentativas.get(ip);
      if (!t) return false;
      if (Date.now() - t.desde > janelaMs) {
        tentativas.delete(ip);
        return false;
      }
      return t.n >= maximo;
    },
    falhou(ip) {
      const t = tentativas.get(ip);
      if (!t || Date.now() - t.desde > janelaMs) tentativas.set(ip, { n: 1, desde: Date.now() });
      else t.n++;
    },
    limpar(ip) {
      tentativas.delete(ip);
    },
  };
}

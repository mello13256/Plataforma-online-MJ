import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import AdmZip from 'adm-zip';

export const CATEGORIAS = [
  'Ação',
  'Aventura',
  'Arcada',
  'Corrida',
  'Desporto',
  'Estratégia',
  'Multijogador',
  'Plataformas',
  'Puzzle',
  'Terror',
  'Outro',
];

const LIMITE_DESCOMPRIMIDO = 1024 * 1024 * 1024; // 1 GB
const MAX_FICHEIROS_ZIP = 20000;

const EXTENSOES_CAPA = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

export class ErroValidacao extends Error {}

export function criarSlug(texto) {
  const slug = texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '');
  return slug || 'jogo';
}

export function slugUnico(bd, titulo) {
  const base = criarSlug(titulo);
  const existe = bd.prepare('SELECT 1 FROM jogos WHERE slug = ?');
  let slug = base;
  for (let n = 2; existe.get(slug); n++) slug = `${base}-${n}`;
  return slug;
}

function nomeAleatorio() {
  return `${Date.now().toString(36)}-${crypto.randomBytes(6).toString('hex')}`;
}

function dentroDe(pasta, destino) {
  return destino.startsWith(pasta + path.sep);
}

function extrairZip(caminhoZip, pastaDestino) {
  let zip;
  try {
    zip = new AdmZip(caminhoZip);
  } catch {
    throw new ErroValidacao('O ficheiro .zip está danificado ou não é válido.');
  }
  const entradas = zip.getEntries().filter((e) => !e.isDirectory);
  if (entradas.length > MAX_FICHEIROS_ZIP) {
    throw new ErroValidacao('O ficheiro .zip tem demasiados ficheiros.');
  }
  const total = entradas.reduce((soma, e) => soma + e.header.size, 0);
  if (total > LIMITE_DESCOMPRIMIDO) {
    throw new ErroValidacao('O conteúdo do ficheiro .zip é demasiado grande (máximo 1 GB descomprimido).');
  }

  const htmls = [];
  for (const entrada of entradas) {
    const nome = entrada.entryName.replace(/\\/g, '/');
    if (nome.startsWith('__MACOSX/') || path.posix.basename(nome) === '.DS_Store') continue;
    const destino = path.resolve(pastaDestino, nome);
    if (!dentroDe(pastaDestino, destino)) {
      throw new ErroValidacao('O ficheiro .zip contém caminhos inválidos.');
    }
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    fs.writeFileSync(destino, entrada.getData());
    if (/\.html?$/i.test(nome)) htmls.push(path.relative(pastaDestino, destino).split(path.sep).join('/'));
  }

  // Preferir o index.html menos profundo; caso contrário, o único .html existente.
  const indices = htmls
    .filter((h) => /(^|\/)index\.html?$/i.test(h))
    .sort((a, b) => a.split('/').length - b.split('/').length);
  if (indices.length) return indices[0];
  if (htmls.length === 1) return htmls[0];
  throw new ErroValidacao('Não foi encontrado nenhum index.html dentro do ficheiro .zip.');
}

// Guarda o ficheiro do jogo (.zip ou .html) numa nova pasta e devolve { pasta, entrada }.
export function guardarFicheiroJogo(ficheiro, pastaJogos) {
  const nomeOriginal = ficheiro.originalname.toLowerCase();
  const pasta = nomeAleatorio();
  const pastaAbs = path.join(pastaJogos, pasta);
  fs.mkdirSync(pastaAbs, { recursive: true });
  try {
    let entrada;
    if (nomeOriginal.endsWith('.zip')) {
      entrada = extrairZip(ficheiro.path, pastaAbs);
    } else if (/\.html?$/.test(nomeOriginal)) {
      fs.copyFileSync(ficheiro.path, path.join(pastaAbs, 'index.html'));
      entrada = 'index.html';
    } else {
      throw new ErroValidacao('O jogo tem de ser um ficheiro .zip ou .html.');
    }
    return { pasta, entrada };
  } catch (erro) {
    fs.rmSync(pastaAbs, { recursive: true, force: true });
    throw erro;
  }
}

export function guardarCapa(ficheiro, pastaCapas) {
  const ext = EXTENSOES_CAPA[ficheiro.mimetype];
  if (!ext) throw new ErroValidacao('A capa tem de ser uma imagem PNG, JPG, WEBP ou GIF.');
  if (ficheiro.size > 10 * 1024 * 1024) throw new ErroValidacao('A capa não pode ter mais de 10 MB.');
  const nome = nomeAleatorio() + ext;
  fs.copyFileSync(ficheiro.path, path.join(pastaCapas, nome));
  return nome;
}

export function apagarFicheirosJogo({ pasta, capa }, { pastaJogos, pastaCapas }) {
  if (pasta) fs.rmSync(path.join(pastaJogos, pasta), { recursive: true, force: true });
  if (capa) fs.rmSync(path.join(pastaCapas, capa), { force: true });
}

export function urlJogo(jogo) {
  if (jogo.tipo === 'ligacao') return jogo.url_externo;
  const entrada = jogo.entrada.split('/').map(encodeURIComponent).join('/');
  return `/ficheiros/jogos/${jogo.pasta}/${entrada}`;
}

export function validarUrl(texto) {
  try {
    const url = new URL(texto);
    if (url.protocol === 'https:' || url.protocol === 'http:') return url.toString();
  } catch {
    // inválido
  }
  return null;
}

// Cabeçalhos para builds comprimidas (ex.: Unity WebGL com Brotli/Gzip).
const TIPOS_BASE = {
  '.js': 'application/javascript',
  '.wasm': 'application/wasm',
  '.data': 'application/octet-stream',
  '.json': 'application/json',
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
};

export function cabecalhosFicheirosJogo(res, caminho) {
  let codificacao = null;
  let base = caminho;
  if (caminho.endsWith('.br')) {
    codificacao = 'br';
    base = caminho.slice(0, -3);
  } else if (caminho.endsWith('.gz')) {
    codificacao = 'gzip';
    base = caminho.slice(0, -3);
  } else if (caminho.endsWith('.unityweb')) {
    res.setHeader('Content-Type', 'application/octet-stream');
  }
  if (codificacao) {
    res.setHeader('Content-Encoding', codificacao);
    res.setHeader('Content-Type', TIPOS_BASE[path.extname(base).toLowerCase()] || 'application/octet-stream');
  }
}

import { DatabaseSync } from 'node:sqlite';

export function abrirBD(caminho) {
  const bd = new DatabaseSync(caminho);
  bd.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS utilizadores (
      id INTEGER PRIMARY KEY,
      utilizador TEXT NOT NULL UNIQUE COLLATE NOCASE,
      nome TEXT NOT NULL,
      hash TEXT NOT NULL,
      criado_em INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessoes (
      token_hash TEXT PRIMARY KEY,
      utilizador_id INTEGER NOT NULL REFERENCES utilizadores(id) ON DELETE CASCADE,
      expira_em INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS jogos (
      id INTEGER PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      titulo TEXT NOT NULL,
      descricao TEXT NOT NULL DEFAULT '',
      instrucoes TEXT NOT NULL DEFAULT '',
      categoria TEXT NOT NULL,
      tipo TEXT NOT NULL CHECK (tipo IN ('ficheiro', 'ligacao')),
      pasta TEXT,
      entrada TEXT,
      url_externo TEXT,
      capa TEXT,
      publicado INTEGER NOT NULL DEFAULT 1,
      jogadas INTEGER NOT NULL DEFAULT 0,
      autor_id INTEGER NOT NULL REFERENCES utilizadores(id),
      criado_em INTEGER NOT NULL,
      atualizado_em INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS jogos_autor ON jogos(autor_id);
  `);
  return bd;
}

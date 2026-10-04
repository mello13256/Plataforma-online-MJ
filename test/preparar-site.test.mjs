import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import AdmZip from 'adm-zip';
import { criarSlug, prepararSite } from '../scripts/preparar-site.mjs';

let raiz;
let indice;

function escrever(relativo, conteudo) {
  const abs = path.join(raiz, relativo);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, conteudo);
}

function zip(relativo, entradas, ajustar) {
  const z = new AdmZip();
  for (const [nome, conteudo] of Object.entries(entradas)) z.addFile(nome, Buffer.from(conteudo));
  ajustar?.(z);
  escrever(relativo, z.toBuffer());
}

before(() => {
  raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'site-'));
  escrever('site/index.html', '<h1>site</h1>');
  escrever('jogos/LEIA-ME.md', 'instruções');
  escrever('jogos/Pasta Normal/index.html', 'pasta');
  escrever('jogos/Pasta Normal/capa.png', 'png');
  zip('jogos/Aventura no Algarve.zip', { 'build/index.html': 'zip', 'build/jogo.wasm.br': 'x', '__MACOSX/lixo': 'x' });
  zip('jogos/sem-indice.zip', { 'a.html': '1', 'b.html': '2' });
  zip('jogos/malicioso.zip', { 'index.html': 'x' }, (z) => {
    z.getEntries()[0].entryName = '../../fora.html';
  });
  escrever('jogos/nao-e-jogo.txt', 'x');
  escrever('jogos/reservas.json', JSON.stringify({ pastas: { 'pasta-normal': 'uid-do-dono' } }));
  escrever('capas/Lisboa.jpg', 'jpg');
  escrever('capas/notas.txt', 'x');
  indice = prepararSite({ raiz });
});

after(() => fs.rmSync(raiz, { recursive: true, force: true }));

describe('preparar-site', () => {
  it('cria slugs sem acentos', () => {
    assert.equal(criarSlug('Corrida à Ponte 25 de Abril!'), 'corrida-a-ponte-25-de-abril');
  });

  it('copia o site', () => {
    assert.equal(fs.readFileSync(path.join(raiz, 'publicar/index.html'), 'utf8'), '<h1>site</h1>');
  });

  it('copia pastas e extrai .zip com nomes normalizados', () => {
    assert.deepEqual(indice.jogos, [
      { pasta: 'aventura-no-algarve', origem: 'Aventura no Algarve.zip', caminho: 'jogos/aventura-no-algarve/build/index.html', capa: null },
      {
        pasta: 'pasta-normal', origem: 'Pasta Normal', caminho: 'jogos/pasta-normal/index.html', capa: 'jogos/pasta-normal/capa.png',
        reservado_para: 'uid-do-dono',
      },
    ]);
    assert.equal(fs.readFileSync(path.join(raiz, 'publicar/jogos/aventura-no-algarve/build/index.html'), 'utf8'), 'zip');
    assert.ok(!fs.existsSync(path.join(raiz, 'publicar/jogos/aventura-no-algarve/__MACOSX')));
  });

  it('ignora jogos inválidos com avisos', () => {
    assert.equal(indice.avisos.length, 2);
    assert.match(indice.avisos.join('\n'), /malicioso\.zip.*caminho inválido/);
    assert.match(indice.avisos.join('\n'), /sem-indice\.zip.*index\.html/);
    assert.ok(!fs.existsSync(path.join(raiz, 'fora.html')));
    assert.ok(!fs.existsSync(path.join(raiz, 'publicar/jogos/malicioso')));
  });

  it('copia capas e escreve o índice', () => {
    assert.deepEqual(indice.capas, ['capas/Lisboa.jpg']);
    const escrito = JSON.parse(fs.readFileSync(path.join(raiz, 'publicar/indice-repositorio.json'), 'utf8'));
    assert.deepEqual(escrito.jogos, indice.jogos);
  });
});

describe('pastas reservadas', () => {
  it('jogos/reservas.json e firestore.rules reservam as mesmas pastas às mesmas contas', () => {
    const raizRepo = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
    const reservas = JSON.parse(fs.readFileSync(path.join(raizRepo, 'jogos/reservas.json'), 'utf8')).pastas;
    const regras = fs.readFileSync(path.join(raizRepo, 'firestore.rules'), 'utf8');
    const uidDono = regras.match(/function uidDono\(\) \{\s*return '([^']+)'/)[1];
    const bloco = regras.match(/function pastasReservadas\(\) \{\s*return \{([^}]*)\}/)[1];
    const nasRegras = Object.fromEntries([...bloco.matchAll(/'([a-z0-9-]+)':\s*(uidDono\(\)|'[^']+')/g)]
      .map(([, pasta, valor]) => [pasta, valor === 'uidDono()' ? uidDono : valor.slice(1, -1)]));
    assert.deepEqual(nasRegras, reservas);
    for (const pasta of Object.keys(reservas)) {
      assert.ok(regras.includes(`/jogos/${pasta}(`), `urlDePastaReservada não inclui «${pasta}»`);
    }
  });
});

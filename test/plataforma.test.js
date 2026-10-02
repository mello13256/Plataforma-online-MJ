import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import AdmZip from 'adm-zip';
import { criarApp } from '../src/app.js';
import { criarUtilizador, gerarHash } from '../src/auth.js';
import { criarSlug } from '../src/jogos.js';

let servidor;
let base;
let pastaDados;
let cookie = '';

async function pedir(caminho, opcoes = {}) {
  return fetch(base + caminho, {
    redirect: 'manual',
    ...opcoes,
    headers: { cookie, origin: base, ...(opcoes.headers || {}) },
  });
}

function formulario(campos, ficheiros = {}) {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) f.append(k, v);
  for (const [k, { conteudo, nome, tipo }] of Object.entries(ficheiros)) {
    f.append(k, new Blob([conteudo], { type: tipo }), nome);
  }
  return f;
}

function zipJogo(entradas) {
  const zip = new AdmZip();
  for (const [nome, conteudo] of Object.entries(entradas)) zip.addFile(nome, Buffer.from(conteudo));
  return zip.toBuffer();
}

before(async () => {
  pastaDados = fs.mkdtempSync(path.join(os.tmpdir(), 'plataforma-'));
  const { app, bd } = criarApp({ pastaDados, nomeSite: 'Jogos MJ', limiteUploadMb: 5 });
  criarUtilizador(bd, { utilizador: 'mello', nome: 'Mello', hash: await gerarHash('segredo123') });
  criarUtilizador(bd, { utilizador: 'amigo', nome: 'Amigo', hash: await gerarHash('segredo456') });
  await new Promise((resolver) => {
    servidor = app.listen(0, resolver);
  });
  base = `http://localhost:${servidor.address().port}`;
});

after(() => {
  servidor.close();
  fs.rmSync(pastaDados, { recursive: true, force: true });
});

describe('plataforma', () => {
  it('cria slugs sem acentos', () => {
    assert.equal(criarSlug('Corrida à Ponte 25 de Abril!'), 'corrida-a-ponte-25-de-abril');
    assert.equal(criarSlug('!!!'), 'jogo');
  });

  it('página inicial em pt-PT', async () => {
    const res = await pedir('/');
    assert.equal(res.status, 200);
    const corpo = await res.text();
    assert.match(corpo, /<html lang="pt-PT">/);
    assert.match(corpo, /Ainda não há jogos publicados/);
  });

  it('painel exige sessão', async () => {
    const res = await pedir('/painel');
    assert.equal(res.status, 302);
    assert.equal(res.headers.get('location'), '/entrar?seguinte=%2Fpainel');
  });

  it('recusa palavra-passe errada', async () => {
    const res = await pedir('/entrar', {
      method: 'POST',
      body: new URLSearchParams({ utilizador: 'mello', palavra_passe: 'errada' }),
    });
    assert.equal(res.status, 401);
    assert.match(await res.text(), /Nome de utilizador ou palavra-passe incorretos/);
  });

  it('recusa pedidos de outra origem', async () => {
    const res = await pedir('/entrar', {
      method: 'POST',
      headers: { origin: 'https://site-malicioso.example' },
      body: new URLSearchParams({ utilizador: 'mello', palavra_passe: 'segredo123' }),
    });
    assert.equal(res.status, 403);
  });

  it('inicia sessão e não aceita redirecionamentos externos', async () => {
    const res = await pedir('/entrar', {
      method: 'POST',
      body: new URLSearchParams({ utilizador: 'MELLO', palavra_passe: 'segredo123', seguinte: '//exemplo.com' }),
    });
    assert.equal(res.status, 302);
    assert.equal(res.headers.get('location'), '/painel');
    cookie = res.headers.get('set-cookie').split(';')[0];
    const painel = await pedir('/painel');
    assert.match(await painel.text(), /Olá, Mello!/);
  });

  it('publica um jogo em .zip e serve os ficheiros', async () => {
    const res = await pedir('/painel/novo', {
      method: 'POST',
      body: formulario(
        { titulo: 'Aventura no Algarve', categoria: 'Aventura', descricao: 'Um jogo de praia.', tipo: 'ficheiro', publicado: '1' },
        {
          ficheiro_jogo: {
            nome: 'jogo.zip',
            tipo: 'application/zip',
            conteudo: zipJogo({ 'build/index.html': '<h1>Olá</h1>', 'build/jogo.wasm.br': 'xx' }),
          },
          capa: { nome: 'capa.png', tipo: 'image/png', conteudo: 'png' },
        },
      ),
    });
    assert.equal(res.status, 302);
    assert.equal(res.headers.get('location'), '/jogo/aventura-no-algarve');

    const pagina = await (await pedir('/jogo/aventura-no-algarve')).text();
    const url = pagina.match(/data-url="([^"]+)"/)[1];
    assert.match(url, /^\/ficheiros\/jogos\/[^/]+\/build\/index\.html$/);
    assert.equal(await (await pedir(url)).text(), '<h1>Olá</h1>');

    const wasm = await pedir(url.replace('index.html', 'jogo.wasm.br'));
    assert.equal(wasm.headers.get('content-encoding'), 'br');
    assert.equal(wasm.headers.get('content-type'), 'application/wasm');

    const inicio = await (await pedir('/?q=algarve')).text();
    assert.match(inicio, /Aventura no Algarve/);
  });

  it('conta jogadas', async () => {
    assert.equal((await pedir('/jogo/aventura-no-algarve/jogada', { method: 'POST' })).status, 204);
    assert.match(await (await pedir('/jogo/aventura-no-algarve')).text(), /1 jogada/);
  });

  it('rejeita zip com caminhos maliciosos', async () => {
    const zip = new AdmZip();
    zip.addFile('index.html', Buffer.from('ok'));
    zip.getEntries()[0].entryName = '../../fora.html';
    const res = await pedir('/painel/novo', {
      method: 'POST',
      body: formulario(
        { titulo: 'Mau', categoria: 'Outro', tipo: 'ficheiro' },
        { ficheiro_jogo: { nome: 'mau.zip', tipo: 'application/zip', conteudo: zip.toBuffer() } },
      ),
    });
    assert.equal(res.status, 400);
    assert.match(await res.text(), /caminhos inválidos/);
    assert.ok(!fs.existsSync(path.join(pastaDados, 'fora.html')));
  });

  it('rejeita zip sem index.html', async () => {
    const res = await pedir('/painel/novo', {
      method: 'POST',
      body: formulario(
        { titulo: 'Sem índice', categoria: 'Outro', tipo: 'ficheiro' },
        { ficheiro_jogo: { nome: 'x.zip', tipo: 'application/zip', conteudo: zipJogo({ 'a.html': '1', 'b.html': '2' }) } },
      ),
    });
    assert.equal(res.status, 400);
    assert.match(await res.text(), /Não foi encontrado nenhum index\.html/);
  });

  it('publica rascunho com ligação externa, escondido do público', async () => {
    const res = await pedir('/painel/novo', {
      method: 'POST',
      body: formulario({ titulo: 'Rascunho <b>secreto</b>', categoria: 'Puzzle', tipo: 'ligacao', url_externo: 'https://itch.io/embed-upload/1' }),
    });
    assert.equal(res.status, 302);
    const slug = res.headers.get('location').split('/').pop();
    assert.equal(slug, 'rascunho-b-secreto-b');

    const doDono = await (await pedir(`/jogo/${slug}`)).text();
    assert.match(doDono, /Rascunho &lt;b&gt;secreto&lt;\/b&gt;/);
    assert.match(doDono, /só tu o consegues ver/);

    const anonimo = await fetch(`${base}/jogo/${slug}`);
    assert.equal(anonimo.status, 404);
    assert.match(await anonimo.text(), /Esta página não existe/);
  });

  it('rejeita ligações que não sejam http(s)', async () => {
    const res = await pedir('/painel/novo', {
      method: 'POST',
      body: formulario({ titulo: 'XSS', categoria: 'Outro', tipo: 'ligacao', url_externo: 'javascript:alert(1)' }),
    });
    assert.equal(res.status, 400);
  });

  it('outro autor não pode editar nem eliminar jogos alheios', async () => {
    const entrada = await pedir('/entrar', {
      method: 'POST',
      headers: { cookie: '' },
      body: new URLSearchParams({ utilizador: 'amigo', palavra_passe: 'segredo456' }),
    });
    const cookieAmigo = entrada.headers.get('set-cookie').split(';')[0];
    const res = await pedir('/painel/jogo/1/eliminar', { method: 'POST', headers: { cookie: cookieAmigo } });
    assert.equal(res.status, 404);
    assert.equal((await pedir('/jogo/aventura-no-algarve')).status, 200);
  });

  it('edita e elimina um jogo, apagando os ficheiros', async () => {
    const editar = await pedir('/painel/jogo/1/editar', {
      method: 'POST',
      body: formulario({ titulo: 'Aventura no Algarve 2', categoria: 'Ação', tipo: 'ficheiro', publicado: '1', remover_capa: '1' }),
    });
    assert.equal(editar.status, 302);
    assert.equal(fs.readdirSync(path.join(pastaDados, 'capas')).length, 0);
    assert.match(await (await pedir('/jogo/aventura-no-algarve')).text(), /Aventura no Algarve 2/);

    const eliminar = await pedir('/painel/jogo/1/eliminar', { method: 'POST' });
    assert.equal(eliminar.status, 302);
    assert.equal((await pedir('/jogo/aventura-no-algarve')).status, 404);
    assert.equal(fs.readdirSync(path.join(pastaDados, 'jogos')).length, 0);
    assert.equal(fs.readdirSync(path.join(pastaDados, 'temp')).length, 0);
  });

  it('termina sessão', async () => {
    await pedir('/sair', { method: 'POST' });
    assert.equal((await pedir('/painel')).status, 302);
  });
});

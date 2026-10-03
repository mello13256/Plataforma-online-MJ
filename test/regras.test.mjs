// Testa as regras de segurança do Firestore (corre com o emulador: npm test).
import fs from 'node:fs';
import { after, before, beforeEach, describe, it } from 'node:test';
import {
  assertFails, assertSucceeds, initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection, deleteDoc, doc, getDoc, getDocs, increment, query, serverTimestamp, setDoc, setLogLevel, updateDoc,
  where,
} from 'firebase/firestore';

// Os pedidos recusados de propósito não precisam de aparecer no registo.
setLogLevel('silent');

let ambiente;

const jogoBase = (extra = {}) => ({
  titulo: 'Aventura no Algarve',
  descricao: 'Um jogo de praia.',
  instrucoes: '',
  categoria: 'Aventura',
  tipo: 'repositorio',
  caminho: 'jogos/aventura/index.html',
  url_externo: null,
  capa: 'jogos/aventura/capa.png',
  publicado: true,
  jogadas: 0,
  autor_uid: 'mello',
  criado_em: serverTimestamp(),
  atualizado_em: serverTimestamp(),
  ...extra,
});

before(async () => {
  const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080').split(':');
  ambiente = await initializeTestEnvironment({
    projectId: 'demo-jogos-mj',
    firestore: { rules: fs.readFileSync('firestore.rules', 'utf8'), host, port: Number(port) },
  });
});

after(() => ambiente.cleanup());

beforeEach(async () => {
  await ambiente.clearFirestore();
  await ambiente.withSecurityRulesDisabled(async (contexto) => {
    const bd = contexto.firestore();
    await setDoc(doc(bd, 'autores/mello'), { nome: 'Mello', utilizador: 'mello' });
    await setDoc(doc(bd, 'autores/amigo'), { nome: 'Amigo', utilizador: 'amigo' });
    await setDoc(doc(bd, 'jogos/publicado'), { ...jogoBase(), criado_em: new Date(), atualizado_em: new Date() });
    await setDoc(doc(bd, 'jogos/rascunho'), { ...jogoBase({ publicado: false }), criado_em: new Date(), atualizado_em: new Date() });
  });
});

const visitante = () => ambiente.unauthenticatedContext().firestore();
const autor = (uid) => ambiente.authenticatedContext(uid).firestore();

describe('regras do Firestore', () => {
  it('visitantes leem jogos publicados e autores', async () => {
    await assertSucceeds(getDoc(doc(visitante(), 'jogos/publicado')));
    await assertSucceeds(getDocs(query(collection(visitante(), 'jogos'), where('publicado', '==', true))));
    await assertSucceeds(getDocs(collection(visitante(), 'autores')));
  });

  it('visitantes não leem rascunhos', async () => {
    await assertFails(getDoc(doc(visitante(), 'jogos/rascunho')));
    await assertFails(getDocs(collection(visitante(), 'jogos')));
  });

  it('autores leem rascunhos', async () => {
    await assertSucceeds(getDoc(doc(autor('amigo'), 'jogos/rascunho')));
  });

  it('visitantes só podem somar 1 jogada a jogos publicados', async () => {
    await assertSucceeds(updateDoc(doc(visitante(), 'jogos/publicado'), { jogadas: increment(1) }));
    await assertFails(updateDoc(doc(visitante(), 'jogos/publicado'), { jogadas: increment(5) }));
    await assertFails(updateDoc(doc(visitante(), 'jogos/publicado'), { titulo: 'Pirateado' }));
    await assertFails(updateDoc(doc(visitante(), 'jogos/rascunho'), { jogadas: increment(1) }));
  });

  it('autor cria jogo válido em seu nome', async () => {
    await assertSucceeds(setDoc(doc(autor('mello'), 'jogos/novo-jogo'), jogoBase()));
  });

  it('contas sem perfil de autor não criam jogos', async () => {
    await assertFails(setDoc(doc(autor('intruso'), 'jogos/novo'), jogoBase({ autor_uid: 'intruso' })));
    await assertFails(setDoc(doc(visitante(), 'jogos/novo'), jogoBase()));
  });

  it('não se cria jogo em nome de outro autor nem com jogadas falsas', async () => {
    await assertFails(setDoc(doc(autor('mello'), 'jogos/novo'), jogoBase({ autor_uid: 'amigo' })));
    await assertFails(setDoc(doc(autor('mello'), 'jogos/novo'), jogoBase({ jogadas: 999 })));
  });

  it('rejeita dados inválidos', async () => {
    const bd = autor('mello');
    await assertFails(setDoc(doc(bd, 'jogos/a'), jogoBase({ categoria: 'Inventada' })));
    await assertFails(setDoc(doc(bd, 'jogos/b'), jogoBase({ titulo: '' })));
    await assertFails(setDoc(doc(bd, 'jogos/c'), jogoBase({ caminho: 'jogos/../segredo/index.html' })));
    await assertFails(setDoc(doc(bd, 'jogos/d'), jogoBase({ caminho: '//malicioso.example/x.html' })));
    await assertFails(setDoc(doc(bd, 'jogos/e'), jogoBase({ capa: '//malicioso.example/x.png' })));
    await assertFails(setDoc(doc(bd, 'jogos/f'), jogoBase({ tipo: 'ligacao', caminho: null, url_externo: 'javascript:alert(1)' })));
    await assertFails(setDoc(doc(bd, 'jogos/g'), jogoBase({ extra: 'campo' })));
    await assertFails(setDoc(doc(bd, 'jogos/Maiusculas'), jogoBase()));
    await assertSucceeds(setDoc(doc(bd, 'jogos/h'), jogoBase({ tipo: 'ligacao', caminho: null, url_externo: 'https://itch.io/embed/1' })));
  });

  it('cada autor só edita e elimina os seus jogos', async () => {
    await assertFails(updateDoc(doc(autor('amigo'), 'jogos/publicado'), { titulo: 'Meu agora', atualizado_em: serverTimestamp() }));
    await assertFails(deleteDoc(doc(autor('amigo'), 'jogos/publicado')));
    await assertSucceeds(updateDoc(doc(autor('mello'), 'jogos/publicado'), { titulo: 'Novo título', atualizado_em: serverTimestamp() }));
    await assertFails(updateDoc(doc(autor('mello'), 'jogos/publicado'), { jogadas: 1000, atualizado_em: serverTimestamp() }));
    await assertSucceeds(deleteDoc(doc(autor('mello'), 'jogos/publicado')));
  });

  it('autores só mudam o próprio nome', async () => {
    await assertSucceeds(updateDoc(doc(autor('mello'), 'autores/mello'), { nome: 'Mello Silva' }));
    await assertFails(updateDoc(doc(autor('mello'), 'autores/amigo'), { nome: 'Pirateado' }));
    await assertFails(updateDoc(doc(autor('mello'), 'autores/mello'), { utilizador: 'outro' }));
    await assertFails(setDoc(doc(autor('intruso'), 'autores/intruso'), { nome: 'Eu', utilizador: 'eu' }));
  });
});

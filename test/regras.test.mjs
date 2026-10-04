// Testa as regras de segurança do Firestore (corre com o emulador: npm test).
import fs from 'node:fs';
import { after, before, beforeEach, describe, it } from 'node:test';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import {
  Bytes, collection, deleteDoc, doc, getDoc, getDocs, increment, query, serverTimestamp, setDoc, setLogLevel, updateDoc,
  where,
} from 'firebase/firestore';

// Os pedidos recusados de propósito não precisam de aparecer no registo.
setLogLevel('silent');

const DONO = 'PIgsxFjHYDc32oIqh5yD4g7uDmF3';
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
  capa_imagem: null,
  transferencias: [],
  publicado: true,
  jogadas: 0,
  autor_uid: 'joel',
  criado_em: serverTimestamp(),
  atualizado_em: serverTimestamp(),
  ...extra,
});

const perfil = (nome, utilizador, permissoes) => ({ nome, utilizador, permissoes });

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
    const agora = new Date();
    await setDoc(doc(bd, `autores/${DONO}`), perfil('Miguel', 'miguel', { admin: true }));
    await setDoc(doc(bd, 'autores/joel'), perfil('Joel', 'joel', { publicar: true }));
    await setDoc(doc(bd, 'autores/antigo'), { nome: 'Antigo', utilizador: 'antigo' }); // sem permissões: pode publicar
    await setDoc(doc(bd, 'autores/editor'), perfil('Editor', 'editor', { publicar: false, editar_todos: true }));
    await setDoc(doc(bd, 'autores/bloqueado'), perfil('Bloqueado', 'bloqueado', { publicar: false }));
    await setDoc(doc(bd, 'jogos/publicado'), { ...jogoBase(), criado_em: agora, atualizado_em: agora });
    await setDoc(doc(bd, 'jogos/rascunho'), { ...jogoBase({ publicado: false }), criado_em: agora, atualizado_em: agora });
  });
});

const visitante = () => ambiente.unauthenticatedContext().firestore();
const como = (uid, email) => ambiente.authenticatedContext(uid, email ? { email } : {}).firestore();

describe('jogos', () => {
  it('convidados veem jogos publicados mas não rascunhos', async () => {
    await assertSucceeds(getDoc(doc(visitante(), 'jogos/publicado')));
    await assertSucceeds(getDocs(query(collection(visitante(), 'jogos'), where('publicado', '==', true))));
    await assertFails(getDoc(doc(visitante(), 'jogos/rascunho')));
    await assertSucceeds(getDoc(doc(como('joel'), 'jogos/rascunho')));
  });

  it('convidados só somam 1 jogada a jogos publicados', async () => {
    await assertSucceeds(updateDoc(doc(visitante(), 'jogos/publicado'), { jogadas: increment(1) }));
    await assertFails(updateDoc(doc(visitante(), 'jogos/publicado'), { jogadas: increment(5) }));
    await assertFails(updateDoc(doc(visitante(), 'jogos/publicado'), { titulo: 'Pirateado' }));
    await assertFails(updateDoc(doc(visitante(), 'jogos/rascunho'), { jogadas: increment(1) }));
  });

  it('quem tem «publicar» cria jogos em seu nome', async () => {
    await assertSucceeds(setDoc(doc(como('joel'), 'jogos/novo'), jogoBase()));
    await assertSucceeds(setDoc(doc(como('antigo'), 'jogos/outro'), jogoBase({ autor_uid: 'antigo' })));
    await assertFails(setDoc(doc(como('joel'), 'jogos/x'), jogoBase({ autor_uid: 'antigo' })));
    await assertFails(setDoc(doc(como('joel'), 'jogos/y'), jogoBase({ jogadas: 9 })));
  });

  it('sem «publicar» ou sem perfil não se cria nada', async () => {
    await assertFails(setDoc(doc(como('bloqueado'), 'jogos/a'), jogoBase({ autor_uid: 'bloqueado' })));
    await assertFails(setDoc(doc(como('intruso'), 'jogos/b'), jogoBase({ autor_uid: 'intruso' })));
    await assertFails(setDoc(doc(visitante(), 'jogos/c'), jogoBase()));
  });

  it('aceita categorias personalizadas, capas enviadas e transferências', async () => {
    const bd = como('joel');
    await assertSucceeds(setDoc(doc(bd, 'jogos/a'), jogoBase({ categoria: 'Roguelike de cartas' })));
    await assertSucceeds(setDoc(doc(bd, 'jogos/b'), jogoBase({ capa: null, capa_imagem: 'data:image/webp;base64,UklGRg==' })));
    await assertSucceeds(setDoc(doc(bd, 'jogos/c'), jogoBase({
      tipo: 'nenhum', caminho: null,
      transferencias: [{ rotulo: 'Windows (.exe)', url: 'https://github.com/x/y/releases/download/v1/jogo.exe' }],
    })));
  });

  it('rejeita dados inválidos', async () => {
    const bd = como('joel');
    await assertFails(setDoc(doc(bd, 'jogos/a'), jogoBase({ categoria: '' })));
    await assertFails(setDoc(doc(bd, 'jogos/b'), jogoBase({ titulo: '' })));
    await assertFails(setDoc(doc(bd, 'jogos/c'), jogoBase({ caminho: 'jogos/../segredo/index.html' })));
    await assertFails(setDoc(doc(bd, 'jogos/d'), jogoBase({ caminho: '//malicioso.example/x.html' })));
    await assertFails(setDoc(doc(bd, 'jogos/e'), jogoBase({ tipo: 'ligacao', caminho: null, url_externo: 'javascript:alert(1)' })));
    await assertFails(setDoc(doc(bd, 'jogos/f'), jogoBase({ capa_imagem: 'data:text/html;base64,PHNjcmlwdD4=' })));
    await assertFails(setDoc(doc(bd, 'jogos/g'), jogoBase({ transferencias: [{ rotulo: 'x', url: 'javascript:alert(1)' }] })));
    await assertFails(setDoc(doc(bd, 'jogos/h'), jogoBase({ tipo: 'nenhum', caminho: null, transferencias: [] })));
    await assertFails(setDoc(doc(bd, 'jogos/i'), jogoBase({ extra: 'campo' })));
    await assertFails(setDoc(doc(bd, 'jogos/Maiusculas'), jogoBase()));
  });

  it('pastas reservadas: só a conta dona publica o jogo dessa pasta', async () => {
    const reservado = { caminho: 'jogos/cinzas-de-valdoria/index.html', capa: 'jogos/cinzas-de-valdoria/capa.png' };
    // outras contas não o publicam, nem como pasta do GitHub nem por ligação para os mesmos ficheiros
    await assertFails(setDoc(doc(como('joel'), 'jogos/copia'), jogoBase(reservado)));
    await assertFails(setDoc(doc(como('joel'), 'jogos/copia2'), jogoBase({
      tipo: 'ligacao', caminho: null, url_externo: 'https://plataforma-web-mj.web.app/jogos/cinzas-de-valdoria/index.html',
    })));
    await assertFails(setDoc(doc(como('joel'), 'jogos/copia3'), jogoBase({
      tipo: 'ligacao', caminho: null, url_externo: 'https://mello13256.github.io/Plataforma-online-MJ/jogos/Cinzas-de-Valdoria/',
    })));
    // nem mudam um jogo seu para apontar para a pasta reservada
    await assertFails(updateDoc(doc(como('joel'), 'jogos/publicado'), { ...reservado, atualizado_em: serverTimestamp() }));
    // um administrador também não o publica em nome próprio
    await ambiente.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), 'autores/admin2'), perfil('Admin', 'admin2', { admin: true })));
    await assertFails(setDoc(doc(como('admin2'), 'jogos/copia4'), jogoBase({ ...reservado, autor_uid: 'admin2' })));
    // o dono publica-o e edita-o; as outras pastas continuam livres
    await assertSucceeds(setDoc(doc(como(DONO), 'jogos/cinzas'), jogoBase({ ...reservado, autor_uid: DONO })));
    await assertSucceeds(updateDoc(doc(como(DONO), 'jogos/cinzas'), { titulo: 'Cinzas de Valdoria', atualizado_em: serverTimestamp() }));
    await assertSucceeds(setDoc(doc(como('joel'), 'jogos/outro'), jogoBase({ caminho: 'jogos/apanha-as-estrelas/index.html' })));
    await assertSucceeds(setDoc(doc(como('joel'), 'jogos/link'), jogoBase({
      tipo: 'ligacao', caminho: null, url_externo: 'https://itch.io/embed-upload/123',
    })));
  });

  it('edição e eliminação respeitam as permissões', async () => {
    const editar = (uid) => updateDoc(doc(como(uid), 'jogos/publicado'), { titulo: 'Novo', atualizado_em: serverTimestamp() });
    await assertSucceeds(editar('joel'));
    await assertSucceeds(editar('editor'));
    await assertSucceeds(editar(DONO));
    await assertFails(editar('antigo'));
    await assertFails(editar('bloqueado'));
    await assertFails(updateDoc(doc(como('joel'), 'jogos/publicado'), { jogadas: 1000, atualizado_em: serverTimestamp() }));
    await assertFails(updateDoc(doc(como('editor'), 'jogos/publicado'), { autor_uid: 'editor', atualizado_em: serverTimestamp() }));

    await assertFails(deleteDoc(doc(como('editor'), 'jogos/publicado')));
    await assertFails(deleteDoc(doc(como('antigo'), 'jogos/publicado')));
    await assertSucceeds(deleteDoc(doc(como(DONO), 'jogos/publicado')));
    await assertSucceeds(deleteDoc(doc(como('joel'), 'jogos/rascunho')));
  });
});

describe('utilizadores e permissões', () => {
  it('cada um muda só o próprio nome', async () => {
    await assertSucceeds(updateDoc(doc(como('joel'), 'autores/joel'), { nome: 'Joel Matos' }));
    await assertFails(updateDoc(doc(como('joel'), 'autores/joel'), { permissoes: { admin: true } }));
    await assertFails(updateDoc(doc(como('joel'), 'autores/antigo'), { nome: 'Pirateado' }));
  });

  it('o administrador gere permissões e remove utilizadores', async () => {
    const admin = como(DONO);
    await assertSucceeds(updateDoc(doc(admin, 'autores/joel'), { permissoes: { publicar: true, eliminar_todos: true } }));
    await assertFails(updateDoc(doc(admin, 'autores/joel'), { permissoes: { voar: true } }));
    await assertSucceeds(deleteDoc(doc(admin, 'autores/bloqueado')));
    await assertFails(deleteDoc(doc(como('joel'), 'autores/antigo')));
  });

  it('o dono nunca perde a administração', async () => {
    await assertFails(updateDoc(doc(como(DONO), `autores/${DONO}`), { permissoes: { publicar: true } }));
    await assertFails(deleteDoc(doc(como(DONO), `autores/${DONO}`)));
    await assertSucceeds(updateDoc(doc(como(DONO), 'autores/joel'), { permissoes: { admin: true } }));
    await assertFails(deleteDoc(doc(como('joel'), `autores/${DONO}`)));
  });

  it('só o administrador cria perfis para contas novas', async () => {
    const novo = perfil('Ana', 'ana', { publicar: true });
    await assertSucceeds(setDoc(doc(como(DONO), 'autores/uid-ana'), novo));
    await assertFails(setDoc(doc(como('joel'), 'autores/uid-x'), novo));
    await assertFails(setDoc(doc(como(DONO), 'autores/uid-y'), perfil('Ana', 'Ana Maiúsculas', { publicar: true })));
  });

  it('uma conta nova não cria o próprio perfil', async () => {
    await assertFails(setDoc(doc(como('intruso', 'intruso@exemplo.pt'), 'autores/intruso'), perfil('Eu', 'eu', { publicar: true })));
    await assertFails(setDoc(doc(como('intruso'), 'jogos/x'), jogoBase({ autor_uid: 'intruso' })));
  });
});

describe('pacotes (ficheiros carregados no site)', () => {
  const pacote = (dono, extra = {}) => ({ dono, partes: 1, tamanho: 3, nome: 'jogo.zip', criado_em: serverTimestamp(), ...extra });
  const parte = (n = 3) => ({ dados: Bytes.fromUint8Array(new Uint8Array(n)) });

  it('quem pode publicar carrega pacotes e as partes', async () => {
    const bd = como('joel');
    await assertSucceeds(setDoc(doc(bd, 'pacotes/pacote-joel-1'), pacote('joel')));
    await assertSucceeds(setDoc(doc(bd, 'pacotes/pacote-joel-1/partes/000'), parte()));
    await assertSucceeds(getDoc(doc(visitante(), 'pacotes/pacote-joel-1/partes/000')));
  });

  it('não se carregam partes em pacotes alheios nem pacotes inválidos', async () => {
    await assertSucceeds(setDoc(doc(como('joel'), 'pacotes/pacote-joel-2'), pacote('joel')));
    await assertFails(setDoc(doc(como('antigo'), 'pacotes/pacote-joel-2/partes/001'), parte()));
    await assertFails(setDoc(doc(como('bloqueado'), 'pacotes/pacote-bloq-1'), pacote('bloqueado')));
    await assertFails(setDoc(doc(como('joel'), 'pacotes/pacote-joel-3'), pacote('antigo')));
    await assertFails(setDoc(doc(como('joel'), 'pacotes/pacote-joel-4'), pacote('joel', { tamanho: 999999999 })));
    await assertFails(setDoc(doc(visitante(), 'pacotes/pacote-anonimo'), pacote('ninguem')));
  });

  it('jogos podem usar um pacote e transferências carregadas no site', async () => {
    const bd = como('joel');
    await assertSucceeds(setDoc(doc(bd, 'jogos/carregado'), jogoBase({
      tipo: 'pacote', caminho: null, pacote: { id: 'pacote-joel-1', entrada: 'build/index.html' },
      transferencias: [{ rotulo: 'Windows (.exe)', url: '/transferir/pacote-joel-9/Jogo.exe' }],
    })));
    await assertFails(setDoc(doc(bd, 'jogos/mau'), jogoBase({ tipo: 'pacote', caminho: null, pacote: { id: 'x', entrada: 'index.html' } })));
    await assertFails(setDoc(doc(bd, 'jogos/mau2'), jogoBase({ transferencias: [{ rotulo: 'x', url: '/outro/sitio' }] })));
  });

  it('só o dono ou quem gere jogos apaga pacotes', async () => {
    await assertSucceeds(setDoc(doc(como('joel'), 'pacotes/pacote-joel-5'), pacote('joel')));
    await assertSucceeds(setDoc(doc(como('joel'), 'pacotes/pacote-joel-5/partes/000'), parte()));
    await assertFails(deleteDoc(doc(como('antigo'), 'pacotes/pacote-joel-5/partes/000')));
    await assertSucceeds(deleteDoc(doc(como(DONO), 'pacotes/pacote-joel-5/partes/000')));
    await assertSucceeds(deleteDoc(doc(como('joel'), 'pacotes/pacote-joel-5')));
  });
});

describe('gostos, comentários e galeria', () => {
  it('convidados dão e retiram gostos, um de cada vez', async () => {
    const ref = doc(visitante(), 'jogos/publicado');
    await assertSucceeds(updateDoc(ref, { gostos: 1 }));
    await assertSucceeds(updateDoc(ref, { gostos: increment(1) }));
    await assertSucceeds(updateDoc(ref, { gostos: increment(-1) }));
    await assertFails(updateDoc(ref, { gostos: increment(5) }));
    await assertFails(updateDoc(doc(visitante(), 'jogos/rascunho'), { gostos: 1 }));
    await assertFails(updateDoc(doc(como('joel'), 'jogos/publicado'), { gostos: 99, atualizado_em: serverTimestamp() }));
  });

  it('não se tiram gostos abaixo de zero', async () => {
    await assertFails(updateDoc(doc(visitante(), 'jogos/publicado'), { gostos: -1 }));
  });

  it('qualquer pessoa comenta jogos publicados', async () => {
    const comentario = { nome: 'Rui', texto: 'Muito fixe!', criado_em: serverTimestamp() };
    await assertSucceeds(setDoc(doc(visitante(), 'jogos/publicado/comentarios/c1'), comentario));
    await assertSucceeds(setDoc(doc(como('joel'), 'jogos/publicado/comentarios/c2'), { ...comentario, uid: 'joel' }));
    await assertFails(setDoc(doc(como('joel'), 'jogos/publicado/comentarios/c3'), { ...comentario, uid: 'antigo' }));
    await assertFails(setDoc(doc(visitante(), 'jogos/rascunho/comentarios/c4'), comentario));
    await assertFails(setDoc(doc(visitante(), 'jogos/publicado/comentarios/c5'), { ...comentario, texto: '' }));
    await assertFails(setDoc(doc(visitante(), 'jogos/publicado/comentarios/c6'), { ...comentario, texto: 'x'.repeat(1001) }));
  });

  it('o autor do jogo e os moderadores apagam comentários', async () => {
    await assertSucceeds(setDoc(doc(visitante(), 'jogos/publicado/comentarios/c1'), { nome: 'Rui', texto: 'spam', criado_em: serverTimestamp() }));
    await assertFails(deleteDoc(doc(visitante(), 'jogos/publicado/comentarios/c1')));
    await assertFails(deleteDoc(doc(como('antigo'), 'jogos/publicado/comentarios/c1')));
    await assertSucceeds(deleteDoc(doc(como('joel'), 'jogos/publicado/comentarios/c1')));
  });

  it('galeria: só quem edita o jogo mexe nas imagens', async () => {
    const imagens = { imagens: ['data:image/webp;base64,UklGRg=='] };
    await assertSucceeds(setDoc(doc(como('joel'), 'galerias/publicado'), imagens));
    await assertSucceeds(setDoc(doc(como('editor'), 'galerias/publicado'), imagens));
    await assertFails(setDoc(doc(como('antigo'), 'galerias/publicado'), imagens));
    await assertFails(setDoc(doc(como('joel'), 'galerias/publicado'), { imagens: ['javascript:alert(1)'] }));
    await assertFails(setDoc(doc(como('joel'), 'galerias/publicado'), { imagens: Array(5).fill(imagens.imagens[0]) }));
    await assertSucceeds(getDoc(doc(visitante(), 'galerias/publicado')));
  });
});

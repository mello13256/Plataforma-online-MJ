// Ligação ao Firebase. No Firebase Hosting, a configuração é lida automaticamente
// de /__/firebase/init.json; em localhost usa os emuladores (npm run local).
import { deleteApp, initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import {
  connectAuthEmulator, createUserWithEmailAndPassword, getAuth, signOut as terminarSessao,
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import { connectFirestoreEmulator, getFirestore } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';

export {
  EmailAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
export {
  Bytes,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';

const local = ['localhost', '127.0.0.1'].includes(location.hostname);

async function lerConfiguracao() {
  if (local) return { projectId: 'demo-jogos-mj', apiKey: 'demo', authDomain: 'localhost' };
  const resposta = await fetch('/__/firebase/init.json');
  if (!resposta.ok) throw new Error('Não foi possível ler a configuração do Firebase.');
  return resposta.json();
}

let configuracao;
try {
  configuracao = await lerConfiguracao();
} catch (erro) {
  document.getElementById('conteudo')?.replaceChildren(
    Object.assign(document.createElement('p'), {
      className: 'erro-form',
      textContent: 'O site ainda não está ligado ao Firebase. Confirma que registaste uma app Web no projeto (ver README).',
    }),
  );
  throw erro;
}

const app = initializeApp(configuracao);
export const auth = getAuth(app);
export const bd = getFirestore(app);

if (local) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(bd, '127.0.0.1', 8080);
}

// Cria uma conta nova sem mexer na sessão de quem está a usar o site
// (usa uma segunda instância do Firebase só para isso). Devolve o UID.
export async function criarConta(email, palavraPasse) {
  const secundaria = initializeApp(configuracao, `criar-conta-${Date.now()}`);
  try {
    const authSecundaria = getAuth(secundaria);
    if (local) connectAuthEmulator(authSecundaria, 'http://127.0.0.1:9099', { disableWarnings: true });
    const credencial = await createUserWithEmailAndPassword(authSecundaria, email, palavraPasse);
    await terminarSessao(authSecundaria);
    return credencial.user.uid;
  } finally {
    await deleteApp(secundaria);
  }
}

import { auth, sendPasswordResetEmail, signInWithEmailAndPassword } from './firebase.js';
import { definirTitulo, el, mensagem, traduzirErro, utilizadorAtual, preencher } from './comum.js';

const conteudo = document.getElementById('conteudo');
const pedido = new URLSearchParams(location.search).get('seguinte') || '';
// Só permite voltar para páginas deste site.
const seguinte = /^\/(?![/\\])/.test(pedido) ? pedido : '/painel';

definirTitulo('Iniciar sessão');

if (await utilizadorAtual) {
  location.replace(seguinte);
} else {
  const aviso = el('div');
  const email = el('input', { type: 'email', name: 'email', autocomplete: 'username', required: true, autofocus: true });
  const palavraPasse = el('input', { type: 'password', name: 'palavra_passe', autocomplete: 'current-password', required: true });
  const botao = el('button', { class: 'botao', type: 'submit' }, 'Entrar');

  const formulario = el('form', {
    class: 'formulario',
    onsubmit: async (evento) => {
      evento.preventDefault();
      botao.disabled = true;
      aviso.replaceChildren();
      try {
        await signInWithEmailAndPassword(auth, email.value.trim(), palavraPasse.value);
        location.replace(seguinte);
      } catch (erro) {
        aviso.replaceChildren(mensagem('erro-form', traduzirErro(erro)));
        botao.disabled = false;
      }
    },
  },
    el('label', {}, 'Email', email),
    el('label', {}, 'Palavra-passe', palavraPasse),
    botao,
    el('button', {
      class: 'ligacao discreta',
      type: 'button',
      onclick: async () => {
        if (!email.value.trim()) {
          aviso.replaceChildren(mensagem('erro-form', 'Escreve primeiro o teu email.'));
          return;
        }
        try {
          await sendPasswordResetEmail(auth, email.value.trim());
          aviso.replaceChildren(mensagem('sucesso', 'Se o email tiver conta, vais receber uma mensagem para definires uma nova palavra-passe.'));
        } catch (erro) {
          aviso.replaceChildren(mensagem('erro-form', traduzirErro(erro)));
        }
      },
    }, 'Esqueci-me da palavra-passe'),
  );

  preencher(conteudo, 
    el('section', { class: 'formulario-estreito' },
      el('h1', {}, 'Iniciar sessão'),
      el('p', { class: 'ajuda' }, 'Área reservada aos autores da plataforma.'),
      aviso,
      formulario,
    ),
  );
}

import { auth, sendPasswordResetEmail, signInWithEmailAndPassword } from './firebase.js';
import { definirTitulo, el, icone, mensagem, preencher, traduzirErro, utilizadorAtual } from './comum.js';

const conteudo = document.getElementById('conteudo');
const pedido = new URLSearchParams(location.search).get('seguinte') || '';
// Só permite voltar para páginas deste site.
const seguinte = /^\/(?![/\\])/.test(pedido) ? pedido : '/painel';

definirTitulo('Entrar');

if (await utilizadorAtual) {
  location.replace(seguinte);
} else {
  const aviso = el('div');
  const email = el('input', { type: 'email', name: 'email', autocomplete: 'username', required: true, autofocus: true });
  const palavraPasse = el('input', { type: 'password', name: 'palavra_passe', autocomplete: 'current-password', required: true });
  const botao = el('button', { class: 'botao grande', type: 'submit' }, 'Entrar');

  const formulario = el('form', {
    class: 'formulario',
    onsubmit: async (evento) => {
      evento.preventDefault();
      botao.disabled = true;
      preencher(aviso);
      try {
        await signInWithEmailAndPassword(auth, email.value.trim(), palavraPasse.value);
        location.replace(seguinte);
      } catch (erro) {
        preencher(aviso, mensagem('erro-form', traduzirErro(erro)));
        botao.disabled = false;
      }
    },
  },
    aviso,
    el('label', {}, el('span', {}, 'Email'), email),
    el('label', {}, el('span', {}, 'Palavra-passe'), palavraPasse),
    botao,
    el('button', {
      class: 'ligacao',
      type: 'button',
      onclick: async () => {
        if (!email.value.trim()) {
          preencher(aviso, mensagem('erro-form', 'Escreve primeiro o teu email.'));
          return;
        }
        try {
          await sendPasswordResetEmail(auth, email.value.trim());
          preencher(aviso, mensagem('sucesso', 'Se o email tiver conta, vais receber uma mensagem para definires uma nova palavra-passe.'));
        } catch (erro) {
          preencher(aviso, mensagem('erro-form', traduzirErro(erro)));
        }
      },
    }, 'Esqueci-me da palavra-passe'),
  );

  preencher(conteudo,
    el('section', { class: 'cartao-form estreito formulario' },
      el('div', {},
        el('h1', {}, 'Área de autores'),
        el('p', { class: 'ajuda' }, 'Só precisas de entrar para publicar ou gerir jogos.'),
      ),
      formulario,
      mensagem('info', el('span', {}, 'Só queres jogar? Não precisas de conta. ', el('a', { href: '/' }, 'Continuar como convidado'), ' →')),
    ),
  );
}

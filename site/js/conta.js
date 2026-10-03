import { EmailAuthProvider, bd, doc, getDoc, reauthenticateWithCredential, updateDoc, updatePassword } from './firebase.js';
import { definirTitulo, el, exigirSessao, mensagem, traduzirErro, preencher } from './comum.js';

const conteudo = document.getElementById('conteudo');
definirTitulo('A minha conta');

try {
  const utilizador = await exigirSessao();
  const perfil = await getDoc(doc(bd, 'autores', utilizador.uid));
  if (!perfil.exists()) {
    location.replace('/painel');
  } else {
    const aviso = el('div');
    const nome = el('input', { name: 'nome', value: perfil.data().nome, maxlength: '40', required: true });
    const atual = el('input', { type: 'password', autocomplete: 'current-password' });
    const nova = el('input', { type: 'password', autocomplete: 'new-password', minlength: '8' });
    const confirmar = el('input', { type: 'password', autocomplete: 'new-password', minlength: '8' });
    const botao = el('button', { class: 'botao', type: 'submit' }, 'Guardar');

    const guardar = async (evento) => {
      evento.preventDefault();
      aviso.replaceChildren();
      const novoNome = nome.value.trim();
      if (!novoNome) return aviso.replaceChildren(mensagem('erro-form', 'O nome não pode ficar vazio.'));
      if (nova.value) {
        if (nova.value.length < 8) return aviso.replaceChildren(mensagem('erro-form', 'A nova palavra-passe tem de ter pelo menos 8 caracteres.'));
        if (nova.value !== confirmar.value) return aviso.replaceChildren(mensagem('erro-form', 'As novas palavras-passe não coincidem.'));
        if (!atual.value) return aviso.replaceChildren(mensagem('erro-form', 'Escreve a palavra-passe atual para a poderes alterar.'));
      }
      botao.disabled = true;
      try {
        if (novoNome !== perfil.data().nome) await updateDoc(doc(bd, 'autores', utilizador.uid), { nome: novoNome });
        if (nova.value) {
          await reauthenticateWithCredential(utilizador, EmailAuthProvider.credential(utilizador.email, atual.value));
          await updatePassword(utilizador, nova.value);
        }
        location.href = '/painel?ok=conta';
      } catch (erro) {
        aviso.replaceChildren(mensagem('erro-form', traduzirErro(erro)));
        botao.disabled = false;
      }
    };

    preencher(conteudo, 
      el('section', { class: 'formulario-estreito' },
        el('p', {}, el('a', { href: '/painel' }, '← Voltar ao painel')),
        el('h1', {}, 'A minha conta'),
        el('p', { class: 'ajuda' }, `Sessão iniciada como ${utilizador.email}`),
        aviso,
        el('form', { class: 'formulario', onsubmit: guardar },
          el('label', {}, 'Nome a apresentar', nome),
          el('fieldset', {},
            el('legend', {}, 'Alterar palavra-passe'),
            el('label', {}, el('span', {}, 'Palavra-passe atual'), atual),
            el('label', {}, el('span', {}, 'Nova palavra-passe ', el('span', { class: 'opcional' }, '(deixa vazio para não alterar)')), nova),
            el('label', {}, 'Confirmar nova palavra-passe', confirmar),
          ),
          botao,
        ),
      ),
    );
  }
} catch (erro) {
  preencher(conteudo, mensagem('erro-form', traduzirErro(erro)));
}

import { EmailAuthProvider, bd, doc, reauthenticateWithCredential, updateDoc, updatePassword } from './firebase.js';
import { definirTitulo, el, exigirPerfil, icone, mensagem, preencher, traduzirErro, utilizadorAtual } from './comum.js';

const conteudo = document.getElementById('conteudo');
definirTitulo('A minha conta');

try {
  const perfil = await exigirPerfil(conteudo);
  if (perfil) {
    const utilizador = await utilizadorAtual;
    const aviso = el('div');
    const nome = el('input', { name: 'nome', value: perfil.nome, maxlength: '40', required: true });
    const atual = el('input', { type: 'password', autocomplete: 'current-password' });
    const nova = el('input', { type: 'password', autocomplete: 'new-password', minlength: '8' });
    const confirmar = el('input', { type: 'password', autocomplete: 'new-password', minlength: '8' });
    const botao = el('button', { class: 'botao', type: 'submit' }, 'Guardar alterações');
    const erro = (texto) => preencher(aviso, mensagem('erro-form', texto));

    const guardar = async (evento) => {
      evento.preventDefault();
      preencher(aviso);
      const novoNome = nome.value.trim();
      if (!novoNome) return erro('O nome não pode ficar vazio.');
      if (nova.value) {
        if (nova.value.length < 8) return erro('A nova palavra-passe tem de ter pelo menos 8 caracteres.');
        if (nova.value !== confirmar.value) return erro('As novas palavras-passe não coincidem.');
        if (!atual.value) return erro('Escreve a palavra-passe atual para a poderes alterar.');
      }
      botao.disabled = true;
      try {
        if (novoNome !== perfil.nome) await updateDoc(doc(bd, 'autores', perfil.uid), { nome: novoNome });
        if (nova.value) {
          await reauthenticateWithCredential(utilizador, EmailAuthProvider.credential(utilizador.email, atual.value));
          await updatePassword(utilizador, nova.value);
        }
        location.href = '/painel?ok=conta';
      } catch (e) {
        erro(traduzirErro(e));
        botao.disabled = false;
      }
    };

    preencher(conteudo,
      el('section', { class: 'largo formulario', style: 'max-width:560px' },
        el('a', { class: 'voltar', href: '/painel' }, icone('seta'), 'Voltar ao painel'),
        el('div', {}, el('h1', {}, 'A minha conta'), el('p', { class: 'ajuda' }, `Sessão iniciada como ${utilizador.email}`)),
        el('form', { class: 'cartao-form formulario', onsubmit: guardar },
          aviso,
          el('label', {}, el('span', {}, 'Nome a apresentar'), nome),
          el('div', { class: 'seccao-form' },
            el('h2', {}, 'Alterar palavra-passe'),
            el('label', { class: 'campo' }, el('span', {}, 'Palavra-passe atual'), atual),
            el('label', { class: 'campo' }, el('span', {}, 'Nova palavra-passe ', el('span', { class: 'opcional' }, '(deixa vazio para não alterar)')), nova),
            el('label', { class: 'campo' }, el('span', {}, 'Confirmar nova palavra-passe'), confirmar),
          ),
          botao,
        ),
      ),
    );
  }
} catch (erro) {
  preencher(conteudo, mensagem('erro-form', traduzirErro(erro)));
}

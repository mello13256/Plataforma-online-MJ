import { bd, collection, getDocs, query, where } from './firebase.js';
import {
  carregarAutores, definirTitulo, el, grelha, iniciais, mensagem, ordenarPorData, paginaErro, preencher, traduzirErro,
} from './comum.js';

const conteudo = document.getElementById('conteudo');
const utilizador = decodeURIComponent(location.pathname.replace(/^\/autor\//, '').replace(/\/$/, ''));

try {
  const autores = await carregarAutores();
  const autor = [...autores.values()].find((a) => a.utilizador === utilizador);
  if (!autor) {
    definirTitulo('Autor não encontrado');
    preencher(conteudo, paginaErro(404, 'Este autor não existe.'));
  } else {
    const resultado = await getDocs(
      query(collection(bd, 'jogos'), where('autor_uid', '==', autor.uid), where('publicado', '==', true)),
    );
    const jogos = ordenarPorData(resultado.docs.map((d) => ({ id: d.id, ...d.data() })));
    definirTitulo(autor.nome);
    preencher(conteudo,
      el('section', { class: 'destaque-principal' },
        el('div', { class: 'autor-linha' },
          el('span', { class: 'avatar', style: 'width:72px;height:72px;font-size:1.6rem' }, iniciais(autor.nome)),
          el('div', {},
            el('h1', {}, autor.nome),
            el('p', {}, `@${autor.utilizador} · ${jogos.length === 1 ? '1 jogo publicado' : `${jogos.length} jogos publicados`}`),
          ),
        ),
      ),
      el('section', {}, el('h2', {}, 'Jogos'), grelha(jogos, autores, 'Este autor ainda não publicou nenhum jogo.')),
    );
  }
} catch (erro) {
  preencher(conteudo, mensagem('erro-form', traduzirErro(erro)));
}

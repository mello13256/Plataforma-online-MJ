import { definirTitulo, paginaErro } from './comum.js';

definirTitulo('Página não encontrada');
document.getElementById('conteudo').replaceChildren(paginaErro(404, 'Esta página não existe.'));

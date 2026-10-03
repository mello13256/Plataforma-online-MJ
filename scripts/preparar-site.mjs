// Prepara a pasta «publicar/» que vai para o Firebase Hosting:
// - copia o site (pasta «site/»);
// - copia cada jogo da pasta «jogos/» (pastas ou ficheiros .zip, que são extraídos);
// - copia as imagens da pasta «capas/»;
// - gera «indice-repositorio.json», usado pelo painel para escolher jogos e capas.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import AdmZip from 'adm-zip';

const LIMITE_DESCOMPRIMIDO = 2 * 1024 * 1024 * 1024; // 2 GB por jogo
const IMAGENS = /\.(png|jpe?g|webp|gif)$/i;
const IGNORAR = new Set(['.DS_Store', 'Thumbs.db', '.gitkeep', 'LEIA-ME.md', '__MACOSX']);

export function criarSlug(texto) {
  const slug = texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '');
  return slug || 'jogo';
}

function paraPosix(caminho) {
  return caminho.split(path.sep).join('/');
}

function listarFicheiros(pasta, base = pasta) {
  const ficheiros = [];
  for (const entrada of fs.readdirSync(pasta, { withFileTypes: true })) {
    if (IGNORAR.has(entrada.name)) continue;
    const abs = path.join(pasta, entrada.name);
    if (entrada.isDirectory()) ficheiros.push(...listarFicheiros(abs, base));
    else ficheiros.push(paraPosix(path.relative(base, abs)));
  }
  return ficheiros;
}

function extrairZip(caminhoZip, destino) {
  const zip = new AdmZip(caminhoZip);
  const entradas = zip.getEntries().filter((e) => !e.isDirectory);
  const total = entradas.reduce((soma, e) => soma + e.header.size, 0);
  if (total > LIMITE_DESCOMPRIMIDO) throw new Error('o conteúdo descomprimido passa de 2 GB');
  for (const entrada of entradas) {
    const nome = entrada.entryName.replace(/\\/g, '/');
    if (nome.split('/').some((parte) => IGNORAR.has(parte))) continue;
    const alvo = path.resolve(destino, nome);
    if (!alvo.startsWith(destino + path.sep)) throw new Error(`caminho inválido dentro do .zip: ${nome}`);
    fs.mkdirSync(path.dirname(alvo), { recursive: true });
    fs.writeFileSync(alvo, entrada.getData());
  }
}

// Escolhe o ficheiro de entrada (o index.html menos profundo, ou o único .html) e a capa.
function analisarJogo(pasta) {
  const ficheiros = listarFicheiros(pasta);
  const profundidade = (f) => f.split('/').length;
  const htmls = ficheiros.filter((f) => /\.html?$/i.test(f));
  const indices = htmls.filter((f) => /(^|\/)index\.html?$/i.test(f)).sort((a, b) => profundidade(a) - profundidade(b));
  const entrada = indices[0] || (htmls.length === 1 ? htmls[0] : null);
  const capa =
    ficheiros
      .filter((f) => /(^|\/)(capa|cover)\.(png|jpe?g|webp|gif)$/i.test(f))
      .sort((a, b) => profundidade(a) - profundidade(b))[0] || null;
  return { entrada, capa };
}

export function prepararSite({ raiz, destino = path.join(raiz, 'publicar') }) {
  const avisos = [];
  const jogos = [];
  const capas = [];

  fs.rmSync(destino, { recursive: true, force: true });
  fs.cpSync(path.join(raiz, 'site'), destino, { recursive: true });

  const pastaJogos = path.join(raiz, 'jogos');
  const destinoJogos = path.join(destino, 'jogos');
  fs.mkdirSync(destinoJogos, { recursive: true });

  const origens = fs.existsSync(pastaJogos)
    ? fs.readdirSync(pastaJogos, { withFileTypes: true }).filter((e) => !IGNORAR.has(e.name) && !e.name.startsWith('.'))
    : [];
  const usadas = new Map();

  for (const origem of origens.sort((a, b) => a.name.localeCompare(b.name))) {
    const ezip = origem.isFile() && /\.zip$/i.test(origem.name);
    if (!origem.isDirectory() && !ezip) continue;
    const pasta = criarSlug(ezip ? origem.name.replace(/\.zip$/i, '') : origem.name);
    if (usadas.has(pasta)) {
      avisos.push(`«${origem.name}» foi ignorado: tem o mesmo nome que «${usadas.get(pasta)}».`);
      continue;
    }
    usadas.set(pasta, origem.name);

    const alvo = path.join(destinoJogos, pasta);
    try {
      if (ezip) extrairZip(path.join(pastaJogos, origem.name), alvo);
      else fs.cpSync(path.join(pastaJogos, origem.name), alvo, { recursive: true });
    } catch (erro) {
      fs.rmSync(alvo, { recursive: true, force: true });
      avisos.push(`«${origem.name}» foi ignorado: ${erro.message}.`);
      continue;
    }

    const { entrada, capa } = analisarJogo(alvo);
    if (!entrada) {
      fs.rmSync(alvo, { recursive: true, force: true });
      avisos.push(`«${origem.name}» foi ignorado: não tem nenhum index.html.`);
      continue;
    }
    jogos.push({
      pasta,
      origem: origem.name,
      caminho: `jogos/${pasta}/${entrada}`,
      capa: capa ? `jogos/${pasta}/${capa}` : null,
    });
  }

  const pastaCapas = path.join(raiz, 'capas');
  if (fs.existsSync(pastaCapas)) {
    fs.mkdirSync(path.join(destino, 'capas'), { recursive: true });
    for (const nome of fs.readdirSync(pastaCapas).sort()) {
      if (!IMAGENS.test(nome)) continue;
      if (/[?#:\\]/.test(nome)) {
        avisos.push(`A capa «${nome}» foi ignorada: o nome tem caracteres inválidos.`);
        continue;
      }
      fs.copyFileSync(path.join(pastaCapas, nome), path.join(destino, 'capas', nome));
      capas.push(`capas/${nome}`);
    }
  }

  const indice = { gerado_em: new Date().toISOString(), jogos, capas, avisos };
  fs.writeFileSync(path.join(destino, 'indice-repositorio.json'), JSON.stringify(indice, null, 2));
  return indice;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const indice = prepararSite({ raiz });
  console.log(`Site preparado em publicar/ com ${indice.jogos.length} jogo(s) e ${indice.capas.length} capa(s).`);
  for (const jogo of indice.jogos) console.log(`  • ${jogo.origem} → /${jogo.caminho}`);
  for (const aviso of indice.avisos) console.warn(`  ⚠ ${aviso}`);
}

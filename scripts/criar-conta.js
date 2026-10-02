// Cria (ou repõe a palavra-passe de) uma conta de autor.
// Utilização: npm run criar-conta -- <utilizador> "<Nome a apresentar>"
// A palavra-passe é pedida no terminal, ou lida da variável PALAVRA_PASSE.
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { criarUtilizador, gerarHash } from '../src/auth.js';
import { abrirBD } from '../src/bd.js';
import { lerConfig } from '../src/config.js';

function perguntarOculto(pergunta) {
  return new Promise((resolver) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl.stdoutMuted = false;
    // Não mostrar o que é escrito depois da pergunta.
    rl._writeToOutput = (texto) => {
      if (!rl.stdoutMuted) rl.output.write(texto);
    };
    rl.question(pergunta, (resposta) => {
      rl.close();
      process.stdout.write('\n');
      resolver(resposta);
    });
    rl.stdoutMuted = true;
  });
}

const [utilizador, nome] = process.argv.slice(2);
if (!utilizador || !/^[a-zA-Z0-9_.-]{2,30}$/.test(utilizador)) {
  console.error('Utilização: npm run criar-conta -- <utilizador> "<Nome a apresentar>"');
  console.error('O nome de utilizador só pode ter letras sem acentos, números, «.», «_» e «-» (2 a 30 caracteres).');
  process.exit(1);
}

const config = lerConfig();
fs.mkdirSync(config.pastaDados, { recursive: true });
const bd = abrirBD(path.join(config.pastaDados, 'plataforma.db'));

let palavraPasse = process.env.PALAVRA_PASSE;
if (!palavraPasse) {
  palavraPasse = await perguntarOculto('Palavra-passe: ');
  const confirmar = await perguntarOculto('Confirmar palavra-passe: ');
  if (palavraPasse !== confirmar) {
    console.error('As palavras-passe não coincidem.');
    process.exit(1);
  }
}
if (palavraPasse.length < 8) {
  console.error('A palavra-passe tem de ter pelo menos 8 caracteres.');
  process.exit(1);
}

const hash = await gerarHash(palavraPasse);
const existente = bd.prepare('SELECT id FROM utilizadores WHERE utilizador = ?').get(utilizador);
if (existente) {
  bd.prepare('UPDATE utilizadores SET hash = ? WHERE id = ?').run(hash, existente.id);
  if (nome) bd.prepare('UPDATE utilizadores SET nome = ? WHERE id = ?').run(nome, existente.id);
  bd.prepare('DELETE FROM sessoes WHERE utilizador_id = ?').run(existente.id);
  console.log(`Palavra-passe de «${utilizador}» atualizada.`);
} else {
  criarUtilizador(bd, { utilizador, nome: nome || utilizador, hash });
  console.log(`Conta «${utilizador}» criada. Já podes entrar em /entrar.`);
}

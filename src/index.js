import { criarApp } from './app.js';
import { lerConfig } from './config.js';

const config = lerConfig();
const { app, bd } = criarApp(config);

const contas = bd.prepare('SELECT COUNT(*) AS n FROM utilizadores').get().n;

app.listen(config.porta, () => {
  console.log(`${config.nomeSite} a funcionar em http://localhost:${config.porta}`);
  if (!contas) {
    console.log('Ainda não existem contas. Cria uma com: npm run criar-conta -- <utilizador> "<Nome>"');
  }
});

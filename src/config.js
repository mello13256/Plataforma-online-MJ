import path from 'node:path';

export function lerConfig(env = process.env) {
  return {
    porta: Number(env.PORTA || env.PORT || 3000),
    pastaDados: path.resolve(env.PASTA_DADOS || 'dados'),
    nomeSite: env.NOME_SITE || 'Jogos MJ',
    limiteUploadMb: Number(env.LIMITE_UPLOAD_MB || 300),
    trasDeProxy: env.TRAS_DE_PROXY === '1',
  };
}

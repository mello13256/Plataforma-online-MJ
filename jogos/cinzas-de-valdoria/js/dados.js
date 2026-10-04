// Dados do mundo de Valdoria: regiões, fogueiras, caminhos, inimigos, itens e mensagens.
// Coordenadas em metros: x cresce para leste, z cresce para sul (norte = -z).

export const MUNDO = { tam: 1400, metade: 700, segmentos: 400 };

export const REGIOES = [
  { id: 'cemiterio', nome: 'Cemitério das Cinzas', x: -430, z: 420, r: 150 },
  { id: 'planicie', nome: 'Planície Esquecida', x: -40, z: 120, r: 230 },
  { id: 'pantano', nome: 'Pântano dos Afogados', x: 380, z: 280, r: 210 },
  { id: 'ruinas', nome: 'Ruínas de Aldermoor', x: -250, z: -290, r: 170 },
  { id: 'estrada', nome: 'Estrada dos Reis', x: 190, z: -190, r: 120 },
  { id: 'fortaleza', nome: 'Fortaleza do Rei Caído', x: 400, z: -420, r: 140 },
];

export const FOGUEIRAS = [
  { id: 'f-cemiterio', nome: 'Cemitério das Cinzas', x: -418, z: 398 },
  { id: 'f-encruzilhada', nome: 'Encruzilhada da Planície', x: 14, z: 112 },
  { id: 'f-pantano', nome: 'Margem do Pântano', x: 292, z: 214 },
  { id: 'f-ruinas', nome: 'Portas de Aldermoor', x: -196, z: -214 },
  { id: 'f-portao', nome: 'Portão da Fortaleza', x: 318, z: -300 },
];

// Polilinhas dos caminhos de terra batida.
export const CAMINHOS = [
  [[-418, 398], [-360, 340], [-300, 300], [-220, 240], [-150, 185], [-70, 140], [14, 112]],
  [[14, 112], [90, 150], [170, 190], [240, 205], [292, 214], [340, 240]],
  [[14, 112], [-20, 40], [-70, -40], [-130, -120], [-180, -190], [-210, -250], [-250, -300]],
  [[14, 112], [60, 30], [110, -60], [170, -150], [240, -230], [318, -300], [360, -336], [400, -362]],
];

// Zonas onde o terreno é aplanado (fogueiras, ruínas, fortaleza). delta sobe/desce a plataforma.
export const ZONAS_PLANAS = [
  { x: -418, z: 398, r: 8, borda: 14 },
  { x: -440, z: 430, r: 34, borda: 30 },
  { x: 14, z: 112, r: 9, borda: 14 },
  { x: -40, z: 60, r: 14, borda: 14 },
  { x: 292, z: 214, r: 9, borda: 12, alvo: 1.4 },
  { x: -196, z: -214, r: 8, borda: 12 },
  { x: -250, z: -300, r: 70, borda: 40 },
  { x: 318, z: -300, r: 9, borda: 14 },
  { x: 400, z: -420, r: 62, borda: 75, delta: 16 },
  { x: 410, z: 300, r: 12, borda: 10, alvo: 1.2 }, // ilhota do pântano
];

export const PANTANO = { x: 380, z: 285, r: 190 };
export const FORTALEZA = { x: 400, z: -420, metade: 36, alturaMuro: 11 };
export const ARENA_LOBO = { x: -262, z: -335, r: 26 };

// Inimigos: tipo, posição, rotação inicial (graus) e se dormem (ficam sentados até se aproximarem).
export const INIMIGOS = [
  // Cemitério
  { tipo: 'esvaziado', x: -400, z: 360, rot: 200 },
  { tipo: 'esvaziado', x: -455, z: 445, rot: 90, sentado: true },
  { tipo: 'esvaziado', x: -425, z: 455, rot: 10 },
  { tipo: 'esvaziado', x: -340, z: 330, rot: 120 },
  { tipo: 'lobo', x: -300, z: 290, rot: 30 },
  // Planície
  { tipo: 'lobo', x: -140, z: 160, rot: 0 },
  { tipo: 'lobo', x: -132, z: 172, rot: 40 },
  { tipo: 'lobo', x: -150, z: 176, rot: 300 },
  { tipo: 'esvaziado', x: -45, z: 70, rot: 180 },
  { tipo: 'esvaziado', x: -32, z: 52, rot: 90, sentado: true },
  { tipo: 'cavaleiro', x: -40, z: 40, rot: 180 },
  { tipo: 'esvaziado', x: 80, z: 200, rot: 270 },
  { tipo: 'lobo', x: 120, z: 40, rot: 90 },
  { tipo: 'lobo', x: 130, z: 50, rot: 120 },
  { tipo: 'esvaziado', x: -200, z: 60, rot: 0 },
  // Pântano
  { tipo: 'esvaziado', x: 340, z: 260, rot: 0 },
  { tipo: 'esvaziado', x: 380, z: 300, rot: 40, sentado: true },
  { tipo: 'esvaziado', x: 420, z: 250, rot: 200 },
  { tipo: 'lobo', x: 450, z: 330, rot: 220 },
  { tipo: 'lobo', x: 440, z: 345, rot: 200 },
  { tipo: 'cavaleiro', x: 405, z: 296, rot: 220 },
  // Ruínas
  { tipo: 'esvaziado', x: -210, z: -250, rot: 0 },
  { tipo: 'esvaziado', x: -230, z: -270, rot: 90, sentado: true },
  { tipo: 'cavaleiro', x: -240, z: -290, rot: 30 },
  { tipo: 'esvaziado', x: -280, z: -260, rot: 300 },
  { tipo: 'cavaleiro', x: -290, z: -300, rot: 120 },
  { tipo: 'esvaziado', x: -220, z: -320, rot: 200 },
  { tipo: 'loboAncestral', x: -262, z: -340, rot: 0, chefe: true },
  // Estrada dos Reis
  { tipo: 'cavaleiro', x: 170, z: -150, rot: 220 },
  { tipo: 'esvaziado', x: 200, z: -190, rot: 200 },
  { tipo: 'lobo', x: 230, z: -160, rot: 90 },
  { tipo: 'lobo', x: 240, z: -170, rot: 60 },
  { tipo: 'cavaleiro', x: 270, z: -265, rot: 200 },
  { tipo: 'cavaleiro', x: 350, z: -340, rot: 210 },
  // Fortaleza
  { tipo: 'reiCaido', x: 400, z: -428, rot: 0, chefe: true },
];

// Itens no chão. 'almas' dá almas; 'frasco' aumenta as cargas do frasco; armas ficam no inventário.
export const ITENS = [
  { id: 'i1', x: -470, z: 470, tipo: 'almas', qtd: 150 },
  { id: 'i2', x: -380, z: 470, tipo: 'frasco' },
  { id: 'i3', x: -60, z: 30, tipo: 'arma', arma: 'machado' },
  { id: 'i4', x: 410, z: 302, tipo: 'arma', arma: 'espadao' },
  { id: 'i5', x: 470, z: 210, tipo: 'almas', qtd: 600 },
  { id: 'i6', x: -300, z: -250, tipo: 'frasco' },
  { id: 'i7', x: -150, z: -330, tipo: 'almas', qtd: 900 },
  { id: 'i8', x: 150, z: 260, tipo: 'almas', qtd: 300 },
  { id: 'i9', x: 260, z: -120, tipo: 'frasco' },
  { id: 'i10', x: -240, z: 120, tipo: 'almas', qtd: 400 },
];

// Mensagens deixadas no chão (como os avisos dos outros viajantes).
export const MENSAGENS = [
  { x: -410, z: 392, texto: 'Descansa junto à fogueira para recuperar o frasco. Mas os mortos também se levantam…' },
  { x: -405, z: 380, texto: 'Espaço para rolar. Rolar no momento certo evita qualquer golpe.' },
  { x: -395, z: 365, texto: 'Botão direito para bloquear com o escudo. Cuidado com a energia.' },
  { x: -360, z: 342, texto: 'Q para fixar o alvo. Um inimigo de cada vez.' },
  { x: 2, z: 104, texto: 'Ali adiante, lobos. Muitos lobos. Paciência é a chave.' },
  { x: -190, z: -205, texto: 'Fera ancestral à frente. Rola para o lado, não para trás.' },
  { x: 305, z: -298, texto: 'O Rei Caído aguarda. A partir daqui não há regresso.' },
  { x: 300, z: 220, texto: 'Tesouro na ilhota. A água é pouco funda.' },
];

// Armas: dano base, escala com força, tempos dos ataques (em segundos) e custo de energia.
export const ARMAS = {
  espada: {
    nome: 'Espada Longa', dano: 42, escala: 0.045, alcance: 2.7, arco: 110,
    leve: { dur: 0.72, ini: 0.3, fim: 0.46, est: 16, equil: 18, mult: 1 },
    forte: { dur: 1.2, ini: 0.52, fim: 0.66, est: 30, equil: 42, mult: 1.9 },
    comprimento: 1.05, largura: 0.07,
  },
  machado: {
    nome: 'Machado de Guerra', dano: 58, escala: 0.055, alcance: 2.5, arco: 120,
    leve: { dur: 0.86, ini: 0.38, fim: 0.54, est: 21, equil: 28, mult: 1 },
    forte: { dur: 1.4, ini: 0.6, fim: 0.74, est: 36, equil: 55, mult: 2 },
    comprimento: 0.85, largura: 0.06, machado: true,
  },
  espadao: {
    nome: 'Espadão do Cavaleiro', dano: 78, escala: 0.07, alcance: 3.3, arco: 140,
    leve: { dur: 1.05, ini: 0.46, fim: 0.62, est: 27, equil: 40, mult: 1 },
    forte: { dur: 1.65, ini: 0.78, fim: 0.94, est: 42, equil: 80, mult: 2.1 },
    comprimento: 1.65, largura: 0.12,
  },
};

export const NOMES_ATRIBUTOS = {
  vigor: 'Vitalidade',
  resistencia: 'Resistência',
  forca: 'Força',
};

export function custoNivel(nivel) {
  return Math.round(120 + 55 * nivel + 5.5 * nivel * nivel);
}

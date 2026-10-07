--!strict
-- Céu Partido — configuração partilhada entre servidor e clientes.
-- Unidades em studs (1 stud ≈ 0,28 m). O mundo flutua sobre um mar de nuvens.

local Config = {}

Config.VERSAO = 1
Config.ALTURA_QUEDA = 30 -- abaixo disto o jogador cai nas nuvens e morre
Config.MAX_JOGADORES_CHEFE = 4

-- ---------------------------------------------------------------- ilhas
export type Ilha = {
	id: string,
	nome: string,
	centro: Vector3, -- centro da superfície (y = altura do topo)
	raio: number,
	rocha: Enum.Material,
	relva: Enum.Material,
	arvores: number, -- quantidade de árvores
	tipoArvore: string, -- "flor" | "pinheiro" | "cristal" | "morta"
	tempestade: boolean?,
}

Config.ILHAS = {
	{ id = "despertar", nome = "Ilha do Despertar", centro = Vector3.new(0, 200, 0), raio = 115, rocha = Enum.Material.Rock, relva = Enum.Material.Grass, arvores = 22, tipoArvore = "flor" },
	{ id = "jardins", nome = "Jardins Suspensos", centro = Vector3.new(330, 215, -70), raio = 140, rocha = Enum.Material.Sandstone, relva = Enum.Material.LeafyGrass, arvores = 34, tipoArvore = "flor" },
	{ id = "pinaculo1", nome = "Pináculos da Ventania", centro = Vector3.new(430, 250, -330), raio = 46, rocha = Enum.Material.Slate, relva = Enum.Material.Grass, arvores = 4, tipoArvore = "pinheiro" },
	{ id = "pinaculo2", nome = "Pináculos da Ventania", centro = Vector3.new(350, 285, -440), raio = 34, rocha = Enum.Material.Slate, relva = Enum.Material.Grass, arvores = 3, tipoArvore = "pinheiro" },
	{ id = "pinaculo3", nome = "Pináculos da Ventania", centro = Vector3.new(250, 270, -390), raio = 40, rocha = Enum.Material.Slate, relva = Enum.Material.Grass, arvores = 3, tipoArvore = "pinheiro" },
	{ id = "observatorio", nome = "Observatório Partido", centro = Vector3.new(40, 300, -560), raio = 135, rocha = Enum.Material.Basalt, relva = Enum.Material.Grass, arvores = 14, tipoArvore = "cristal" },
	{ id = "limiar", nome = "Limiar da Tempestade", centro = Vector3.new(-210, 335, -470), raio = 42, rocha = Enum.Material.Basalt, relva = Enum.Material.Ground, arvores = 3, tipoArvore = "morta" },
	{ id = "olho", nome = "Olho da Tempestade", centro = Vector3.new(-430, 360, -330), raio = 105, rocha = Enum.Material.Basalt, relva = Enum.Material.Ground, arvores = 6, tipoArvore = "morta", tempestade = true },
	{ id = "refugio", nome = "Refúgio Esquecido", centro = Vector3.new(-260, 180, 160), raio = 60, rocha = Enum.Material.Limestone, relva = Enum.Material.Grass, arvores = 8, tipoArvore = "flor" },
} :: { Ilha }

-- pontes de pedra entre ilhas: {de, para}
Config.PONTES = {
	{ "despertar", "jardins" },
	{ "observatorio", "limiar" },
}

-- correntes de ar ascendentes (posição da base, raio, altura do topo)
Config.CORRENTES = {
	{ pos = Vector3.new(375, 205, -175), raio = 14, topo = 340 }, -- jardins -> pináculos
	{ pos = Vector3.new(445, 240, -360), raio = 11, topo = 345 }, -- pináculo 1 -> 2
	{ pos = Vector3.new(345, 275, -455), raio = 10, topo = 360 }, -- pináculo 2 -> 3/observatório
	{ pos = Vector3.new(240, 260, -405), raio = 11, topo = 395 }, -- pináculo 3 -> observatório
	{ pos = Vector3.new(-80, 195, 60), raio = 12, topo = 280 }, -- despertar -> refúgio (segredo)
	{ pos = Vector3.new(-250, 170, 150), raio = 12, topo = 300 }, -- refúgio -> despertar
	{ pos = Vector3.new(-230, 325, -445), raio = 12, topo = 450 }, -- limiar -> olho
}

-- ---------------------------------------------------------------- faróis (pontos de descanso)
Config.FAROIS = {
	{ id = "f1", nome = "Farol do Despertar", ilha = "despertar", pos = Vector3.new(18, 0, 30) },
	{ id = "f2", nome = "Farol dos Jardins", ilha = "jardins", pos = Vector3.new(275, 0, -30) },
	{ id = "f3", nome = "Farol da Ventania", ilha = "pinaculo1", pos = Vector3.new(420, 0, -322) },
	{ id = "f4", nome = "Farol do Observatório", ilha = "observatorio", pos = Vector3.new(100, 0, -480) },
	{ id = "f5", nome = "Farol do Limiar", ilha = "limiar", pos = Vector3.new(-200, 0, -462) },
	{ id = "f6", nome = "Farol do Refúgio", ilha = "refugio", pos = Vector3.new(-250, 0, 175) },
}
Config.FAROL_INICIAL = "f1"
Config.INICIO = Vector3.new(-30, 0, 70) -- onde o primeiro jogador desperta (y vem do terreno)

-- arenas dos chefes: centro, raio e posição da barreira de vento
export type Arena = { ilha: string, centro: Vector3, raio: number, normal: Vector3 }
Config.ARENAS = {
	-- a barreira fica em centro + normal * raio (a entrada da arena)
	guardiao = { ilha = "observatorio", centro = Vector3.new(30, 0, -600), raio = 55, normal = Vector3.new(0, 0, 1) },
	tempestor = { ilha = "olho", centro = Vector3.new(-440, 0, -340), raio = 70, normal = Vector3.new(0.87, 0, -0.49).Unit },
} :: { [string]: Arena }

-- ---------------------------------------------------------------- armas
export type Golpe = { dur: number, ini: number, fim: number, energia: number, equil: number, mult: number, anim: string }
export type Arma = { nome: string, dano: number, escala: number, alcance: number, arco: number, leve: { Golpe }, forte: Golpe, modelo: string }

Config.ARMAS = {
	lamina = {
		nome = "Lâmina dos Ventos", dano = 40, escala = 0.045, alcance = 9, arco = 115, modelo = "espada",
		leve = {
			{ dur = 0.72, ini = 0.28, fim = 0.44, energia = 16, equil = 18, mult = 1, anim = "leve1" },
			{ dur = 0.72, ini = 0.28, fim = 0.44, energia = 16, equil = 18, mult = 1.05, anim = "leve2" },
		},
		forte = { dur = 1.2, ini = 0.52, fim = 0.68, energia = 30, equil = 42, mult = 1.9, anim = "forte" },
	},
	martelo = {
		nome = "Martelo Celeste", dano = 62, escala = 0.06, alcance = 8.5, arco = 120, modelo = "martelo",
		leve = {
			{ dur = 1.0, ini = 0.44, fim = 0.6, energia = 24, equil = 35, mult = 1, anim = "forte" },
			{ dur = 0.95, ini = 0.42, fim = 0.58, energia = 22, equil = 32, mult = 0.95, anim = "leve2" },
		},
		forte = { dur = 1.6, ini = 0.78, fim = 0.94, energia = 40, equil = 75, mult = 2.1, anim = "salto" },
	},
	lanca = {
		nome = "Lança do Horizonte", dano = 36, escala = 0.05, alcance = 12, arco = 50, modelo = "lanca",
		leve = {
			{ dur = 0.62, ini = 0.26, fim = 0.38, energia = 14, equil = 14, mult = 1, anim = "estocada" },
			{ dur = 0.62, ini = 0.26, fim = 0.38, energia = 14, equil = 14, mult = 1, anim = "estocada" },
		},
		forte = { dur = 1.15, ini = 0.5, fim = 0.66, energia = 28, equil = 36, mult = 1.8, anim = "varrer" },
	},
} :: { [string]: Arma }

Config.ARMA_INICIAL = "lamina"

-- ---------------------------------------------------------------- jogador
Config.JOGADOR = {
	vidaBase = 400, vidaPorNivel = 40,
	energiaBase = 100, energiaPorNivel = 6,
	recuperacaoEnergia = 46, -- por segundo
	atrasoEnergia = 0.65,
	custoRolar = 19, custoCorrer = 15, -- correr: por segundo
	durRolar = 0.62, invulIni = 0.05, invulFim = 0.42,
	velAndar = 14, velCorrer = 24, velBloquear = 7, velBeber = 5,
	orvalhoInicial = 3, curaOrvalho = 0.42,
	bloqueioAngulo = 75, -- graus
}

Config.ATRIBUTOS = {
	{ id = "vigor", nome = "Vigor", descricao = "Aumenta a vida." },
	{ id = "folego", nome = "Fôlego", descricao = "Aumenta a energia." },
	{ id = "forca", nome = "Força", descricao = "Aumenta o dano das armas." },
}

function Config.custoNivel(nivel: number): number
	return math.floor(120 + 55 * nivel + 5.5 * nivel * nivel)
end

-- ---------------------------------------------------------------- inimigos
export type Ataque = {
	anim: string, dur: number, ini: number, fim: number, alcance: number, arco: number, mult: number, equil: number,
	peso: number, distMin: number?, distMax: number?, avanco: { number }?, avancoAlvo: boolean?, tipo: string?,
	area: { dist: number, raio: number }?, combo: string?, probCombo: number?, raio: boolean?, projetil: boolean?, giro: boolean?,
}
export type TipoInimigo = {
	nome: string, estilo: string, escala: number, vida: number, dano: number, equilMax: number, vel: number, corrida: number,
	raio: number, visao: number, eter: number, rastreio: number, chefe: boolean?, hiperArmadura: boolean?, escudo: boolean?, flutua: boolean?,
	ataques: { Ataque },
}

local function A(anim: string, dur: number, ini: number, fim: number, extra: { [string]: any }?): Ataque
	local a: { [string]: any } = { anim = anim, dur = dur, ini = ini, fim = fim, alcance = 8, arco = 100, mult = 1, equil = 20, peso = 1 }
	if extra then
		for k, v in extra do
			a[k] = v
		end
	end
	return (a :: any) :: Ataque
end

Config.INIMIGOS = {
	corrompido = {
		nome = "Corrompido", estilo = "corrompido", escala = 1, vida = 110, dano = 36, equilMax = 25, vel = 9, corrida = 15,
		raio = 1.6, visao = 55, eter = 45, rastreio = 6,
		ataques = {
			A("forte", 1.55, 0.86, 0.98, { alcance = 7.5, arco = 80, mult = 1.15, avanco = { 0.48, 0.62, 10 }, equil = 25 }),
			A("leve1", 1.15, 0.5, 0.62, { alcance = 7, arco = 110, mult = 0.9, avanco = { 0.35, 0.5, 8 } }),
			A("estocada", 1.3, 0.68, 0.8, { alcance = 8.5, arco = 50, avanco = { 0.48, 0.6, 18 }, distMax = 15, distMin = 7 }),
		},
	},
	sentinela = {
		nome = "Sentinela de Pedra", estilo = "sentinela", escala = 1.25, vida = 430, dano = 58, equilMax = 80, vel = 7, corrida = 14,
		raio = 2.2, visao = 70, eter = 260, rastreio = 6.5, hiperArmadura = true, escudo = true,
		ataques = {
			A("leve1", 1.0, 0.44, 0.56, { alcance = 9, arco = 110, avanco = { 0.3, 0.5, 9 }, combo = "leve2", probCombo = 0.6 }),
			A("leve2", 1.0, 0.44, 0.56, { alcance = 9, arco = 110, avanco = { 0.3, 0.5, 9 }, peso = 0, combo = "forte", probCombo = 0.35 }),
			A("forte", 1.55, 0.8, 0.92, { alcance = 10, arco = 70, mult = 1.6, avanco = { 0.45, 0.6, 11 }, equil = 45 }),
			A("estocada", 1.3, 0.64, 0.76, { alcance = 10.5, arco = 45, mult = 1.2, avanco = { 0.45, 0.6, 22 }, distMax = 20, distMin = 9 }),
		},
	},
	espectro = {
		nome = "Espectro do Vento", estilo = "espectro", escala = 0.95, vida = 85, dano = 30, equilMax = 15, vel = 12, corrida = 26,
		raio = 1.6, visao = 80, eter = 60, rastreio = 9, flutua = true,
		ataques = {
			A("leve2", 0.85, 0.4, 0.52, { alcance = 7, arco = 90, avanco = { 0.3, 0.5, 14 } }),
			A("estocada", 1.2, 0.5, 0.64, { alcance = 7.5, arco = 70, mult = 1.25, avancoAlvo = true, avanco = { 0.35, 0.62, 0 }, distMax = 28, distMin = 10 }),
		},
	},
	guardiao = {
		nome = "Ormund, o Guardião de Pedra", estilo = "guardiao", escala = 3.2, vida = 1900, dano = 90, equilMax = 240, vel = 9, corrida = 20,
		raio = 5.5, visao = 120, eter = 3500, rastreio = 4.5, chefe = true, hiperArmadura = true,
		ataques = {
			A("varrer", 1.7, 0.9, 1.04, { alcance = 19, arco = 170, avanco = { 0.5, 0.65, 8 }, combo = "leve2", probCombo = 0.4 }),
			A("leve2", 1.35, 0.66, 0.78, { alcance = 18, arco = 140, mult = 0.9, peso = 0, avanco = { 0.4, 0.6, 10 } }),
			A("forte", 1.9, 1.06, 1.18, { alcance = 18, arco = 60, mult = 1.5, equil = 60, tipo = "derrubar", area = { dist = 14, raio = 11 } }),
			A("arremesso", 1.8, 0.95, 1.0, { alcance = 120, arco = 360, mult = 1.1, projetil = true, distMin = 22, distMax = 120, peso = 0.8 }),
			A("salto", 2.2, 1.3, 1.42, { alcance = 15, arco = 360, mult = 1.5, avancoAlvo = true, avanco = { 0.3, 0.62, 0 }, distMax = 70, distMin = 26, tipo = "derrubar", area = { dist = 10, raio = 15 } }),
		},
	},
	tempestor = {
		nome = "Tempestor, o Coração Partido", estilo = "tempestor", escala = 3.4, vida = 3600, dano = 105, equilMax = 330, vel = 8, corrida = 22,
		raio = 5, visao = 160, eter = 15000, rastreio = 3.8, chefe = true, hiperArmadura = true,
		ataques = {
			A("varrer", 1.75, 0.98, 1.12, { alcance = 20, arco = 170, avanco = { 0.5, 0.65, 9 }, combo = "leve2", probCombo = 0.45 }),
			A("leve2", 1.4, 0.68, 0.8, { alcance = 19, arco = 140, mult = 0.9, peso = 0, avanco = { 0.4, 0.6, 11 }, combo = "forte", probCombo = 0.5 }),
			A("forte", 2.0, 1.12, 1.24, { alcance = 19, arco = 60, mult = 1.5, equil = 60, tipo = "derrubar", area = { dist = 15, raio = 10 } }),
			A("estocada", 1.7, 0.92, 1.06, { alcance = 22, arco = 40, mult = 1.25, avanco = { 0.5, 0.66, 34 }, distMax = 40, distMin = 15 }),
			A("rugido", 2.2, 1.0, 1.05, { alcance = 200, arco = 360, mult = 0.85, raio = true, distMin = 0, distMax = 200, peso = 0.7 }),
			A("salto", 2.3, 1.38, 1.5, { alcance = 16, arco = 360, mult = 1.6, avancoAlvo = true, avanco = { 0.3, 0.62, 0 }, distMax = 80, distMin = 26, tipo = "derrubar", area = { dist = 11, raio = 15 } }),
		},
	},
} :: { [string]: TipoInimigo }

-- inimigos espalhados pelo mundo: tipo, posição (x, z; y vem do terreno), ângulo
Config.ESPAWNS = {
	-- Ilha do Despertar
	{ tipo = "corrompido", x = -10, z = -40, rot = 180 },
	{ tipo = "corrompido", x = 50, z = -60, rot = 200 },
	{ tipo = "corrompido", x = 75, z = -10, rot = 90, sentado = true },
	{ tipo = "espectro", x = -60, z = -70, rot = 160 },
	-- Jardins Suspensos
	{ tipo = "corrompido", x = 300, z = -10, rot = 270 },
	{ tipo = "corrompido", x = 340, z = -40, rot = 200, sentado = true },
	{ tipo = "corrompido", x = 380, z = -100, rot = 30 },
	{ tipo = "sentinela", x = 350, z = -120, rot = 180 },
	{ tipo = "espectro", x = 410, z = -30, rot = 260 },
	{ tipo = "espectro", x = 280, z = -130, rot = 90 },
	-- Pináculos
	{ tipo = "espectro", x = 350, z = -445, rot = 0 },
	{ tipo = "espectro", x = 255, z = -385, rot = 90 },
	{ tipo = "corrompido", x = 440, z = -340, rot = 200 },
	-- Observatório
	{ tipo = "sentinela", x = 90, z = -500, rot = 200 },
	{ tipo = "sentinela", x = -20, z = -510, rot = 160 },
	{ tipo = "corrompido", x = 60, z = -470, rot = 180 },
	{ tipo = "corrompido", x = -40, z = -470, rot = 90, sentado = true },
	{ tipo = "espectro", x = 110, z = -540, rot = 270 },
	{ tipo = "guardiao", x = 30, z = -610, rot = 0, chefe = "guardiao" },
	-- Limiar e Olho
	{ tipo = "sentinela", x = -215, z = -480, rot = 90 },
	{ tipo = "espectro", x = -360, z = -300, rot = 120 },
	{ tipo = "tempestor", x = -450, z = -330, rot = 230, chefe = "tempestor" },
	-- Refúgio (segredo)
	{ tipo = "sentinela", x = -270, z = 140, rot = 45 },
}

-- ---------------------------------------------------------------- relicários (baús)
Config.RELICARIOS = {
	{ id = "r1", x = 70, z = 60, tipo = "orvalho" },
	{ id = "r2", x = 390, z = -140, tipo = "arma", arma = "martelo" },
	{ id = "r3", x = 345, z = -450, tipo = "eter", qtd = 600 },
	{ id = "r4", x = 240, z = -398, tipo = "orvalho" },
	{ id = "r5", x = -60, z = -520, tipo = "arma", arma = "lanca" },
	{ id = "r6", x = 140, z = -600, tipo = "eter", qtd = 1200 },
	{ id = "r7", x = -255, z = 185, tipo = "orvalho" },
	{ id = "r8", x = -280, z = 170, tipo = "eter", qtd = 2000 },
	{ id = "r9", x = -195, z = -485, tipo = "eter", qtd = 900 },
}

-- ---------------------------------------------------------------- pedras com inscrições (dicas)
Config.INSCRICOES = {
	{ x = -20, z = 60, texto = "Toca no Farol para o acender. Descansar enche o Orvalho… mas faz regressar os Corrompidos." },
	{ x = 0, z = 20, texto = "Shift: toca para te esquivares, mantém para correr. A esquiva no momento certo atravessa qualquer golpe." },
	{ x = 30, z = -10, texto = "Botão direito para bloquear. Cada golpe bloqueado gasta energia." },
	{ x = 80, z = 10, texto = "Mantém Espaço no ar para planar. As correntes de vento levam-te mais alto." },
	{ x = 95, z = -20, texto = "Se morreres, o teu Éter fica onde caíste. Volta para o recuperar." },
	{ x = 300, z = -60, texto = "Uma corrente de vento a norte leva aos Pináculos." },
	{ x = 60, z = -530, texto = "Atrás da barreira de vento dorme o Guardião. Rola para o lado quando ele salta." },
	{ x = -205, z = -455, texto = "O Coração Partido espera no Olho da Tempestade. Os raios caem onde estás." },
}

return Config

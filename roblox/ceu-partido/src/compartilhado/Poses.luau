--!strict
-- Poses-chave das animações procedurais (esqueleto R15).
-- Cada pose indica rotações por articulação em radianos (x, y, z) na convenção do Roblox
-- (personagem virada para -Z): x positivo levanta braços/pernas para a frente e inclina o tronco para trás.

local Poses = {}

export type Pose = { [string]: any }
export type Chave = { number | Pose }

-- articulações do R15 que animamos
Poses.ARTICULACOES = {
	"Root", "Waist", "Neck",
	"RightShoulder", "RightElbow", "RightWrist", "LeftShoulder", "LeftElbow", "LeftWrist",
	"RightHip", "RightKnee", "RightAnkle", "LeftHip", "LeftKnee", "LeftAnkle",
}

local function V(x: number, y: number, z: number): Vector3
	return Vector3.new(x, y, z)
end

-- postura de combate: base de todas as poses
Poses.POSTURA = {
	RightShoulder = V(0.35, 0, 0.1), RightElbow = V(0.75, 0, 0), RightWrist = V(-0.15, 0, 0),
	LeftShoulder = V(0.3, 0, -0.12), LeftElbow = V(1.0, 0, 0), LeftWrist = V(0, 0, 0),
	Waist = V(-0.06, 0, 0), Neck = V(0.05, 0, 0), Root = V(0, 0, 0),
	RightHip = V(0, 0, 0), RightKnee = V(0, 0, 0), RightAnkle = V(0, 0, 0),
	LeftHip = V(0, 0, 0), LeftKnee = V(0, 0, 0), LeftAnkle = V(0, 0, 0),
} :: { [string]: Vector3 }

-- bloqueio com o escudo à frente do peito
Poses.BLOQUEIO = {
	LeftShoulder = V(1.4, 0, 0), LeftElbow = V(0, 0, 1.55), Waist = V(-0.12, -0.15, 0),
} :: { [string]: Vector3 }

local AVANCO = { RightHip = V(0.55, 0, 0), RightKnee = V(-0.35, 0, 0), LeftHip = V(-0.4, 0, 0), LeftKnee = V(-0.4, 0, 0), LeftAnkle = V(0.3, 0, 0) }

local function junta(a: Pose, b: Pose?): Pose
	local r: Pose = {}
	for k, v in a do
		r[k] = v
	end
	if b then
		for k, v in b do
			r[k] = v
		end
	end
	return r
end

-- y: deslocamento vertical do corpo (studs); piv: inclinação de todo o corpo (radianos)
Poses.ANIMACOES = {
	leve1 = {
		{ 0, {} },
		{ 0.36, { RightShoulder = V(1.9, 0, 1.1), RightElbow = V(1.6, 0, 0), RightWrist = V(-0.4, 0, 0), Waist = V(-0.05, -0.95, 0), RightHip = V(0.2, 0, 0), LeftHip = V(-0.15, 0, 0) } },
		{ 0.5, junta({ RightShoulder = V(1.35, 0.4, -0.65), RightElbow = V(0.35, 0, 0), RightWrist = V(0.2, 0, 0), Waist = V(-0.25, 1.0, 0) }, AVANCO) },
		{ 0.72, junta({ RightShoulder = V(0.9, 0.2, -0.55), RightElbow = V(0.5, 0, 0), Waist = V(-0.2, 0.5, 0) }, AVANCO) },
		{ 1, {} },
	},
	leve2 = {
		{ 0, {} },
		{ 0.34, { RightShoulder = V(1.4, 0.3, -0.75), RightElbow = V(1.5, 0, 0), RightWrist = V(-0.3, 0, 0), Waist = V(-0.1, 0.85, 0) } },
		{ 0.5, junta({ RightShoulder = V(1.45, -0.2, 1.15), RightElbow = V(0.25, 0, 0), RightWrist = V(0.1, 0, 0), Waist = V(-0.22, -0.9, 0) }, AVANCO) },
		{ 0.72, junta({ RightShoulder = V(1.0, 0, 0.9), RightElbow = V(0.5, 0, 0), Waist = V(-0.18, -0.45, 0) }, AVANCO) },
		{ 1, {} },
	},
	forte = {
		{ 0, {} },
		{ 0.42, { RightShoulder = V(3.0, 0, 0.25), RightElbow = V(1.2, 0, 0), RightWrist = V(-0.3, 0, 0), LeftShoulder = V(2.6, 0, -0.3), LeftElbow = V(1.4, 0, 0), Waist = V(0.25, -0.25, 0), RightHip = V(-0.25, 0, 0), RightKnee = V(-0.3, 0, 0), y = 0.05 } },
		{ 0.56, { RightShoulder = V(0.75, 0, -0.15), RightElbow = V(0.15, 0, 0), RightWrist = V(0.3, 0, 0), LeftShoulder = V(0.6, 0, 0.1), LeftElbow = V(0.4, 0, 0), Waist = V(-0.55, 0, 0), Neck = V(0.35, 0, 0), RightHip = V(0.85, 0, 0), RightKnee = V(-0.7, 0, 0), LeftHip = V(-0.5, 0, 0), LeftKnee = V(-0.55, 0, 0), y = -0.45 } },
		{ 0.78, { RightShoulder = V(0.6, 0, -0.15), RightElbow = V(0.2, 0, 0), Waist = V(-0.45, 0, 0), RightHip = V(0.8, 0, 0), RightKnee = V(-0.7, 0, 0), LeftHip = V(-0.45, 0, 0), LeftKnee = V(-0.5, 0, 0), y = -0.4 } },
		{ 1, {} },
	},
	estocada = {
		{ 0, {} },
		{ 0.4, { RightShoulder = V(0.6, 0, 0.3), RightElbow = V(1.9, 0, 0), RightWrist = V(-0.6, 0, 0), Waist = V(0.05, -0.5, 0), LeftHip = V(-0.2, 0, 0) } },
		{ 0.52, junta({ RightShoulder = V(1.55, 0, 0.05), RightElbow = V(0.05, 0, 0), RightWrist = V(-0.05, 0, 0), Waist = V(-0.35, 0.25, 0), y = -0.3 }, AVANCO) },
		{ 0.75, junta({ RightShoulder = V(1.45, 0, 0.05), RightElbow = V(0.15, 0, 0), Waist = V(-0.3, 0.2, 0), y = -0.22 }, AVANCO) },
		{ 1, {} },
	},
	varrer = {
		{ 0, {} },
		{ 0.45, { RightShoulder = V(1.2, -0.2, 1.5), RightElbow = V(0.5, 0, 0), RightWrist = V(-0.2, 0, 0), LeftShoulder = V(1.0, 0, -0.6), Waist = V(-0.05, -1.3, 0), LeftHip = V(-0.3, 0, 0) } },
		{ 0.6, junta({ RightShoulder = V(1.4, 0.2, -1.2), RightElbow = V(0.2, 0, 0), RightWrist = V(0.1, 0, 0), LeftShoulder = V(0.4, 0, 0.3), Waist = V(-0.15, 1.35, 0) }, AVANCO) },
		{ 0.8, junta({ RightShoulder = V(1.0, 0, -0.9), RightElbow = V(0.4, 0, 0), Waist = V(-0.12, 0.7, 0) }, AVANCO) },
		{ 1, {} },
	},
	salto = {
		{ 0, {} },
		{ 0.25, { RightHip = V(0.9, 0, 0), RightKnee = V(-1.5, 0, 0), LeftHip = V(0.9, 0, 0), LeftKnee = V(-1.5, 0, 0), Waist = V(-0.5, 0, 0), RightShoulder = V(0.5, 0, 0.3), y = -0.8 } },
		{ 0.5, { RightShoulder = V(3.1, 0, 0.2), RightElbow = V(1.0, 0, 0), LeftShoulder = V(2.8, 0, -0.3), LeftElbow = V(1.2, 0, 0), Waist = V(0.3, 0, 0), RightHip = V(0.5, 0, 0), RightKnee = V(-0.9, 0, 0), LeftHip = V(0.3, 0, 0), LeftKnee = V(-1.0, 0, 0) } },
		{ 0.64, { RightShoulder = V(0.6, 0, -0.1), RightElbow = V(0.1, 0, 0), LeftShoulder = V(0.6, 0, 0.1), Waist = V(-0.6, 0, 0), RightHip = V(1.0, 0, 0), RightKnee = V(-1.2, 0, 0), LeftHip = V(-0.3, 0, 0), LeftKnee = V(-0.9, 0, 0), y = -0.8 } },
		{ 0.85, { RightShoulder = V(0.6, 0, -0.1), Waist = V(-0.5, 0, 0), RightHip = V(1.0, 0, 0), RightKnee = V(-1.2, 0, 0), y = -0.7 } },
		{ 1, {} },
	},
	arremesso = {
		{ 0, {} },
		{ 0.45, { RightShoulder = V(2.6, 0, 0.6), RightElbow = V(1.4, 0, 0), LeftShoulder = V(1.2, 0, -0.4), Waist = V(0.2, -0.8, 0), RightHip = V(-0.3, 0, 0), LeftHip = V(0.3, 0, 0) } },
		{ 0.58, junta({ RightShoulder = V(1.2, 0, -0.3), RightElbow = V(0.1, 0, 0), LeftShoulder = V(0.3, 0, 0.2), Waist = V(-0.3, 0.7, 0) }, AVANCO) },
		{ 1, {} },
	},
	rugido = {
		{ 0, {} },
		{ 0.3, { Waist = V(0.35, 0, 0), Neck = V(0.4, 0, 0), RightShoulder = V(0.6, 0, 1.2), LeftShoulder = V(0.6, 0, -1.2), RightElbow = V(0.6, 0, 0), LeftElbow = V(0.6, 0, 0) } },
		{ 0.8, { Waist = V(0.35, 0, 0), Neck = V(0.45, 0, 0), RightShoulder = V(0.6, 0, 1.3), LeftShoulder = V(0.6, 0, -1.3), RightElbow = V(0.6, 0, 0), LeftElbow = V(0.6, 0, 0) } },
		{ 1, {} },
	},
	rolar = {
		{ 0, {} },
		{ 0.15, { RightHip = V(1.7, 0, 0), RightKnee = V(-2.1, 0, 0), LeftHip = V(1.7, 0, 0), LeftKnee = V(-2.1, 0, 0), Waist = V(-0.9, 0, 0), Neck = V(-0.5, 0, 0), RightShoulder = V(1.0, 0, -0.3), RightElbow = V(1.6, 0, 0), LeftShoulder = V(1.0, 0, 0.3), LeftElbow = V(1.6, 0, 0), y = -0.8 } },
		{ 0.7, { RightHip = V(1.7, 0, 0), RightKnee = V(-2.1, 0, 0), LeftHip = V(1.7, 0, 0), LeftKnee = V(-2.1, 0, 0), Waist = V(-0.9, 0, 0), Neck = V(-0.5, 0, 0), RightShoulder = V(1.0, 0, -0.3), RightElbow = V(1.6, 0, 0), LeftShoulder = V(1.0, 0, 0.3), LeftElbow = V(1.6, 0, 0), y = -0.8 } },
		{ 0.88, { RightHip = V(0.6, 0, 0), RightKnee = V(-1.0, 0, 0), LeftHip = V(0.2, 0, 0), LeftKnee = V(-0.6, 0, 0), Waist = V(-0.4, 0, 0), y = -0.45 } },
		{ 1, {} },
	},
	recuar = {
		{ 0, {} },
		{ 0.3, { Waist = V(0.3, 0, 0), Neck = V(0.2, 0, 0), RightHip = V(-0.3, 0, 0), LeftHip = V(0.4, 0, 0), LeftKnee = V(-0.6, 0, 0), y = -0.2 } },
		{ 1, {} },
	},
	beber = {
		{ 0, {} },
		{ 0.3, { LeftShoulder = V(2.1, 0.3, 0.55), LeftElbow = V(2.0, 0, 0), Neck = V(0.45, 0, 0), Waist = V(0.1, 0, 0) } },
		{ 0.7, { LeftShoulder = V(2.1, 0.3, 0.55), LeftElbow = V(2.0, 0, 0), Neck = V(0.5, 0, 0), Waist = V(0.1, 0, 0) } },
		{ 1, {} },
	},
	atordoado = {
		{ 0, {} },
		{ 0.2, { Waist = V(0.45, 0.2, 0), Neck = V(0.35, 0, 0), RightShoulder = V(0.2, 0, 0.9), LeftShoulder = V(0.2, 0, -0.9), RightElbow = V(0.4, 0, 0), LeftElbow = V(0.4, 0, 0), RightHip = V(-0.35, 0, 0), LeftKnee = V(-0.4, 0, 0), LeftHip = V(0.2, 0, 0), y = -0.15 } },
		{ 0.6, { Waist = V(0.3, 0.1, 0), Neck = V(0.2, 0, 0), RightShoulder = V(0.2, 0, 0.6), LeftShoulder = V(0.2, 0, -0.6), RightHip = V(-0.3, 0, 0), LeftKnee = V(-0.3, 0, 0), y = -0.1 } },
		{ 1, {} },
	},
	golpeado = {
		{ 0, {} },
		{ 0.3, { Waist = V(0.3, -0.25, 0), Neck = V(0.3, 0, 0), LeftShoulder = V(0.5, 0, -0.4) } },
		{ 1, {} },
	},
	derrubado = {
		{ 0, {} },
		{ 0.15, { Waist = V(0.5, 0, 0), Neck = V(0.4, 0, 0), RightShoulder = V(1.8, 0, 0.5), LeftShoulder = V(1.8, 0, -0.5), piv = 0.6 } },
		{ 0.4, { Waist = V(0.2, 0, 0), RightShoulder = V(2.6, 0, 0.6), LeftShoulder = V(2.6, 0, -0.6), RightHip = V(0.6, 0, 0), RightKnee = V(-0.8, 0, 0), LeftHip = V(0.3, 0, 0), piv = 1.45, y = -1.3 } },
		{ 0.65, { Waist = V(0.1, 0, 0), RightShoulder = V(2.6, 0, 0.6), LeftShoulder = V(2.6, 0, -0.6), RightHip = V(0.6, 0, 0), RightKnee = V(-0.8, 0, 0), piv = 1.45, y = -1.3 } },
		{ 0.85, { Waist = V(-0.6, 0, 0), RightHip = V(1.5, 0, 0), RightKnee = V(-2.0, 0, 0), LeftHip = V(1.2, 0, 0), LeftKnee = V(-1.8, 0, 0), piv = 0, y = -1.1 } },
		{ 1, {} },
	},
	morrer = {
		{ 0, {} },
		{ 0.25, { Waist = V(-0.3, 0, -0.2), Neck = V(-0.4, 0, 0), RightHip = V(0.8, 0, 0), RightKnee = V(-1.6, 0, 0), LeftHip = V(0.6, 0, 0), LeftKnee = V(-1.4, 0, 0), RightShoulder = V(0.2, 0, 0.3), LeftShoulder = V(0.2, 0, -0.3), y = -1.0 } },
		{ 0.55, { Waist = V(-0.2, 0, -0.3), Neck = V(-0.5, 0, -0.3), RightHip = V(1.2, 0, 0), RightKnee = V(-1.0, 0, 0), LeftHip = V(0.5, 0, 0), LeftKnee = V(-0.5, 0, 0), RightShoulder = V(1.0, 0, 1.2), LeftShoulder = V(0.3, 0, -1.2), piv = -1.5, y = -1.4 } },
		{ 1, { Waist = V(-0.1, 0, -0.3), Neck = V(-0.6, 0, -0.5), RightHip = V(0.4, 0, 0), RightKnee = V(-0.3, 0, 0), LeftHip = V(0.2, 0, 0), LeftKnee = V(-0.2, 0, 0), RightShoulder = V(1.6, 0, 1.3), LeftShoulder = V(0.5, 0, -1.3), piv = -1.55, y = -1.5 } },
	},
	sentado = {
		{ 0, { RightHip = V(1.45, 0, 0.15), RightKnee = V(-1.3, 0, 0), LeftHip = V(1.45, 0, -0.15), LeftKnee = V(-1.3, 0, 0), Waist = V(-0.5, 0, 0), Neck = V(-0.5, 0, 0), RightShoulder = V(0.5, 0, -0.2), RightElbow = V(0.6, 0, 0), LeftShoulder = V(0.5, 0, 0.2), LeftElbow = V(0.6, 0, 0), y = -1.75 } },
		{ 1, { RightHip = V(1.45, 0, 0.15), RightKnee = V(-1.3, 0, 0), LeftHip = V(1.45, 0, -0.15), LeftKnee = V(-1.3, 0, 0), Waist = V(-0.55, 0, 0), Neck = V(-0.55, 0, 0), RightShoulder = V(0.5, 0, -0.2), RightElbow = V(0.6, 0, 0), LeftShoulder = V(0.5, 0, 0.2), LeftElbow = V(0.6, 0, 0), y = -1.75 } },
	},
	levantar = {
		{ 0, { RightHip = V(1.45, 0, 0.15), RightKnee = V(-1.3, 0, 0), LeftHip = V(1.45, 0, -0.15), LeftKnee = V(-1.3, 0, 0), Waist = V(-0.5, 0, 0), Neck = V(-0.5, 0, 0), y = -1.75 } },
		{ 0.5, { RightHip = V(1.0, 0, 0), RightKnee = V(-1.6, 0, 0), LeftHip = V(0.4, 0, 0), LeftKnee = V(-0.8, 0, 0), Waist = V(-0.6, 0, 0), y = -1.0 } },
		{ 1, {} },
	},
	acender = {
		{ 0, {} },
		{ 0.35, { RightHip = V(1.2, 0, 0), RightKnee = V(-1.9, 0, 0), LeftHip = V(-0.4, 0, 0), LeftKnee = V(-1.8, 0, 0), Waist = V(-0.5, 0, 0), RightShoulder = V(1.3, 0, -0.1), RightElbow = V(0.2, 0, 0), y = -1.25 } },
		{ 0.75, { RightHip = V(1.2, 0, 0), RightKnee = V(-1.9, 0, 0), LeftHip = V(-0.4, 0, 0), LeftKnee = V(-1.8, 0, 0), Waist = V(-0.5, 0, 0), RightShoulder = V(1.3, 0, -0.1), RightElbow = V(0.2, 0, 0), y = -1.25 } },
		{ 1, {} },
	},
} :: { [string]: { { any } } }

local function suave(t: number): number
	return t * t * (3 - 2 * t)
end

-- Avalia uma animação no tempo normalizado t (0..1).
-- Devolve rotações por articulação, o deslocamento vertical (y) e a inclinação do corpo (piv).
function Poses.avaliar(nome: string, t: number): ({ [string]: Vector3 }, number, number)
	local chaves = Poses.ANIMACOES[nome]
	local base = Poses.POSTURA
	local resultado: { [string]: Vector3 } = {}
	if not chaves then
		return resultado, 0, 0
	end
	local i = 1
	while i < #chaves - 1 and t > (chaves[i + 1][1] :: number) do
		i += 1
	end
	local k0 = chaves[i]
	local k1 = chaves[math.min(i + 1, #chaves)]
	local t0 = k0[1] :: number
	local t1 = k1[1] :: number
	local p0 = k0[2] :: Pose
	local p1 = k1[2] :: Pose
	local k = if t1 > t0 then suave(math.clamp((t - t0) / (t1 - t0), 0, 1)) else 1
	local nomes: { [string]: boolean } = {}
	for n in p0 do
		nomes[n] = true
	end
	for n in p1 do
		nomes[n] = true
	end
	local y, piv = 0, 0
	for n in nomes do
		if n == "y" or n == "piv" then
			local a = (p0[n] or 0) :: number
			local b = (p1[n] or 0) :: number
			if n == "y" then
				y = a + (b - a) * k
			else
				piv = a + (b - a) * k
			end
		else
			local a = (p0[n] or base[n] or Vector3.zero) :: Vector3
			local b = (p1[n] or base[n] or Vector3.zero) :: Vector3
			resultado[n] = a:Lerp(b, k)
		end
	end
	return resultado, y, piv
end

return Poses

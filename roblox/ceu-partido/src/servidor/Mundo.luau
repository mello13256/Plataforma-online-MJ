--!strict
-- Gera o mundo de Céu Partido quando o servidor arranca: ilhas de terreno, vegetação,
-- ruínas, pontes, correntes de vento, faróis, relicários, inscrições, nuvens e iluminação.

local Lighting = game:GetService("Lighting")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Config = require(ReplicatedStorage:WaitForChild("Compartilhado"):WaitForChild("Config"))

local Mundo = {}

local terreno = workspace.Terrain
local pasta: Folder
local ilhasPorId: { [string]: Config.Ilha } = {}
for _, ilha in Config.ILHAS do
	ilhasPorId[ilha.id] = ilha
end
Mundo.ilhasPorId = ilhasPorId

-- ---------------------------------------------------------------- utilitários

local function semente(texto: string): number
	local h = 7
	for i = 1, #texto do
		h = (h * 31 + string.byte(texto, i)) % 2147483647
	end
	return h
end

local function parte(props: { [string]: any }, pai: Instance?): BasePart
	local classe = props.Classe or "Part"
	local p = Instance.new(classe) :: BasePart
	p.Anchored = true
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	for k, v in props do
		if k ~= "Classe" then
			(p :: any)[k] = v
		end
	end
	p.Parent = pai or pasta
	return p
end

local filtroTerreno = RaycastParams.new()
filtroTerreno.FilterType = Enum.RaycastFilterType.Include
filtroTerreno.FilterDescendantsInstances = { terreno }

-- altura do chão (terreno) em x, z; nil se não houver chão
function Mundo.chao(x: number, z: number): Vector3?
	local r = workspace:Raycast(Vector3.new(x, 900, z), Vector3.new(0, -1000, 0), filtroTerreno)
	return if r then r.Position else nil
end

function Mundo.chaoOuIlha(x: number, z: number, ilhaId: string?): Vector3
	local p = Mundo.chao(x, z)
	if p then
		return p
	end
	local y = 200
	if ilhaId and ilhasPorId[ilhaId] then
		y = ilhasPorId[ilhaId].centro.Y
	end
	return Vector3.new(x, y, z)
end

-- a que ilha pertence um ponto (a mais próxima no plano)
function Mundo.ilhaEm(pos: Vector3): Config.Ilha?
	local melhor: Config.Ilha? = nil
	local md = math.huge
	for _, ilha in Config.ILHAS do
		local d = Vector2.new(pos.X - ilha.centro.X, pos.Z - ilha.centro.Z).Magnitude
		if d < ilha.raio * 1.1 and d < md then
			md = d
			melhor = ilha
		end
	end
	return melhor
end

-- ---------------------------------------------------------------- ilhas (terreno)

local function gerarIlha(ilha: Config.Ilha)
	local c = ilha.centro
	local r = ilha.raio
	local rnd = Random.new(semente(ilha.id))
	-- corpo de rocha em camadas, a afunilar para baixo (cone invertido irregular)
	local profundidade = r * 1.15 + 20
	local camadas = math.ceil(profundidade / 6)
	for k = 0, camadas do
		local f = k / camadas
		local raio = r * (1 - f) ^ 1.35 * (0.93 + rnd:NextNumber() * 0.12) + 3
		local desvio = Vector3.new(rnd:NextNumber(-1, 1), 0, rnd:NextNumber(-1, 1)) * r * 0.06 * f
		local y = c.Y - 4 - k * 6
		local mat = if k < 2 then Enum.Material.Ground else ilha.rocha
		terreno:FillCylinder(CFrame.new(c + desvio + Vector3.new(0, y - c.Y, 0)), 7, raio, mat)
		-- saliências rochosas na borda
		local n = math.max(3, math.floor(raio / 14))
		for j = 1, n do
			local a = rnd:NextNumber(0, math.pi * 2)
			local d = raio * rnd:NextNumber(0.75, 0.95)
			local rb = raio * rnd:NextNumber(0.12, 0.26) + 2
			terreno:FillBall(Vector3.new(c.X + math.cos(a) * d, y - rb * 0.3, c.Z + math.sin(a) * d), rb, ilha.rocha)
		end
	end
	-- estalactites pendentes
	for _ = 1, math.floor(r / 18) do
		local a = rnd:NextNumber(0, math.pi * 2)
		local d = rnd:NextNumber(0, r * 0.45)
		local base = Vector3.new(c.X + math.cos(a) * d, c.Y - profundidade * rnd:NextNumber(0.5, 0.85), c.Z + math.sin(a) * d)
		local rb = rnd:NextNumber(6, 12)
		for k = 0, 4 do
			terreno:FillBall(base - Vector3.new(0, k * rb * 0.8, 0), rb * (1 - k * 0.18), ilha.rocha)
		end
	end
	-- superfície com relva e colinas suaves
	terreno:FillCylinder(CFrame.new(c.X, c.Y - 2, c.Z), 4, r, ilha.relva)
	for _ = 1, math.floor(r / 14) do
		local a = rnd:NextNumber(0, math.pi * 2)
		local d = rnd:NextNumber(0, r * 0.7)
		local hr = rnd:NextNumber(10, 24)
		terreno:FillBall(Vector3.new(c.X + math.cos(a) * d, c.Y - hr * 0.82, c.Z + math.sin(a) * d), hr, ilha.relva)
	end
	-- borda arredondada e irregular
	local nb = math.floor(r / 6)
	for j = 1, nb do
		local a = (j / nb) * math.pi * 2 + rnd:NextNumber(-0.1, 0.1)
		local rb = rnd:NextNumber(r * 0.07, r * 0.13) + 2
		local d = r - rb * 0.4
		terreno:FillBall(Vector3.new(c.X + math.cos(a) * d, c.Y - rb * 0.65, c.Z + math.sin(a) * d), rb, if rnd:NextNumber() < 0.6 then ilha.relva else ilha.rocha)
	end
	-- pequenos lagos nas ilhas grandes
	if r > 120 and not ilha.tempestade then
		local a = rnd:NextNumber(0, math.pi * 2)
		local p = Vector3.new(c.X + math.cos(a) * r * 0.45, c.Y, c.Z + math.sin(a) * r * 0.45)
		terreno:FillCylinder(CFrame.new(p + Vector3.new(0, -1, 0)), 6, 14, Enum.Material.Air)
		terreno:FillCylinder(CFrame.new(p + Vector3.new(0, -2.5, 0)), 3, 14, Enum.Material.Water)
		terreno:FillCylinder(CFrame.new(p + Vector3.new(0, -5, 0)), 2, 15, Enum.Material.Mud)
	end
end

-- rochas soltas a flutuar entre as ilhas (decoração)
local function gerarRochasFlutuantes()
	local rnd = Random.new(99)
	for _ = 1, 26 do
		local p = Vector3.new(rnd:NextNumber(-600, 600), rnd:NextNumber(120, 420), rnd:NextNumber(-750, 350))
		local longe = true
		for _, ilha in Config.ILHAS do
			if (Vector2.new(p.X, p.Z) - Vector2.new(ilha.centro.X, ilha.centro.Z)).Magnitude < ilha.raio + 40 then
				longe = false
				break
			end
		end
		if longe then
			local r = rnd:NextNumber(6, 16)
			terreno:FillBall(p, r, Enum.Material.Rock)
			terreno:FillBall(p - Vector3.new(0, r * 0.8, 0), r * 0.7, Enum.Material.Slate)
			terreno:FillBall(p + Vector3.new(0, r * 0.55, 0), r * 0.6, Enum.Material.Grass)
		end
	end
end

-- ---------------------------------------------------------------- vegetação e ruínas (peças)

local CORES_FLOR = {
	Color3.fromRGB(255, 182, 206), Color3.fromRGB(250, 214, 230), Color3.fromRGB(255, 236, 190),
	Color3.fromRGB(196, 230, 160), Color3.fromRGB(255, 200, 150),
}

local function arvore(tipo: string, base: Vector3, rnd: Random, pai: Instance)
	local m = Instance.new("Model")
	m.Name = "Arvore"
	local escala = rnd:NextNumber(0.8, 1.35)
	if tipo == "flor" then
		local h = 14 * escala
		parte({ Size = Vector3.new(h, 1.8 * escala, 1.8 * escala), Shape = Enum.PartType.Cylinder, Material = Enum.Material.Wood,
			Color = Color3.fromRGB(110, 82, 62), CFrame = CFrame.new(base + Vector3.new(0, h / 2 - 1, 0)) * CFrame.Angles(0, 0, math.rad(90)) }, m)
		local cor = CORES_FLOR[rnd:NextInteger(1, #CORES_FLOR)]
		for i = 1, 5 do
			local a = i * 1.3 + rnd:NextNumber()
			local d = if i == 1 then 0 else rnd:NextNumber(3, 5.5) * escala
			local s = rnd:NextNumber(8, 12) * escala
			parte({ Size = Vector3.new(s, s * 0.8, s), Shape = Enum.PartType.Ball, Material = Enum.Material.LeafyGrass, Color = cor,
				CFrame = CFrame.new(base + Vector3.new(math.cos(a) * d, h + rnd:NextNumber(-1.5, 2.5) * escala, math.sin(a) * d)), CastShadow = true }, m)
		end
	elseif tipo == "pinheiro" then
		local h = 20 * escala
		parte({ Size = Vector3.new(h, 1.4 * escala, 1.4 * escala), Shape = Enum.PartType.Cylinder, Material = Enum.Material.Wood,
			Color = Color3.fromRGB(92, 70, 52), CFrame = CFrame.new(base + Vector3.new(0, h / 2 - 1, 0)) * CFrame.Angles(0, 0, math.rad(90)) }, m)
		for k = 0, 3 do
			local raio = (9 - k * 2) * escala
			parte({ Size = Vector3.new(3.2 * escala, raio * 2, raio * 2), Shape = Enum.PartType.Cylinder, Material = Enum.Material.LeafyGrass,
				Color = Color3.fromRGB(58, 98, 66), CFrame = CFrame.new(base + Vector3.new(0, h * 0.35 + k * 4.2 * escala, 0)) * CFrame.Angles(0, 0, math.rad(90)) }, m)
		end
	elseif tipo == "cristal" then
		local cor = if rnd:NextNumber() < 0.5 then Color3.fromRGB(120, 200, 255) else Color3.fromRGB(190, 140, 255)
		for i = 1, rnd:NextInteger(3, 5) do
			local h = rnd:NextNumber(6, 14) * escala
			local w = h * 0.28
			parte({ Size = Vector3.new(w, h, w), Material = Enum.Material.Glass, Color = cor, Transparency = 0.15,
				CFrame = CFrame.new(base + Vector3.new(rnd:NextNumber(-2, 2), h * 0.4, rnd:NextNumber(-2, 2)))
					* CFrame.Angles(rnd:NextNumber(-0.4, 0.4), rnd:NextNumber(0, 3), rnd:NextNumber(-0.4, 0.4)) }, m)
			if i == 1 then
				local luz = Instance.new("PointLight")
				luz.Color = cor
				luz.Range = 16
				luz.Brightness = 1.2
				luz.Parent = m:FindFirstChildWhichIsA("BasePart")
			end
		end
	else -- morta
		local h = 12 * escala
		parte({ Size = Vector3.new(h, 1.5 * escala, 1.5 * escala), Shape = Enum.PartType.Cylinder, Material = Enum.Material.Wood,
			Color = Color3.fromRGB(60, 56, 54), CFrame = CFrame.new(base + Vector3.new(0, h / 2 - 1, 0)) * CFrame.Angles(0, 0, math.rad(90)) }, m)
		for _ = 1, 4 do
			local len = rnd:NextNumber(5, 8) * escala
			local cf = CFrame.new(base + Vector3.new(0, h * rnd:NextNumber(0.55, 0.95), 0))
				* CFrame.Angles(0, rnd:NextNumber(0, math.pi * 2), math.rad(rnd:NextNumber(30, 60)))
			parte({ Size = Vector3.new(len, 0.7 * escala, 0.7 * escala), Shape = Enum.PartType.Cylinder, Material = Enum.Material.Wood,
				Color = Color3.fromRGB(60, 56, 54), CFrame = cf * CFrame.new(len / 2, 0, 0) }, m)
		end
	end
	m.Parent = pai
end

local PEDRA = Color3.fromRGB(196, 190, 176)

local function pilar(pos: Vector3, altura: number, partido: boolean, rnd: Random, pai: Instance)
	local h = if partido then altura * rnd:NextNumber(0.35, 0.8) else altura
	parte({ Size = Vector3.new(6, 1.6, 6), Material = Enum.Material.Marble, Color = PEDRA, CFrame = CFrame.new(pos + Vector3.new(0, 0.6, 0)) }, pai)
	parte({ Size = Vector3.new(h, 3.6, 3.6), Shape = Enum.PartType.Cylinder, Material = Enum.Material.Marble, Color = PEDRA,
		CFrame = CFrame.new(pos + Vector3.new(0, 1.4 + h / 2, 0)) * CFrame.Angles(0, 0, math.rad(90)) }, pai)
	if not partido then
		parte({ Size = Vector3.new(5.5, 1.4, 5.5), Material = Enum.Material.Marble, Color = PEDRA, CFrame = CFrame.new(pos + Vector3.new(0, 1.4 + h + 0.7, 0)) }, pai)
	else
		local a = rnd:NextNumber(0, math.pi * 2)
		parte({ Size = Vector3.new(4.5, 3.4, 3.4), Shape = Enum.PartType.Cylinder, Material = Enum.Material.Marble, Color = PEDRA,
			CFrame = CFrame.new(pos + Vector3.new(math.cos(a) * 5, 1.6, math.sin(a) * 5)) * CFrame.Angles(0, a, 0) }, pai)
	end
end

-- anel de muro em ruínas (arenas)
local function anelMuro(centro: Vector3, raio: number, altura: number, abertura: Vector3, larguraAbertura: number, mat: Enum.Material, cor: Color3, pai: Instance)
	local rnd = Random.new(semente(tostring(centro)))
	local segmentos = math.floor(raio * 2 * math.pi / 9)
	local angAbertura = math.atan2(abertura.Z, abertura.X)
	for i = 0, segmentos - 1 do
		local a = (i + 0.5) / segmentos * math.pi * 2
		local dif = math.abs(math.atan2(math.sin(a - angAbertura), math.cos(a - angAbertura)))
		if dif * raio > larguraAbertura / 2 + 4 then
			local x = centro.X + math.cos(a) * raio
			local z = centro.Z + math.sin(a) * raio
			local chao = Mundo.chaoOuIlha(x, z)
			local h = altura * rnd:NextNumber(0.75, 1.15)
			parte({ Size = Vector3.new(4, h + 6, 9.6), Material = mat, Color = cor,
				CFrame = CFrame.new(x, chao.Y + h / 2 - 3, z) * CFrame.Angles(0, -a, 0) }, pai)
		end
	end
end

-- ponte de tábuas entre duas ilhas
local function ponte(a: Config.Ilha, b: Config.Ilha, pai: Instance)
	local dir = Vector3.new(b.centro.X - a.centro.X, 0, b.centro.Z - a.centro.Z).Unit
	local p0 = Mundo.chaoOuIlha(a.centro.X + dir.X * (a.raio - 8), a.centro.Z + dir.Z * (a.raio - 8), a.id)
	local p1 = Mundo.chaoOuIlha(b.centro.X - dir.X * (b.raio - 8), b.centro.Z - dir.Z * (b.raio - 8), b.id)
	local total = (p1 - p0).Magnitude
	local n = math.ceil(total / 6)
	for i = 0, n - 1 do
		local t0 = i / n
		local t1 = (i + 1) / n
		-- pequena curvatura para baixo a meio
		local s0 = math.sin(t0 * math.pi) * 4
		local s1 = math.sin(t1 * math.pi) * 4
		local q0 = p0:Lerp(p1, t0) - Vector3.new(0, s0 + 0.6, 0)
		local q1 = p0:Lerp(p1, t1) - Vector3.new(0, s1 + 0.6, 0)
		local meio = (q0 + q1) / 2
		local cf = CFrame.lookAt(meio, q1)
		parte({ Size = Vector3.new(12, 1.2, (q1 - q0).Magnitude + 0.3), Material = Enum.Material.WoodPlanks,
			Color = Color3.fromRGB(150, 112, 80), CFrame = cf }, pai)
		if i % 2 == 0 then
			for _, lado in { -1, 1 } do
				parte({ Size = Vector3.new(0.8, 5, 0.8), Material = Enum.Material.Wood, Color = Color3.fromRGB(110, 82, 62),
					CFrame = cf * CFrame.new(lado * 5.8, 2.6, 0) }, pai)
			end
		end
		-- corrimão (impede quedas acidentais)
		for _, lado in { -1, 1 } do
			parte({ Size = Vector3.new(0.4, 0.4, (q1 - q0).Magnitude + 0.3), Material = Enum.Material.Fabric, Color = Color3.fromRGB(200, 180, 140),
				CFrame = cf * CFrame.new(lado * 5.8, 4.6, 0) }, pai)
			parte({ Size = Vector3.new(0.4, 6, (q1 - q0).Magnitude + 0.3), Transparency = 1, CanCollide = true,
				CFrame = cf * CFrame.new(lado * 6.2, 3, 0) }, pai)
		end
	end
	return p0, p1
end

-- ---------------------------------------------------------------- correntes de vento

local function corrente(def: { pos: Vector3, raio: number, topo: number }, pai: Instance)
	local base = Mundo.chaoOuIlha(def.pos.X, def.pos.Z)
	local altura = def.topo - base.Y
	local zona = parte({ Name = "Corrente", Size = Vector3.new(altura, def.raio * 2, def.raio * 2), Shape = Enum.PartType.Cylinder,
		Transparency = 1, CanCollide = false, CanQuery = false, CanTouch = false,
		CFrame = CFrame.new(base + Vector3.new(0, altura / 2, 0)) * CFrame.Angles(0, 0, math.rad(90)) }, pai)
	zona:SetAttribute("Raio", def.raio)
	zona:SetAttribute("Base", base.Y)
	zona:SetAttribute("Topo", def.topo)
	-- partículas a subir
	local emissor = Instance.new("ParticleEmitter")
	emissor.Texture = "rbxasset://textures/particles/sparkles_main.dds"
	emissor.Color = ColorSequence.new(Color3.fromRGB(220, 245, 255))
	emissor.LightEmission = 0.7
	emissor.Size = NumberSequence.new({ NumberSequenceKeypoint.new(0, 0.6), NumberSequenceKeypoint.new(1, 0.2) })
	emissor.Transparency = NumberSequence.new({ NumberSequenceKeypoint.new(0, 0.2), NumberSequenceKeypoint.new(1, 1) })
	emissor.Lifetime = NumberRange.new(altura / 60, altura / 45)
	emissor.Speed = NumberRange.new(45, 60)
	emissor.Rate = 40
	emissor.EmissionDirection = Enum.NormalId.Top
	emissor.SpreadAngle = Vector2.new(4, 4)
	emissor.Shape = Enum.ParticleEmitterShape.Disc
	emissor.ShapeStyle = Enum.ParticleEmitterShapeStyle.Volume
	local anexo = Instance.new("Attachment")
	anexo.Parent = zona
	anexo.WorldCFrame = CFrame.new(base + Vector3.new(0, 1, 0))
	emissor.Parent = anexo
	-- círculo luminoso na base e anéis a flutuar
	parte({ Size = Vector3.new(0.4, def.raio * 2, def.raio * 2), Shape = Enum.PartType.Cylinder, Material = Enum.Material.Neon,
		Color = Color3.fromRGB(190, 235, 255), Transparency = 0.55, CanCollide = false, CanQuery = false,
		CFrame = CFrame.new(base + Vector3.new(0, 0.3, 0)) * CFrame.Angles(0, 0, math.rad(90)) }, pai)
	for k = 1, 3 do
		parte({ Size = Vector3.new(0.3, def.raio * 2.1, def.raio * 2.1), Shape = Enum.PartType.Cylinder, Material = Enum.Material.ForceField,
			Color = Color3.fromRGB(200, 240, 255), Transparency = 0.2, CanCollide = false, CanQuery = false,
			CFrame = CFrame.new(base + Vector3.new(0, altura * k / 4, 0)) * CFrame.Angles(0, 0, math.rad(90)) }, pai)
	end
end

-- ---------------------------------------------------------------- faróis, relicários, inscrições, barreiras

Mundo.farois = {} :: { [string]: { modelo: Model, prompt: ProximityPrompt, pos: Vector3, cristal: BasePart, luz: PointLight, aceso: boolean } }

local function farol(def: { id: string, nome: string, ilha: string, pos: Vector3 }, pai: Instance)
	local chao = Mundo.chaoOuIlha(def.pos.X, def.pos.Z, def.ilha)
	local m = Instance.new("Model")
	m.Name = "Farol_" .. def.id
	parte({ Size = Vector3.new(2, 10, 10), Shape = Enum.PartType.Cylinder, Material = Enum.Material.Cobblestone, Color = Color3.fromRGB(150, 146, 138),
		CFrame = CFrame.new(chao + Vector3.new(0, 0.6, 0)) * CFrame.Angles(0, 0, math.rad(90)) }, m)
	parte({ Size = Vector3.new(7, 2.4, 2.4), Shape = Enum.PartType.Cylinder, Material = Enum.Material.Marble, Color = PEDRA,
		CFrame = CFrame.new(chao + Vector3.new(0, 5, 0)) * CFrame.Angles(0, 0, math.rad(90)) }, m)
	parte({ Size = Vector3.new(1.4, 5, 5), Shape = Enum.PartType.Cylinder, Material = Enum.Material.Metal, Color = Color3.fromRGB(120, 100, 70),
		CFrame = CFrame.new(chao + Vector3.new(0, 8.8, 0)) * CFrame.Angles(0, 0, math.rad(90)) }, m)
	for k = 0, 3 do
		local a = k * math.pi / 2
		parte({ Size = Vector3.new(0.5, 4, 0.5), Material = Enum.Material.Metal, Color = Color3.fromRGB(120, 100, 70),
			CFrame = CFrame.new(chao + Vector3.new(math.cos(a) * 2.2, 10.6, math.sin(a) * 2.2)) }, m)
	end
	local cristal = parte({ Name = "Cristal", Size = Vector3.new(1.8, 3.2, 1.8), Material = Enum.Material.Glass, Color = Color3.fromRGB(120, 120, 130),
		CFrame = CFrame.new(chao + Vector3.new(0, 11.2, 0)) * CFrame.Angles(0, math.rad(45), 0), CanCollide = false }, m)
	local luz = Instance.new("PointLight")
	luz.Color = Color3.fromRGB(255, 200, 120)
	luz.Range = 28
	luz.Brightness = 0
	luz.Shadows = true
	luz.Parent = cristal
	local brilho = Instance.new("ParticleEmitter")
	brilho.Name = "Brilho"
	brilho.Texture = "rbxasset://textures/particles/fire_main.dds"
	brilho.Color = ColorSequence.new(Color3.fromRGB(255, 190, 110), Color3.fromRGB(255, 110, 40))
	brilho.LightEmission = 1
	brilho.Size = NumberSequence.new({ NumberSequenceKeypoint.new(0, 1.6), NumberSequenceKeypoint.new(1, 0.2) })
	brilho.Transparency = NumberSequence.new({ NumberSequenceKeypoint.new(0, 0.3), NumberSequenceKeypoint.new(1, 1) })
	brilho.Lifetime = NumberRange.new(0.6, 1.1)
	brilho.Speed = NumberRange.new(2, 4)
	brilho.Rate = 30
	brilho.Enabled = false
	brilho.Parent = cristal
	local base = m:FindFirstChildWhichIsA("BasePart") :: BasePart
	local prompt = Instance.new("ProximityPrompt")
	prompt.Name = "Farol"
	prompt.ActionText = "Acender"
	prompt.ObjectText = def.nome
	prompt.HoldDuration = 0.4
	prompt.MaxActivationDistance = 12
	prompt.RequiresLineOfSight = false
	prompt.GamepadKeyCode = Enum.KeyCode.ButtonY
	prompt:SetAttribute("Farol", def.id)
	prompt.Parent = base
	m:SetAttribute("Farol", def.id)
	m.Parent = pai
	Mundo.farois[def.id] = { modelo = m, prompt = prompt, pos = chao, cristal = cristal, luz = luz, aceso = false }
end

function Mundo.acenderFarolVisual(id: string)
	local f = Mundo.farois[id]
	if not f or f.aceso then
		return
	end
	f.aceso = true
	f.cristal.Material = Enum.Material.Neon
	f.cristal.Color = Color3.fromRGB(255, 196, 120)
	f.luz.Brightness = 2.2
	local b = f.cristal:FindFirstChild("Brilho")
	if b and b:IsA("ParticleEmitter") then
		b.Enabled = true
	end
end

Mundo.relicarios = {} :: { [string]: { modelo: Model, prompt: ProximityPrompt } }

local function relicario(def: { id: string, x: number, z: number }, pai: Instance)
	local chao = Mundo.chaoOuIlha(def.x, def.z)
	local m = Instance.new("Model")
	m.Name = "Relicario_" .. def.id
	local caixa = parte({ Size = Vector3.new(4.5, 2.6, 3), Material = Enum.Material.Wood, Color = Color3.fromRGB(120, 86, 56),
		CFrame = CFrame.new(chao + Vector3.new(0, 1.3, 0)) * CFrame.Angles(0, math.rad(def.x % 360), 0) }, m)
	local tampa = parte({ Name = "Tampa", Size = Vector3.new(4.7, 1, 3.2), Material = Enum.Material.Wood, Color = Color3.fromRGB(140, 100, 64),
		CFrame = caixa.CFrame * CFrame.new(0, 1.8, 0) }, m)
	for _, x in { -1.6, 1.6 } do
		parte({ Size = Vector3.new(0.4, 3.8, 3.3), Material = Enum.Material.Metal, Color = Color3.fromRGB(200, 170, 90),
			CFrame = caixa.CFrame * CFrame.new(x, 0.5, 0), CanCollide = false }, m)
	end
	local brilho = Instance.new("ParticleEmitter")
	brilho.Texture = "rbxasset://textures/particles/sparkles_main.dds"
	brilho.Color = ColorSequence.new(Color3.fromRGB(255, 230, 160))
	brilho.LightEmission = 1
	brilho.Size = NumberSequence.new(0.35)
	brilho.Lifetime = NumberRange.new(1, 2)
	brilho.Speed = NumberRange.new(1, 2)
	brilho.Rate = 6
	brilho.SpreadAngle = Vector2.new(60, 60)
	brilho.Parent = tampa
	local prompt = Instance.new("ProximityPrompt")
	prompt.Name = "Relicario"
	prompt.ActionText = "Abrir"
	prompt.ObjectText = "Relicário"
	prompt.HoldDuration = 0.6
	prompt.MaxActivationDistance = 9
	prompt.GamepadKeyCode = Enum.KeyCode.ButtonY
	prompt:SetAttribute("Relicario", def.id)
	prompt.Parent = caixa
	m:SetAttribute("Relicario", def.id)
	m.Parent = pai
	Mundo.relicarios[def.id] = { modelo = m, prompt = prompt }
end

local function inscricao(def: { x: number, z: number, texto: string }, pai: Instance)
	local chao = Mundo.chaoOuIlha(def.x, def.z)
	local pedra = parte({ Name = "Inscricao", Size = Vector3.new(4, 5, 1.2), Material = Enum.Material.Slate, Color = Color3.fromRGB(120, 124, 132),
		CFrame = CFrame.new(chao + Vector3.new(0, 2, 0)) * CFrame.Angles(math.rad(-8), math.rad((def.x * 7) % 360), 0) }, pai)
	parte({ Size = Vector3.new(2.6, 0.25, 0.1), Material = Enum.Material.Neon, Color = Color3.fromRGB(140, 220, 255), CanCollide = false,
		CFrame = pedra.CFrame * CFrame.new(0, 1, -0.62) }, pai)
	parte({ Size = Vector3.new(1.8, 0.25, 0.1), Material = Enum.Material.Neon, Color = Color3.fromRGB(140, 220, 255), CanCollide = false,
		CFrame = pedra.CFrame * CFrame.new(0, 0.3, -0.62) }, pai)
	local prompt = Instance.new("ProximityPrompt")
	prompt.Name = "Inscricao"
	prompt.ActionText = "Ler"
	prompt.ObjectText = "Inscrição"
	prompt.MaxActivationDistance = 8
	prompt.GamepadKeyCode = Enum.KeyCode.ButtonY
	prompt:SetAttribute("Texto", def.texto)
	prompt.Parent = pedra
end

Mundo.barreiras = {} :: { [string]: { parte: BasePart, prompt: ProximityPrompt, dentro: Vector3, fora: Vector3 } }

local function barreira(id: string, arena: { ilha: string, centro: Vector3, raio: number, normal: Vector3 }, pai: Instance)
	local entrada = arena.centro + arena.normal * arena.raio
	local chao = Mundo.chaoOuIlha(entrada.X, entrada.Z, arena.ilha)
	local cf = CFrame.lookAt(chao + Vector3.new(0, 9, 0), chao + Vector3.new(0, 9, 0) + arena.normal)
	local p = parte({ Name = "Barreira_" .. id, Size = Vector3.new(18, 22, 1), Material = Enum.Material.ForceField,
		Color = Color3.fromRGB(170, 225, 255), Transparency = 0.1, CFrame = cf }, pai)
	local vento = Instance.new("ParticleEmitter")
	vento.Texture = "rbxasset://textures/particles/smoke_main.dds"
	vento.Color = ColorSequence.new(Color3.fromRGB(220, 240, 255))
	vento.Size = NumberSequence.new(3)
	vento.Transparency = NumberSequence.new({ NumberSequenceKeypoint.new(0, 0.6), NumberSequenceKeypoint.new(1, 1) })
	vento.Lifetime = NumberRange.new(1, 2)
	vento.Speed = NumberRange.new(6, 10)
	vento.Rate = 25
	vento.EmissionDirection = Enum.NormalId.Top
	vento.Parent = p
	local prompt = Instance.new("ProximityPrompt")
	prompt.Name = "Barreira"
	prompt.ActionText = "Atravessar"
	prompt.ObjectText = "Barreira de Vento"
	prompt.HoldDuration = 0.8
	prompt.MaxActivationDistance = 14
	prompt.RequiresLineOfSight = false
	prompt.GamepadKeyCode = Enum.KeyCode.ButtonY
	prompt:SetAttribute("Arena", id)
	prompt.Parent = p
	Mundo.barreiras[id] = {
		parte = p, prompt = prompt,
		dentro = chao - arena.normal * 7 + Vector3.new(0, 3, 0),
		fora = chao + arena.normal * 7 + Vector3.new(0, 3, 0),
	}
end

function Mundo.abrirBarreira(id: string, aberta: boolean)
	local b = Mundo.barreiras[id]
	if not b then
		return
	end
	b.parte.CanCollide = not aberta
	b.parte.Transparency = if aberta then 1 else 0.1
	b.prompt.Enabled = not aberta
	local e = b.parte:FindFirstChildWhichIsA("ParticleEmitter")
	if e then
		e.Enabled = not aberta
	end
end

-- ---------------------------------------------------------------- céu, nuvens e luz

local function ambiente()
	Lighting.ClockTime = 16.3
	Lighting.GeographicLatitude = 30
	Lighting.Brightness = 3
	Lighting.Ambient = Color3.fromRGB(70, 70, 82)
	Lighting.OutdoorAmbient = Color3.fromRGB(140, 140, 156)
	Lighting.EnvironmentDiffuseScale = 1
	Lighting.EnvironmentSpecularScale = 1
	Lighting.ShadowSoftness = 0.3
	Lighting.GlobalShadows = true
	for _, filho in Lighting:GetChildren() do
		if filho:IsA("PostEffect") or filho:IsA("Atmosphere") or filho:IsA("Sky") then
			filho:Destroy()
		end
	end
	local atm = Instance.new("Atmosphere")
	atm.Density = 0.32
	atm.Offset = 0.15
	atm.Color = Color3.fromRGB(214, 222, 236)
	atm.Decay = Color3.fromRGB(150, 140, 170)
	atm.Glare = 0.35
	atm.Haze = 1.4
	atm.Parent = Lighting
	local ceu = Instance.new("Sky")
	ceu.SunAngularSize = 14
	ceu.MoonAngularSize = 8
	ceu.StarCount = 1500
	ceu.Parent = Lighting
	local bloom = Instance.new("BloomEffect")
	bloom.Intensity = 0.7
	bloom.Size = 30
	bloom.Threshold = 1.2
	bloom.Parent = Lighting
	local raios = Instance.new("SunRaysEffect")
	raios.Intensity = 0.06
	raios.Spread = 0.6
	raios.Parent = Lighting
	local cor = Instance.new("ColorCorrectionEffect")
	cor.Name = "Cor"
	cor.Saturation = 0.08
	cor.Contrast = 0.06
	cor.TintColor = Color3.fromRGB(255, 249, 242)
	cor.Parent = Lighting

	-- nuvens do céu (camada alta)
	local nuvens = terreno:FindFirstChildOfClass("Clouds") or Instance.new("Clouds")
	nuvens.Cover = 0.5
	nuvens.Density = 0.6
	nuvens.Color = Color3.fromRGB(255, 250, 245)
	nuvens.Parent = terreno

	-- mar de nuvens por baixo das ilhas
	local mar = parte({ Name = "MarDeNuvens", Size = Vector3.new(2048, 2, 2048), Material = Enum.Material.SmoothPlastic,
		Color = Color3.fromRGB(236, 238, 246), Transparency = 0.15, CanCollide = false, CanQuery = false, CanTouch = false, CastShadow = false,
		CFrame = CFrame.new(-50, 15, -200) })
	mar.Name = "MarDeNuvens"
	local rnd = Random.new(5)
	for i = 1, 12 do
		local emissor = parte({ Name = "Nuvem", Size = Vector3.new(380, 1, 380), Transparency = 1, CanCollide = false, CanQuery = false, CanTouch = false,
			CFrame = CFrame.new(rnd:NextNumber(-800, 700), rnd:NextNumber(40, 90), rnd:NextNumber(-950, 500)) })
		local e = Instance.new("ParticleEmitter")
		e.Texture = "rbxasset://textures/particles/smoke_main.dds"
		e.Color = ColorSequence.new(Color3.fromRGB(255, 255, 255), Color3.fromRGB(225, 228, 240))
		e.Size = NumberSequence.new({ NumberSequenceKeypoint.new(0, 90), NumberSequenceKeypoint.new(1, 150) })
		e.Transparency = NumberSequence.new({ NumberSequenceKeypoint.new(0, 1), NumberSequenceKeypoint.new(0.3, 0.35), NumberSequenceKeypoint.new(0.7, 0.35), NumberSequenceKeypoint.new(1, 1) })
		e.Lifetime = NumberRange.new(40, 60)
		e.Speed = NumberRange.new(1, 3)
		e.Rate = 0.35
		e.RotSpeed = NumberRange.new(-2, 2)
		e.Rotation = NumberRange.new(0, 360)
		e.EmissionDirection = Enum.NormalId.Top
		e.SpreadAngle = Vector2.new(80, 80)
		e.Shape = Enum.ParticleEmitterShape.Box
		e.LightInfluence = 1
		e.Parent = emissor
		if i <= 6 then
			-- já começam com algumas nuvens visíveis
			e:Emit(4)
		end
	end
end

-- tempestade permanente sobre o Olho
local function tempestade(ilha: Config.Ilha, pai: Instance)
	local nuvem = parte({ Name = "Tempestade", Size = Vector3.new(260, 1, 260), Transparency = 1, CanCollide = false, CanQuery = false, CanTouch = false,
		CFrame = CFrame.new(ilha.centro + Vector3.new(0, 90, 0)) }, pai)
	local e = Instance.new("ParticleEmitter")
	e.Texture = "rbxasset://textures/particles/smoke_main.dds"
	e.Color = ColorSequence.new(Color3.fromRGB(70, 72, 92), Color3.fromRGB(40, 40, 56))
	e.Size = NumberSequence.new({ NumberSequenceKeypoint.new(0, 50), NumberSequenceKeypoint.new(1, 90) })
	e.Transparency = NumberSequence.new({ NumberSequenceKeypoint.new(0, 1), NumberSequenceKeypoint.new(0.3, 0.25), NumberSequenceKeypoint.new(0.8, 0.3), NumberSequenceKeypoint.new(1, 1) })
	e.Lifetime = NumberRange.new(14, 22)
	e.Speed = NumberRange.new(2, 4)
	e.Rate = 2.5
	e.RotSpeed = NumberRange.new(-8, 8)
	e.Shape = Enum.ParticleEmitterShape.Box
	e.Parent = nuvem
	e:Emit(20)
	local chuva = Instance.new("ParticleEmitter")
	chuva.Texture = "rbxasset://textures/particles/sparkles_main.dds"
	chuva.Color = ColorSequence.new(Color3.fromRGB(180, 200, 230))
	chuva.Size = NumberSequence.new(0.25)
	chuva.Lifetime = NumberRange.new(1.5, 2)
	chuva.Speed = NumberRange.new(70, 80)
	chuva.Rate = 160
	chuva.EmissionDirection = Enum.NormalId.Bottom
	chuva.Shape = Enum.ParticleEmitterShape.Box
	chuva.Parent = nuvem
end

-- ---------------------------------------------------------------- geração completa

local function etapa(nome: string, fn: () -> ())
	local ok, erro = pcall(fn :: any)
	if not ok then
		warn("[Céu Partido] erro ao gerar «" .. nome .. "»:", erro)
	end
end

function Mundo.gerar()
	pasta = Instance.new("Folder")
	pasta.Name = "Mundo"
	pasta.Parent = workspace
	terreno.WaterColor = Color3.fromRGB(70, 150, 170)
	terreno.WaterTransparency = 0.6
	terreno.WaterWaveSize = 0.08
	terreno:SetMaterialColor(Enum.Material.Grass, Color3.fromRGB(106, 150, 80))
	terreno:SetMaterialColor(Enum.Material.LeafyGrass, Color3.fromRGB(120, 160, 86))
	terreno:SetMaterialColor(Enum.Material.Ground, Color3.fromRGB(110, 92, 72))

	etapa("ambiente", ambiente)
	for _, ilha in Config.ILHAS do
		etapa("ilha " .. ilha.id, function()
			gerarIlha(ilha)
		end)
	end
	etapa("rochas", gerarRochasFlutuantes)

	-- ponto de exclusão para vegetação
	local livres: { { p: Vector3, r: number } } = {}
	local function excluir(p: Vector3, r: number)
		table.insert(livres, { p = p, r = r })
	end
	for _, f in Config.FAROIS do
		excluir(f.pos, 14)
	end
	for _, r in Config.RELICARIOS do
		excluir(Vector3.new(r.x, 0, r.z), 7)
	end
	for _, c in Config.CORRENTES do
		excluir(c.pos, c.raio + 6)
	end
	for _, i in Config.INSCRICOES do
		excluir(Vector3.new(i.x, 0, i.z), 5)
	end
	for _, a in Config.ARENAS do
		excluir(a.centro, a.raio + 8)
	end
	excluir(Config.INICIO, 10)

	local estruturas = Instance.new("Folder")
	estruturas.Name = "Estruturas"
	estruturas.Parent = pasta

	etapa("pontes", function()
		-- pontes
		for _, par in Config.PONTES do
			local a, b = ilhasPorId[par[1]], ilhasPorId[par[2]]
			if a and b then
				local p0, p1 = ponte(a, b, estruturas)
				excluir(p0, 16)
				excluir(p1, 16)
			end
		end
	end)

	etapa("ruínas", function()
		-- ruínas por ilha
		local rnd = Random.new(1234)
		-- círculo de menires no Despertar
		for i = 0, 7 do
			local a = i / 8 * math.pi * 2
			local p = Mundo.chaoOuIlha(-60 + math.cos(a) * 18, 10 + math.sin(a) * 18)
			local h = rnd:NextNumber(7, 12)
			parte({ Size = Vector3.new(3.4, h, 2.2), Material = Enum.Material.Slate, Color = Color3.fromRGB(120, 126, 134),
				CFrame = CFrame.new(p + Vector3.new(0, h / 2 - 1, 0)) * CFrame.Angles(rnd:NextNumber(-0.08, 0.08), -a, rnd:NextNumber(-0.08, 0.08)) }, estruturas)
		end
		excluir(Vector3.new(-60, 0, 10), 22)
		-- colunatas dos Jardins
		for i = 0, 9 do
			local p = Mundo.chaoOuIlha(300 + (i % 5) * 14, -95 + math.floor(i / 5) * 40)
			pilar(p, 16, i % 3 == 1, rnd, estruturas)
		end
		local arco = Mundo.chaoOuIlha(355, -75)
		parte({ Size = Vector3.new(62, 2.4, 6), Material = Enum.Material.Marble, Color = PEDRA, CFrame = CFrame.new(arco + Vector3.new(-27, 19, -20)) }, estruturas)
		excluir(Vector3.new(328, 0, -75), 38)
		-- observatório: muro circular da arena e telescópio caído
		local ag = Config.ARENAS.guardiao
		anelMuro(ag.centro, ag.raio, 18, ag.normal, 18, Enum.Material.Marble, PEDRA, estruturas)
		local tel = Mundo.chaoOuIlha(80, -560)
		parte({ Size = Vector3.new(40, 7, 7), Shape = Enum.PartType.Cylinder, Material = Enum.Material.Metal, Color = Color3.fromRGB(150, 120, 80),
			CFrame = CFrame.new(tel + Vector3.new(0, 8, 0)) * CFrame.Angles(0, math.rad(30), math.rad(25)) }, estruturas)
		excluir(Vector3.new(80, 0, -560), 22)
		-- olho da tempestade: anel de rochas negras
		local at = Config.ARENAS.tempestor
		anelMuro(at.centro, at.raio, 22, at.normal, 18, Enum.Material.Basalt, Color3.fromRGB(60, 60, 70), estruturas)
	end)

	etapa("vegetação", function()
		-- vegetação
		local veg = Instance.new("Folder")
		veg.Name = "Vegetacao"
		veg.Parent = pasta
		for _, ilha in Config.ILHAS do
			local r2 = Random.new(semente(ilha.id .. "veg"))
			local colocadas = 0
			local tentativas = 0
			while colocadas < ilha.arvores and tentativas < ilha.arvores * 12 do
				tentativas += 1
				local a = r2:NextNumber(0, math.pi * 2)
				local d = math.sqrt(r2:NextNumber()) * ilha.raio * 0.85
				local x = ilha.centro.X + math.cos(a) * d
				local z = ilha.centro.Z + math.sin(a) * d
				local ok = true
				for _, e in livres do
					if (Vector2.new(x, z) - Vector2.new(e.p.X, e.p.Z)).Magnitude < e.r then
						ok = false
						break
					end
				end
				local chao = if ok then Mundo.chao(x, z) else nil
				if chao and math.abs(chao.Y - ilha.centro.Y) < 14 then
					arvore(ilha.tipoArvore, chao, r2, veg)
					colocadas += 1
				end
			end
		end
	end)

	-- correntes, faróis, relicários, inscrições, barreiras
	local interativos = Instance.new("Folder")
	interativos.Name = "Interativos"
	interativos.Parent = pasta
	local correntes = Instance.new("Folder")
	correntes.Name = "Correntes"
	correntes.Parent = workspace
	for _, c in Config.CORRENTES do
		etapa("corrente", function()
			corrente(c, correntes)
		end)
	end
	for _, f in Config.FAROIS do
		etapa("farol " .. f.id, function()
			farol(f, interativos)
		end)
	end
	for _, r in Config.RELICARIOS do
		etapa("relicário " .. r.id, function()
			relicario(r, interativos)
		end)
	end
	for _, i in Config.INSCRICOES do
		etapa("inscrição", function()
			inscricao(i, interativos)
		end)
	end
	for id, a in Config.ARENAS do
		etapa("barreira " .. id, function()
			barreira(id, a, interativos)
		end)
	end
	for _, ilha in Config.ILHAS do
		if ilha.tempestade then
			etapa("tempestade", function()
				tempestade(ilha, estruturas)
			end)
		end
	end
end

return Mundo

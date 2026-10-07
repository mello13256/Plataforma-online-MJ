--!strict
-- Constrói os corpos dos inimigos (esqueleto R15, para partilharem as animações dos jogadores),
-- as armas, o escudo e o planador.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Config = require(ReplicatedStorage:WaitForChild("Compartilhado"):WaitForChild("Config"))

local Personagens = {}

local function peca(props: { [string]: any }, pai: Instance?): BasePart
	local p = Instance.new(props.Classe or "Part") :: BasePart
	p.Anchored = false
	p.CanCollide = false
	p.CanQuery = false
	p.CanTouch = false
	p.Massless = true
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	for k, v in props do
		if k ~= "Classe" then
			(p :: any)[k] = v
		end
	end
	if pai then
		p.Parent = pai
	end
	return p
end

local function soldar(a: BasePart, b: BasePart)
	local w = Instance.new("WeldConstraint")
	w.Part0 = a
	w.Part1 = b
	w.Parent = b
end

-- Cria um modelo de arma com uma peça "Punho" na origem; a lâmina aponta para -Z do punho.
function Personagens.criarArma(tipo: string): Model
	local m = Instance.new("Model")
	m.Name = "Arma"
	local couro = Color3.fromRGB(70, 48, 34)
	local metal = Color3.fromRGB(196, 200, 206)
	local punho = peca({ Name = "Punho", Size = Vector3.new(0.35, 0.35, 1.3), Material = Enum.Material.Fabric, Color = couro, CFrame = CFrame.new() }, m)
	m.PrimaryPart = punho
	local function junta(p: BasePart)
		p.Parent = m
		soldar(punho, p)
	end
	if tipo == "espada" or tipo == "espadaPartida" or tipo == "espadaRei" then
		local comp = if tipo == "espadaPartida" then 2.2 elseif tipo == "espadaRei" then 5 else 4
		local larg = if tipo == "espadaRei" then 0.9 else 0.55
		local corL = if tipo == "espadaPartida" then Color3.fromRGB(110, 104, 100) elseif tipo == "espadaRei" then Color3.fromRGB(60, 66, 90) else metal
		junta(peca({ Size = Vector3.new(larg * 3.2, 0.25, 0.4), Material = Enum.Material.Metal, Color = Color3.fromRGB(150, 130, 80), CFrame = CFrame.new(0, 0, -0.8) }))
		junta(peca({ Size = Vector3.new(larg, 0.16, comp), Material = Enum.Material.Metal, Color = corL, CFrame = CFrame.new(0, 0, -0.95 - comp / 2) }))
		junta(peca({ Classe = "WedgePart", Size = Vector3.new(0.16, larg / 2, larg * 1.2), Material = Enum.Material.Metal, Color = corL,
			CFrame = CFrame.new(0, 0, -0.95 - comp - larg * 0.6) * CFrame.Angles(0, math.rad(-90), math.rad(90)) }))
		if tipo == "espadaRei" then
			junta(peca({ Name = "Gume", Size = Vector3.new(larg * 0.3, 0.2, comp), Material = Enum.Material.Neon, Color = Color3.fromRGB(120, 200, 255), CFrame = CFrame.new(0, 0, -0.95 - comp / 2) }))
		end
		junta(peca({ Classe = "Part", Shape = Enum.PartType.Ball, Size = Vector3.new(0.5, 0.5, 0.5), Material = Enum.Material.Metal, Color = Color3.fromRGB(150, 130, 80), CFrame = CFrame.new(0, 0, 0.75) }))
	elseif tipo == "martelo" then
		punho.Size = Vector3.new(0.35, 0.35, 5)
		punho.CFrame = CFrame.new(0, 0, -1.6)
		punho.Material = Enum.Material.Wood
		punho.Color = Color3.fromRGB(110, 80, 56)
		-- o "punho" fica deslocado: a origem da arma é onde a mão segura
		local agarre = peca({ Name = "Agarre", Size = Vector3.new(0.2, 0.2, 0.2), Transparency = 1, CFrame = CFrame.new() }, m)
		soldar(punho, agarre)
		junta(peca({ Size = Vector3.new(2.6, 1.7, 1.7), Material = Enum.Material.Slate, Color = Color3.fromRGB(150, 160, 180), CFrame = CFrame.new(0, 0, -4.1) }))
		junta(peca({ Size = Vector3.new(2.8, 0.4, 1.9), Material = Enum.Material.Neon, Color = Color3.fromRGB(150, 220, 255), CFrame = CFrame.new(0, 0, -4.1) }))
		m.PrimaryPart = agarre
	elseif tipo == "lanca" then
		punho.Size = Vector3.new(0.3, 0.3, 9)
		punho.CFrame = CFrame.new(0, 0, -2.2)
		punho.Material = Enum.Material.Wood
		punho.Color = Color3.fromRGB(130, 96, 64)
		local agarre = peca({ Name = "Agarre", Size = Vector3.new(0.2, 0.2, 0.2), Transparency = 1, CFrame = CFrame.new() }, m)
		soldar(punho, agarre)
		junta(peca({ Classe = "WedgePart", Size = Vector3.new(0.2, 0.55, 1.6), Material = Enum.Material.Metal, Color = metal,
			CFrame = CFrame.new(0, 0.27, -7.5) * CFrame.Angles(0, math.rad(180), 0) }))
		junta(peca({ Classe = "WedgePart", Size = Vector3.new(0.2, 0.55, 1.6), Material = Enum.Material.Metal, Color = metal,
			CFrame = CFrame.new(0, -0.27, -7.5) * CFrame.Angles(math.rad(180), 0, 0) }))
		junta(peca({ Size = Vector3.new(0.9, 0.12, 0.5), Material = Enum.Material.Fabric, Color = Color3.fromRGB(80, 140, 200), CFrame = CFrame.new(0, 0, -6.4) }))
		m.PrimaryPart = agarre
	elseif tipo == "punhos" then
		punho.Transparency = 1
	end
	return m
end

local function equiparArma(personagem: Model, tipo: string)
	local mao = personagem:FindFirstChild("RightHand") :: BasePart?
	if not mao then
		return
	end
	local antiga = personagem:FindFirstChild("Arma")
	if antiga then
		antiga:Destroy()
	end
	local arma = Personagens.criarArma(tipo)
	local agarre = arma.PrimaryPart :: BasePart
	arma:PivotTo(mao.CFrame)
	local w = Instance.new("Weld")
	w.Part0 = mao
	w.Part1 = agarre
	w.C0 = CFrame.new(0, -mao.Size.Y * 0.35, 0)
	w.Parent = agarre
	arma.Parent = personagem
end
Personagens.equiparArma = equiparArma

-- escudo preso ao antebraço esquerdo; a face fica para -X do antebraço (virado para fora)
local function equiparEscudo(personagem: Model, cor: Color3)
	local braco = personagem:FindFirstChild("LeftLowerArm") :: BasePart?
	if not braco then
		return
	end
	local m = Instance.new("Model")
	m.Name = "Escudo"
	local face = peca({ Name = "Face", Size = Vector3.new(0.3, 3.2, 2.4), Material = Enum.Material.Metal, Color = cor }, m)
	local orla = peca({ Size = Vector3.new(0.2, 3.4, 2.6), Material = Enum.Material.Metal, Color = Color3.fromRGB(170, 140, 80) }, m)
	local bossa = peca({ Shape = Enum.PartType.Ball, Size = Vector3.new(0.8, 0.8, 0.8), Material = Enum.Material.Metal, Color = Color3.fromRGB(170, 140, 80) }, m)
	face.CFrame = CFrame.new()
	orla.CFrame = CFrame.new(0.1, 0, 0)
	bossa.CFrame = CFrame.new(-0.25, 0, 0)
	soldar(face, orla)
	soldar(face, bossa)
	-- o "cima" do escudo fica para -Z do antebraço, para que o bloqueio o ponha vertical à frente do peito
	local w = Instance.new("Weld")
	w.Part0 = braco
	w.Part1 = face
	w.C0 = CFrame.new(-braco.Size.X / 2 - 0.25, -braco.Size.Y * 0.15, 0) * CFrame.Angles(math.rad(-90), 0, 0)
	w.Parent = face
	m.PrimaryPart = face
	m.Parent = personagem
end

-- planador (asa de tecido) às costas; fica invisível até se planar
local function equiparPlanador(personagem: Model)
	local tronco = personagem:FindFirstChild("UpperTorso") :: BasePart?
	if not tronco then
		return
	end
	local m = Instance.new("Model")
	m.Name = "Planador"
	local barra = peca({ Name = "Barra", Size = Vector3.new(9, 0.25, 0.25), Material = Enum.Material.Wood, Color = Color3.fromRGB(120, 90, 60), Transparency = 1 }, m)
	barra.CFrame = CFrame.new()
	for _, lado in { -1, 1 } do
		local asa = peca({ Name = "Asa", Size = Vector3.new(4.6, 0.12, 2.6), Material = Enum.Material.Fabric,
			Color = Color3.fromRGB(230, 236, 245), Transparency = 1 }, m)
		asa.CFrame = CFrame.new(lado * 2.3, -0.2, 1.0) * CFrame.Angles(0, 0, math.rad(lado * -10))
		soldar(barra, asa)
	end
	local w = Instance.new("Weld")
	w.Part0 = tronco
	w.Part1 = barra
	w.C0 = CFrame.new(0, tronco.Size.Y * 0.5 + 1.6, 0.6)
	w.Parent = barra
	m.Parent = personagem
end

function Personagens.equiparJogador(personagem: Model, arma: string)
	local def = Config.ARMAS[arma] or Config.ARMAS[Config.ARMA_INICIAL]
	equiparArma(personagem, def.modelo)
	if not personagem:FindFirstChild("Escudo") then
		equiparEscudo(personagem, Color3.fromRGB(70, 110, 170))
	end
	if not personagem:FindFirstChild("Planador") then
		equiparPlanador(personagem)
	end
end

-- ---------------------------------------------------------------- inimigos

local ESTILOS = {
	corrompido = { pele = Color3.fromRGB(92, 84, 104), roupa = Color3.fromRGB(52, 44, 62), olhos = Color3.fromRGB(190, 120, 255), arma = "espadaPartida", material = Enum.Material.SmoothPlastic },
	sentinela = { pele = Color3.fromRGB(140, 138, 128), roupa = Color3.fromRGB(100, 98, 92), olhos = Color3.fromRGB(110, 230, 255), arma = "espada", material = Enum.Material.Slate, escudo = true },
	espectro = { pele = Color3.fromRGB(200, 225, 245), roupa = Color3.fromRGB(170, 205, 235), olhos = Color3.fromRGB(255, 255, 255), arma = "punhos", material = Enum.Material.Glass },
	guardiao = { pele = Color3.fromRGB(116, 110, 98), roupa = Color3.fromRGB(96, 92, 84), olhos = Color3.fromRGB(255, 160, 60), arma = "punhos", material = Enum.Material.Slate },
	tempestor = { pele = Color3.fromRGB(46, 48, 66), roupa = Color3.fromRGB(30, 32, 46), olhos = Color3.fromRGB(120, 210, 255), arma = "espadaRei", material = Enum.Material.Metal },
}

local function corpo(desc: HumanoidDescription): Model
	local ok, modelo = pcall(function()
		return Players:CreateHumanoidModelFromDescription(desc, Enum.HumanoidRigType.R15)
	end)
	if ok and modelo then
		return modelo
	end
	error("Não foi possível criar o corpo R15: " .. tostring(modelo))
end

function Personagens.criarInimigo(tipo: string): Model
	local cfg = Config.INIMIGOS[tipo]
	local est = ESTILOS[cfg.estilo]
	local desc = Instance.new("HumanoidDescription")
	desc.HeadColor = est.pele
	desc.LeftArmColor = est.pele
	desc.RightArmColor = est.pele
	desc.LeftLegColor = est.roupa
	desc.RightLegColor = est.roupa
	desc.TorsoColor = est.roupa
	desc.Face = 0
	local modelo = corpo(desc)
	modelo.Name = cfg.nome
	for _, filho in modelo:GetDescendants() do
		if filho:IsA("Script") or filho:IsA("LocalScript") then
			filho:Destroy()
		elseif filho:IsA("Decal") and filho.Name == "face" then
			filho:Destroy()
		elseif filho:IsA("BasePart") and filho.Name ~= "HumanoidRootPart" then
			filho.Material = est.material
			if cfg.estilo == "espectro" then
				filho.Transparency = 0.35
			end
		end
	end
	local hum = modelo:FindFirstChildOfClass("Humanoid") :: Humanoid
	hum.DisplayDistanceType = Enum.HumanoidDisplayDistanceType.None
	hum.HealthDisplayType = Enum.HumanoidHealthDisplayType.AlwaysOff
	hum.BreakJointsOnDeath = false
	hum.RequiresNeck = false
	hum.MaxHealth = 1e6
	hum.Health = 1e6
	hum.AutoRotate = false
	hum:SetStateEnabled(Enum.HumanoidStateType.Dead, false)
	hum:SetStateEnabled(Enum.HumanoidStateType.FallingDown, false)
	hum:SetStateEnabled(Enum.HumanoidStateType.Ragdoll, false)
	hum:SetStateEnabled(Enum.HumanoidStateType.Climbing, false)
	hum:SetStateEnabled(Enum.HumanoidStateType.Seated, false)

	local cabeca = modelo:FindFirstChild("Head") :: BasePart
	local tronco = modelo:FindFirstChild("UpperTorso") :: BasePart
	-- olhos luminosos
	for _, lado in { -1, 1 } do
		local olho = peca({ Size = Vector3.new(0.22, 0.12, 0.1), Material = Enum.Material.Neon, Color = est.olhos }, modelo)
		olho.CFrame = cabeca.CFrame * CFrame.new(lado * 0.22, 0.12, -cabeca.Size.Z / 2)
		soldar(cabeca, olho)
	end
	-- adereços por estilo
	if cfg.estilo == "corrompido" then
		local capuz = peca({ Shape = Enum.PartType.Ball, Size = Vector3.new(1.6, 1.6, 1.6), Material = Enum.Material.Fabric, Color = est.roupa }, modelo)
		capuz.CFrame = cabeca.CFrame * CFrame.new(0, 0.25, 0.22)
		soldar(cabeca, capuz)
		local manto = peca({ Size = Vector3.new(2.2, 3.2, 0.15), Material = Enum.Material.Fabric, Color = est.roupa }, modelo)
		manto.CFrame = tronco.CFrame * CFrame.new(0, -0.9, tronco.Size.Z / 2 + 0.1) * CFrame.Angles(math.rad(-8), 0, 0)
		soldar(tronco, manto)
	elseif cfg.estilo == "sentinela" or cfg.estilo == "guardiao" then
		local elmo = peca({ Size = Vector3.new(1.5, 1.4, 1.5), Material = Enum.Material.Slate, Color = est.pele }, modelo)
		elmo.CFrame = cabeca.CFrame * CFrame.new(0, 0.15, 0)
		soldar(cabeca, elmo)
		for _, lado in { -1, 1 } do
			local ombro = peca({ Size = Vector3.new(1.4, 1, 1.6), Material = Enum.Material.Slate, Color = est.pele }, modelo)
			ombro.CFrame = tronco.CFrame * CFrame.new(lado * 1.3, 0.75, 0)
			soldar(tronco, ombro)
			if cfg.estilo == "guardiao" then
				local musgo = peca({ Size = Vector3.new(1.45, 0.3, 1.65), Material = Enum.Material.Grass, Color = Color3.fromRGB(96, 140, 70) }, modelo)
				musgo.CFrame = ombro.CFrame * CFrame.new(0, 0.6, 0)
				soldar(ombro, musgo)
			end
		end
		if cfg.estilo == "guardiao" then
			for _, nome in { "RightHand", "LeftHand" } do
				local mao = modelo:FindFirstChild(nome) :: BasePart
				local punho = peca({ Shape = Enum.PartType.Ball, Size = Vector3.new(1.5, 1.5, 1.5), Material = Enum.Material.Slate, Color = est.pele }, modelo)
				punho.CFrame = mao.CFrame
				soldar(mao, punho)
			end
			local nucleo = peca({ Size = Vector3.new(0.7, 0.7, 0.2), Material = Enum.Material.Neon, Color = est.olhos }, modelo)
			nucleo.CFrame = tronco.CFrame * CFrame.new(0, 0.2, -tronco.Size.Z / 2 - 0.05)
			soldar(tronco, nucleo)
		end
	elseif cfg.estilo == "espectro" then
		for _, nome in { "LeftUpperLeg", "LeftLowerLeg", "LeftFoot", "RightUpperLeg", "RightLowerLeg", "RightFoot" } do
			local p = modelo:FindFirstChild(nome)
			if p and p:IsA("BasePart") then
				p.Transparency = 1
			end
		end
		local veu = Instance.new("ParticleEmitter")
		veu.Texture = "rbxasset://textures/particles/smoke_main.dds"
		veu.Color = ColorSequence.new(Color3.fromRGB(220, 240, 255))
		veu.Size = NumberSequence.new({ NumberSequenceKeypoint.new(0, 1.6), NumberSequenceKeypoint.new(1, 0.4) })
		veu.Transparency = NumberSequence.new({ NumberSequenceKeypoint.new(0, 0.5), NumberSequenceKeypoint.new(1, 1) })
		veu.Lifetime = NumberRange.new(0.6, 1)
		veu.Speed = NumberRange.new(1, 3)
		veu.Rate = 30
		veu.EmissionDirection = Enum.NormalId.Bottom
		veu.Parent = modelo:FindFirstChild("LowerTorso")
		for _, nome in { "RightHand", "LeftHand" } do
			local mao = modelo:FindFirstChild(nome) :: BasePart
			mao.Material = Enum.Material.Neon
			mao.Color = Color3.fromRGB(200, 240, 255)
		end
	elseif cfg.estilo == "tempestor" then
		for i = 0, 6 do
			local a = i / 7 * math.pi * 2
			local espinho = peca({ Size = Vector3.new(0.2, 0.7 + (i % 2) * 0.4, 0.2), Material = Enum.Material.Metal, Color = Color3.fromRGB(150, 130, 80) }, modelo)
			espinho.CFrame = cabeca.CFrame * CFrame.new(math.cos(a) * 0.5, 0.8, math.sin(a) * 0.5)
			soldar(cabeca, espinho)
		end
		local capa = peca({ Size = Vector3.new(2.3, 3.8, 0.12), Material = Enum.Material.Fabric, Color = Color3.fromRGB(70, 30, 40) }, modelo)
		capa.CFrame = tronco.CFrame * CFrame.new(0, -1.2, tronco.Size.Z / 2 + 0.1) * CFrame.Angles(math.rad(-6), 0, 0)
		soldar(tronco, capa)
		local faiscas = Instance.new("ParticleEmitter")
		faiscas.Name = "Faiscas"
		faiscas.Texture = "rbxasset://textures/particles/sparkles_main.dds"
		faiscas.Color = ColorSequence.new(Color3.fromRGB(150, 220, 255))
		faiscas.LightEmission = 1
		faiscas.Size = NumberSequence.new(0.3)
		faiscas.Lifetime = NumberRange.new(0.2, 0.5)
		faiscas.Speed = NumberRange.new(4, 8)
		faiscas.Rate = 10
		faiscas.SpreadAngle = Vector2.new(180, 180)
		faiscas.Parent = tronco
	end
	equiparArma(modelo, est.arma)
	if est.escudo then
		equiparEscudo(modelo, Color3.fromRGB(90, 92, 100))
	end
	-- barra de vida por cima da cabeça (só aparece depois de levar dano)
	local bb = Instance.new("BillboardGui")
	bb.Name = "BarraVida"
	bb.Size = UDim2.fromOffset(110, 8)
	bb.StudsOffsetWorldSpace = Vector3.new(0, 2.6, 0)
	bb.AlwaysOnTop = true
	bb.MaxDistance = 90
	bb.Enabled = false
	local fundo = Instance.new("Frame")
	fundo.Size = UDim2.fromScale(1, 1)
	fundo.BackgroundColor3 = Color3.fromRGB(20, 16, 16)
	fundo.BackgroundTransparency = 0.3
	fundo.BorderSizePixel = 0
	fundo.Parent = bb
	local valor = Instance.new("Frame")
	valor.Name = "Valor"
	valor.Size = UDim2.fromScale(1, 1)
	valor.BackgroundColor3 = Color3.fromRGB(170, 40, 30)
	valor.BorderSizePixel = 0
	valor.Parent = fundo
	bb.Parent = cabeca

	modelo:SetAttribute("Tipo", tipo)
	if cfg.escala ~= 1 then
		modelo:ScaleTo(cfg.escala)
	end
	-- altura das ancas calculada a partir dos pés (garante que os pés tocam no chão depois de escalar)
	local raiz = modelo:FindFirstChild("HumanoidRootPart") :: BasePart
	local pe = modelo:FindFirstChild("LeftFoot") :: BasePart?
	if raiz and pe then
		hum.HipHeight = (raiz.Position.Y - raiz.Size.Y / 2) - (pe.Position.Y - pe.Size.Y / 2)
	end
	if cfg.flutua then
		hum.HipHeight += 1.6
	end
	modelo:SetAttribute("Escala", cfg.escala)
	return modelo
end

return Personagens

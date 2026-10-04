--!nonstrict
-- Efeitos visuais no cliente: impactos, faíscas, ondas de choque, avisos de raio, relâmpagos,
-- cura, Éter, morte de inimigos e o ambiente da tempestade.

local Debris = game:GetService("Debris")
local Lighting = game:GetService("Lighting")
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local TweenService = game:GetService("TweenService")

local Config = require(ReplicatedStorage:WaitForChild("Compartilhado"):WaitForChild("Config"))

local Efeitos = {}
local Camara
local pasta

local TEX = {
	brilho = "rbxasset://textures/particles/sparkles_main.dds",
	fumo = "rbxasset://textures/particles/smoke_main.dds",
	fogo = "rbxasset://textures/particles/fire_main.dds",
}

local function ancora(pos)
	local p = Instance.new("Part")
	p.Anchored = true
	p.CanCollide = false
	p.CanQuery = false
	p.CanTouch = false
	p.Transparency = 1
	p.Size = Vector3.new(0.2, 0.2, 0.2)
	p.Position = pos
	p.Parent = pasta
	return p
end

local function rajada(pos, props, n, vida)
	local p = ancora(pos)
	local e = Instance.new("ParticleEmitter")
	e.Rate = 0
	e.Texture = props.textura or TEX.brilho
	e.Color = ColorSequence.new(props.cor or Color3.new(1, 1, 1), props.cor2 or props.cor or Color3.new(1, 1, 1))
	e.LightEmission = props.luz or 0.8
	e.Size = NumberSequence.new({ NumberSequenceKeypoint.new(0, props.tam or 0.5), NumberSequenceKeypoint.new(1, (props.tam or 0.5) * (props.tamFim or 0.3)) })
	e.Transparency = NumberSequence.new({ NumberSequenceKeypoint.new(0, props.transp or 0), NumberSequenceKeypoint.new(1, 1) })
	e.Lifetime = NumberRange.new((props.vida or 0.5) * 0.6, props.vida or 0.5)
	e.Speed = NumberRange.new((props.vel or 10) * 0.4, props.vel or 10)
	e.SpreadAngle = Vector2.new(props.espalhar or 180, props.espalhar or 180)
	e.Acceleration = props.gravidade or Vector3.new(0, -20, 0)
	e.Drag = props.atrito or 2
	e.EmissionDirection = props.direcao or Enum.NormalId.Top
	e.Parent = p
	e:Emit(n)
	Debris:AddItem(p, vida or 3)
	return p
end

local function anel(pos, raioMax, dur, cor, neon)
	local p = Instance.new("Part")
	p.Anchored = true
	p.CanCollide = false
	p.CanQuery = false
	p.CanTouch = false
	p.Shape = Enum.PartType.Cylinder
	p.Material = if neon then Enum.Material.Neon else Enum.Material.SmoothPlastic
	p.Color = cor
	p.Transparency = 0.25
	p.Size = Vector3.new(0.4, 1, 1)
	p.CFrame = CFrame.new(pos + Vector3.new(0, 0.3, 0)) * CFrame.Angles(0, 0, math.rad(90))
	p.Parent = pasta
	TweenService:Create(p, TweenInfo.new(dur, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), {
		Size = Vector3.new(0.4, raioMax * 2, raioMax * 2), Transparency = 1,
	}):Play()
	Debris:AddItem(p, dur + 0.1)
end

local function som(pos, id, volume, tom)
	local p = ancora(pos)
	local s = Instance.new("Sound")
	s.SoundId = id
	s.Volume = volume or 0.6
	s.PlaybackSpeed = tom or 1
	s.RollOffMaxDistance = 200
	s.Parent = p
	s:Play()
	Debris:AddItem(p, 4)
end

local function distanciaAoJogador(pos)
	local c = Players.LocalPlayer.Character
	local raiz = c and c:FindFirstChild("HumanoidRootPart")
	if not raiz then
		return math.huge
	end
	return (raiz.Position - pos).Magnitude
end

-- relâmpago: segmentos de néon do céu até ao chão
local function relampago(pos)
	local topo = pos + Vector3.new(math.random(-20, 20), 140, math.random(-20, 20))
	local anterior = topo
	local n = 9
	for i = 1, n do
		local k = i / n
		local p = topo:Lerp(pos, k)
		if i < n then
			p += Vector3.new(math.random(-60, 60) / 10, 0, math.random(-60, 60) / 10)
		end
		local seg = Instance.new("Part")
		seg.Anchored = true
		seg.CanCollide = false
		seg.CanQuery = false
		seg.Material = Enum.Material.Neon
		seg.Color = Color3.fromRGB(200, 235, 255)
		local comp = (p - anterior).Magnitude
		seg.Size = Vector3.new(0.6, 0.6, comp)
		seg.CFrame = CFrame.lookAt((p + anterior) / 2, p)
		seg.Parent = pasta
		TweenService:Create(seg, TweenInfo.new(0.35), { Transparency = 1 }):Play()
		Debris:AddItem(seg, 0.4)
		anterior = p
	end
	local luz = ancora(pos + Vector3.new(0, 6, 0))
	local l = Instance.new("PointLight")
	l.Color = Color3.fromRGB(190, 225, 255)
	l.Range = 60
	l.Brightness = 8
	l.Parent = luz
	TweenService:Create(l, TweenInfo.new(0.4), { Brightness = 0 }):Play()
	Debris:AddItem(luz, 0.5)
	rajada(pos, { cor = Color3.fromRGB(200, 235, 255), vel = 30, vida = 0.5, tam = 0.6 }, 30)
	som(pos, "rbxasset://sounds/electronicpingshort.wav", 0.8, 0.35)
	local d = distanciaAoJogador(pos)
	if d < 120 then
		Camara.tremer(0.5 * (1 - d / 120))
		local cc = Lighting:FindFirstChild("Cor")
		if cc and cc:IsA("ColorCorrectionEffect") then
			cc.Brightness = 0.35
			TweenService:Create(cc, TweenInfo.new(0.35), { Brightness = 0 }):Play()
		end
	end
end
Efeitos.relampago = relampago

function Efeitos.tratar(tipo, pos, a, b, c)
	if typeof(pos) ~= "Vector3" then
		return
	end
	if distanciaAoJogador(pos) > 500 then
		return
	end
	if tipo == "golpe" then
		local cores = {
			carne = Color3.fromRGB(120, 20, 20), eter = Color3.fromRGB(170, 120, 255), pedra = Color3.fromRGB(170, 160, 140), vento = Color3.fromRGB(220, 240, 255),
		}
		rajada(pos, { cor = cores[a] or cores.eter, vel = 18, vida = 0.45, tam = 0.45, luz = if a == "carne" then 0 else 0.6 }, 16)
		rajada(pos, { cor = Color3.fromRGB(255, 245, 220), vel = 0, vida = 0.12, tam = 3, tamFim = 1 }, 1)
		som(pos, "rbxasset://sounds/swordslash.wav", 0.35, 0.6)
	elseif tipo == "faisca" then
		rajada(pos, { cor = Color3.fromRGB(255, 200, 120), vel = 30, vida = 0.35, tam = 0.25, gravidade = Vector3.new(0, -60, 0) }, 22)
		rajada(pos, { cor = Color3.fromRGB(255, 240, 200), vel = 0, vida = 0.1, tam = 3.5, tamFim = 1 }, 1)
	elseif tipo == "onda" then
		anel(pos, a or 10, 0.45, if b == "pedra" then Color3.fromRGB(190, 175, 150) else Color3.fromRGB(220, 230, 255), false)
		rajada(pos + Vector3.new(0, 1, 0), { textura = TEX.fumo, cor = Color3.fromRGB(170, 158, 140), vel = 25, vida = 1.2, tam = 6, tamFim = 2.5, transp = 0.3, luz = 0, gravidade = Vector3.new(0, 4, 0), espalhar = 80 }, 18)
	elseif tipo == "anel" then
		anel(pos, a or 30, b or 1, if c == "raio" then Color3.fromRGB(150, 210, 255) else Color3.fromRGB(255, 130, 60), true)
	elseif tipo == "aviso" then
		local raio = a or 9
		local dur = b or 1
		local p = Instance.new("Part")
		p.Anchored = true
		p.CanCollide = false
		p.CanQuery = false
		p.Shape = Enum.PartType.Cylinder
		p.Material = Enum.Material.Neon
		p.Color = Color3.fromRGB(150, 200, 255)
		p.Transparency = 0.9
		p.Size = Vector3.new(0.25, raio * 2, raio * 2)
		p.CFrame = CFrame.new(pos + Vector3.new(0, 0.25, 0)) * CFrame.Angles(0, 0, math.rad(90))
		p.Parent = pasta
		TweenService:Create(p, TweenInfo.new(dur), { Transparency = 0.35 }):Play()
		Debris:AddItem(p, dur + 0.05)
	elseif tipo == "raio" then
		relampago(pos)
	elseif tipo == "tremor" then
		local d = distanciaAoJogador(pos)
		if d < 120 then
			Camara.tremer((a or 0.5) * (1 - d / 120))
		end
	elseif tipo == "cura" then
		rajada(pos, { cor = Color3.fromRGB(255, 200, 120), cor2 = Color3.fromRGB(160, 255, 200), vel = 6, vida = 1.2, tam = 0.4, gravidade = Vector3.new(0, 10, 0) }, 30)
	elseif tipo == "eter" then
		rajada(pos + Vector3.new(0, 2, 0), { cor = Color3.fromRGB(210, 230, 255), vel = 14, vida = 1.4, tam = 0.4, gravidade = Vector3.new(0, 6, 0) }, 30)
	elseif tipo == "morte" then
		rajada(pos, { textura = TEX.fumo, cor = Color3.fromRGB(80, 70, 100), vel = 8, vida = 1.6, tam = 3, tamFim = 2, transp = 0.4, luz = 0, gravidade = Vector3.new(0, 5, 0) }, 14)
	elseif tipo == "nevoeiro" then
		rajada(pos, { textura = TEX.fumo, cor = Color3.fromRGB(230, 245, 255), vel = 12, vida = 1, tam = 4, transp = 0.3, luz = 0.3, gravidade = Vector3.zero }, 20)
	elseif tipo == "grito" then
		rajada(pos + Vector3.new(0, 4, 0), { cor = Color3.fromRGB(255, 120, 80), vel = 4, vida = 0.6, tam = 0.3 }, 6)
	end
end

-- ambiente local da tempestade quando se está perto do Olho
local function ambienteTempestade()
	local olho
	for _, ilha in Config.ILHAS do
		if ilha.tempestade then
			olho = ilha
		end
	end
	if not olho then
		return
	end
	local proximoRaio = 0
	local cc
	RunService.Heartbeat:Connect(function()
		cc = cc or Lighting:FindFirstChild("Cor")
		local c = Players.LocalPlayer.Character
		local raiz = c and c:FindFirstChild("HumanoidRootPart")
		if not raiz or not cc then
			return
		end
		local d = Vector2.new(raiz.Position.X - olho.centro.X, raiz.Position.Z - olho.centro.Z).Magnitude
		local k = math.clamp(1 - (d - olho.raio) / 220, 0, 1)
		cc.TintColor = Color3.fromRGB(255, 249, 242):Lerp(Color3.fromRGB(170, 180, 210), k)
		cc.Saturation = 0.08 - 0.3 * k
		if k > 0.3 and os.clock() > proximoRaio then
			proximoRaio = os.clock() + math.random(4, 9)
			local a = math.random() * math.pi * 2
			local r = olho.raio * (0.9 + math.random() * 0.8)
			relampago(Vector3.new(olho.centro.X + math.cos(a) * r, olho.centro.Y - 20, olho.centro.Z + math.sin(a) * r))
		end
	end)
end

function Efeitos.iniciar(remotos, camara)
	Camara = camara
	pasta = Instance.new("Folder")
	pasta.Name = "EfeitosLocais"
	pasta.Parent = workspace
	remotos.Efeito.OnClientEvent:Connect(Efeitos.tratar)
	ambienteTempestade()
end

return Efeitos

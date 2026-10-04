--!nonstrict
-- Animação procedural de todas as personagens (jogadores e inimigos), feita no cliente.
-- Lê o estado de cada personagem (atributos Acao/AcaoT0/AcaoDur, velocidade, bloqueio, planar)
-- e escreve diretamente nas articulações Motor6D do esqueleto R15.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")

local Poses = require(ReplicatedStorage:WaitForChild("Compartilhado"):WaitForChild("Poses"))

local Animador = {}
local rigs = setmetatable({}, { __mode = "k" })
local estadoLocal -- tabela partilhada com o Main (previsão das ações do próprio jogador)

local function suave(t)
	t = math.clamp(t, 0, 1)
	return t * t * (3 - 2 * t)
end

local function obterRig(modelo)
	local r = rigs[modelo]
	if r then
		return r
	end
	local motores = {}
	for _, d in modelo:GetDescendants() do
		if d:IsA("Motor6D") then
			motores[d.Name] = d
		end
	end
	if not motores.Root then
		return nil
	end
	r = { motores = motores, atual = {}, y = 0, piv = 0, fase = math.random() * 6, bloqueio = 0, planar = 0, ar = 0 }
	for nome in motores do
		r.atual[nome] = Vector3.zero
	end
	modelo:GetAttributeChangedSignal("AcaoT0"):Connect(function()
		r.chegadaAtributo = os.clock()
	end)
	rigs[modelo] = r
	return r
end

-- devolve a ação a mostrar e o tempo normalizado (ou nil)
local function acaoAtual(modelo, r, local_)
	local nome = modelo:GetAttribute("Acao")
	local t0 = modelo:GetAttribute("AcaoT0")
	local dur = modelo:GetAttribute("AcaoDur")
	local manter = modelo:GetAttribute("AcaoManter")
	local tAttr = nil
	if nome and t0 and dur and dur > 0 then
		tAttr = (workspace:GetServerTimeNow() - t0) / dur
	end
	-- previsão local do próprio jogador (resposta imediata ao botão)
	if local_ and estadoLocal and estadoLocal.acao then
		local a = estadoLocal.acao
		local chegada = r.chegadaAtributo or 0
		local mesmaAcao = nome == a.nome and math.abs(chegada - a.inicio) < 0.6
		if a.inicio >= chegada - 0.05 or mesmaAcao then
			local t = (os.clock() - a.inicio) / a.dur
			if t < 1 then
				return a.nome, t
			end
			if not mesmaAcao and a.inicio > chegada then
				return nil, nil
			end
		end
	end
	if tAttr then
		if tAttr < 1 then
			return nome, tAttr
		elseif manter then
			return nome, 1
		end
	end
	return nil, nil
end

local function mostrarPlanador(modelo, visivel)
	local p = modelo:FindFirstChild("Planador")
	if not p then
		return
	end
	for _, d in p:GetDescendants() do
		if d:IsA("BasePart") and d.Name ~= "Barra" then
			d.Transparency = if visivel then 0.05 else 1
		elseif d:IsA("BasePart") then
			d.Transparency = if visivel then 0 else 1
		end
	end
end

local function animar(modelo, dt, local_)
	local r = obterRig(modelo)
	if not r then
		return
	end
	local raiz = modelo:FindFirstChild("HumanoidRootPart")
	if not raiz then
		return
	end
	local escala = modelo:GetAttribute("Escala") or 1
	local vel = raiz.AssemblyLinearVelocity
	local v = Vector3.new(vel.X, 0, vel.Z).Magnitude / escala
	local alvo = {}
	for n, val in Poses.POSTURA do
		alvo[n] = val
	end

	-- locomoção
	local k = math.min(1.4, v / 14)
	local corrida = if v > 19 then 1 else 0
	r.fase += dt * (if v > 0.8 then 4 + v * 0.38 else 0)
	local s, c = math.sin(r.fase), math.cos(r.fase)
	local amp = 0.55 * k + corrida * 0.25
	local joelho = 0.9 * k + corrida * 0.5
	alvo.LeftHip = Vector3.new(s * amp, 0, 0)
	alvo.RightHip = Vector3.new(-s * amp, 0, 0)
	alvo.LeftKnee = Vector3.new(-(0.08 + math.max(0, c) * joelho), 0, 0)
	alvo.RightKnee = Vector3.new(-(0.08 + math.max(0, -c) * joelho), 0, 0)
	alvo.LeftAnkle = Vector3.new(-s * amp * 0.25, 0, 0)
	alvo.RightAnkle = Vector3.new(s * amp * 0.25, 0, 0)
	alvo.Waist = alvo.Waist + Vector3.new(-(0.05 * k + corrida * 0.28), s * 0.08 * k, 0)
	alvo.LeftShoulder = alvo.LeftShoulder + Vector3.new(-s * (0.12 * k + corrida * 0.6), 0, 0)
	alvo.RightShoulder = alvo.RightShoulder + Vector3.new(s * (0.12 * k + corrida * 0.6), 0, 0)
	if corrida > 0 then
		alvo.RightElbow = Vector3.new(1.1, 0, 0)
	end
	local y = -math.abs(c) * 0.1 * k
	if v < 0.8 then
		y -= 0.03 + math.sin(os.clock() * 1.2) * 0.025
	end
	local piv = 0

	-- no ar e a planar
	local planando = modelo:GetAttribute("Planando") == true
	r.planar += ((if planando then 1 else 0) - r.planar) * math.min(1, dt * 10)
	if r.planarVisivel ~= planando then
		r.planarVisivel = planando
		mostrarPlanador(modelo, planando)
	end
	local noAr = math.abs(vel.Y) > 10 and not planando
	r.ar += ((if noAr then 1 else 0) - r.ar) * math.min(1, dt * 8)
	if r.ar > 0.01 then
		local w = r.ar
		alvo.LeftHip = alvo.LeftHip:Lerp(Vector3.new(0.5, 0, 0), w)
		alvo.RightHip = alvo.RightHip:Lerp(Vector3.new(0.2, 0, 0), w)
		alvo.LeftKnee = alvo.LeftKnee:Lerp(Vector3.new(-0.9, 0, 0), w)
		alvo.RightKnee = alvo.RightKnee:Lerp(Vector3.new(-0.5, 0, 0), w)
	end
	if r.planar > 0.01 then
		local w = r.planar
		alvo.RightShoulder = alvo.RightShoulder:Lerp(Vector3.new(2.9, 0, -0.35), w)
		alvo.LeftShoulder = alvo.LeftShoulder:Lerp(Vector3.new(2.9, 0, 0.35), w)
		alvo.RightElbow = alvo.RightElbow:Lerp(Vector3.new(0.2, 0, 0), w)
		alvo.LeftElbow = alvo.LeftElbow:Lerp(Vector3.new(0.2, 0, 0), w)
		alvo.Waist = alvo.Waist:Lerp(Vector3.new(-0.25, 0, 0), w)
		alvo.LeftHip = alvo.LeftHip:Lerp(Vector3.new(-0.25, 0, 0), w)
		alvo.RightHip = alvo.RightHip:Lerp(Vector3.new(-0.15, 0, 0), w)
		alvo.LeftKnee = alvo.LeftKnee:Lerp(Vector3.new(-0.4, 0, 0), w)
		alvo.RightKnee = alvo.RightKnee:Lerp(Vector3.new(-0.3, 0, 0), w)
	end

	-- bloqueio com escudo
	local bloq = modelo:GetAttribute("Bloqueando") == true or (local_ and estadoLocal and estadoLocal.bloqueando)
	r.bloqueio += ((if bloq then 1 else 0) - r.bloqueio) * math.min(1, dt * 14)
	if r.bloqueio > 0.01 then
		for n, val in Poses.BLOQUEIO do
			alvo[n] = (alvo[n] or Vector3.zero):Lerp(val, r.bloqueio)
		end
	end

	-- ação (ataques, rolar, beber, atordoado, morrer…)
	local rolo = 0
	local nome, t = acaoAtual(modelo, r, local_)
	if nome then
		local pose, ay, ap = Poses.avaliar(nome, t)
		for n, val in pose do
			alvo[n] = val
		end
		y += ay
		piv = ap
		if nome == "rolar" then
			rolo = -suave((t - 0.1) / 0.68) * math.pi * 2
		end
	end

	-- aplicar com suavização
	local alfa = 1 - math.exp(-dt * 18)
	for n, m in r.motores do
		local alvoN = alvo[n]
		if alvoN then
			local atual = r.atual[n] or Vector3.zero
			atual = atual:Lerp(alvoN, alfa)
			r.atual[n] = atual
			if n ~= "Root" then
				m.Transform = CFrame.Angles(atual.X, atual.Y, atual.Z)
			end
		end
	end
	r.y += (y - r.y) * alfa
	r.piv += (piv - r.piv) * alfa
	local raizM = r.motores.Root
	if raizM then
		raizM.Transform = CFrame.new(0, r.y * escala, 0) * CFrame.Angles(r.piv + rolo, 0, 0)
	end
end

function Animador.iniciar(estado)
	estadoLocal = estado
	local camara = workspace.CurrentCamera
	RunService.PreSimulation:Connect(function(dt)
		local foco = camara.CFrame.Position
		local eu = Players.LocalPlayer.Character
		for _, plr in Players:GetPlayers() do
			local ch = plr.Character
			if ch and ch.Parent then
				local raiz = ch:FindFirstChild("HumanoidRootPart")
				if raiz and (raiz.Position - foco).Magnitude < 400 then
					animar(ch, dt, ch == eu)
				end
			end
		end
		local pasta = workspace:FindFirstChild("Inimigos")
		if pasta then
			for _, m in pasta:GetChildren() do
				local raiz = m:FindFirstChild("HumanoidRootPart")
				if raiz and (raiz.Position - foco).Magnitude < 350 then
					animar(m, dt, false)
				end
			end
		end
	end)
end

return Animador

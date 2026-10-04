--!nonstrict
-- Inimigos e chefes: criação, inteligência (perseguir, rondar, atacar), golpes, áreas, projéteis,
-- raios, equilíbrio, morte, regresso ao descansar e arenas com barreira de vento.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local TweenService = game:GetService("TweenService")

local Config = require(ReplicatedStorage:WaitForChild("Compartilhado"):WaitForChild("Config"))
local Mundo = require(script.Parent:WaitForChild("Mundo"))
local Personagens = require(script.Parent:WaitForChild("Personagens"))

local Inimigos = {}
local ctx
local lista = {}
Inimigos.lista = lista
local pasta
local arenas = {}
local efeitosAtivos: { any } = {} -- ondas de choque e projéteis em curso

local GRAUS = math.pi / 180
local RAIO_JOGADOR = 1.5

local function agora()
	return os.clock()
end

local function plano(v)
	return Vector3.new(v.X, 0, v.Z)
end

local function angDif(a, b)
	local d = b - a
	while d > math.pi do
		d -= math.pi * 2
	end
	while d < -math.pi do
		d += math.pi * 2
	end
	return d
end

local function anguloDe(v)
	return math.atan2(-v.X, -v.Z) -- ângulo de rotação Y para olhar na direção v (Roblox olha para -Z)
end

local function efeito(...)
	ctx.remotos.Efeito:FireAllClients(...)
end

-- ---------------------------------------------------------------- criação

local function definirAcao(ini, nome, dur, manter)
	local m = ini.modelo
	if not m then
		return
	end
	m:SetAttribute("AcaoDur", dur)
	m:SetAttribute("AcaoManter", manter == true)
	m:SetAttribute("AcaoT0", workspace:GetServerTimeNow())
	m:SetAttribute("Acao", nome)
end

local function mudar(ini, estado, dur)
	ini.estado = estado
	ini.inicio = agora()
	ini.estadoAte = agora() + (dur or math.huge)
end

local function construir(ini)
	local d = ini.def
	local modelo = Personagens.criarInimigo(d.tipo)
	local raiz = modelo:FindFirstChild("HumanoidRootPart")
	local hum = modelo:FindFirstChildOfClass("Humanoid")
	modelo.PrimaryPart = raiz
	local chao = Mundo.chaoOuIlha(d.x, d.z)
	local altura = hum.HipHeight + raiz.Size.Y / 2
	modelo:PivotTo(CFrame.new(chao + Vector3.new(0, altura + 0.2, 0)) * CFrame.Angles(0, math.rad(d.rot or 0), 0))
	local anexo = Instance.new("Attachment")
	anexo.Name = "Alinhar"
	anexo.Parent = raiz
	local alinhar = Instance.new("AlignOrientation")
	alinhar.Mode = Enum.OrientationAlignmentMode.OneAttachment
	alinhar.Attachment0 = anexo
	alinhar.RigidityEnabled = false
	alinhar.MaxTorque = math.huge
	alinhar.Responsiveness = 25
	alinhar.CFrame = CFrame.Angles(0, math.rad(d.rot or 0), 0)
	alinhar.Parent = raiz
	modelo:SetAttribute("VidaMax", ini.vidaMax)
	modelo:SetAttribute("Vida", ini.vidaMax)
	modelo:SetAttribute("Chefe", ini.chefe ~= nil)
	modelo.Parent = pasta
	pcall(function()
		raiz:SetNetworkOwner(nil)
	end)
	ini.modelo = modelo
	ini.raiz = raiz
	ini.hum = hum
	ini.alinhar = alinhar
	ini.casa = chao
	ini.ilha = Mundo.ilhaEm(chao)
end

local function repor(ini)
	if ini.modelo then
		ini.modelo:Destroy()
	end
	ini.vidaMax = ini.cfg.vida
	ini.vida = ini.cfg.vida
	ini.equil = ini.cfg.equilMax
	ini.tSemDano = 0
	ini.vivo = true
	ini.fase = 1
	ini.alvo = nil
	ini.ataque = nil
	ini.espera = 0
	ini.golpeadores = {}
	ini.ultimoAtaque = nil
	ini.morteT = nil
	construir(ini)
	if ini.chefe then
		mudar(ini, "aguardar")
		definirAcao(ini, "sentado", 2, true)
	elseif ini.def.sentado then
		mudar(ini, "sentado")
		definirAcao(ini, "sentado", 2, true)
	else
		mudar(ini, "ocioso")
	end
end

-- ---------------------------------------------------------------- utilitários de alvo

local function jogadorVivo(plr)
	local c = plr.Character
	if not c then
		return nil
	end
	local hum = c:FindFirstChildOfClass("Humanoid")
	local raiz = c:FindFirstChild("HumanoidRootPart")
	if not hum or not raiz or hum.Health <= 0 then
		return nil
	end
	return raiz
end

local function candidatos(ini)
	-- os chefes só lutam com quem está na arena
	if ini.chefe then
		local r = {}
		for plr in arenas[ini.chefe].participantes do
			table.insert(r, plr)
		end
		return r
	end
	return game:GetService("Players"):GetPlayers()
end

local function escolherAlvo(ini)
	local melhor, md = nil, math.huge
	for _, plr in candidatos(ini) do
		local raiz = jogadorVivo(plr)
		local est = ctx.jogadores.estados[plr]
		if raiz and est and est.estado ~= "sentado" then
			local delta = raiz.Position - ini.raiz.Position
			local d = plano(delta).Magnitude
			if math.abs(delta.Y) < 40 + ini.cfg.escala * 5 and d < md then
				-- só vê o jogador à frente, ou muito perto, ou se já estiver alerta
				local ang = math.abs(angDif(anguloDe(ini.raiz.CFrame.LookVector), anguloDe(delta)))
				if ini.alvo == plr or ini.chefe or d < 18 or (d < ini.cfg.visao and ang < 80 * GRAUS) then
					melhor, md = plr, d
				end
			end
		end
	end
	return melhor, md
end

local function olharPara(ini, pos)
	local v = plano(pos - ini.raiz.Position)
	if v.Magnitude > 0.05 then
		ini.alinhar.CFrame = CFrame.lookAt(Vector3.zero, v.Unit)
	end
end

local function limitarIlha(ini, p)
	local ilha = ini.ilha
	if not ilha then
		return p
	end
	local c = Vector3.new(ilha.centro.X, p.Y, ilha.centro.Z)
	local v = p - c
	local max = ilha.raio * 0.82
	if ini.chefe then
		local a = Config.ARENAS[ini.chefe]
		c = Vector3.new(a.centro.X, p.Y, a.centro.Z)
		v = p - c
		max = a.raio - 6
	end
	if v.Magnitude > max then
		return c + v.Unit * max
	end
	return p
end

local function moverPara(ini, pos, vel)
	ini.hum.WalkSpeed = vel
	ini.hum:MoveTo(limitarIlha(ini, pos))
end

local function parar(ini)
	ini.hum.WalkSpeed = 0
	ini.hum:Move(Vector3.zero)
end

-- ---------------------------------------------------------------- ataques

local function escolherAtaque(ini, dist)
	local validos = {}
	local total = 0
	for _, a in ini.cfg.ataques do
		local maxD = math.max(a.distMax or 0, a.alcance + ini.cfg.raio * 0.5)
		if a.peso > 0 and dist >= (a.distMin or 0) and dist <= maxD then
			local p = a.peso * (if a == ini.ultimoAtaque then 0.4 else 1)
			table.insert(validos, { a, p })
			total += p
		end
	end
	if #validos == 0 then
		return nil
	end
	local r = math.random() * total
	for _, v in validos do
		r -= v[2]
		if r <= 0 then
			return v[1]
		end
	end
	return validos[1][1]
end

local function iniciarAtaque(ini, def)
	local vel = if ini.fase == 2 then 1.18 else 1
	ini.ultimoAtaque = def
	ini.ataque = { def = def, dur = def.dur / vel, ini = def.ini / vel, fim = def.fim / vel, golpeados = {}, areaFeita = false, salto = false, avisos = nil }
	mudar(ini, "atacar")
	definirAcao(ini, def.anim, ini.ataque.dur)
	-- raios: marca o chão por baixo de cada alvo antes de cair
	if def.raio then
		local posicoes = {}
		for _, plr in candidatos(ini) do
			local raiz = jogadorVivo(plr)
			if raiz then
				local p = Mundo.chaoOuIlha(raiz.Position.X, raiz.Position.Z)
				table.insert(posicoes, p)
				efeito("aviso", p, 9, ini.ataque.ini)
				if ini.fase == 2 then
					local extra = p + Vector3.new(math.random(-14, 14), 0, math.random(-14, 14))
					extra = Mundo.chaoOuIlha(extra.X, extra.Z)
					table.insert(posicoes, extra)
					efeito("aviso", extra, 9, ini.ataque.ini)
				end
			end
		end
		ini.ataque.avisos = posicoes
	end
end

local function danoA(ini, plr, mult, tipo, origem, elemento)
	local d = ini.ataque and ini.ataque.def
	local dano = ini.cfg.dano * mult * (if ini.fase == 2 then 1.15 else 1)
	return ctx.jogadores.receberDano(plr, dano, origem, { equil = d and d.equil or 30, tipo = tipo, elemento = elemento })
end

local function ondaDeChoque(ini, centro, raioMax, dur, mult, elemento)
	table.insert(efeitosAtivos, { tipo = "onda", ini = ini, centro = centro, raioMax = raioMax, dur = dur, t0 = agora(), atingidos = {}, mult = mult, elemento = elemento })
	efeito("anel", centro, raioMax, dur, elemento)
end

local function lancarProjetil(ini, alvoPos)
	local mao = ini.modelo:FindFirstChild("RightHand")
	local origem = if mao then mao.Position else ini.raiz.Position + Vector3.new(0, 8, 0)
	local pedra = Instance.new("Part")
	pedra.Shape = Enum.PartType.Ball
	pedra.Size = Vector3.new(5, 5, 5)
	pedra.Material = Enum.Material.Slate
	pedra.Color = Color3.fromRGB(110, 104, 96)
	pedra.Anchored = true
	pedra.CanCollide = false
	pedra.Position = origem
	pedra.Parent = workspace
	table.insert(efeitosAtivos, { tipo = "projetil", ini = ini, parte = pedra, de = origem, para = alvoPos, dur = 0.95, t0 = agora() })
end

local function verificarGolpe(ini)
	local at = ini.ataque
	local d = at.def
	local frente = plano(ini.raiz.CFrame.LookVector).Unit
	-- ataques de área (impacto no chão)
	if d.area and not at.areaFeita then
		at.areaFeita = true
		local centro = ini.raiz.Position + frente * d.area.dist
		centro = Mundo.chaoOuIlha(centro.X, centro.Z)
		efeito("onda", centro, d.area.raio, "pedra")
		efeito("tremor", centro, if ini.chefe then 0.8 else 0.4)
		for _, plr in candidatos(ini) do
			local raiz = jogadorVivo(plr)
			if raiz and plano(raiz.Position - centro).Magnitude < d.area.raio + RAIO_JOGADOR and math.abs(raiz.Position.Y - centro.Y) < 12 then
				danoA(ini, plr, d.mult, d.tipo or "normal", centro)
			end
		end
		if ini.fase == 2 and ini.cfg.estilo == "tempestor" then
			ondaDeChoque(ini, centro, 34, 1.0, 0.45, "raio")
		end
		return
	end
	if d.projetil and not at.areaFeita then
		at.areaFeita = true
		if ini.alvo then
			local raiz = jogadorVivo(ini.alvo)
			if raiz then
				lancarProjetil(ini, raiz.Position + plano(raiz.AssemblyLinearVelocity) * 0.5)
			end
		end
		return
	end
	if d.raio and not at.areaFeita then
		at.areaFeita = true
		for _, p in at.avisos or {} do
			efeito("raio", p)
			for _, plr in candidatos(ini) do
				local raiz = jogadorVivo(plr)
				if raiz and plano(raiz.Position - p).Magnitude < 9 + RAIO_JOGADOR then
					danoA(ini, plr, d.mult, "normal", p + Vector3.new(0, 30, 0), "raio")
				end
			end
		end
		return
	end
	for _, plr in candidatos(ini) do
		if not at.golpeados[plr] then
			local raiz = jogadorVivo(plr)
			if raiz then
				local delta = plano(raiz.Position - ini.raiz.Position)
				local dist = delta.Magnitude
				if dist - RAIO_JOGADOR <= d.alcance and math.abs(raiz.Position.Y - ini.raiz.Position.Y) < 8 + ini.cfg.escala * 3 then
					local ang = if dist > 0.01 then math.acos(math.clamp(delta.Unit:Dot(frente), -1, 1)) else 0
					if d.arco >= 360 or ang <= d.arco / 2 * GRAUS or dist < ini.cfg.raio + 1 then
						local r = danoA(ini, plr, d.mult, d.tipo or "normal", ini.raiz.Position, if ini.fase == 2 then "raio" else nil)
						if r ~= "esquivou" then
							at.golpeados[plr] = true
						end
					end
				end
			end
		end
	end
end

-- ---------------------------------------------------------------- ciclo de cada inimigo

local function despertar(ini)
	if ini.estado == "aguardar" or ini.estado == "sentado" then
		mudar(ini, "levantar", if ini.chefe then 2.2 else 1.1)
		definirAcao(ini, if ini.chefe then "rugido" else "levantar", if ini.chefe then 2.2 else 1.1)
	end
end
Inimigos.despertar = despertar

local function atualizarInimigo(ini, dt)
	local t = agora()
	local cfg = ini.cfg
	if not ini.vivo then
		return
	end
	ini.tSemDano += dt
	if ini.tSemDano > 3 then
		ini.equil = math.min(cfg.equilMax, ini.equil + dt * cfg.equilMax * 0.3)
	end
	-- caiu da ilha: volta a casa
	if ini.raiz.Position.Y < Config.ALTURA_QUEDA then
		repor(ini)
		return
	end
	local alvo, dist = escolherAlvo(ini)
	local raizAlvo = alvo and jogadorVivo(alvo)
	local longeCasa = plano(ini.raiz.Position - ini.casa).Magnitude
	local estado = ini.estado

	if estado == "aguardar" then
		parar(ini)
	elseif estado == "sentado" then
		parar(ini)
		if raizAlvo and dist < 18 then
			despertar(ini)
		end
	elseif estado == "levantar" then
		parar(ini)
		if t >= ini.estadoAte then
			ini.alvo = alvo
			mudar(ini, "perseguir")
		end
	elseif estado == "ocioso" then
		if raizAlvo then
			ini.alvo = alvo
			mudar(ini, "perseguir")
			ini.espera = 0.4 + math.random() * 0.6
			efeito("grito", ini.raiz.Position, cfg.estilo)
			-- os vizinhos também acordam
			for _, o in lista do
				if o ~= ini and o.vivo and not o.chefe and (o.estado == "ocioso" or o.estado == "sentado") and plano(o.raiz.Position - ini.raiz.Position).Magnitude < 40 then
					o.alvo = alvo
					if o.estado == "sentado" then
						despertar(o)
					else
						mudar(o, "perseguir")
					end
				end
			end
		else
			ini.espera -= dt
			if ini.espera <= 0 then
				ini.espera = 3 + math.random() * 4
				if math.random() < 0.5 then
					ini.ronda = ini.casa + Vector3.new(math.random(-20, 20), 0, math.random(-20, 20))
				else
					ini.ronda = nil
				end
			end
			if ini.ronda and plano(ini.ronda - ini.raiz.Position).Magnitude > 3 then
				moverPara(ini, ini.ronda, cfg.vel * 0.6)
				olharPara(ini, ini.ronda)
			else
				parar(ini)
			end
		end
	elseif estado == "perseguir" or estado == "rondar" then
		if not raizAlvo or (not ini.chefe and longeCasa > 160) then
			ini.alvo = nil
			mudar(ini, "regressar")
		else
			ini.alvo = alvo
			olharPara(ini, raizAlvo.Position)
			ini.espera -= dt
			if estado == "perseguir" then
				local at = escolherAtaque(ini, dist)
				local frente = plano(ini.raiz.CFrame.LookVector).Unit
				local paraAlvo = plano(raizAlvo.Position - ini.raiz.Position).Unit
				if at and ini.espera <= 0 and frente:Dot(paraAlvo) > 0.8 then
					iniciarAtaque(ini, at)
				else
					local ideal = cfg.raio + 6
					if dist > ideal then
						moverPara(ini, raizAlvo.Position, if dist > 30 then cfg.corrida else cfg.vel * 1.4)
					else
						parar(ini)
					end
				end
			else -- rondar: andar de lado à volta do alvo
				local ideal = cfg.raio + 12
				local radial = plano(ini.raiz.Position - raizAlvo.Position).Unit
				local lado = Vector3.new(-radial.Z, 0, radial.X) * ini.ladoRonda
				local desejo = raizAlvo.Position + radial * ideal + lado * 10
				moverPara(ini, desejo, cfg.vel * 0.8)
				if t >= ini.estadoAte then
					mudar(ini, "perseguir")
				end
			end
		end
	elseif estado == "atacar" then
		local at = ini.ataque
		local d = at.def
		local tt = t - ini.inicio
		local tn = tt / at.dur
		if raizAlvo and tt < at.ini * 0.8 then
			olharPara(ini, raizAlvo.Position)
		end
		-- avanço durante o golpe
		local av = d.avanco
		if av and tn >= av[1] and tn <= av[2] then
			local frente = plano(ini.raiz.CFrame.LookVector).Unit
			if d.avancoAlvo then
				if not at.salto then
					at.salto = true
					local janela = (av[2] - av[1]) * at.dur
					local destino = if raizAlvo then raizAlvo.Position else ini.raiz.Position + frente * 20
					local distH = math.max(0, plano(destino - ini.raiz.Position).Magnitude - cfg.raio - (if d.area then d.area.dist * 0.5 else 2))
					local vh = math.min(90, distH / janela)
					local vy = workspace.Gravity * janela / 2
					ini.hum.WalkSpeed = 0
					ini.raiz.AssemblyLinearVelocity = frente * vh + Vector3.new(0, vy, 0)
				end
			else
				local perto = raizAlvo and plano(raizAlvo.Position - ini.raiz.Position).Magnitude < cfg.raio + 2
				ini.hum.WalkSpeed = if perto then 0 else av[3]
				ini.hum:Move(frente)
			end
		else
			parar(ini)
		end
		if tt >= at.ini and tt <= at.fim then
			verificarGolpe(ini)
		end
		if tt >= at.dur then
			local proximo = nil
			if d.combo and math.random() < (d.probCombo or 0) * (if ini.fase == 2 then 1.4 else 1) and dist and dist < 30 then
				for _, a in cfg.ataques do
					if a.anim == d.combo then
						proximo = a
					end
				end
			end
			if proximo then
				iniciarAtaque(ini, proximo)
			else
				ini.ataque = nil
				ini.ladoRonda = if math.random() < 0.5 then -1 else 1
				ini.espera = (0.3 + math.random() * 0.9) * (if ini.fase == 2 then 0.6 else 1)
				if ini.chefe and math.random() < 0.5 then
					mudar(ini, "perseguir")
				else
					mudar(ini, "rondar", 0.6 + math.random() * 1.2)
				end
			end
		end
	elseif estado == "atordoado" or estado == "golpeado" then
		parar(ini)
		if t >= ini.estadoAte then
			mudar(ini, "perseguir")
		end
	elseif estado == "transformar" then
		parar(ini)
		if not ini.ondaFase and t - ini.inicio > 0.9 then
			ini.ondaFase = true
			efeito("tremor", ini.raiz.Position, 1)
			ondaDeChoque(ini, Mundo.chaoOuIlha(ini.raiz.Position.X, ini.raiz.Position.Z), 40, 0.9, 0.4, "raio")
			local gume = ini.modelo:FindFirstChild("Gume", true)
			if gume and gume:IsA("BasePart") then
				gume.Color = Color3.fromRGB(200, 240, 255)
				gume.Size = gume.Size * Vector3.new(2.2, 1.5, 1)
			end
			local f = ini.modelo:FindFirstChild("Faiscas", true)
			if f and f:IsA("ParticleEmitter") then
				f.Rate = 60
			end
		end
		if t >= ini.estadoAte then
			mudar(ini, "perseguir")
		end
	elseif estado == "regressar" then
		if raizAlvo and dist < 25 and longeCasa < 100 then
			ini.alvo = alvo
			mudar(ini, "perseguir")
		elseif longeCasa < 4 then
			ini.vida = ini.vidaMax
			ini.modelo:SetAttribute("Vida", ini.vida)
			mudar(ini, "ocioso")
		else
			moverPara(ini, ini.casa, cfg.vel * 1.3)
			olharPara(ini, ini.casa)
			ini.vida = math.min(ini.vidaMax, ini.vida + ini.vidaMax * 0.15 * dt)
			ini.modelo:SetAttribute("Vida", ini.vida)
		end
	end
end

-- ---------------------------------------------------------------- dano recebido e morte

local function morrer(ini)
	ini.vivo = false
	ini.morteT = agora()
	mudar(ini, "morto")
	definirAcao(ini, "morrer", 1.4, true)
	parar(ini)
	ini.modelo:SetAttribute("Vida", 0)
	local pos = ini.raiz.Position
	efeito("morte", pos, ini.cfg.estilo)
	-- todos os que ajudaram (e estão perto) recebem o Éter
	for plr in ini.golpeadores do
		local raiz = jogadorVivo(plr)
		if raiz and (raiz.Position - pos).Magnitude < 200 then
			ctx.jogadores.darEter(plr, ini.cfg.eter, pos)
		end
	end
	if ini.chefe then
		local arena = arenas[ini.chefe]
		arena.derrotado = true
		arena.ativa = false
		Mundo.abrirBarreira(ini.chefe, true)
		local final = ini.chefe == "tempestor"
		for plr in arena.participantes do
			ctx.jogadores.registarChefe(plr, ini.chefe)
			ctx.remotos.Chefe:FireClient(plr, nil)
			ctx.jogadores.aviso(plr, if final then "final" else "chefe", ini.cfg.nome)
		end
		arena.participantes = {}
	end
	-- desfaz-se em vento
	local modelo = ini.modelo
	task.delay(1.8, function()
		if not modelo.Parent then
			return
		end
		for _, p in modelo:GetDescendants() do
			if p:IsA("BasePart") and p.Transparency < 1 then
				TweenService:Create(p, TweenInfo.new(1.2), { Transparency = 1 }):Play()
			end
		end
	end)
	task.delay(3.2, function()
		if modelo.Parent then
			modelo:Destroy()
		end
		if ini.modelo == modelo then
			ini.modelo = nil
		end
	end)
end

function Inimigos.receberDano(ini, dano, equilDano, plr, forte)
	if not ini.vivo then
		return
	end
	local cfg = ini.cfg
	ini.golpeadores[plr] = true
	if not ini.alvo then
		ini.alvo = plr
	end
	if ini.estado == "sentado" or ini.estado == "ocioso" or ini.estado == "regressar" then
		mudar(ini, "perseguir")
	end
	local pos = ini.raiz.Position + Vector3.new(0, 2 * cfg.escala, 0)
	-- as sentinelas bloqueiam golpes de frente quando não estão a atacar
	local bloqueou = false
	if cfg.escudo and (ini.estado == "rondar" or ini.estado == "perseguir") and math.random() < 0.45 then
		local raizJ = jogadorVivo(plr)
		if raizJ then
			local v = plano(raizJ.Position - ini.raiz.Position).Unit
			if v:Dot(plano(ini.raiz.CFrame.LookVector).Unit) > 0.5 then
				bloqueou = true
				dano *= 0.18
				equilDano *= 0.4
				ctx.jogadores.gastarEnergia(plr, 10)
				efeito("faisca", pos)
			end
		end
	end
	if not bloqueou then
		efeito("golpe", pos, if cfg.estilo == "sentinela" or cfg.estilo == "guardiao" then "pedra" elseif cfg.estilo == "espectro" then "vento" else "eter")
	end
	ini.vida -= dano
	ini.tSemDano = 0
	ini.modelo:SetAttribute("Vida", math.max(0, ini.vida))
	ini.modelo:SetAttribute("UltimoDano", workspace:GetServerTimeNow())
	ini.modelo:SetAttribute("DanoRecente", math.floor(dano + 0.5))
	if ini.vida <= 0 then
		morrer(ini)
		return
	end
	-- segunda fase do Tempestor
	if cfg.estilo == "tempestor" and ini.fase == 1 and ini.vida < ini.vidaMax * 0.5 then
		ini.fase = 2
		ini.ondaFase = false
		ini.ataque = nil
		mudar(ini, "transformar", 2.4)
		definirAcao(ini, "rugido", 2.4)
		for p in arenas[ini.chefe].participantes do
			ctx.jogadores.aviso(p, "texto", "O Coração Partido desperta a tempestade")
		end
		return
	end
	if bloqueou then
		return
	end
	ini.equil -= equilDano
	local emGolpe = ini.estado == "atacar" and ini.ataque and agora() - ini.inicio >= ini.ataque.ini * 0.7
	if ini.equil <= 0 then
		ini.equil = cfg.equilMax
		ini.ataque = nil
		local dur = if ini.chefe then 2.2 else 1.3
		mudar(ini, "atordoado", dur)
		definirAcao(ini, "atordoado", dur)
	elseif not cfg.hiperArmadura and not emGolpe then
		ini.ataque = nil
		mudar(ini, "golpeado", 0.4)
		definirAcao(ini, "golpeado", 0.4)
	end
end

-- algum inimigo vivo está a perseguir alguém perto deste ponto?
function Inimigos.ameacaPerto(pos, raio)
	for _, ini in lista do
		if ini.vivo and ini.raiz and ini.alvo and (ini.estado == "perseguir" or ini.estado == "rondar" or ini.estado == "atacar")
			and (ini.raiz.Position - pos).Magnitude < raio then
			return true
		end
	end
	return false
end

-- ao descansar: os mortos regressam e os que não estão a combater voltam ao seu posto
function Inimigos.reporMortos()
	for _, ini in lista do
		if not ini.chefe then
			local emCombate = ini.vivo and ini.alvo ~= nil and (ini.estado == "perseguir" or ini.estado == "rondar" or ini.estado == "atacar")
			if not emCombate then
				repor(ini)
			end
		end
	end
end

-- ---------------------------------------------------------------- arenas

local function escalarChefe(arena)
	local ini = arena.chefe
	if not ini or not ini.vivo then
		return
	end
	local n = 0
	for _ in arena.participantes do
		n += 1
	end
	local novoMax = ini.cfg.vida * (1 + 0.6 * math.max(0, n - 1))
	if novoMax > ini.vidaMax then
		local prop = ini.vida / ini.vidaMax
		ini.vidaMax = novoMax
		ini.vida = novoMax * prop
		ini.modelo:SetAttribute("VidaMax", novoMax)
		ini.modelo:SetAttribute("Vida", ini.vida)
	end
end

function Inimigos.entrarArena(plr, id)
	local arena = arenas[id]
	local b = Mundo.barreiras[id]
	if not arena or not b or arena.derrotado then
		return
	end
	local c = plr.Character
	if not c then
		return
	end
	local n = 0
	for _ in arena.participantes do
		n += 1
	end
	if n >= Config.MAX_JOGADORES_CHEFE then
		ctx.jogadores.aviso(plr, "texto", "A arena já está cheia")
		return
	end
	c:PivotTo(CFrame.lookAt(b.dentro, b.dentro - Config.ARENAS[id].normal))
	ctx.remotos.Efeito:FireAllClients("nevoeiro", b.dentro)
	arena.participantes[plr] = true
	local chefe = arena.chefe
	if chefe and chefe.vivo then
		if not arena.ativa then
			arena.ativa = true
			despertar(chefe)
		end
		escalarChefe(arena)
		ctx.remotos.Chefe:FireClient(plr, chefe.modelo)
	end
end

function Inimigos.sairArena(plr)
	for _, arena in arenas do
		if arena.participantes[plr] then
			arena.participantes[plr] = nil
			ctx.remotos.Chefe:FireClient(plr, nil)
		end
	end
end

local function atualizarArenas()
	for id, arena in arenas do
		local a = Config.ARENAS[id]
		for plr in arena.participantes do
			local raiz = jogadorVivo(plr)
			if not raiz or plano(raiz.Position - a.centro).Magnitude > a.raio + 20 then
				arena.participantes[plr] = nil
				if plr.Parent then
					ctx.remotos.Chefe:FireClient(plr, nil)
				end
			end
		end
		if arena.ativa and next(arena.participantes) == nil then
			-- toda a gente morreu ou saiu: o chefe recompõe-se
			arena.ativa = false
			if arena.chefe then
				repor(arena.chefe)
			end
		end
	end
end

-- ---------------------------------------------------------------- efeitos em curso (ondas e projéteis)

local function atualizarEfeitos()
	local t = agora()
	for i = #efeitosAtivos, 1, -1 do
		local e = efeitosAtivos[i]
		local k = math.min(1, (t - e.t0) / e.dur)
		if e.tipo == "onda" then
			local r = e.raioMax * (1 - (1 - k) ^ 2)
			for _, plr in candidatos(e.ini) do
				if not e.atingidos[plr] then
					local raiz = jogadorVivo(plr)
					if raiz then
						local d = plano(raiz.Position - e.centro).Magnitude
						if math.abs(d - r) < 2.5 and r > 3 and math.abs(raiz.Position.Y - e.centro.Y) < 6 then
							e.atingidos[plr] = true
							local dano = e.ini.cfg.dano * e.mult
							ctx.jogadores.receberDano(plr, dano, e.centro, { equil = 40, tipo = "normal", elemento = e.elemento })
						end
					end
				end
			end
		elseif e.tipo == "projetil" then
			local p = e.de:Lerp(e.para, k) + Vector3.new(0, math.sin(k * math.pi) * 25, 0)
			e.parte.Position = p
			if k >= 1 then
				e.parte:Destroy()
				efeito("onda", e.para, 8, "pedra")
				efeito("tremor", e.para, 0.5)
				for _, plr in candidatos(e.ini) do
					local raiz = jogadorVivo(plr)
					if raiz and (raiz.Position - e.para).Magnitude < 8 + RAIO_JOGADOR then
						ctx.jogadores.receberDano(plr, e.ini.cfg.dano * 1.1, e.para, { equil = 50, tipo = "derrubar" })
					end
				end
			end
		end
		if k >= 1 then
			table.remove(efeitosAtivos, i)
		end
	end
end

-- ---------------------------------------------------------------- ciclo geral

local tReaparecer = 0

function Inimigos.atualizar(dt)
	for _, ini in lista do
		if ini.vivo and ini.raiz and ini.raiz.Parent then
			-- só pensa quem tem jogadores por perto
			local perto = ini.chefe ~= nil and arenas[ini.chefe].ativa
			if not perto then
				for _, plr in game:GetService("Players"):GetPlayers() do
					local raiz = jogadorVivo(plr)
					if raiz and (raiz.Position - ini.raiz.Position).Magnitude < 260 then
						perto = true
						break
					end
				end
			end
			if perto or ini.estado ~= "ocioso" then
				atualizarInimigo(ini, dt)
			end
		end
	end
	atualizarEfeitos()
	atualizarArenas()
	-- os mortos regressam ao fim de algum tempo, se ninguém estiver a olhar
	tReaparecer -= dt
	if tReaparecer <= 0 then
		tReaparecer = 10
		for _, ini in lista do
			if not ini.vivo and not ini.chefe and ini.morteT and agora() - ini.morteT > 240 then
				local alguem = false
				for _, plr in game:GetService("Players"):GetPlayers() do
					local raiz = jogadorVivo(plr)
					if raiz and plano(raiz.Position - ini.casa).Magnitude < 90 then
						alguem = true
					end
				end
				if not alguem then
					repor(ini)
				end
			end
		end
	end
end

function Inimigos.iniciar(contexto)
	ctx = contexto
	pasta = Instance.new("Folder")
	pasta.Name = "Inimigos"
	pasta.Parent = workspace
	for id in Config.ARENAS do
		arenas[id] = { participantes = {}, ativa = false, derrotado = false, chefe = nil }
	end
	for _, def in Config.ESPAWNS do
		local ini = { def = def, cfg = Config.INIMIGOS[def.tipo], chefe = def.chefe, ladoRonda = 1 }
		local ok, erro = pcall(repor, ini)
		if ok then
			table.insert(lista, ini)
			if ini.chefe then
				arenas[ini.chefe].chefe = ini
			end
		else
			warn("[Céu Partido] não foi possível criar", def.tipo, erro)
		end
	end
end

return Inimigos

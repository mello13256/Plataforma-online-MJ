--!nonstrict
-- Estado dos jogadores no servidor: energia, ações de combate, dano recebido, morte e Eco de Éter,
-- faróis (acender, descansar, subir de nível, viajar), relicários e gravação.

local Players = game:GetService("Players")
local ProximityPromptService = game:GetService("ProximityPromptService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Config = require(ReplicatedStorage:WaitForChild("Compartilhado"):WaitForChild("Config"))
local Dados = require(script.Parent:WaitForChild("Dados"))
local Mundo = require(script.Parent:WaitForChild("Mundo"))
local Personagens = require(script.Parent:WaitForChild("Personagens"))

local Jogadores = {}

local ctx -- contexto partilhado (remotos, inimigos), definido em iniciar()
local estados = {}
Jogadores.estados = estados

local J = Config.JOGADOR
local GRAUS = math.pi / 180

local function agora()
	return os.clock()
end

local function tempoServidor()
	return workspace:GetServerTimeNow()
end

local function contem(lista, v)
	return table.find(lista, v) ~= nil
end

-- ---------------------------------------------------------------- atributos

function Jogadores.vidaMax(d)
	return J.vidaBase + (d.vigor - 10) * J.vidaPorNivel
end

function Jogadores.energiaMax(d)
	return J.energiaBase + (d.folego - 10) * J.energiaPorNivel
end

local function sincronizar(est)
	local p = est.jogador
	local d = est.dados
	p:SetAttribute("Nivel", d.nivel)
	p:SetAttribute("Vigor", d.vigor)
	p:SetAttribute("Folego", d.folego)
	p:SetAttribute("Forca", d.forca)
	p:SetAttribute("Eter", d.eter)
	p:SetAttribute("OrvalhoMax", d.orvalhoMax)
	p:SetAttribute("Orvalho", est.orvalho)
	p:SetAttribute("Arma", d.arma)
	p:SetAttribute("Armas", table.concat(d.armas, ","))
	p:SetAttribute("Farois", table.concat(d.farois, ","))
	p:SetAttribute("Relicarios", table.concat(d.relicarios, ","))
	p:SetAttribute("Chefes", table.concat(d.chefes, ","))
	p:SetAttribute("EnergiaMax", Jogadores.energiaMax(d))
	p:SetAttribute("Energia", math.floor(est.energia + 0.5))
	p:SetAttribute("CustoNivel", Config.custoNivel(d.nivel))
end

local function personagemValida(est)
	local c = est.jogador.Character
	if not c then
		return nil
	end
	local hum = c:FindFirstChildOfClass("Humanoid")
	local raiz = c:FindFirstChild("HumanoidRootPart")
	if not hum or not raiz or hum.Health <= 0 then
		return nil
	end
	return c, hum, raiz
end

local function definirAcao(est, nome, dur, manter)
	local c = est.jogador.Character
	if not c then
		return
	end
	c:SetAttribute("AcaoDur", dur)
	c:SetAttribute("AcaoManter", manter == true)
	c:SetAttribute("AcaoT0", tempoServidor())
	c:SetAttribute("Acao", nome)
end

local function som(raiz, id, volume, tom)
	local s = Instance.new("Sound")
	s.SoundId = id
	s.Volume = volume or 0.6
	s.PlaybackSpeed = tom or 1
	s.RollOffMaxDistance = 120
	s.Parent = raiz
	s:Play()
	game:GetService("Debris"):AddItem(s, 3)
end
Jogadores.som = som

local function aviso(plr, tipo, texto)
	ctx.remotos.Aviso:FireClient(plr, tipo, texto)
end
Jogadores.aviso = aviso

local function gastar(est, quanto, atraso)
	est.energia -= quanto
	est.atrasoAte = agora() + (atraso or J.atrasoEnergia)
end

function Jogadores.gastarEnergia(plr, quanto)
	local est = estados[plr]
	if est then
		gastar(est, quanto)
	end
end

local function mudar(est, estado, dur)
	est.estado = estado
	est.inicio = agora()
	est.estadoAte = agora() + (dur or math.huge)
end

-- ---------------------------------------------------------------- ações

local function emRecuperacao(est)
	-- pode encadear outra ação no fim de um ataque ou de um rolamento
	local t = agora()
	if est.estado == "ataque" and est.ataque then
		return t >= est.inicio + est.ataque.def.fim
	end
	if est.estado == "rolar" then
		return t >= est.estadoAte - 0.15
	end
	return false
end

local function tentarAtacar(est, forte)
	local c = personagemValida(est)
	if not c then
		return
	end
	if est.energia <= 0 then
		return
	end
	if not (est.estado == "livre" or emRecuperacao(est)) then
		return
	end
	local arma = Config.ARMAS[est.dados.arma] or Config.ARMAS[Config.ARMA_INICIAL]
	if est.estado ~= "ataque" and agora() - (est.fimUltimoAtaque or 0) > 0.6 then
		est.combo = 0
	end
	local def
	if forte then
		def = arma.forte
	else
		def = arma.leve[(est.combo % #arma.leve) + 1]
	end
	est.combo += 1
	gastar(est, def.energia)
	mudar(est, "ataque", def.dur)
	est.ataque = { def = def, arma = arma, forte = forte, golpeados = {} }
	est.fimUltimoAtaque = agora() + def.dur
	definirAcao(est, def.anim, def.dur)
	local raiz = c:FindFirstChild("HumanoidRootPart")
	task.delay(math.max(0, def.ini - 0.12), function()
		if raiz and raiz.Parent then
			som(raiz, if forte then "rbxasset://sounds/swordlunge.wav" else "rbxasset://sounds/swordslash.wav", 0.5, if arma.modelo == "martelo" then 0.75 else 1)
		end
	end)
end

local function tentarRolar(est, tras)
	if not personagemValida(est) then
		return
	end
	if est.energia <= 0 then
		return
	end
	if not (est.estado == "livre" or emRecuperacao(est)) then
		return
	end
	gastar(est, J.custoRolar)
	mudar(est, "rolar", J.durRolar)
	est.invulDe = agora() + J.invulIni
	est.invulAte = agora() + J.invulFim
	definirAcao(est, if tras then "recuar" else "rolar", J.durRolar)
end

local function tentarBeber(est)
	if not personagemValida(est) or est.estado ~= "livre" then
		return
	end
	if est.orvalho <= 0 then
		aviso(est.jogador, "texto", "O Orvalho Celeste acabou")
		return
	end
	mudar(est, "beber", 1.35)
	est.curou = false
	definirAcao(est, "beber", 1.35)
end

local function trocarArma(est)
	if est.estado ~= "livre" or #est.dados.armas < 2 then
		return
	end
	local i = table.find(est.dados.armas, est.dados.arma) or 0
	est.dados.arma = est.dados.armas[(i % #est.dados.armas) + 1]
	local c = est.jogador.Character
	if c then
		Personagens.equiparJogador(c, est.dados.arma)
		local raiz = c:FindFirstChild("HumanoidRootPart")
		if raiz then
			som(raiz, "rbxasset://sounds/unsheath.wav", 0.5)
		end
	end
	sincronizar(est)
	aviso(est.jogador, "texto", Config.ARMAS[est.dados.arma].nome)
end

-- ---------------------------------------------------------------- golpes dos jogadores

local function verificarGolpe(est)
	local c, _, raiz = personagemValida(est)
	if not c then
		return
	end
	local at = est.ataque
	local arma = at.arma
	local frente = raiz.CFrame.LookVector * Vector3.new(1, 0, 1)
	if frente.Magnitude < 0.01 then
		return
	end
	frente = frente.Unit
	local mult = 1 + (est.dados.forca - 10) * arma.escala
	for _, ini in ctx.inimigos.lista do
		if ini.vivo and ini.raiz and not at.golpeados[ini] then
			local delta = (ini.raiz.Position - raiz.Position) * Vector3.new(1, 0, 1)
			local d = delta.Magnitude
			local dy = math.abs(ini.raiz.Position.Y - raiz.Position.Y)
			if d - ini.cfg.raio <= arma.alcance and dy < 10 + ini.cfg.escala * 3 then
				local ang = if d > 0.01 then math.acos(math.clamp(delta.Unit:Dot(frente), -1, 1)) else 0
				if ang <= arma.arco / 2 * GRAUS or d < ini.cfg.raio + 2 then
					at.golpeados[ini] = true
					local dano = arma.dano * at.def.mult * mult * (0.95 + math.random() * 0.1)
					ctx.inimigos.receberDano(ini, dano, at.def.equil, est.jogador, at.forte)
				end
			end
		end
	end
end

-- ---------------------------------------------------------------- dano recebido

local function atordoar(est, dur, anim)
	mudar(est, "atordoado", dur)
	definirAcao(est, anim or (if dur > 0.8 then "atordoado" else "golpeado"), dur)
	local c = est.jogador.Character
	if c then
		c:SetAttribute("AtordoadoAte", tempoServidor() + dur)
	end
end

-- opcoes: { equil, tipo = "normal" | "derrubar", elemento = "raio" | nil }
function Jogadores.receberDano(plr, dano, origem, opcoes)
	opcoes = opcoes or {}
	local est = estados[plr]
	if not est or not est.vivo then
		return "nada"
	end
	local c, hum, raiz = personagemValida(est)
	if not c then
		return "nada"
	end
	local t = agora()
	if (est.invulDe and t >= est.invulDe and t <= (est.invulAte or 0)) or est.estado == "sentado" or est.estado == "acender" then
		return "esquivou"
	end
	if est.estado == "derrubado" and t > est.inicio + 0.35 then
		return "esquivou"
	end
	local equil = opcoes.equil or 20
	local delta = (origem - raiz.Position) * Vector3.new(1, 0, 1)
	local dir = if delta.Magnitude > 0.01 then delta.Unit else -raiz.CFrame.LookVector
	local frente = (raiz.CFrame.LookVector * Vector3.new(1, 0, 1)).Unit
	local ang = math.acos(math.clamp(frente:Dot(dir), -1, 1))
	-- bloqueio
	if est.bloqueando and est.estado == "livre" and ang < J.bloqueioAngulo * GRAUS then
		gastar(est, equil * 1.1 + dano * 0.12, 0.9)
		local chip = if opcoes.elemento == "raio" then 0.35 elseif opcoes.tipo == "derrubar" then 0.15 else 0
		ctx.remotos.Efeito:FireAllClients("faisca", raiz.Position + frente * 2 + Vector3.new(0, 1, 0))
		som(raiz, "rbxasset://sounds/unsheath.wav", 0.7, 0.6)
		if est.energia < 0 then
			est.energia = 0
			hum.Health -= dano * 0.4
			atordoar(est, 1.1, "atordoado")
			aviso(plr, "texto", "Guarda quebrada!")
			ctx.remotos.Impacto:FireClient(plr, -dir, 30, 0.4)
		else
			hum.Health -= dano * chip
			ctx.remotos.Impacto:FireClient(plr, -dir, 14, 0.2)
		end
		return "bloqueou"
	end
	hum.Health -= dano
	ctx.remotos.Efeito:FireAllClients("golpe", raiz.Position + Vector3.new(0, 1, 0), "carne")
	if hum.Health <= 0 then
		ctx.remotos.Impacto:FireClient(plr, -dir, 20, 0.6)
		return "acertou"
	end
	local superArmadura = est.estado == "ataque" and est.ataque and est.ataque.forte
		and t > est.inicio + est.ataque.def.ini * 0.5 and t < est.inicio + est.ataque.def.fim and equil < 45
	if opcoes.tipo == "derrubar" then
		mudar(est, "derrubado", 1.7)
		definirAcao(est, "derrubado", 1.7)
		c:SetAttribute("AtordoadoAte", tempoServidor() + 1.5)
		ctx.remotos.Impacto:FireClient(plr, -dir, 55, 0.7)
	elseif not superArmadura then
		atordoar(est, 0.42, "golpeado")
		ctx.remotos.Impacto:FireClient(plr, -dir, 22, math.min(0.6, 0.15 + dano / 300))
	else
		ctx.remotos.Impacto:FireClient(plr, -dir, 0, 0.2)
	end
	return "acertou"
end

function Jogadores.invulneravel(plr)
	local est = estados[plr]
	if not est then
		return true
	end
	local t = agora()
	return (est.invulDe and t >= est.invulDe and t <= (est.invulAte or 0)) or est.estado == "sentado"
end

function Jogadores.darEter(plr, qtd, origem)
	local est = estados[plr]
	if not est or not est.vivo then
		return
	end
	est.dados.eter += qtd
	sincronizar(est)
	ctx.remotos.Efeito:FireAllClients("eter", origem, plr.UserId)
	aviso(plr, "eter", tostring(qtd))
end

function Jogadores.registarChefe(plr, id)
	local est = estados[plr]
	if est and not contem(est.dados.chefes, id) then
		table.insert(est.dados.chefes, id)
		sincronizar(est)
		task.spawn(Dados.guardar, plr.UserId, est.dados)
	end
end

-- ---------------------------------------------------------------- Eco de Éter (o que fica ao morrer)

local pastaEcos

local function criarEco(plr, eco)
	local antigo = pastaEcos:FindFirstChild("Eco_" .. plr.UserId)
	if antigo then
		antigo:Destroy()
	end
	if not eco then
		return
	end
	local p = Instance.new("Part")
	p.Name = "Eco_" .. plr.UserId
	p.Shape = Enum.PartType.Ball
	p.Size = Vector3.new(1.6, 1.6, 1.6)
	p.Material = Enum.Material.Neon
	p.Color = Color3.fromRGB(150, 255, 210)
	p.Transparency = 0.2
	p.Anchored = true
	p.CanCollide = false
	p.Position = Vector3.new(eco.x, eco.y, eco.z)
	local luz = Instance.new("PointLight")
	luz.Color = p.Color
	luz.Range = 14
	luz.Brightness = 1.5
	luz.Parent = p
	local e = Instance.new("ParticleEmitter")
	e.Texture = "rbxasset://textures/particles/sparkles_main.dds"
	e.Color = ColorSequence.new(p.Color)
	e.LightEmission = 1
	e.Size = NumberSequence.new(0.5)
	e.Lifetime = NumberRange.new(1, 2)
	e.Speed = NumberRange.new(1, 3)
	e.Rate = 14
	e.SpreadAngle = Vector2.new(180, 180)
	e.Parent = p
	local prompt = Instance.new("ProximityPrompt")
	prompt.Name = "Eco"
	prompt.ActionText = "Recuperar Éter"
	prompt.ObjectText = "Eco de " .. plr.DisplayName .. " (" .. eco.qtd .. ")"
	prompt.MaxActivationDistance = 9
	prompt.RequiresLineOfSight = false
	prompt.GamepadKeyCode = Enum.KeyCode.ButtonY
	prompt:SetAttribute("Dono", plr.UserId)
	prompt.Parent = p
	p:SetAttribute("Dono", plr.UserId)
	p.Parent = pastaEcos
end

local function recuperarEco(plr, prompt)
	local est = estados[plr]
	if not est or prompt:GetAttribute("Dono") ~= plr.UserId then
		if est then
			aviso(plr, "texto", "Este Eco pertence a outro andarilho")
		end
		return
	end
	local eco = est.dados.eco
	if not eco then
		return
	end
	est.dados.eter += eco.qtd
	est.dados.eco = nil
	criarEco(plr, nil)
	sincronizar(est)
	ctx.remotos.Efeito:FireAllClients("eter", Vector3.new(eco.x, eco.y, eco.z), plr.UserId)
	aviso(plr, "banner", "ÉTER RECUPERADO")
	task.spawn(Dados.guardar, plr.UserId, est.dados)
end

-- ---------------------------------------------------------------- faróis

local function posFarol(id)
	local f = Mundo.farois[id]
	if not f then
		return nil
	end
	return f.pos
end

local function colocarJuntoAoFarol(personagem, id)
	local p = posFarol(id)
	if not p then
		return
	end
	local alvo = p + Vector3.new(5, 4, 5)
	personagem:PivotTo(CFrame.lookAt(alvo, Vector3.new(p.X, alvo.Y, p.Z)))
end

local function descansar(est, id)
	local c, hum = personagemValida(est)
	if not c then
		return
	end
	est.sentado = id
	mudar(est, "sentado")
	definirAcao(est, "sentado", 2, true)
	hum.Health = hum.MaxHealth
	est.orvalho = est.dados.orvalhoMax
	est.energia = Jogadores.energiaMax(est.dados)
	est.dados.ultimoFarol = id
	ctx.inimigos.reporMortos()
	sincronizar(est)
	task.spawn(Dados.guardar, est.jogador.UserId, est.dados)
	ctx.remotos.Farol:FireClient(est.jogador, id)
end

local function usarFarol(plr, id)
	local est = estados[plr]
	if not est or est.estado ~= "livre" then
		return
	end
	local c, _, raiz = personagemValida(est)
	if not c then
		return
	end
	if ctx.inimigos.ameacaPerto(raiz.Position, 45) then
		aviso(plr, "texto", "Não podes descansar com inimigos por perto")
		return
	end
	local def
	for _, f in Config.FAROIS do
		if f.id == id then
			def = f
		end
	end
	if not def then
		return
	end
	if not contem(est.dados.farois, id) then
		table.insert(est.dados.farois, id)
		Mundo.acenderFarolVisual(id)
		mudar(est, "acender", 1.7)
		definirAcao(est, "acender", 1.6)
		som(raiz, "rbxasset://sounds/electronicpingshort.wav", 0.6, 0.5)
		aviso(plr, "farol", def.nome)
		task.delay(1.6, function()
			if est.vivo and (est.estado :: string) == "acender" then
				descansar(est, id)
			end
		end)
	else
		descansar(est, id)
	end
end

local function partir(est)
	if est.estado ~= "sentado" then
		return
	end
	est.sentado = nil
	mudar(est, "levantar", 1.1)
	definirAcao(est, "levantar", 1.1)
end

local function subirNivel(est, atributo)
	if est.estado ~= "sentado" then
		return
	end
	local valido = false
	for _, a in Config.ATRIBUTOS do
		if a.id == atributo then
			valido = true
		end
	end
	if not valido then
		return
	end
	local d = est.dados
	local custo = Config.custoNivel(d.nivel)
	if d.eter < custo or d[atributo] >= 60 then
		return
	end
	d.eter -= custo
	d.nivel += 1
	d[atributo] += 1
	local c, hum = personagemValida(est)
	if c then
		hum.MaxHealth = Jogadores.vidaMax(d)
		hum.Health = hum.MaxHealth
	end
	est.energia = Jogadores.energiaMax(d)
	sincronizar(est)
	task.spawn(Dados.guardar, est.jogador.UserId, d)
end

local function viajar(est, id)
	if est.estado ~= "sentado" or est.sentado == id or not contem(est.dados.farois, id) then
		return
	end
	local c = personagemValida(est)
	if not c then
		return
	end
	colocarJuntoAoFarol(c, id)
	est.sentado = id
	est.dados.ultimoFarol = id
	definirAcao(est, "sentado", 2, true)
	task.spawn(Dados.guardar, est.jogador.UserId, est.dados)
	ctx.remotos.Farol:FireClient(est.jogador, id)
end

-- ---------------------------------------------------------------- relicários

local function abrirRelicario(plr, id)
	local est = estados[plr]
	if not est or est.estado ~= "livre" then
		return
	end
	if contem(est.dados.relicarios, id) then
		aviso(plr, "texto", "Já abriste este relicário")
		return
	end
	local def
	for _, r in Config.RELICARIOS do
		if r.id == id then
			def = r
		end
	end
	if not def then
		return
	end
	table.insert(est.dados.relicarios, id)
	local c, _, raiz = personagemValida(est)
	if raiz then
		som(raiz, "rbxasset://sounds/electronicpingshort.wav", 0.6, 1.2)
	end
	mudar(est, "acender", 0.9)
	definirAcao(est, "acender", 0.9)
	if def.tipo == "orvalho" then
		est.dados.orvalhoMax += 1
		est.orvalho += 1
		aviso(plr, "item", "Fragmento de Orvalho — o frasco tem agora " .. est.dados.orvalhoMax .. " cargas")
	elseif def.tipo == "arma" then
		if not contem(est.dados.armas, def.arma) then
			table.insert(est.dados.armas, def.arma)
		end
		est.dados.arma = def.arma
		if c then
			Personagens.equiparJogador(c, def.arma)
		end
		aviso(plr, "item", Config.ARMAS[def.arma].nome .. " (X para trocar de arma)")
	elseif def.tipo == "eter" then
		est.dados.eter += def.qtd
		aviso(plr, "item", "Éter cristalizado (" .. def.qtd .. ")")
	end
	sincronizar(est)
	task.spawn(Dados.guardar, plr.UserId, est.dados)
end

-- ---------------------------------------------------------------- personagem e morte

local filtroChao = RaycastParams.new()
filtroChao.FilterType = Enum.RaycastFilterType.Exclude

local function aoMorrer(est)
	if not est.vivo then
		return
	end
	est.vivo = false
	mudar(est, "morto")
	definirAcao(est, "morrer", 1.6, true)
	local plr = est.jogador
	local d = est.dados
	if d.eter > 0 then
		local p = est.ultimoChao or Vector3.new(0, 200, 0)
		d.eco = { x = p.X, y = p.Y, z = p.Z, qtd = d.eter }
		d.eter = 0
		criarEco(plr, d.eco)
	end
	sincronizar(est)
	aviso(plr, "morte", "")
	ctx.inimigos.sairArena(plr)
	task.spawn(Dados.guardar, plr.UserId, d)
	task.delay(5.5, function()
		if plr.Parent then
			plr:LoadCharacter()
		end
	end)
end

local function prepararPersonagem(est, personagem)
	local hum = personagem:WaitForChild("Humanoid", 10)
	local raiz = personagem:WaitForChild("HumanoidRootPart", 10)
	if not hum or not raiz then
		return
	end
	hum.BreakJointsOnDeath = false
	hum.RequiresNeck = false
	hum.MaxHealth = Jogadores.vidaMax(est.dados)
	hum.Health = hum.MaxHealth
	est.vivo = true
	est.energia = Jogadores.energiaMax(est.dados)
	est.orvalho = est.dados.orvalhoMax
	est.bloqueando = false
	est.correndo = false
	est.invulDe = nil
	est.invulAte = nil
	est.sentado = nil
	est.ultimoChao = nil
	mudar(est, "levantar", 1.6)
	personagem:SetAttribute("Jogador", true)
	Personagens.equiparJogador(personagem, est.dados.arma)
	-- posição inicial: último farol ou o despertar
	local id = est.dados.ultimoFarol
	if id and Mundo.farois[id] then
		colocarJuntoAoFarol(personagem, id)
	else
		local chao = Mundo.chaoOuIlha(Config.INICIO.X, Config.INICIO.Z, "despertar")
		personagem:PivotTo(CFrame.new(chao + Vector3.new(0, 4, 0)) * CFrame.Angles(0, math.rad(200), 0))
	end
	definirAcao(est, "levantar", 1.6)
	hum.Died:Connect(function()
		aoMorrer(est)
	end)
	sincronizar(est)
end

-- ---------------------------------------------------------------- ciclo

local tAtributos = 0
local tChao = 0
local tGravar = 0

function Jogadores.atualizar(dt)
	local t = agora()
	tAtributos -= dt
	tChao -= dt
	tGravar -= dt
	for plr, est in estados do
		local c, hum, raiz = personagemValida(est)
		if c and est.vivo then
			-- fim de estados temporários
			if est.estado ~= "livre" and est.estado ~= "sentado" and est.estado ~= "morto" and t >= est.estadoAte then
				if est.estado == "ataque" then
					est.ataque = nil
				end
				mudar(est, "livre")
			end
			-- golpes ativos
			if est.estado == "ataque" and est.ataque then
				local dt0 = t - est.inicio
				if dt0 >= est.ataque.def.ini and dt0 <= est.ataque.def.fim then
					verificarGolpe(est)
				end
			end
			-- beber
			if est.estado == "beber" and not est.curou and t - est.inicio > 0.6 then
				est.curou = true
				est.orvalho -= 1
				hum.Health = math.min(hum.MaxHealth, hum.Health + hum.MaxHealth * J.curaOrvalho)
				ctx.remotos.Efeito:FireAllClients("cura", raiz.Position)
				sincronizar(est)
			end
			-- energia
			local velH = (raiz.AssemblyLinearVelocity * Vector3.new(1, 0, 1)).Magnitude
			if est.correndo and est.estado == "livre" and velH > 16 and est.energia > 0 then
				est.energia -= J.custoCorrer * dt
				est.atrasoAte = t + 0.4
			elseif t >= est.atrasoAte and est.estado ~= "ataque" and est.estado ~= "rolar" then
				local ritmo = J.recuperacaoEnergia * (if est.bloqueando then 0.4 else 1)
				est.energia = math.min(Jogadores.energiaMax(est.dados), est.energia + ritmo * dt)
			end
			local bloq = est.bloqueando and est.estado == "livre"
			if c:GetAttribute("Bloqueando") ~= bloq then
				c:SetAttribute("Bloqueando", bloq)
			end
			-- queda nas nuvens
			if raiz.Position.Y < Config.ALTURA_QUEDA then
				hum.Health = 0
			end
			-- último chão firme (onde fica o Eco)
			if tChao <= 0 and est.estado ~= "rolar" then
				filtroChao.FilterDescendantsInstances = { c, workspace:FindFirstChild("Inimigos") }
				local r = workspace:Raycast(raiz.Position, Vector3.new(0, -9, 0), filtroChao)
				if r then
					est.ultimoChao = r.Position + Vector3.new(0, 2.5, 0)
				end
			end
		end
		if tAtributos <= 0 then
			plr:SetAttribute("Energia", math.floor(est.energia + 0.5))
			plr:SetAttribute("Orvalho", est.orvalho)
		end
		if tGravar <= 0 then
			task.spawn(Dados.guardar, plr.UserId, est.dados)
		end
	end
	if tAtributos <= 0 then
		tAtributos = 0.08
	end
	if tChao <= 0 then
		tChao = 0.4
	end
	if tGravar <= 0 then
		tGravar = 120
	end
end

-- ---------------------------------------------------------------- arranque

local function entrou(plr)
	local dados = Dados.carregar(plr.UserId)
	if not plr.Parent then
		return
	end
	local est: any = {
		jogador = plr, dados = dados, energia = 0, atrasoAte = 0, estado = "morto", inicio = agora(), estadoAte = math.huge,
		combo = 0, orvalho = dados.orvalhoMax, vivo = false, bloqueando = false, correndo = false,
	}
	estados[plr] = est
	-- faróis já acesos por este jogador também ficam acesos no mundo
	for _, id in dados.farois do
		Mundo.acenderFarolVisual(id)
	end
	if dados.eco then
		criarEco(plr, dados.eco)
	end
	sincronizar(est)
	plr.CharacterAdded:Connect(function(personagem)
		local ok, erro = pcall(prepararPersonagem, est, personagem)
		if not ok then
			warn("[Céu Partido] erro ao preparar a personagem:", erro)
		end
	end)
	plr:LoadCharacter()
end

function Jogadores.iniciar(contexto)
	ctx = contexto
	pastaEcos = Instance.new("Folder")
	pastaEcos.Name = "Ecos"
	pastaEcos.Parent = workspace

	local R = ctx.remotos
	R.Acao.OnServerEvent:Connect(function(plr, tipo, arg)
		local est = estados[plr]
		if not est or not est.vivo or type(tipo) ~= "string" then
			return
		end
		if tipo == "leve" then
			tentarAtacar(est, false)
		elseif tipo == "forte" then
			tentarAtacar(est, true)
		elseif tipo == "rolar" then
			tentarRolar(est, arg == "tras")
		elseif tipo == "bloquear" then
			est.bloqueando = arg == true
		elseif tipo == "correr" then
			est.correndo = arg == true
		elseif tipo == "beber" then
			tentarBeber(est)
		elseif tipo == "trocarArma" then
			trocarArma(est)
		elseif tipo == "planar" then
			local c = plr.Character
			if c then
				c:SetAttribute("Planando", arg == true)
			end
		end
	end)
	R.Menu.OnServerEvent:Connect(function(plr, tipo, arg)
		local est = estados[plr]
		if not est or not est.vivo or type(tipo) ~= "string" then
			return
		end
		if tipo == "partir" then
			partir(est)
		elseif tipo == "subir" and type(arg) == "string" then
			subirNivel(est, arg)
		elseif tipo == "viajar" and type(arg) == "string" then
			viajar(est, arg)
		end
	end)
	ProximityPromptService.PromptTriggered:Connect(function(prompt, plr)
		if prompt.Name == "Farol" then
			usarFarol(plr, prompt:GetAttribute("Farol"))
		elseif prompt.Name == "Relicario" then
			abrirRelicario(plr, prompt:GetAttribute("Relicario"))
		elseif prompt.Name == "Eco" then
			recuperarEco(plr, prompt)
		elseif prompt.Name == "Barreira" then
			local est = estados[plr]
			if est and est.vivo and est.estado == "livre" then
				ctx.inimigos.entrarArena(plr, prompt:GetAttribute("Arena"))
			end
		end
	end)

	local function entrarSeguro(plr)
		local ok, erro = pcall(entrou, plr)
		if not ok then
			warn("[Céu Partido] erro ao entrar:", erro)
			if plr.Parent and not plr.Character then
				plr:LoadCharacter()
			end
		end
	end
	Players.PlayerAdded:Connect(entrarSeguro)
	for _, plr in Players:GetPlayers() do
		task.spawn(entrarSeguro, plr)
	end
	Players.PlayerRemoving:Connect(function(plr)
		local est = estados[plr]
		if est then
			Dados.guardar(plr.UserId, est.dados)
			criarEco(plr, nil)
			ctx.inimigos.sairArena(plr)
		end
		estados[plr] = nil
	end)
	game:BindToClose(function()
		for plr, est in estados do
			Dados.guardar(plr.UserId, est.dados)
		end
	end)
end

return Jogadores

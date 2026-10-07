--!nonstrict
-- Controlos e movimento local: ataques, esquiva, corrida, bloqueio, Orvalho, troca de arma, fixar alvo,
-- planar e correntes de vento. As ações são enviadas ao servidor (que decide o dano) e mostradas já no cliente.

local ContextActionService = game:GetService("ContextActionService")
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local UserInputService = game:GetService("UserInputService")

local Config = require(ReplicatedStorage:WaitForChild("Compartilhado"):WaitForChild("Config"))

local Controles = {}
local jogador = Players.LocalPlayer
local estado
local R
local Camara
local J = Config.JOGADOR

local pendente = nil -- ação carregada um pouco antes do fim da anterior
local combo = 0
local fimUltimoAtaque = 0
local shiftDesde = nil
local impulso -- LinearVelocity para esquiva, avanço dos golpes e empurrões

local function agora()
	return os.clock()
end

local function energia()
	return jogador:GetAttribute("Energia") or 0
end

local function personagem()
	local c = jogador.Character
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

local function mostrarAcao(nome, dur)
	estado.acao = { nome = nome, inicio = agora(), dur = dur }
end

local function mudarLocal(e, dur)
	estado.local_ = e
	estado.desde = agora()
	estado.ate = agora() + (dur or math.huge)
end
Controles.mudarLocal = mudarLocal
Controles.mostrarAcao = mostrarAcao

local function podeAgir()
	local t = agora()
	if estado.local_ == "livre" then
		return true
	end
	if estado.local_ == "ataque" and estado.golpe and t >= estado.desde + estado.golpe.fim then
		return true
	end
	if estado.local_ == "rolar" and t >= estado.ate - 0.15 then
		return true
	end
	return false
end

local function noAr(hum)
	return hum.FloorMaterial == Enum.Material.Air
end

local function virarPara(raiz, dir)
	local d = Vector3.new(dir.X, 0, dir.Z)
	if d.Magnitude > 0.05 then
		raiz.CFrame = CFrame.lookAt(raiz.Position, raiz.Position + d)
	end
end

local function direcaoDesejada(hum)
	local m = hum.MoveDirection
	return Vector3.new(m.X, 0, m.Z)
end

-- ---------------------------------------------------------------- ações

local function atacar(forte)
	local c, hum, raiz = personagem()
	if not c or noAr(hum) or energia() <= 0 then
		return false
	end
	local arma = Config.ARMAS[jogador:GetAttribute("Arma") or Config.ARMA_INICIAL] or Config.ARMAS[Config.ARMA_INICIAL]
	if estado.local_ ~= "ataque" and agora() - fimUltimoAtaque > 0.6 then
		combo = 0
	end
	local def = if forte then arma.forte else arma.leve[(combo % #arma.leve) + 1]
	combo += 1
	fimUltimoAtaque = agora() + def.dur
	R.Acao:FireServer(if forte then "forte" else "leve")
	mudarLocal("ataque", def.dur)
	estado.golpe = def
	estado.golpeForte = forte
	mostrarAcao(def.anim, def.dur)
	-- orientação no início do golpe
	if estado.alvo then
		local raizA = estado.alvo:FindFirstChild("HumanoidRootPart")
		if raizA then
			virarPara(raiz, raizA.Position - raiz.Position)
		end
	else
		local d = direcaoDesejada(hum)
		if d.Magnitude > 0.2 then
			virarPara(raiz, d)
		end
	end
	return true
end

local function rolar()
	local c, hum, raiz = personagem()
	if not c or noAr(hum) or energia() <= 0 then
		return false
	end
	local d = direcaoDesejada(hum)
	local tras = d.Magnitude < 0.2
	R.Acao:FireServer("rolar", if tras then "tras" else nil)
	mudarLocal("rolar", J.durRolar)
	estado.rolTras = tras
	if tras then
		estado.dirRolar = -Vector3.new(raiz.CFrame.LookVector.X, 0, raiz.CFrame.LookVector.Z).Unit
		mostrarAcao("recuar", J.durRolar)
	else
		estado.dirRolar = d.Unit
		virarPara(raiz, d)
		mostrarAcao("rolar", J.durRolar)
	end
	return true
end

local function beber()
	local c, hum = personagem()
	if not c or noAr(hum) or estado.local_ ~= "livre" then
		return false
	end
	if (jogador:GetAttribute("Orvalho") or 0) <= 0 then
		R.Acao:FireServer("beber") -- o servidor mostra o aviso
		return true
	end
	R.Acao:FireServer("beber")
	mudarLocal("beber", 1.35)
	mostrarAcao("beber", 1.35)
	return true
end

local function definirPlanar(v)
	if estado.planando == v then
		return
	end
	estado.planando = v
	R.Acao:FireServer("planar", v)
end

local function tentar(acao)
	local c, hum = personagem()
	if estado.menu or not c then
		return
	end
	-- no ar, a esquiva fecha o planador
	if acao == "rolar" and estado.planando and noAr(hum) then
		definirPlanar(false)
		return
	end
	if not podeAgir() then
		pendente = { acao = acao, ate = agora() + 0.4 }
		return
	end
	local ok = false
	if acao == "leve" then
		ok = atacar(false)
	elseif acao == "forte" then
		ok = atacar(true)
	elseif acao == "rolar" then
		ok = rolar()
	elseif acao == "beber" then
		ok = beber()
	end
	if ok then
		pendente = nil
	end
end

local function definirCorrida(v)
	if estado.correndo == v then
		return
	end
	estado.correndo = v
	R.Acao:FireServer("correr", v)
end

-- ---------------------------------------------------------------- ligações

local function ligarAcoes()
	local function acao(nome, fn, toque, ...)
		ContextActionService:BindAction(nome, function(_, inputState, input)
			if estado.menu then
				return Enum.ContextActionResult.Pass
			end
			fn(inputState, input)
			return Enum.ContextActionResult.Sink
		end, toque, ...)
	end
	acao("CP_Leve", function(s)
		if s == Enum.UserInputState.Begin then
			tentar("leve")
		end
	end, true, Enum.UserInputType.MouseButton1, Enum.KeyCode.ButtonR1)
	acao("CP_Forte", function(s)
		if s == Enum.UserInputState.Begin then
			tentar("forte")
		end
	end, true, Enum.KeyCode.F, Enum.KeyCode.ButtonR2)
	acao("CP_Bloquear", function(s)
		local v = s == Enum.UserInputState.Begin or s == Enum.UserInputState.Change
		if estado.bloqueando ~= v then
			estado.bloqueando = v
			R.Acao:FireServer("bloquear", v)
		end
	end, true, Enum.UserInputType.MouseButton2, Enum.KeyCode.ButtonL1)
	-- Shift / B: tocar = esquivar, manter = correr
	acao("CP_Esquivar", function(s, input)
		if input.UserInputType == Enum.UserInputType.Touch then
			if s == Enum.UserInputState.Begin then
				tentar("rolar")
			end
			return
		end
		if s == Enum.UserInputState.Begin then
			shiftDesde = agora()
		elseif s == Enum.UserInputState.End or s == Enum.UserInputState.Cancel then
			if shiftDesde and agora() - shiftDesde < 0.24 then
				tentar("rolar")
			end
			shiftDesde = nil
			definirCorrida(false)
		end
	end, true, Enum.KeyCode.LeftShift, Enum.KeyCode.ButtonB)
	acao("CP_Beber", function(s)
		if s == Enum.UserInputState.Begin then
			tentar("beber")
		end
	end, true, Enum.KeyCode.R, Enum.KeyCode.ButtonX)
	acao("CP_Alvo", function(s)
		if s == Enum.UserInputState.Begin then
			Camara.alternarAlvo()
		end
	end, true, Enum.KeyCode.Q, Enum.UserInputType.MouseButton3, Enum.KeyCode.ButtonR3)
	acao("CP_Arma", function(s)
		if s == Enum.UserInputState.Begin and estado.local_ == "livre" then
			R.Acao:FireServer("trocarArma")
		end
	end, false, Enum.KeyCode.X, Enum.KeyCode.DPadUp)
	-- no ecrã tátil: botão para correr (alternar)
	if UserInputService.TouchEnabled then
		ContextActionService:BindAction("CP_Correr", function(_, s)
			if s == Enum.UserInputState.Begin then
				definirCorrida(not estado.correndo)
			end
			return Enum.ContextActionResult.Sink
		end, true)
		local botoes = {
			CP_Leve = { "Atacar", UDim2.new(1, -95, 1, -95) },
			CP_Forte = { "Forte", UDim2.new(1, -165, 1, -60) },
			CP_Bloquear = { "Escudo", UDim2.new(1, -165, 1, -130) },
			CP_Esquivar = { "Rolar", UDim2.new(1, -95, 1, -165) },
			CP_Beber = { "Orvalho", UDim2.new(1, -235, 1, -95) },
			CP_Alvo = { "Alvo", UDim2.new(1, -235, 1, -165) },
			CP_Correr = { "Correr", UDim2.new(1, -25 - 70, 1, -235) },
		}
		for nome, b in botoes do
			ContextActionService:SetTitle(nome, b[1])
			ContextActionService:SetPosition(nome, b[2])
		end
	end
	-- saltar no ar abre (ou fecha) o planador
	UserInputService.JumpRequest:Connect(function()
		local c, hum = personagem()
		if not c or estado.menu then
			return
		end
		if noAr(hum) then
			if not estado.planando and estado.saltoT and agora() - estado.saltoT > 0.3 then
				definirPlanar(true)
			end
		else
			estado.saltoT = agora()
		end
	end)
end

-- ---------------------------------------------------------------- ciclo por fotograma

local function correnteEm(pos)
	local pasta = workspace:FindFirstChild("Correntes")
	if not pasta then
		return nil
	end
	for _, z in pasta:GetChildren() do
		local raio = z:GetAttribute("Raio")
		local base = z:GetAttribute("Base")
		local topo = z:GetAttribute("Topo")
		if raio and base and topo then
			local d = Vector2.new(pos.X - z.Position.X, pos.Z - z.Position.Z).Magnitude
			if d < raio and pos.Y > base - 3 and pos.Y < topo + 12 then
				return z, topo
			end
		end
	end
	return nil
end

local function garantirImpulso(raiz)
	if impulso and impulso.Parent and impulso.Attachment0 and impulso.Attachment0.Parent == raiz then
		return impulso
	end
	local a = Instance.new("Attachment")
	a.Name = "AnexoImpulso"
	a.Parent = raiz
	impulso = Instance.new("LinearVelocity")
	impulso.Name = "Impulso"
	impulso.Attachment0 = a
	impulso.RelativeTo = Enum.ActuatorRelativeTo.World
	impulso.VelocityConstraintMode = Enum.VelocityConstraintMode.Plane
	impulso.PrimaryTangentAxis = Vector3.new(1, 0, 0)
	impulso.SecondaryTangentAxis = Vector3.new(0, 0, 1)
	impulso.MaxForce = 1e6
	impulso.Enabled = false
	impulso.Parent = raiz
	return impulso
end

function Controles.empurrar(dir, forca)
	estado.empurraoAte = agora() + 0.18
	estado.empurraoVel = Vector3.new(dir.X, 0, dir.Z) * forca
end

local function atualizar(dt)
	local c, hum, raiz = personagem()
	if not c then
		return
	end
	local t = agora()
	local imp = garantirImpulso(raiz)

	-- atordoamento decidido pelo servidor
	local atordoado = c:GetAttribute("AtordoadoAte")
	if atordoado and atordoado > workspace:GetServerTimeNow() and estado.local_ ~= "atordoado" and estado.local_ ~= "sentado" then
		mudarLocal("atordoado", atordoado - workspace:GetServerTimeNow())
		estado.acao = nil
		pendente = nil
	end
	-- fim dos estados temporários
	if estado.local_ ~= "livre" and estado.local_ ~= "sentado" and t >= estado.ate then
		mudarLocal("livre")
	end
	-- ação carregada antes do tempo
	if pendente then
		if t > pendente.ate then
			pendente = nil
		elseif podeAgir() then
			tentar(pendente.acao)
		end
	end
	-- corrida (manter Shift)
	if shiftDesde and t - shiftDesde >= 0.24 and estado.local_ == "livre" then
		definirCorrida(energia() > 1)
	end

	-- velocidade de andar conforme o estado
	local livre = estado.local_ == "livre"
	local velAndar = 0
	if livre and not estado.menu then
		if estado.bloqueando then
			velAndar = J.velBloquear
		elseif estado.correndo and energia() > 1 then
			velAndar = J.velCorrer
		else
			velAndar = J.velAndar
		end
	elseif estado.local_ == "beber" then
		velAndar = J.velBeber
	end
	hum.WalkSpeed = velAndar
	hum.UseJumpPower = false
	hum.JumpHeight = if livre and not estado.menu then 7.5 else 0

	-- orientação: com alvo fixo, a personagem encara-o
	local alvo = estado.alvo
	local raizA = alvo and alvo:FindFirstChild("HumanoidRootPart")
	if raizA and (livre or estado.local_ == "beber") and not estado.correndo and not noAr(hum) then
		hum.AutoRotate = false
		local d = raizA.Position - raiz.Position
		local alvoCF = CFrame.lookAt(raiz.Position, raiz.Position + Vector3.new(d.X, 0, d.Z))
		raiz.CFrame = raiz.CFrame:Lerp(alvoCF, math.min(1, dt * 12))
	else
		hum.AutoRotate = livre or estado.local_ == "beber"
	end

	-- impulsos (esquiva, avanço do golpe, empurrão)
	local vel = nil
	if estado.empurraoAte and t < estado.empurraoAte then
		vel = estado.empurraoVel
	elseif estado.local_ == "rolar" then
		local k = (t - estado.desde) / J.durRolar
		local v = if estado.rolTras then (if k < 0.5 then 22 else 4) else (if k < 0.62 then 30 elseif k < 0.85 then 11 else 3)
		vel = estado.dirRolar * v
	elseif estado.local_ == "ataque" and estado.golpe then
		local tt = t - estado.desde
		if tt > estado.golpe.ini - 0.12 and tt < estado.golpe.ini + 0.06 then
			local perto = raizA and (raizA.Position - raiz.Position).Magnitude < 7 + (alvo:GetAttribute("Escala") or 1) * 2
			local v = if perto then 0 elseif estado.golpeForte then 13 else 10
			local lv = raiz.CFrame.LookVector
			vel = Vector3.new(lv.X, 0, lv.Z).Unit * v
		else
			vel = Vector3.zero
		end
	elseif estado.local_ == "atordoado" then
		vel = Vector3.zero
	end
	if vel then
		imp.Enabled = true
		imp.PlaneVelocity = Vector2.new(vel.X, vel.Z)
	else
		imp.Enabled = false
	end

	-- planar e correntes de vento
	local zona, topo = correnteEm(raiz.Position)
	local v = raiz.AssemblyLinearVelocity
	if zona then
		local alvoVy = if raiz.Position.Y < topo then 70 else 8
		raiz.AssemblyLinearVelocity = Vector3.new(v.X, v.Y + (alvoVy - v.Y) * math.min(1, dt * 4), v.Z)
		v = raiz.AssemblyLinearVelocity
		if hum:GetState() ~= Enum.HumanoidStateType.Freefall then
			hum:ChangeState(Enum.HumanoidStateType.Freefall)
		end
	end
	if estado.planando then
		if not noAr(hum) then
			definirPlanar(false)
		else
			local desejo = direcaoDesejada(hum)
			local frente = Vector3.new(raiz.CFrame.LookVector.X, 0, raiz.CFrame.LookVector.Z)
			local dirH = if desejo.Magnitude > 0.1 then desejo.Unit else frente.Unit
			local h = Vector3.new(v.X, 0, v.Z):Lerp(dirH * 34, math.min(1, dt * 2.5))
			local vy = if zona then v.Y else math.max(v.Y, -9)
			raiz.AssemblyLinearVelocity = Vector3.new(h.X, vy, h.Z)
			hum.AutoRotate = false
			if h.Magnitude > 1 then
				raiz.CFrame = raiz.CFrame:Lerp(CFrame.lookAt(raiz.Position, raiz.Position + h), math.min(1, dt * 6))
			end
		end
	end
	if not noAr(hum) then
		estado.saltoT = estado.saltoT or t
	end
end

function Controles.iniciar(est, remotos, camara)
	estado = est
	R = remotos
	Camara = camara
	ligarAcoes()
	RunService.Heartbeat:Connect(atualizar)
end

function Controles.reiniciar()
	pendente = nil
	combo = 0
	shiftDesde = nil
	impulso = nil
	estado.planando = false
	estado.correndo = false
	estado.bloqueando = false
	estado.acao = nil
end

return Controles

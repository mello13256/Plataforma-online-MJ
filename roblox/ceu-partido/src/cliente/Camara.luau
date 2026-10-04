--!nonstrict
-- Câmara em terceira pessoa: rato/manípulo/toque, colisão com o cenário, fixar alvo e tremor.

local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local UserInputService = game:GetService("UserInputService")

local Camara = {}
local jogador = Players.LocalPlayer
local cam = workspace.CurrentCamera

local yaw = 0
local pitch = 0.25
local distAtual = 13
local foco = Vector3.zero
local tremor = 0
local estado -- tabela partilhada
local sensibilidade = 0.0032
local direitoX, direitoY = 0, 0
local trocou = false

local filtro = RaycastParams.new()
filtro.FilterType = Enum.RaycastFilterType.Exclude

function Camara.tremer(i)
	tremor = math.min(1.2, tremor + i)
end

function Camara.yaw()
	return yaw
end

function Camara.definirYaw(v)
	yaw = v
end

-- candidatos a alvo: inimigos vivos à frente da câmara
local function candidatos()
	local r = {}
	local pasta = workspace:FindFirstChild("Inimigos")
	local c = jogador.Character
	local raizJ = c and c:FindFirstChild("HumanoidRootPart")
	if not pasta or not raizJ then
		return r
	end
	local frente = Vector3.new(-math.sin(yaw), 0, -math.cos(yaw))
	for _, m in pasta:GetChildren() do
		local raiz = m:FindFirstChild("HumanoidRootPart")
		if raiz and (m:GetAttribute("Vida") or 0) > 0 then
			local d = raiz.Position - raizJ.Position
			local dist = Vector3.new(d.X, 0, d.Z).Magnitude
			if dist < 90 and math.abs(d.Y) < 40 then
				local u = Vector3.new(d.X, 0, d.Z).Unit
				local ang = math.acos(math.clamp(u:Dot(frente), -1, 1))
				if ang < 1.1 then
					table.insert(r, { m = m, raiz = raiz, dist = dist, ang = ang, lado = u:Dot(Vector3.new(math.cos(yaw), 0, -math.sin(yaw))) })
				end
			end
		end
	end
	return r
end

function Camara.alternarAlvo()
	if estado.alvo then
		estado.alvo = nil
		return
	end
	local lista = candidatos()
	table.sort(lista, function(a, b)
		return a.ang * 8 + a.dist * 0.04 < b.ang * 8 + b.dist * 0.04
	end)
	if lista[1] then
		estado.alvo = lista[1].m
	else
		-- sem alvo: centra a câmara atrás da personagem
		local c = jogador.Character
		local raiz = c and c:FindFirstChild("HumanoidRootPart")
		if raiz then
			local lv = raiz.CFrame.LookVector
			yaw = math.atan2(-lv.X, -lv.Z)
		end
	end
end

local function trocarAlvo(dir)
	local atual = estado.alvo
	if not atual then
		return
	end
	local lista = candidatos()
	local raizA = atual:FindFirstChild("HumanoidRootPart")
	if not raizA then
		return
	end
	local melhor, md = nil, math.huge
	for _, cnd in lista do
		if cnd.m ~= atual then
			if (dir > 0 and cnd.lado > 0) or (dir < 0 and cnd.lado < 0) then
				if cnd.ang < md then
					melhor, md = cnd.m, cnd.ang
				end
			end
		end
	end
	if melhor then
		estado.alvo = melhor
	end
end

function Camara.iniciar(est)
	estado = est
	cam.CameraType = Enum.CameraType.Scriptable
	UserInputService.InputChanged:Connect(function(input, processado)
		if input.UserInputType == Enum.UserInputType.Gamepad1 and input.KeyCode == Enum.KeyCode.Thumbstick2 then
			direitoX = if math.abs(input.Position.X) > 0.15 then input.Position.X else 0
			direitoY = if math.abs(input.Position.Y) > 0.15 then input.Position.Y else 0
		elseif input.UserInputType == Enum.UserInputType.Touch and not processado then
			yaw -= input.Delta.X * 0.006
			pitch += input.Delta.Y * 0.006
		elseif input.UserInputType == Enum.UserInputType.MouseWheel and estado.alvo then
			trocarAlvo(if input.Position.Z > 0 then 1 else -1)
		end
	end)

	RunService:BindToRenderStep("CeuPartidoCamara", Enum.RenderPriority.Camera.Value + 1, function(dt)
		cam.CameraType = Enum.CameraType.Scriptable
		local c = jogador.Character
		local raiz = c and c:FindFirstChild("HumanoidRootPart")
		local hum = c and c:FindFirstChildOfClass("Humanoid")
		if not raiz or not hum then
			return
		end
		-- rato bloqueado ao centro enquanto se joga
		if estado.menu then
			UserInputService.MouseBehavior = Enum.MouseBehavior.Default
			UserInputService.MouseIconEnabled = true
		else
			UserInputService.MouseBehavior = Enum.MouseBehavior.LockCenter
			UserInputService.MouseIconEnabled = false
		end
		local delta = if estado.menu then Vector2.zero else UserInputService:GetMouseDelta()
		local alvo = estado.alvo
		if alvo then
			local raizA = alvo:FindFirstChild("HumanoidRootPart")
			if not raizA or (alvo:GetAttribute("Vida") or 0) <= 0 or (raizA.Position - raiz.Position).Magnitude > 110 then
				estado.alvo = nil
				alvo = nil
			end
		end
		if alvo then
			local raizA = alvo:FindFirstChild("HumanoidRootPart")
			local d = raizA.Position - raiz.Position
			local yAlvo = math.atan2(-d.X, -d.Z)
			local dif = math.atan2(math.sin(yAlvo - yaw), math.cos(yAlvo - yaw))
			yaw += dif * math.min(1, dt * 7)
			local escalaA = alvo:GetAttribute("Escala") or 1
			local pAlvo = math.clamp(0.22 + (escalaA - 1) * 0.06, 0.12, 0.5)
			pitch += (pAlvo - pitch) * math.min(1, dt * 4)
			-- trocar de alvo com um movimento rápido
			if math.abs(delta.X) > 30 and not trocou then
				trocarAlvo(if delta.X > 0 then 1 else -1)
				trocou = true
			elseif math.abs(direitoX) > 0.85 and not trocou then
				trocarAlvo(if direitoX > 0 then 1 else -1)
				trocou = true
			elseif math.abs(delta.X) < 5 and math.abs(direitoX) < 0.3 then
				trocou = false
			end
		else
			yaw -= delta.X * sensibilidade * estado.sensibilidade
			pitch += delta.Y * sensibilidade * estado.sensibilidade * (if estado.inverterY then -1 else 1)
			yaw -= direitoX * dt * 3.2
			pitch -= direitoY * dt * 2.2
		end
		pitch = math.clamp(pitch, -0.6, 1.25)

		local altura = if hum.RigType == Enum.HumanoidRigType.R15 then 2.4 else 2
		local destino = raiz.Position + Vector3.new(0, altura, 0)
		foco = foco:Lerp(destino, math.min(1, dt * 16))
		if (foco - destino).Magnitude > 30 then
			foco = destino
		end
		local escalaAlvo = alvo and (alvo:GetAttribute("Escala") or 1) or 1
		local distBase = (if alvo then 15 + (escalaAlvo - 1) * 4 else 13) + (if estado.planando then 4 else 0)
		local dir = Vector3.new(-math.sin(yaw) * math.cos(pitch), -math.sin(pitch), -math.cos(yaw) * math.cos(pitch)) -- direção do olhar
		-- colisão com o cenário
		local ignorar = { workspace:FindFirstChild("Inimigos"), workspace:FindFirstChild("Correntes"), workspace:FindFirstChild("Ecos") }
		for _, p in Players:GetPlayers() do
			if p.Character then
				table.insert(ignorar, p.Character)
			end
		end
		filtro.FilterDescendantsInstances = ignorar
		local dist = distBase
		local hit = workspace:Raycast(foco, -dir * (distBase + 0.5), filtro)
		if hit then
			dist = math.max(1.5, (hit.Position - foco).Magnitude - 0.8)
		end
		distAtual += (dist - distAtual) * math.min(1, dt * (if dist < distAtual then 25 else 5))
		local pos = foco - dir * distAtual
		local olhar = foco
		if alvo then
			local raizA = alvo:FindFirstChild("HumanoidRootPart")
			olhar = foco:Lerp(raizA.Position + Vector3.new(0, 1.5 * escalaAlvo, 0), 0.3)
		end
		local cf = CFrame.lookAt(pos, olhar)
		-- tremor
		tremor = math.max(0, tremor - dt * 1.8)
		if tremor > 0 then
			local k = tremor * tremor
			local t = os.clock()
			cf = cf * CFrame.new(math.sin(t * 61) * 0.35 * k, math.sin(t * 53 + 1) * 0.3 * k, 0) * CFrame.Angles(0, 0, math.sin(t * 47) * 0.03 * k)
		end
		cam.CFrame = cf
	end)
end

return Camara

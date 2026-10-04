--!nonstrict
-- Céu Partido — arranque do cliente.

local Players = game:GetService("Players")
local ReplicatedFirst = game:GetService("ReplicatedFirst")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local jogador = Players.LocalPlayer

-- ecrã de espera enquanto o servidor ergue as ilhas
local espera = Instance.new("ScreenGui")
espera.Name = "Espera"
espera.IgnoreGuiInset = true
espera.DisplayOrder = 100
espera.ResetOnSpawn = false
local fundo = Instance.new("Frame")
fundo.Size = UDim2.fromScale(1, 1)
fundo.BackgroundColor3 = Color3.fromRGB(14, 18, 28)
fundo.BorderSizePixel = 0
fundo.Parent = espera
local titulo = Instance.new("TextLabel")
titulo.BackgroundTransparency = 1
titulo.Size = UDim2.new(1, 0, 0, 90)
titulo.Position = UDim2.fromScale(0, 0.38)
titulo.Font = Enum.Font.Fantasy
titulo.TextSize = 72
titulo.TextColor3 = Color3.fromRGB(226, 200, 140)
titulo.Text = "CÉU PARTIDO"
titulo.Parent = fundo
local sub = Instance.new("TextLabel")
sub.BackgroundTransparency = 1
sub.Size = UDim2.new(1, -80, 0, 90)
sub.TextWrapped = true
sub.Position = UDim2.new(0, 40, 0.52, 0)
sub.Font = Enum.Font.Garamond
sub.TextSize = 24
sub.TextColor3 = Color3.fromRGB(200, 205, 220)
sub.Text = "A erguer as ilhas…"
sub.Parent = fundo
espera.Parent = jogador:WaitForChild("PlayerGui")
pcall(function()
	ReplicatedFirst:RemoveDefaultLoadingScreen()
end)

local inicioEspera = os.clock()
local pastaRemotos = nil
while not (pastaRemotos and ReplicatedStorage:GetAttribute("MundoPronto")) do
	pastaRemotos = ReplicatedStorage:FindFirstChild("Remotos")
	local erro = ReplicatedStorage:GetAttribute("ErroServidor")
	if erro then
		sub.Text = "Erro no servidor: " .. tostring(erro)
	elseif os.clock() - inicioEspera > 25 then
		sub.Text = "O servidor está a demorar. No Studio, abre View → Output e procura mensagens a vermelho."
	end
	task.wait(0.3)
end
local R = {}
for _, r in pastaRemotos:GetChildren() do
	R[r.Name] = r
end

local pastaModulos = script.Parent
local Camara = require(pastaModulos:WaitForChild("Camara"))
local Animador = require(pastaModulos:WaitForChild("Animador"))
local Controles = require(pastaModulos:WaitForChild("Controles"))
local Efeitos = require(pastaModulos:WaitForChild("Efeitos"))
local Hud = require(pastaModulos:WaitForChild("Hud"))

-- estado partilhado entre os módulos do cliente
local estado = {
	local_ = "livre", desde = 0, ate = 0, acao = nil, golpe = nil, menu = false, alvo = nil,
	sensibilidade = 1, inverterY = false, planando = false, correndo = false, bloqueando = false,
}

Camara.iniciar(estado)
Animador.iniciar(estado)
Controles.iniciar(estado, R, Camara)
Efeitos.iniciar(R, Camara)
Hud.iniciar(estado, R, Controles)

R.Impacto.OnClientEvent:Connect(function(dir, forca, tremor)
	if typeof(dir) == "Vector3" and type(forca) == "number" and forca > 0 then
		Controles.empurrar(dir, forca)
	end
	if type(tremor) == "number" then
		Camara.tremer(tremor)
	end
end)

local function aoPersonagem(personagem)
	Controles.reiniciar()
	estado.alvo = nil
	estado.menu = false
	Controles.mudarLocal("levantar", 1.6)
	Hud.personagemNova(personagem)
	local raiz = personagem:WaitForChild("HumanoidRootPart", 10)
	if raiz then
		task.wait()
		local lv = raiz.CFrame.LookVector
		Camara.definirYaw(math.atan2(-lv.X, -lv.Z))
	end
	if espera.Parent then
		espera:Destroy()
	end
end

jogador.CharacterAdded:Connect(aoPersonagem)
if jogador.Character then
	task.spawn(aoPersonagem, jogador.Character)
end

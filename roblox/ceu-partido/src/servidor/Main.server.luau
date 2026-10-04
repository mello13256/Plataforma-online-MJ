--!strict
-- Céu Partido — arranque do servidor.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")

Players.CharacterAutoLoads = false

-- remotos partilhados com os clientes
local remotos = Instance.new("Folder")
remotos.Name = "Remotos"
local nomes = { "Acao", "Menu", "Aviso", "Farol", "Chefe", "Impacto", "Efeito" }
local R: { [string]: RemoteEvent } = {}
for _, nome in nomes do
	local r = Instance.new("RemoteEvent")
	r.Name = nome
	r.Parent = remotos
	R[nome] = r
end

-- cada passo é protegido: um erro fica registado na janela Output, mas o jogo arranca na mesma
local function passo(nome: string, fn: () -> ())
	local ok, erro = pcall(fn :: any)
	if not ok then
		warn("[Céu Partido] falhou «" .. nome .. "»:", erro)
		ReplicatedStorage:SetAttribute("ErroServidor", nome .. ": " .. tostring(erro))
	end
end

local Mundo, Jogadores, Inimigos
passo("carregar módulos", function()
	Mundo = require(script.Parent:WaitForChild("Mundo")) :: any
	Jogadores = require(script.Parent:WaitForChild("Jogadores")) :: any
	Inimigos = require(script.Parent:WaitForChild("Inimigos")) :: any
end)

local inicio = os.clock()
passo("gerar o mundo", function()
	Mundo.gerar()
end)
print(string.format("[Céu Partido] mundo gerado em %.1f s", os.clock() - inicio))

local ctx = { remotos = R, jogadores = Jogadores, inimigos = Inimigos, mundo = Mundo }
passo("criar inimigos", function()
	Inimigos.iniciar(ctx)
end)
remotos.Parent = ReplicatedStorage
passo("preparar jogadores", function()
	Jogadores.iniciar(ctx)
end)

-- o mundo está pronto: os clientes podem começar
ReplicatedStorage:SetAttribute("MundoPronto", true)

RunService.Heartbeat:Connect(function(dt)
	if Jogadores then
		Jogadores.atualizar(dt)
	end
	if Inimigos then
		Inimigos.atualizar(dt)
	end
end)

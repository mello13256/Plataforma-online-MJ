--!strict
-- Céu Partido — arranque do servidor.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local StarterGui = game:GetService("StarterGui")

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

local Mundo = require(script.Parent:WaitForChild("Mundo"))
local Jogadores = require(script.Parent:WaitForChild("Jogadores"))
local Inimigos = require(script.Parent:WaitForChild("Inimigos"))

local inicio = os.clock()
Mundo.gerar()
print(string.format("[Céu Partido] mundo gerado em %.1f s", os.clock() - inicio))

local ctx = { remotos = R, jogadores = Jogadores, inimigos = Inimigos, mundo = Mundo }
Inimigos.iniciar(ctx)
remotos.Parent = ReplicatedStorage
Jogadores.iniciar(ctx)

-- o mundo está pronto: os clientes podem começar
ReplicatedStorage:SetAttribute("MundoPronto", true)

RunService.Heartbeat:Connect(function(dt)
	Jogadores.atualizar(dt)
	Inimigos.atualizar(dt)
end)

-- a interface padrão de mochila e lista de jogadores não é usada neste jogo
StarterGui.ResetPlayerGuiOnSpawn = false

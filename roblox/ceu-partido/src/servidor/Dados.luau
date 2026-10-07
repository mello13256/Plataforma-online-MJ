--!strict
-- Gravação do progresso de cada jogador (DataStore). Sem acesso à API (ex.: Studio sem permissão),
-- o jogo continua a funcionar, mas o progresso só dura a sessão.

local DataStoreService = game:GetService("DataStoreService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Config = require(ReplicatedStorage:WaitForChild("Compartilhado"):WaitForChild("Config"))

export type Progresso = {
	versao: number,
	nivel: number,
	vigor: number,
	folego: number,
	forca: number,
	eter: number,
	orvalhoMax: number,
	armas: { string },
	arma: string,
	farois: { string },
	ultimoFarol: string?,
	relicarios: { string },
	chefes: { string },
	eco: { x: number, y: number, z: number, qtd: number }?,
}

local Dados = {}

local loja: DataStore? = nil
local okLoja, erroLoja = pcall(function()
	loja = DataStoreService:GetDataStore("CeuPartido_v1")
end)
if not okLoja then
	warn("[Céu Partido] DataStore indisponível; o progresso não será guardado:", erroLoja)
end

function Dados.novo(): Progresso
	return {
		versao = Config.VERSAO,
		nivel = 1,
		vigor = 10,
		folego = 10,
		forca = 10,
		eter = 0,
		orvalhoMax = Config.JOGADOR.orvalhoInicial,
		armas = { Config.ARMA_INICIAL },
		arma = Config.ARMA_INICIAL,
		farois = {},
		ultimoFarol = nil,
		relicarios = {},
		chefes = {},
		eco = nil,
	}
end

local function chave(userId: number): string
	return "J_" .. tostring(userId)
end

function Dados.carregar(userId: number): Progresso
	local base = Dados.novo()
	local l = loja
	if not l then
		return base
	end
	for tentativa = 1, 3 do
		local ok, valor = pcall(function()
			return l:GetAsync(chave(userId))
		end)
		if ok then
			if type(valor) == "table" then
				for k, v in valor do
					(base :: any)[k] = v
				end
			end
			return base
		end
		warn("[Céu Partido] falha ao carregar (tentativa " .. tentativa .. "):", valor)
		task.wait(1)
	end
	return base
end

function Dados.guardar(userId: number, p: Progresso)
	local l = loja
	if not l then
		return
	end
	local ok, erro = pcall(function()
		l:SetAsync(chave(userId), p)
	end)
	if not ok then
		warn("[Céu Partido] falha ao guardar:", erro)
	end
end

return Dados

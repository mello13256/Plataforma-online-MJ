--!nonstrict
-- Interface: barras de vida e energia, Orvalho, arma, Éter, barra do chefe, faixas de mensagem,
-- nome das ilhas, menu do farol (subir de nível, viajar), inscrições e ajuda dos controlos.

local GuiService = game:GetService("GuiService")
local Players = game:GetService("Players")
local ProximityPromptService = game:GetService("ProximityPromptService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local StarterGui = game:GetService("StarterGui")
local TweenService = game:GetService("TweenService")
local UserInputService = game:GetService("UserInputService")

local Config = require(ReplicatedStorage:WaitForChild("Compartilhado"):WaitForChild("Config"))

local Hud = {}
local jogador = Players.LocalPlayer
local estado
local R
local Controles

local OURO = Color3.fromRGB(226, 200, 140)
local TEXTO = Color3.fromRGB(236, 228, 210)
local FONTE = Enum.Font.Garamond
local FONTE_TITULO = Enum.Font.Fantasy

local gui
local el: { [string]: any } = {}
local chefeModelo = nil
local vidaVisivel = 0
local eterMostrado = 0
local ganho = 0
local ganhoAte = 0

local function novo(classe, props, filhos)
	local o = Instance.new(classe)
	for k, v in props do
		if k ~= "Parent" then
			o[k] = v
		end
	end
	for _, f in filhos or {} do
		f.Parent = o
	end
	if props.Parent then
		o.Parent = props.Parent
	end
	return o
end

local function texto(props)
	local t = novo("TextLabel", {
		BackgroundTransparency = 1, Font = FONTE, TextColor3 = TEXTO, TextScaled = false, TextSize = 20,
		TextStrokeTransparency = 0.6, TextStrokeColor3 = Color3.new(0, 0, 0),
	})
	for k, v in props do
		t[k] = v
	end
	return t
end

local function botao(props)
	local b = novo("TextButton", {
		BackgroundColor3 = Color3.fromRGB(28, 24, 20), BackgroundTransparency = 0.2, BorderSizePixel = 0, AutoButtonColor = true,
		Font = FONTE, TextColor3 = TEXTO, TextSize = 22, Size = UDim2.fromOffset(260, 40), Selectable = true,
	}, { novo("UIStroke", { Color = Color3.fromRGB(120, 100, 64), Thickness = 1, ApplyStrokeMode = Enum.ApplyStrokeMode.Border }) })
	for k, v in props do
		b[k] = v
	end
	return b
end

local function barra(nome, cor, pai, pos)
	local fundo = novo("Frame", {
		Name = nome, Parent = pai, Position = pos, Size = UDim2.fromOffset(250, 12), BackgroundColor3 = Color3.fromRGB(10, 8, 8),
		BackgroundTransparency = 0.25, BorderSizePixel = 0,
	}, { novo("UIStroke", { Color = Color3.fromRGB(90, 80, 60), Thickness = 1 }) })
	novo("Frame", { Name = "Perda", Parent = fundo, Size = UDim2.fromScale(1, 1), BackgroundColor3 = Color3.fromRGB(232, 214, 160), BorderSizePixel = 0 })
	novo("Frame", { Name = "Valor", Parent = fundo, Size = UDim2.fromScale(1, 1), BackgroundColor3 = cor, BorderSizePixel = 0 }, {
		novo("UIGradient", { Color = ColorSequence.new(cor:Lerp(Color3.new(1, 1, 1), 0.2), cor:Lerp(Color3.new(0, 0, 0), 0.35)), Rotation = 90 }),
	})
	return fundo
end

local function painel(nome, tamanho, posicao)
	return novo("Frame", {
		Name = nome, Parent = gui, Size = tamanho, Position = posicao, AnchorPoint = Vector2.new(0.5, 0.5),
		BackgroundColor3 = Color3.fromRGB(12, 10, 9), BackgroundTransparency = 0.12, BorderSizePixel = 0, Visible = false,
	}, {
		novo("UIStroke", { Color = Color3.fromRGB(110, 92, 60), Thickness = 1 }),
		novo("UIPadding", { PaddingLeft = UDim.new(0, 22), PaddingRight = UDim.new(0, 22), PaddingTop = UDim.new(0, 18), PaddingBottom = UDim.new(0, 18) }),
	})
end

local function listaCsv(attr)
	local s = jogador:GetAttribute(attr)
	local r = {}
	if type(s) == "string" and #s > 0 then
		for p in string.gmatch(s, "[^,]+") do
			r[p] = true
		end
	end
	return r
end

-- ---------------------------------------------------------------- mensagens

local function mostrarTexto(rotulo, dur)
	rotulo.TextTransparency = 1
	rotulo.TextStrokeTransparency = 1
	rotulo.Visible = true
	TweenService:Create(rotulo, TweenInfo.new(0.6), { TextTransparency = 0, TextStrokeTransparency = 0.5 }):Play()
	task.delay(dur, function()
		TweenService:Create(rotulo, TweenInfo.new(1.2), { TextTransparency = 1, TextStrokeTransparency = 1 }):Play()
	end)
end

function Hud.aviso(t, dur)
	el.aviso.Text = t
	mostrarTexto(el.aviso, dur or 3)
end

function Hud.faixa(titulo, sub, cor, dur)
	el.faixa.Visible = true
	el.faixaTitulo.Text = titulo
	el.faixaTitulo.TextColor3 = cor or OURO
	el.faixaSub.Text = sub or ""
	el.faixa.BackgroundTransparency = 1
	TweenService:Create(el.faixa, TweenInfo.new(0.8), { BackgroundTransparency = 0.35 }):Play()
	mostrarTexto(el.faixaTitulo, dur or 3.5)
	mostrarTexto(el.faixaSub, dur or 3.5)
	task.delay((dur or 3.5) + 0.2, function()
		TweenService:Create(el.faixa, TweenInfo.new(1.2), { BackgroundTransparency = 1 }):Play()
	end)
end

function Hud.area(nome)
	el.area.Text = nome
	mostrarTexto(el.area, 3)
end

function Hud.fade(v, dur)
	TweenService:Create(el.fade, TweenInfo.new(dur or 0.8), { BackgroundTransparency = if v then 0 else 1 }):Play()
end

local function tratarAviso(tipo, t)
	if tipo == "farol" then
		Hud.faixa("FAROL ACESO", t, Color3.fromRGB(255, 210, 140), 3)
	elseif tipo == "morte" then
		Hud.faixa("MORRESTE", "O teu Éter ficou onde caíste.", Color3.fromRGB(170, 30, 24), 4)
	elseif tipo == "chefe" then
		Hud.faixa("GRANDE INIMIGO ABATIDO", t, OURO, 5)
	elseif tipo == "final" then
		Hud.faixa("O CÉU ESTÁ EM PAZ", "Tempestor caiu. Obrigado por jogares Céu Partido.", OURO, 9)
	elseif tipo == "banner" then
		Hud.faixa(t, "", OURO, 3)
	elseif tipo == "item" then
		Hud.aviso("Obtiveste: " .. t, 4)
	elseif tipo == "eter" then
		local n = tonumber(t) or 0
		ganho = if os.clock() < ganhoAte then ganho + n else n
		ganhoAte = os.clock() + 2.5
	else
		Hud.aviso(t, 3)
	end
end

-- ---------------------------------------------------------------- menu do farol

local function fecharPaineis()
	for _, nome in { "menuFarol", "menuNivel", "menuViajar", "leitura", "ajuda" } do
		el[nome].Visible = false
	end
	GuiService.SelectedObject = nil
end

local function abrir(nome)
	fecharPaineis()
	el[nome].Visible = true
	estado.menu = true
	local primeiro = el[nome]:FindFirstChildWhichIsA("TextButton", true)
	if primeiro and UserInputService.GamepadEnabled then
		GuiService.SelectedObject = primeiro
	end
end

local function fecharTudo()
	fecharPaineis()
	estado.menu = false
end

local function desenharNivel()
	local p = el.menuNivel
	local custo = jogador:GetAttribute("CustoNivel") or 0
	local eter = jogador:GetAttribute("Eter") or 0
	p.Info.Text = string.format("Nível %d     Éter %d     Custo %d", jogador:GetAttribute("Nivel") or 1, eter, custo)
	p.Info.TextColor3 = if eter >= custo then TEXTO else Color3.fromRGB(220, 110, 90)
	for _, a in Config.ATRIBUTOS do
		local linha = p.Lista:FindFirstChild(a.id)
		if linha then
			linha.Valor.Text = tostring(jogador:GetAttribute(string.upper(string.sub(a.id, 1, 1)) .. string.sub(a.id, 2)) or 10)
			linha.Mais.Active = eter >= custo
			linha.Mais.TextTransparency = if eter >= custo then 0 else 0.6
		end
	end
	local hum = jogador.Character and jogador.Character:FindFirstChildOfClass("Humanoid")
	local arma = Config.ARMAS[jogador:GetAttribute("Arma") or Config.ARMA_INICIAL]
	local forca = jogador:GetAttribute("Forca") or 10
	p.Stats.Text = string.format("Vida %d     Energia %d     Dano %d",
		hum and hum.MaxHealth or 0, jogador:GetAttribute("EnergiaMax") or 0, math.floor(arma.dano * (1 + (forca - 10) * arma.escala)))
end

local function desenharViajar()
	local lista = el.menuViajar.Lista
	for _, f in lista:GetChildren() do
		if f:IsA("TextButton") then
			f:Destroy()
		end
	end
	local acesos = listaCsv("Farois")
	for i, f in Config.FAROIS do
		if acesos[f.id] then
			local b = botao({ Text = f.nome .. (if f.id == estado.farolAtual then "  (aqui)" else ""), LayoutOrder = i, Size = UDim2.new(1, 0, 0, 38), Parent = lista })
			b.Activated:Connect(function()
				if f.id == estado.farolAtual then
					return
				end
				fecharPaineis()
				Hud.fade(true, 0.6)
				task.delay(0.7, function()
					R.Menu:FireServer("viajar", f.id)
					task.delay(0.6, function()
						Hud.fade(false, 0.8)
					end)
				end)
			end)
		end
	end
end

function Hud.abrirFarol(id)
	estado.farolAtual = id
	Controles.mudarLocal("sentado")
	for _, f in Config.FAROIS do
		if f.id == id then
			el.menuFarol.Titulo.Text = f.nome
		end
	end
	abrir("menuFarol")
end

local function partir()
	fecharTudo()
	R.Menu:FireServer("partir")
	Controles.mudarLocal("levantar", 1.1)
	Controles.mostrarAcao("levantar", 1.1)
end

-- ---------------------------------------------------------------- construção

local function construir()
	gui = novo("ScreenGui", { Name = "CeuPartidoHud", ResetOnSpawn = false, IgnoreGuiInset = true, ZIndexBehavior = Enum.ZIndexBehavior.Sibling, Parent = jogador:WaitForChild("PlayerGui") })

	-- barras
	el.hp = barra("Vida", Color3.fromRGB(176, 34, 26), gui, UDim2.fromOffset(34, 34))
	el.en = barra("Energia", Color3.fromRGB(70, 140, 60), gui, UDim2.fromOffset(34, 52))
	el.en.Perda.Visible = false

	-- Orvalho e arma
	el.orvalho = novo("Frame", { Parent = gui, AnchorPoint = Vector2.new(0, 1), Position = UDim2.new(0, 34, 1, -40), Size = UDim2.fromOffset(64, 64),
		BackgroundColor3 = Color3.fromRGB(20, 16, 12), BackgroundTransparency = 0.25, BorderSizePixel = 0 }, {
		novo("UIStroke", { Color = Color3.fromRGB(110, 92, 60) }),
		novo("Frame", { Name = "Icone", AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.5), Size = UDim2.fromOffset(24, 34),
			BackgroundColor3 = Color3.fromRGB(255, 170, 70), BorderSizePixel = 0 }, { novo("UICorner", { CornerRadius = UDim.new(0.5, 0) }) }),
		texto({ Name = "Num", AnchorPoint = Vector2.new(1, 1), Position = UDim2.new(1, -4, 1, 0), Size = UDim2.fromOffset(30, 24), TextXAlignment = Enum.TextXAlignment.Right, TextSize = 22, Text = "3" }),
		texto({ Name = "Nome", AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.new(0.5, 0, 1, 2), Size = UDim2.fromOffset(150, 20), TextSize = 16, Text = "Orvalho Celeste" }),
	})
	el.arma = texto({ Parent = gui, AnchorPoint = Vector2.new(0, 1), Position = UDim2.new(0, 120, 1, -52), Size = UDim2.fromOffset(240, 26), TextXAlignment = Enum.TextXAlignment.Left, TextSize = 20, Text = "" })

	-- Éter
	el.eter = texto({ Parent = gui, AnchorPoint = Vector2.new(1, 1), Position = UDim2.new(1, -40, 1, -40), Size = UDim2.fromOffset(240, 34),
		TextXAlignment = Enum.TextXAlignment.Right, TextSize = 28, Font = FONTE_TITULO, Text = "0" })
	el.ganho = texto({ Parent = gui, AnchorPoint = Vector2.new(1, 1), Position = UDim2.new(1, -40, 1, -74), Size = UDim2.fromOffset(240, 24),
		TextXAlignment = Enum.TextXAlignment.Right, TextSize = 20, TextColor3 = Color3.fromRGB(200, 220, 255), Text = "" })

	-- chefe
	el.chefe = novo("Frame", { Parent = gui, AnchorPoint = Vector2.new(0.5, 1), Position = UDim2.new(0.5, 0, 1, -110), Size = UDim2.new(0.6, 0, 0, 46), BackgroundTransparency = 1, Visible = false })
	texto({ Name = "Nome", Parent = el.chefe, Size = UDim2.new(1, 0, 0, 26), TextXAlignment = Enum.TextXAlignment.Left, TextSize = 24, Font = FONTE_TITULO })
	local bc = barra("Barra", Color3.fromRGB(150, 30, 22), el.chefe, UDim2.fromOffset(0, 30))
	bc.Size = UDim2.new(1, 0, 0, 12)

	-- textos grandes
	el.faixa = novo("Frame", { Parent = gui, AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.45), Size = UDim2.new(1, 0, 0, 150),
		BackgroundColor3 = Color3.new(0, 0, 0), BackgroundTransparency = 1, BorderSizePixel = 0, Visible = false })
	el.faixaTitulo = texto({ Parent = el.faixa, Size = UDim2.new(1, 0, 0, 90), Position = UDim2.fromOffset(0, 10), TextSize = 72, Font = FONTE_TITULO, TextTransparency = 1 })
	el.faixaSub = texto({ Parent = el.faixa, Size = UDim2.new(1, 0, 0, 30), Position = UDim2.fromOffset(0, 100), TextSize = 24, TextTransparency = 1 })
	el.area = texto({ Parent = gui, AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.3), Size = UDim2.new(1, 0, 0, 60), TextSize = 44, Font = FONTE_TITULO, TextTransparency = 1 })
	el.aviso = texto({ Parent = gui, AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.fromScale(0.5, 0.13), Size = UDim2.new(1, 0, 0, 30), TextSize = 24, TextTransparency = 1 })
	el.fade = novo("Frame", { Parent = gui, Size = UDim2.fromScale(1, 1), BackgroundColor3 = Color3.new(0, 0, 0), BackgroundTransparency = 1, BorderSizePixel = 0, ZIndex = 50 })

	-- menu do farol
	el.menuFarol = painel("MenuFarol", UDim2.fromOffset(320, 250), UDim2.new(0, 220, 0.5, 0))
	texto({ Name = "Titulo", Parent = el.menuFarol, Size = UDim2.new(1, 0, 0, 34), TextSize = 26, Font = FONTE_TITULO, TextColor3 = OURO, Text = "Farol" })
	local lf = novo("Frame", { Name = "Botoes", Parent = el.menuFarol, Position = UDim2.fromOffset(0, 50), Size = UDim2.new(1, 0, 1, -50), BackgroundTransparency = 1 }, {
		novo("UIListLayout", { Padding = UDim.new(0, 8), SortOrder = Enum.SortOrder.LayoutOrder }),
	})
	local bNivel = botao({ Text = "Subir de nível", LayoutOrder = 1, Size = UDim2.new(1, 0, 0, 42), Parent = lf })
	local bViajar = botao({ Text = "Viajar", LayoutOrder = 2, Size = UDim2.new(1, 0, 0, 42), Parent = lf })
	local bPartir = botao({ Text = "Partir", LayoutOrder = 3, Size = UDim2.new(1, 0, 0, 42), Parent = lf })
	bNivel.Activated:Connect(function()
		desenharNivel()
		abrir("menuNivel")
	end)
	bViajar.Activated:Connect(function()
		desenharViajar()
		abrir("menuViajar")
	end)
	bPartir.Activated:Connect(partir)

	-- subir de nível
	el.menuNivel = painel("MenuNivel", UDim2.fromOffset(520, 360), UDim2.fromScale(0.5, 0.5))
	texto({ Parent = el.menuNivel, Size = UDim2.new(1, 0, 0, 34), TextSize = 26, Font = FONTE_TITULO, TextColor3 = OURO, Text = "Subir de nível" })
	texto({ Name = "Info", Parent = el.menuNivel, Position = UDim2.fromOffset(0, 42), Size = UDim2.new(1, 0, 0, 26), TextSize = 21 })
	local lista = novo("Frame", { Name = "Lista", Parent = el.menuNivel, Position = UDim2.fromOffset(0, 80), Size = UDim2.new(1, 0, 0, 170), BackgroundTransparency = 1 }, {
		novo("UIListLayout", { Padding = UDim.new(0, 6), SortOrder = Enum.SortOrder.LayoutOrder }),
	})
	for i, a in Config.ATRIBUTOS do
		local linha = novo("Frame", { Name = a.id, Parent = lista, LayoutOrder = i, Size = UDim2.new(1, 0, 0, 50), BackgroundTransparency = 1 })
		texto({ Parent = linha, Size = UDim2.new(0.6, 0, 0, 26), TextXAlignment = Enum.TextXAlignment.Left, TextSize = 22, Text = a.nome })
		texto({ Parent = linha, Position = UDim2.fromOffset(0, 24), Size = UDim2.new(0.6, 0, 0, 20), TextXAlignment = Enum.TextXAlignment.Left, TextSize = 16,
			TextColor3 = Color3.fromRGB(170, 160, 140), Text = a.descricao })
		texto({ Name = "Valor", Parent = linha, Position = UDim2.new(0.6, 0, 0, 0), Size = UDim2.new(0.2, 0, 0, 40), TextSize = 26, Text = "10" })
		local mais = botao({ Name = "Mais", Parent = linha, Text = "+", Position = UDim2.new(1, -50, 0, 2), Size = UDim2.fromOffset(46, 38), TextSize = 28 })
		mais.Activated:Connect(function()
			R.Menu:FireServer("subir", a.id)
			task.delay(0.35, desenharNivel)
		end)
	end
	texto({ Name = "Stats", Parent = el.menuNivel, Position = UDim2.new(0, 0, 1, -90), Size = UDim2.new(1, 0, 0, 26), TextSize = 20, TextColor3 = Color3.fromRGB(200, 190, 170) })
	local voltarN = botao({ Parent = el.menuNivel, Text = "Voltar", AnchorPoint = Vector2.new(1, 1), Position = UDim2.fromScale(1, 1), Size = UDim2.fromOffset(140, 38) })
	voltarN.Activated:Connect(function()
		abrir("menuFarol")
	end)

	-- viajar
	el.menuViajar = painel("MenuViajar", UDim2.fromOffset(420, 420), UDim2.fromScale(0.5, 0.5))
	texto({ Parent = el.menuViajar, Size = UDim2.new(1, 0, 0, 34), TextSize = 26, Font = FONTE_TITULO, TextColor3 = OURO, Text = "Viajar para…" })
	novo("Frame", { Name = "Lista", Parent = el.menuViajar, Position = UDim2.fromOffset(0, 48), Size = UDim2.new(1, 0, 1, -100), BackgroundTransparency = 1 }, {
		novo("UIListLayout", { Padding = UDim.new(0, 6), SortOrder = Enum.SortOrder.LayoutOrder }),
	})
	local voltarV = botao({ Parent = el.menuViajar, Text = "Voltar", AnchorPoint = Vector2.new(1, 1), Position = UDim2.fromScale(1, 1), Size = UDim2.fromOffset(140, 38) })
	voltarV.Activated:Connect(function()
		abrir("menuFarol")
	end)

	-- inscrições
	el.leitura = painel("Leitura", UDim2.fromOffset(560, 230), UDim2.fromScale(0.5, 0.5))
	el.leitura.BackgroundColor3 = Color3.fromRGB(20, 26, 34)
	texto({ Parent = el.leitura, Size = UDim2.new(1, 0, 0, 30), TextSize = 22, Font = FONTE_TITULO, TextColor3 = Color3.fromRGB(150, 215, 255), Text = "Inscrição" })
	texto({ Name = "Texto", Parent = el.leitura, Position = UDim2.fromOffset(0, 40), Size = UDim2.new(1, 0, 1, -90), TextSize = 24, TextWrapped = true, Font = Enum.Font.Garamond })
	local fecharL = botao({ Parent = el.leitura, Text = "Fechar", AnchorPoint = Vector2.new(0.5, 1), Position = UDim2.fromScale(0.5, 1), Size = UDim2.fromOffset(160, 38) })
	fecharL.Activated:Connect(fecharTudo)

	-- ajuda dos controlos
	el.ajuda = painel("Ajuda", UDim2.fromOffset(620, 470), UDim2.fromScale(0.5, 0.5))
	texto({ Parent = el.ajuda, Size = UDim2.new(1, 0, 0, 30), TextSize = 26, Font = FONTE_TITULO, TextColor3 = OURO, Text = "Controlos" })
	local linhas = {
		{ "Mover / saltar", "WASD / Espaço", "Manípulo esq. / A" },
		{ "Planar (no ar)", "Espaço outra vez", "A outra vez" },
		{ "Ataque leve", "Botão esquerdo", "RB" },
		{ "Ataque forte", "F", "RT" },
		{ "Bloquear", "Botão direito", "LB" },
		{ "Esquivar / correr", "Shift (tocar / manter)", "B (tocar / manter)" },
		{ "Orvalho (curar)", "R", "X" },
		{ "Fixar alvo", "Q / botão do meio", "R3" },
		{ "Trocar de arma", "X", "Cruz para cima" },
		{ "Interagir", "E", "Y" },
		{ "Esta ajuda", "H", "—" },
	}
	for i, l in linhas do
		local y = 40 + (i - 1) * 32
		texto({ Parent = el.ajuda, Position = UDim2.fromOffset(0, y), Size = UDim2.new(0.36, 0, 0, 30), TextXAlignment = Enum.TextXAlignment.Left, Text = l[1] })
		texto({ Parent = el.ajuda, Position = UDim2.new(0.36, 0, 0, y), Size = UDim2.new(0.34, 0, 0, 30), TextXAlignment = Enum.TextXAlignment.Left, TextColor3 = OURO, Text = l[2] })
		texto({ Parent = el.ajuda, Position = UDim2.new(0.7, 0, 0, y), Size = UDim2.new(0.3, 0, 0, 30), TextXAlignment = Enum.TextXAlignment.Left, TextColor3 = OURO, Text = l[3] })
	end
	local fecharA = botao({ Parent = el.ajuda, Text = "Fechar", AnchorPoint = Vector2.new(0.5, 1), Position = UDim2.fromScale(0.5, 1), Size = UDim2.fromOffset(160, 38) })
	fecharA.Activated:Connect(fecharTudo)

	-- mira do alvo fixo
	el.mira = novo("BillboardGui", { Name = "Mira", Parent = gui, Size = UDim2.fromOffset(18, 18), AlwaysOnTop = true, Enabled = false }, {
		novo("Frame", { Size = UDim2.fromScale(1, 1), BackgroundColor3 = Color3.new(1, 1, 1), BackgroundTransparency = 0.1, BorderSizePixel = 0 }, {
			novo("UICorner", { CornerRadius = UDim.new(0.5, 0) }),
			novo("UIStroke", { Color = Color3.new(0, 0, 0), Transparency = 0.5, Thickness = 1.5 }),
		}),
	})
end

-- ---------------------------------------------------------------- atualização

local function tamanhoBarra(fundo, larg)
	fundo.Size = UDim2.fromOffset(larg, fundo.Size.Y.Offset)
end

local ultimaIlha = nil
local tIlha = 0
local tPrompts = 0

local function ajustarPrompts()
	-- textos e visibilidade dos prompts conforme o progresso deste jogador
	local acesos = listaCsv("Farois")
	local abertos = listaCsv("Relicarios")
	local mundo = workspace:FindFirstChild("Mundo")
	local inter = mundo and mundo:FindFirstChild("Interativos")
	if inter then
		for _, p in inter:GetDescendants() do
			if p:IsA("ProximityPrompt") then
				local f = p:GetAttribute("Farol")
				local r = p:GetAttribute("Relicario")
				if f then
					p.ActionText = if acesos[f] then "Descansar" else "Acender"
				elseif r then
					p.Enabled = not abertos[r]
					local tampa = p.Parent and p.Parent.Parent and p.Parent.Parent:FindFirstChild("Tampa")
					if tampa and abertos[r] then
						tampa.Transparency = 1
						local brilho = tampa:FindFirstChildWhichIsA("ParticleEmitter")
						if brilho then
							brilho.Enabled = false
						end
					end
				end
			end
		end
	end
	local ecos = workspace:FindFirstChild("Ecos")
	if ecos then
		for _, p in ecos:GetDescendants() do
			if p:IsA("ProximityPrompt") then
				p.Enabled = p:GetAttribute("Dono") == jogador.UserId
			end
		end
	end
end

local function atualizar(dt)
	local c = jogador.Character
	local hum = c and c:FindFirstChildOfClass("Humanoid")
	local vp = workspace.CurrentCamera.ViewportSize
	if hum then
		local larg = math.min(vp.X * 0.45, hum.MaxHealth * 0.62)
		tamanhoBarra(el.hp, larg)
		local f = math.clamp(hum.Health / hum.MaxHealth, 0, 1)
		el.hp.Valor.Size = UDim2.fromScale(f, 1)
		vidaVisivel = if hum.Health > vidaVisivel then hum.Health else vidaVisivel + (hum.Health - vidaVisivel) * math.min(1, dt * 2.5)
		el.hp.Perda.Size = UDim2.fromScale(math.clamp(vidaVisivel / hum.MaxHealth, 0, 1), 1)
	end
	local enMax = jogador:GetAttribute("EnergiaMax") or 100
	tamanhoBarra(el.en, math.min(vp.X * 0.4, enMax * 1.9))
	el.en.Valor.Size = UDim2.fromScale(math.clamp((jogador:GetAttribute("Energia") or 0) / enMax, 0, 1), 1)
	local orv = jogador:GetAttribute("Orvalho") or 0
	el.orvalho.Num.Text = tostring(orv)
	el.orvalho.Icone.BackgroundColor3 = if orv > 0 then Color3.fromRGB(255, 170, 70) else Color3.fromRGB(80, 70, 60)
	local arma = Config.ARMAS[jogador:GetAttribute("Arma") or Config.ARMA_INICIAL]
	el.arma.Text = if arma then arma.nome else ""

	-- Éter a contar
	local eter = jogador:GetAttribute("Eter") or 0
	if eterMostrado ~= eter then
		local d = eter - eterMostrado
		local passo = math.max(1, math.ceil(math.abs(d) * math.min(1, dt * 4)))
		eterMostrado += math.sign(d) * passo
		if math.sign(eter - eterMostrado) ~= math.sign(d) then
			eterMostrado = eter
		end
	end
	el.eter.Text = tostring(eterMostrado)
	el.ganho.Text = if os.clock() < ganhoAte then "+" .. ganho else ""

	-- chefe
	if chefeModelo and chefeModelo.Parent and (chefeModelo:GetAttribute("Vida") or 0) > 0 then
		el.chefe.Visible = true
		el.chefe.Nome.Text = chefeModelo.Name
		local v = chefeModelo:GetAttribute("Vida") or 0
		local m = chefeModelo:GetAttribute("VidaMax") or 1
		el.chefe.Barra.Valor.Size = UDim2.fromScale(math.clamp(v / m, 0, 1), 1)
		local perda = el.chefe.Barra.Perda
		local alvoP = math.clamp(v / m, 0, 1)
		perda.Size = UDim2.fromScale(perda.Size.X.Scale + (alvoP - perda.Size.X.Scale) * math.min(1, dt * 2.5), 1)
	else
		el.chefe.Visible = false
	end

	-- barras dos inimigos (só depois de levarem dano, ou com o alvo fixo)
	local pasta = workspace:FindFirstChild("Inimigos")
	if pasta then
		local agoraS = workspace:GetServerTimeNow()
		for _, m in pasta:GetChildren() do
			local cabeca = m:FindFirstChild("Head")
			local bb = cabeca and cabeca:FindFirstChild("BarraVida")
			if bb then
				local vida = m:GetAttribute("Vida") or 0
				local recente = agoraS - (m:GetAttribute("UltimoDano") or -100) < 4
				bb.Enabled = vida > 0 and not m:GetAttribute("Chefe") and (recente or estado.alvo == m)
				if bb.Enabled then
					local fr = bb:FindFirstChildWhichIsA("Frame")
					local valor = fr and fr:FindFirstChild("Valor")
					if valor then
						valor.Size = UDim2.fromScale(math.clamp(vida / (m:GetAttribute("VidaMax") or 1), 0, 1), 1)
					end
				end
			end
		end
	end

	-- mira
	local alvo = estado.alvo
	local raizA = alvo and alvo:FindFirstChild("UpperTorso")
	if raizA then
		el.mira.Adornee = raizA
	end
	el.mira.Enabled = raizA ~= nil

	-- nome da ilha
	tIlha -= dt
	if tIlha <= 0 and c then
		tIlha = 0.5
		local raiz = c:FindFirstChild("HumanoidRootPart")
		if raiz then
			local atual = nil
			for _, ilha in Config.ILHAS do
				local d = Vector2.new(raiz.Position.X - ilha.centro.X, raiz.Position.Z - ilha.centro.Z).Magnitude
				if d < ilha.raio * 1.05 and math.abs(raiz.Position.Y - ilha.centro.Y) < 60 then
					atual = ilha.nome
				end
			end
			if atual and atual ~= ultimaIlha then
				Hud.area(atual)
			end
			if atual then
				ultimaIlha = atual
			end
		end
	end
	tPrompts -= dt
	if tPrompts <= 0 then
		tPrompts = 1
		ajustarPrompts()
	end
end

function Hud.personagemNova(personagem)
	vidaVisivel = 0
	Hud.fade(false, 1.2)
	local hum = personagem:WaitForChild("Humanoid", 10)
	if hum then
		hum.Died:Connect(function()
			estado.alvo = nil
			fecharTudo()
			task.delay(4.6, function()
				Hud.fade(true, 0.9)
			end)
		end)
	end
end

function Hud.iniciar(est, remotos, controles)
	estado = est
	R = remotos
	Controles = controles
	pcall(function()
		StarterGui:SetCoreGuiEnabled(Enum.CoreGuiType.Backpack, false)
		StarterGui:SetCoreGuiEnabled(Enum.CoreGuiType.Health, false)
	end)
	construir()
	R.Aviso.OnClientEvent:Connect(tratarAviso)
	R.Farol.OnClientEvent:Connect(Hud.abrirFarol)
	R.Chefe.OnClientEvent:Connect(function(m)
		chefeModelo = m
		if m then
			el.chefe.Barra.Perda.Size = UDim2.fromScale(1, 1)
		end
	end)
	ProximityPromptService.PromptTriggered:Connect(function(prompt)
		if prompt.Name == "Inscricao" then
			el.leitura.Texto.Text = "«" .. tostring(prompt:GetAttribute("Texto")) .. "»"
			abrir("leitura")
		end
	end)
	UserInputService.InputBegan:Connect(function(input, processado)
		if processado then
			return
		end
		if input.KeyCode == Enum.KeyCode.H then
			if el.ajuda.Visible then
				el.ajuda.Visible = false
				if estado.menu and not (el.menuFarol.Visible or el.menuNivel.Visible or el.menuViajar.Visible or el.leitura.Visible) then
					estado.menu = false
				end
			elseif not estado.menu then
				abrir("ajuda")
			end
		elseif input.KeyCode == Enum.KeyCode.ButtonB and estado.menu then
			if el.menuFarol.Visible then
				partir()
			elseif el.menuNivel.Visible or el.menuViajar.Visible then
				abrir("menuFarol")
			else
				fecharTudo()
			end
		end
	end)
	RunService.RenderStepped:Connect(atualizar)
	-- mostra a ajuda na primeira entrada, sem bloquear os controlos (some sozinha ou com H)
	task.delay(2, function()
		if not estado.menu then
			el.ajuda.Visible = true
			task.delay(14, function()
				if el.ajuda.Visible and not estado.menu then
					el.ajuda.Visible = false
				end
			end)
		end
	end)
end

return Hud

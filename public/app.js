// Leitor de jogos: só carrega o jogo quando se carrega em «Jogar».
const leitor = document.getElementById('leitor');
const botaoJogar = document.getElementById('botao-jogar');

if (leitor && botaoJogar) {
  botaoJogar.addEventListener('click', () => {
    const iframe = document.createElement('iframe');
    iframe.src = leitor.dataset.url;
    iframe.title = 'Jogo';
    iframe.allow = 'fullscreen; autoplay; gamepad; clipboard-write';
    iframe.allowFullscreen = true;
    if (leitor.dataset.externo) {
      iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-pointer-lock allow-forms allow-popups');
    }
    leitor.replaceChildren(iframe);
    iframe.focus();
    fetch(leitor.dataset.jogada, { method: 'POST' }).catch(() => {});
  });

  document.getElementById('botao-ecra-inteiro')?.addEventListener('click', () => {
    if (!leitor.querySelector('iframe')) botaoJogar.click();
    leitor.requestFullscreen?.();
  });
}

// Confirmação antes de ações destrutivas.
document.querySelectorAll('form[data-confirmar]').forEach((form) => {
  form.addEventListener('submit', (evento) => {
    if (!confirm(form.dataset.confirmar)) evento.preventDefault();
  });
});

// Formulário de jogo: mostra apenas os campos do tipo escolhido.
const formJogo = document.getElementById('formulario-jogo');
if (formJogo) {
  const atualizar = () => {
    const tipo = formJogo.querySelector('input[name="tipo"]:checked')?.value;
    formJogo.querySelectorAll('.campo-tipo').forEach((campo) => {
      campo.hidden = campo.dataset.tipo !== tipo;
    });
  };
  formJogo.querySelectorAll('input[name="tipo"]').forEach((r) => r.addEventListener('change', atualizar));
  atualizar();

  formJogo.addEventListener('submit', () => {
    const botao = formJogo.querySelector('button[type="submit"]');
    botao.disabled = true;
    botao.textContent = botao.dataset.aEnviar;
  });
}

// Mostra o nome do ficheiro escolhido nos seletores de ficheiros.
document.querySelectorAll('.seletor-ficheiro input[type="file"]').forEach((input) => {
  input.addEventListener('change', () => {
    const nome = input.closest('.seletor-ficheiro').querySelector('.nome-ficheiro');
    nome.textContent = input.files[0]?.name || 'Nenhum ficheiro escolhido';
  });
});

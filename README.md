⏱️ Bakragore Timer & LootSplit
Ferramenta web para caçadas de boss no Tibia — reúne um timer de mecânica de boss com alertas sonoros, um divisor automático de loot e uma calculadora de custo de imbuements, tudo em uma única página, sem dependências externas.
Construído 100% em HTML, CSS e JavaScript puro — sem frameworks, sem build step, sem backend. Abre em qualquer navegador e roda inteiramente no lado do cliente.
---
🔗 Demo
👉 Acessar o site (https://guiipaes.github.io/bakragore-timer-lootsplit/)
---
✨ Funcionalidades
⏱️ Timer Bakragore
Timer de 1min30s, sincronizado com a mecânica de Rotten Charge do boss Bakragore
Alertas sonoros automáticos: aviso aos 10s restantes, contagem regressiva nos últimos 5s, e um som diferente no exato momento em que a Rotten Charge dispara
Controle de volume individual para cada som, com opção de mudo
Sessão limitada a 25 minutos, respeitando a duração máxima do combate
Botões de teste (−30s / −15s) para agilizar verificações sem esperar o ciclo inteiro
Modo Picture-in-Picture — o timer flutua numa janela separada, sempre visível por cima do jogo, com play/pause e reset direto por lá
💰 LootSplit
Cola o texto copiado do Party Hunt Analyser do Tibia e calcula a divisão justa do loot automaticamente
Gera a lista de transferências mínimas necessárias (quem paga quanto pra quem), no formato pronto pra usar no comando `Transfer` do jogo
Permite excluir jogadores específicos da divisão (ex: alguém que ajudou mas não participa do loot)
Botão de copiar tudo, com resumo formatado pronto pra colar no chat de voz da equipe (TeamSpeak/Discord)
Histórico de sessões salvo automaticamente no navegador — dá pra recarregar cálculos antigos a qualquer momento
🧪 Calculadora de Imbuements
Cola o texto do Hunt Analyser (solo) e lê o tempo da sessão, Loot, Supplies e Balance
Você informa só o imbuement, o tier (Basic, Intricate ou Powerful) e a quantidade de cada um
Mostra o custo de imbuements por hora, o gasto na sessão colada, o lucro depois dos imbuements e o loot mínimo por hora para empatar
Preços dos materiais editáveis (começam no valor de NPC) e opção de comprar com Gold Tokens em Strike, Vampirism e Void
Tudo fica salvo no navegador (localStorage)
---
🛠️ Tecnologias
HTML5 + CSS3 (variáveis CSS, Flexbox/Grid, sem frameworks)
JavaScript vanilla (sem bibliotecas externas)
Web Audio API — geração de sons em tempo real (sem arquivos de áudio)
Document Picture-in-Picture API — janela flutuante nativa do navegador
`localStorage` — persistência do histórico de LootSplit
Fontes: JetBrains Mono + Space Grotesk via Google Fonts
---
🚀 Como usar
Não precisa instalar nada. Duas opções:
1. Acesse direto pelo link publicado (veja seção Demo)
2. Rode localmente:
```bash
git clone https://github.com/seu-usuario/bakragore-timer.git
cd bakragore-timer
```
Depois é só abrir o `index.html` no navegador (duplo clique ou arrastar pra aba do Chrome/Edge).
---
📋 Como funciona o LootSplit
No Tibia, abra o Party Hunt Analyser e copie o texto (botão direito → Copy to clipboard)
Cole na aba LootSplit do site
Clique em Calcular Split
Desmarque, se necessário, algum jogador que não deva entrar na divisão
Copie as transferências individuais ou o resumo completo pra compartilhar com o grupo
O cálculo usa um algoritmo de acerto de contas mínimo (parecido com o usado em apps de divisão de despesas): em vez de todo mundo pagar todo mundo, ele encontra o menor número possível de transferências para equilibrar o grupo.
---
🧪 Como funciona a Calculadora de Imbuements
No Tibia, abra o Hunt Analyser e copie os dados da sessão
Cole na aba Imbuements, no campo 1. Hunt Analyser
Em 2. Seus imbuements, adicione cada imbuement que você mantém ligado e a quantidade (Void Powerful em duas peças = Void, III, quantidade 2)
Ajuste os preços dos materiais para o que você paga no seu servidor
O custo por hora de cada imbuement é (materiais + taxa do NPC) ÷ 20 horas, vezes a quantidade. O gasto da sessão é esse valor vezes o tempo da sessão colada
Taxa do NPC por slot: Basic 7.500, Intricate 60.000, Powerful 250.000 gp
Materiais marcados como "referência" podem estar desatualizados: confira no jogo
---
🎨 Design
Paleta em tons de roxo, inspirada nas cores usadas no jogo. Interface pensada para ser lida rapidamente durante o combate — texto grande, alto contraste, feedback sonoro para não depender de olhar a tela o tempo todo.
---
📌 Compatibilidade
Recurso	Navegadores suportados
Timer, sons, LootSplit	Todos os navegadores modernos
Picture-in-Picture	Chrome / Edge (recentes)
Histórico salvo (localStorage)	Todos, exceto navegação anônima/privada
---
📄 Licença
Projeto pessoal, de uso livre. Sinta-se à vontade para copiar, adaptar e usar em suas próprias caçadas.
---
<div align="center">
Feito para facilitar caçadas de boss e divisões de dinheiro no Tibia 🗡️
</div>

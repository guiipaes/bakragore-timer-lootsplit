// ===========================================================
// TIMER BAKRAGORE — lógica do timer da Rotten Charge + PIP
// ===========================================================
(function(){
  const REST_TIME = 90;      // 1min30s (intervalo da Rotten Charge)
  const SESSION_TIME = 25 * 60; // 25 min

  const ring = document.getElementById('ring');
  const timeEl = document.getElementById('time');
  const phaseLabelEl = document.getElementById('phaseLabel');
  const cycleNoteEl = document.getElementById('cycleNote');
  const sessionLabelEl = document.getElementById('sessionLabel');
  const sessionFillEl = document.getElementById('sessionFill');
  const toggleBtn = document.getElementById('toggleBtn');
  const resetBtn = document.getElementById('resetBtn');
  const pipBtn = document.getElementById('pipBtn');
  const pipHintEl = document.getElementById('pipHint');
  const add30Btn = document.getElementById('sub30Btn');
  const add15Btn = document.getElementById('sub15Btn');
  const statusEl = document.getElementById('status');

  const CIRC = 2 * Math.PI * 122;
  ring.setAttribute('stroke-dasharray', CIRC.toFixed(1));

  let phaseRemaining = REST_TIME;
  let sessionElapsed = 0;
  let cycle = 1;
  let running = false;
  let intervalId = null;

  // ---------- Volumes / mute por som ----------
  const sound = {
    warn:   { vol: 0.7, muted: false },
    count5: { vol: 0.7, muted: false },
    start:  { vol: 0.7, muted: false }
  };

  function wireSoundControl(key, sliderId, muteBtnId, pctId){
    const slider = document.getElementById(sliderId);
    const muteBtn = document.getElementById(muteBtnId);
    const pctEl = document.getElementById(pctId);
    slider.addEventListener('input', () => {
      sound[key].vol = Number(slider.value) / 100;
      pctEl.textContent = slider.value + '%';
    });
    muteBtn.addEventListener('click', () => {
      sound[key].muted = !sound[key].muted;
      muteBtn.classList.toggle('muted', sound[key].muted);
      muteBtn.textContent = sound[key].muted ? '🔇' : '🔊';
    });
  }
  wireSoundControl('warn',   'volWarn',   'muteWarn',   'pctWarn');
  wireSoundControl('count5', 'volCount5', 'muteCount5', 'pctCount5');
  wireSoundControl('start',  'volStart',  'muteStart',  'pctStart');

  function effectiveVol(key){
    return sound[key].muted ? 0 : sound[key].vol;
  }

  // ---------- Beeps via Web Audio API ----------
  let audioCtx = null;
  function getAudioCtx(){
    if(!audioCtx){
      const AC = window.AudioContext || window.webkitAudioContext;
      if(AC) audioCtx = new AC();
    }
    if(audioCtx && audioCtx.state === 'suspended'){
      audioCtx.resume();
    }
    return audioCtx;
  }

  function playTone(freq, duration, volKey, opts){
    const gainMax = effectiveVol(volKey);
    if(gainMax <= 0) return;
    const ctx = getAudioCtx();
    if(!ctx) return;
    const type = (opts && opts.type) || 'sine';
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(gainMax * 0.5, now + 0.01);
    gain.gain.linearRampToValueAtTime(0, now + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  // Bip único ao restar 10s de descanso
  function beepWarnTen(){
    playTone(880, 0.18, 'warn', { type:'triangle' });
  }
  // Bip curto, um por segundo, nos últimos 5s de descanso
  function beepCountFive(){
    playTone(660, 0.12, 'count5', { type:'square' });
  }
  // Bip diferente ao chegar a 0 — Rotten Charge dispara e o ciclo reinicia
  function beepRottenCharge(){
    playTone(1200, 0.3, 'start', { type:'sawtooth' });
    setTimeout(() => playTone(1500, 0.25, 'start', { type:'sawtooth' }), 120);
  }

  function fmt(s){
    const m = Math.floor(s/60);
    const sec = s % 60;
    return String(m).padStart(2,'0') + ':' + String(sec).padStart(2,'0');
  }

  function render(){
    timeEl.textContent = fmt(phaseRemaining);
    cycleNoteEl.textContent = 'ciclo ' + cycle;
    sessionLabelEl.textContent = fmt(sessionElapsed) + ' / ' + fmt(SESSION_TIME);
    sessionFillEl.style.width = Math.min(100, (sessionElapsed / SESSION_TIME) * 100) + '%';
    pipSessionLabelEl.textContent = fmt(sessionElapsed) + ' / ' + fmt(SESSION_TIME);
    pipSessionFillEl.style.width = Math.min(100, (sessionElapsed / SESSION_TIME) * 100) + '%';

    const fraction = phaseRemaining / REST_TIME;
    ring.setAttribute('stroke-dashoffset', (CIRC * (1 - fraction)).toFixed(1));
  }

  function tick(){
    if(sessionElapsed >= SESSION_TIME){
      finishSession();
      return;
    }

    phaseRemaining -= 1;
    sessionElapsed += 1;

    // 10s restantes: bip único de aviso
    if(phaseRemaining === 10){
      beepWarnTen();
    }
    // últimos 5s: um bip por segundo (5,4,3,2,1)
    if(phaseRemaining >= 1 && phaseRemaining <= 5){
      beepCountFive();
    }

    if(phaseRemaining <= 0){
      beepRottenCharge(); // Rotten Charge disparou — bip diferente
      phaseRemaining = REST_TIME;
      cycle += 1;
    }

    render();

    if(sessionElapsed >= SESSION_TIME){
      finishSession();
    }
  }

  function finishSession(){
    stop();
    statusEl.textContent = 'Sessão de 25 minutos concluída. 🎉';
    statusEl.classList.add('done');
    toggleBtn.disabled = true;
    pipToggleBtn.disabled = true;
  }

  function start(){
    if(running) return;
    getAudioCtx(); // desbloqueia o áudio a partir do gesto do usuário
    running = true;
    toggleBtn.textContent = 'Pausar';
    toggleBtn.classList.add('pause');
    pipToggleBtn.textContent = '⏸';
    pipToggleBtn.classList.add('pause');
    statusEl.textContent = '';
    statusEl.classList.remove('done');
    intervalId = setInterval(tick, 1000);
  }

  function stop(){
    running = false;
    toggleBtn.textContent = 'Continuar';
    toggleBtn.classList.remove('pause');
    pipToggleBtn.textContent = '▶';
    pipToggleBtn.classList.remove('pause');
    if(intervalId){ clearInterval(intervalId); intervalId = null; }
  }

  function reset(){
    stop();
    phaseRemaining = REST_TIME;
    sessionElapsed = 0;
    cycle = 1;
    toggleBtn.textContent = 'Iniciar';
    toggleBtn.disabled = false;
    pipToggleBtn.textContent = '▶';
    pipToggleBtn.disabled = false;
    statusEl.textContent = '';
    statusEl.classList.remove('done');
    render();
  }

  function subtractTime(seconds){
    const before = phaseRemaining;
    // mantém pelo menos 1s para o próximo tick cuidar da transição de fase normalmente
    phaseRemaining = Math.max(1, phaseRemaining - seconds);
    const actualCut = before - phaseRemaining;

    // avança a sessão total (25min) na mesma proporção do tempo pulado
    sessionElapsed = Math.min(SESSION_TIME, sessionElapsed + actualCut);

    if(sessionElapsed >= SESSION_TIME){
      finishSession();
      return;
    }

    render();
  }

  toggleBtn.addEventListener('click', function(){
    if(running) stop(); else start();
  });
  resetBtn.addEventListener('click', reset);
  add30Btn.addEventListener('click', () => subtractTime(30));
  add15Btn.addEventListener('click', () => subtractTime(15));

  // ---------- Picture-in-Picture (janela flutuante sempre por cima) ----------
  const stageEl = document.getElementById('stageBox');
  const stageParent = stageEl.parentNode;
  const stageNextSibling = stageEl.nextSibling;

  const pipPanel = document.getElementById('pipPanel');
  const pipPanelParent = pipPanel.parentNode;
  const pipPanelNextSibling = pipPanel.nextSibling;

  const pipStageSlot = document.getElementById('pipStageSlot');
  const pipToggleBtn = document.getElementById('pipToggleBtn');
  const pipResetBtn = document.getElementById('pipResetBtn');
  const pipSessionLabelEl = document.getElementById('pipSessionLabel');
  const pipSessionFillEl = document.getElementById('pipSessionFill');

  let pipWindow = null;

  function copyStylesInto(targetDoc){
    [...document.styleSheets].forEach(sheet => {
      try{
        const rulesText = [...sheet.cssRules].map(r => r.cssText).join('\n');
        const styleTag = targetDoc.createElement('style');
        styleTag.textContent = rulesText;
        targetDoc.head.appendChild(styleTag);
      }catch(e){ /* stylesheet cross-origin, ignora */ }
    });
  }

  function returnPipContentToMainPage(){
    // devolve o círculo pro lugar original dele na página
    if(stageNextSibling){
      stageParent.insertBefore(stageEl, stageNextSibling);
    } else {
      stageParent.appendChild(stageEl);
    }
    // devolve o painel de PIP pro lugar original dele (oculto)
    if(pipPanelNextSibling){
      pipPanelParent.insertBefore(pipPanel, pipPanelNextSibling);
    } else {
      pipPanelParent.appendChild(pipPanel);
    }
  }

  async function openPip(){
    if(!('documentPictureInPicture' in window)){
      pipHintEl.textContent = 'PIP não suportado neste navegador/ambiente. Use Chrome ou Edge, fora de um iframe.';
      return;
    }
    try{
      pipWindow = await documentPictureInPicture.requestWindow({ width: 210, height: 170 });
    }catch(e){
      pipHintEl.textContent = 'Não foi possível abrir o PIP: ' + e.message;
      return;
    }

    copyStylesInto(pipWindow.document);
    pipStageSlot.appendChild(stageEl);         // move o círculo pro slot do painel
    pipWindow.document.body.classList.add('pip-mode');
    pipWindow.document.body.appendChild(pipPanel); // move o painel inteiro pra janela de PIP

    pipHintEl.textContent = '';
    pipBtn.textContent = 'Fechar PIP';

    pipWindow.addEventListener('pagehide', () => {
      returnPipContentToMainPage();
      pipWindow = null;
      pipBtn.textContent = '🗔 PIP';
    }, { once: true });
  }

  function closePip(){
    if(pipWindow) pipWindow.close();
  }

  pipBtn.addEventListener('click', () => {
    if(pipWindow) closePip(); else openPip();
  });

  // botão Iniciar/Pausar dentro do PIP faz a mesma coisa que o botão principal
  pipToggleBtn.addEventListener('click', function(){
    if(running) stop(); else start();
  });
  pipResetBtn.addEventListener('click', reset);

  if(!('documentPictureInPicture' in window)){
    pipHintEl.textContent = 'PIP requer Chrome/Edge recentes, fora de um iframe restrito.';
  }

  render();
})();


// ===========================================================
// LOOTSPLIT — abas, parser do Party Hunt Analyser e cálculo do split
// ===========================================================
(function(){
  // ---------- Abas ----------
  const tabBtnTimer = document.getElementById('tabBtnTimer');
  const tabBtnLoot = document.getElementById('tabBtnLoot');
  const panelTimer = document.getElementById('panelTimer');
  const panelLoot = document.getElementById('panelLoot');

  function activateTab(name){
    const isTimer = name === 'timer';
    tabBtnTimer.classList.toggle('active', isTimer);
    tabBtnLoot.classList.toggle('active', !isTimer);
    panelTimer.classList.toggle('active', isTimer);
    panelLoot.classList.toggle('active', !isTimer);
  }
  tabBtnTimer.addEventListener('click', () => activateTab('timer'));
  tabBtnLoot.addEventListener('click', () => activateTab('loot'));

  // ---------- LootSplit ----------
  const lootInput = document.getElementById('lootInput');
  const lootCalcBtn = document.getElementById('lootCalcBtn');
  const lootClearBtn = document.getElementById('lootClearBtn');
  const lootErrorEl = document.getElementById('lootError');
  const lootResultsEl = document.getElementById('lootResults');
  const lootTotalBalanceEl = document.getElementById('lootTotalBalance');
  const lootEqualShareEl = document.getElementById('lootEqualShare');
  const lootTableBodyEl = document.getElementById('lootTableBody');
  const lootTransfersListEl = document.getElementById('lootTransfersList');
  const lootCopyAllBtn = document.getElementById('lootCopyAllBtn');

  let lastComputation = null; // guarda o último cálculo pro botão "Copiar tudo"

  function parseNumber(str){
    const clean = String(str).replace(/[^\d-]/g, '');
    const n = parseInt(clean, 10);
    return isNaN(n) ? 0 : n;
  }

  function fmtMoney(n){
    const rounded = Math.round(n);
    return rounded.toLocaleString('pt-BR');
  }

  // ---------- Copiar pra área de transferência ----------
  function fallbackCopy(text){
    let ok = false;
    try{
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      ok = document.execCommand('copy');
      document.body.removeChild(ta);
    }catch(e){ ok = false; }
    return ok;
  }

  function flashCopied(btnEl){
    if(!btnEl) return;
    const original = btnEl.textContent;
    btnEl.classList.add('copied');
    btnEl.textContent = '✅';
    setTimeout(() => {
      btnEl.classList.remove('copied');
      btnEl.textContent = original;
    }, 1300);
  }

  function copyText(text, btnEl){
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(text)
        .then(() => flashCopied(btnEl))
        .catch(() => { if(fallbackCopy(text)) flashCopied(btnEl); });
    } else {
      if(fallbackCopy(text)) flashCopied(btnEl);
    }
  }

  // Interpreta o texto colado do Party Hunt Analyser do Tibia
  function parseAnalyser(text){
    const lines = text.split(/\r?\n/);
    const statRegex = /^(Loot|Supplies|Balance|Damage|Healing)\s*:\s*(-?[\d.,]+)/i;
    const sessionDataRegex = /^Session data\s*:/i;
    const sessionDurationRegex = /^Session\s*:\s*(.+)/i;
    const lootTypeRegex = /^Loot Type\s*:/i;

    const members = [];
    let current = null;
    let sessionDuration = '';

    for(const rawLine of lines){
      const line = rawLine.trim();
      if(!line) continue;
      if(sessionDataRegex.test(line) || lootTypeRegex.test(line)) continue;

      const durationMatch = line.match(sessionDurationRegex);
      if(durationMatch){
        sessionDuration = durationMatch[1].trim();
        continue;
      }

      const statMatch = line.match(statRegex);
      if(statMatch){
        if(current){
          const key = statMatch[1].toLowerCase();
          current[key] = parseNumber(statMatch[2]);
        }
        // stats antes do primeiro membro = totais do grupo; ignoramos aqui
        // pois recalculamos o total a partir da soma dos membros.
        continue;
      }

      // linha de nome de jogador (com ou sem "(Leader)")
      let name = line;
      let isLeader = false;
      if(/\(leader\)\s*$/i.test(name)){
        isLeader = true;
        name = name.replace(/\s*\(leader\)\s*$/i, '').trim();
      }
      current = { name, isLeader, loot:0, supplies:0, balance:0, damage:0, healing:0 };
      members.push(current);
    }

    return { members, sessionDuration };
  }

  function computeSettlements(members, equalShare){
    const diffs = members.map(m => ({ name: m.name, diff: equalShare - m.balance }));
    const creditors = diffs.filter(d => d.diff > 0.5).sort((a,b) => b.diff - a.diff).map(d => ({...d}));
    const debtors = diffs.filter(d => d.diff < -0.5).map(d => ({ name: d.name, diff: -d.diff })).sort((a,b) => b.diff - a.diff);

    const transactions = [];
    let i = 0, j = 0;
    while(i < creditors.length && j < debtors.length){
      const amount = Math.min(creditors[i].diff, debtors[j].diff);
      if(amount > 0.5){
        transactions.push({ from: debtors[j].name, to: creditors[i].name, amount: Math.round(amount) });
      }
      creditors[i].diff -= amount;
      debtors[j].diff -= amount;
      if(creditors[i].diff <= 0.5) i++;
      if(debtors[j].diff <= 0.5) j++;
    }
    return transactions;
  }

  function transferLine(t){
    return t.from + ' to pay ' + t.amount + ' to ' + t.to + ' - Transfer ' + t.amount + ' to ' + t.to;
  }

  // Linha usada no resumo pro TeamSpeak — só o comando "Transfer X to Y" fica em negrito.
  function transferLineBold(t){
    return t.from + ' to pay ' + t.amount + ' to ' + t.to +
           ' - [b]Transfer ' + t.amount + ' to ' + t.to + '[/b]';
  }

  function buildSummaryText(data){
    const { transactions, totalBalance, equalShare, sessionDuration, excludedNames } = data;
    const lines = [];
    lines.push('LootSplit' + (sessionDuration ? ' — Sessão ' + sessionDuration : ''));
    lines.push('Balance total: ' + fmtMoney(totalBalance) + ' gp');
    lines.push('Divisão por pessoa: ' + fmtMoney(equalShare) + ' gp');
    if(excludedNames && excludedNames.length > 0){
      lines.push('Fora da divisão: ' + excludedNames.join(', '));
    }
    lines.push('');
    lines.push('Transferências:');
    if(transactions.length === 0){
      lines.push('Tudo já está equilibrado — ninguém precisa pagar ninguém.');
    } else {
      transactions.forEach(t => {
        lines.push(transferLineBold(t));
      });
    }
    return lines.join('\n');
  }

  // Guarda a lista completa (com quem está incluído/excluído) pra recalcular ao marcar/desmarcar.
  let currentMembers = [];
  let currentSessionDuration = '';

  function applySplit(){
    const includedMembers = currentMembers.filter(m => m.included);
    const totalBalance = includedMembers.reduce((sum, m) => sum + m.balance, 0);
    const equalShare = includedMembers.length > 0 ? totalBalance / includedMembers.length : 0;

    lootTotalBalanceEl.textContent = fmtMoney(totalBalance) + ' gp';
    lootEqualShareEl.textContent = fmtMoney(equalShare) + ' gp / pessoa';

    lootTableBodyEl.innerHTML = '';
    currentMembers.forEach(m => {
      const tr = document.createElement('tr');
      if(!m.included) tr.classList.add('excluded-row');

      const tdName = document.createElement('td');
      tdName.className = 'loot-name-cell';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'loot-include-checkbox';
      checkbox.checked = m.included;
      checkbox.title = 'Incluir na divisão do loot';
      checkbox.addEventListener('change', () => {
        m.included = checkbox.checked;
        applySplit();
      });
      const nameSpan = document.createElement('span');
      nameSpan.textContent = m.name + (m.isLeader ? ' (Leader)' : '');
      tdName.appendChild(checkbox);
      tdName.appendChild(nameSpan);
      tr.appendChild(tdName);

      const tdLoot = document.createElement('td');
      tdLoot.textContent = fmtMoney(m.loot);
      tr.appendChild(tdLoot);

      const tdSupplies = document.createElement('td');
      tdSupplies.textContent = fmtMoney(m.supplies);
      tr.appendChild(tdSupplies);

      const tdBalance = document.createElement('td');
      tdBalance.textContent = fmtMoney(m.balance);
      tr.appendChild(tdBalance);

      const tdAdjust = document.createElement('td');
      if(!m.included){
        tdAdjust.textContent = '— fora';
      } else {
        const adjust = equalShare - m.balance;
        if(adjust > 0.5){
          tdAdjust.textContent = '+' + fmtMoney(adjust);
          tdAdjust.classList.add('positive');
        } else if(adjust < -0.5){
          tdAdjust.textContent = '-' + fmtMoney(Math.abs(adjust));
          tdAdjust.classList.add('negative');
        } else {
          tdAdjust.textContent = '0';
        }
      }
      tr.appendChild(tdAdjust);

      lootTableBodyEl.appendChild(tr);
    });

    const transactions = includedMembers.length > 0 ? computeSettlements(includedMembers, equalShare) : [];
    lootTransfersListEl.innerHTML = '';
    if(transactions.length === 0){
      const li = document.createElement('li');
      li.className = 'empty-msg';
      li.textContent = 'Tudo já está equilibrado — ninguém precisa pagar ninguém.';
      lootTransfersListEl.appendChild(li);
    } else {
      transactions.forEach(t => {
        const li = document.createElement('li');

        const textSpan = document.createElement('span');
        textSpan.className = 'transfer-text';
        const fromStrong = document.createElement('strong');
        fromStrong.textContent = t.from;
        const toStrong1 = document.createElement('strong');
        toStrong1.textContent = t.to;
        const toStrong2 = document.createElement('strong');
        toStrong2.textContent = t.to;
        textSpan.appendChild(fromStrong);
        textSpan.appendChild(document.createTextNode(' to pay ' + t.amount + ' to '));
        textSpan.appendChild(toStrong1);
        textSpan.appendChild(document.createTextNode(' - Transfer ' + t.amount + ' to '));
        textSpan.appendChild(toStrong2);

        const copyBtn = document.createElement('button');
        copyBtn.className = 'transfer-copy-btn';
        copyBtn.title = 'Copiar: ' + transferLine(t);
        copyBtn.textContent = '📋';
        copyBtn.addEventListener('click', () => {
          copyText(transferLine(t), copyBtn);
        });

        li.appendChild(textSpan);
        li.appendChild(copyBtn);
        lootTransfersListEl.appendChild(li);
      });
    }

    const excludedNames = currentMembers.filter(m => !m.included).map(m => m.name);
    lastComputation = { transactions, totalBalance, equalShare, sessionDuration: currentSessionDuration, excludedNames };
    lootResultsEl.style.display = 'block';
  }

  function calculateLootSplit(skipSave){
    lootErrorEl.textContent = '';
    lootResultsEl.style.display = 'none';
    lastComputation = null;

    const text = lootInput.value;
    if(!text.trim()){
      lootErrorEl.textContent = 'Cole o texto do Party Hunt Analyser antes de calcular.';
      return;
    }

    const { members, sessionDuration } = parseAnalyser(text);
    if(members.length === 0){
      lootErrorEl.textContent = 'Não consegui identificar nenhum jogador nesse texto. Confira se colou o texto completo do Party Hunt Analyser.';
      return;
    }

    currentMembers = members.map(m => ({ ...m, included: true }));
    currentSessionDuration = sessionDuration;
    applySplit();

    if(!skipSave){
      addToHistory(text, sessionDuration, members);
    }
  }

  lootCalcBtn.addEventListener('click', () => calculateLootSplit(false));
  lootClearBtn.addEventListener('click', () => {
    lootInput.value = '';
    lootErrorEl.textContent = '';
    lootResultsEl.style.display = 'none';
    lastComputation = null;
    currentMembers = [];
  });
  lootCopyAllBtn.addEventListener('click', () => {
    if(!lastComputation) return;
    copyText(buildSummaryText(lastComputation), lootCopyAllBtn);
  });

  // ---------- Histórico salvo (localStorage) ----------
  // Funciona quando o arquivo é aberto direto no navegador (fora do preview do Claude).
  const LOOT_HISTORY_KEY = 'lootsplit_history_v1';
  const lootHistoryListEl = document.getElementById('lootHistoryList');
  const lootHistoryClearBtn = document.getElementById('lootHistoryClearBtn');
  let storageAvailable = true;

  function loadHistory(){
    try{
      const raw = localStorage.getItem(LOOT_HISTORY_KEY);
      return raw ? JSON.parse(raw) : [];
    }catch(e){
      storageAvailable = false;
      return [];
    }
  }

  function saveHistoryArray(arr){
    try{
      localStorage.setItem(LOOT_HISTORY_KEY, JSON.stringify(arr));
    }catch(e){
      storageAvailable = false;
    }
  }

  function fmtHistoryDate(ts){
    const d = new Date(ts);
    return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
  }

  function renderHistoryList(){
    const history = loadHistory();
    lootHistoryListEl.innerHTML = '';

    if(!storageAvailable){
      const div = document.createElement('div');
      div.className = 'loot-history-empty';
      div.textContent = 'Histórico indisponível neste ambiente. Abra o arquivo .html direto no Chrome/Edge (fora do preview do Claude) pra usar o cache.';
      lootHistoryListEl.appendChild(div);
      return;
    }

    if(history.length === 0){
      const div = document.createElement('div');
      div.className = 'loot-history-empty';
      div.textContent = 'Nenhuma sessão salva ainda — toda vez que você calcular um split, ele fica guardado aqui.';
      lootHistoryListEl.appendChild(div);
      return;
    }

    history.forEach(entry => {
      const item = document.createElement('div');
      item.className = 'history-item';

      const info = document.createElement('div');
      const dateDiv = document.createElement('div');
      dateDiv.className = 'history-item-date';
      dateDiv.textContent = fmtHistoryDate(entry.savedAt);
      const metaDiv = document.createElement('div');
      metaDiv.className = 'history-item-meta';
      metaDiv.textContent = (entry.sessionDuration ? 'Sessão ' + entry.sessionDuration + ' · ' : '') +
        entry.memberCount + ' jogadores · Balance ' + fmtMoney(entry.totalBalance) + ' gp';
      info.appendChild(dateDiv);
      info.appendChild(metaDiv);

      const actions = document.createElement('div');
      actions.className = 'history-item-actions';

      const loadBtn = document.createElement('button');
      loadBtn.className = 'history-load-btn';
      loadBtn.textContent = 'Carregar';
      loadBtn.addEventListener('click', () => {
        lootInput.value = entry.rawText;
        calculateLootSplit(true);
        lootInput.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });

      const delBtn = document.createElement('button');
      delBtn.className = 'history-delete-btn';
      delBtn.title = 'Remover do histórico';
      delBtn.textContent = '🗑';
      delBtn.addEventListener('click', () => {
        const updated = loadHistory().filter(e => e.id !== entry.id);
        saveHistoryArray(updated);
        renderHistoryList();
      });

      actions.appendChild(loadBtn);
      actions.appendChild(delBtn);
      item.appendChild(info);
      item.appendChild(actions);
      lootHistoryListEl.appendChild(item);
    });
  }

  function addToHistory(rawText, sessionDuration, members){
    if(!storageAvailable) return;
    const totalBalance = members.reduce((sum, m) => sum + m.balance, 0);
    const entry = {
      id: Date.now() + '-' + Math.random().toString(36).slice(2, 7),
      savedAt: Date.now(),
      sessionDuration,
      totalBalance,
      memberCount: members.length,
      rawText
    };
    const history = loadHistory();
    history.unshift(entry);
    while(history.length > 20) history.pop(); // guarda só as 20 últimas sessões
    saveHistoryArray(history);
    renderHistoryList();
  }

  lootHistoryClearBtn.addEventListener('click', () => {
    if(loadHistory().length === 0) return;
    if(confirm('Apagar todo o histórico de LootSplit salvo neste navegador?')){
      saveHistoryArray([]);
      renderHistoryList();
    }
  });

  renderHistoryList();
})();

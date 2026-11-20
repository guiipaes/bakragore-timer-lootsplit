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

  // mantém a janela de PIP com a mesma paleta de cores da página
  function syncPipTheme(){
    if(!pipWindow) return;
    const t = document.documentElement.getAttribute('data-theme');
    if(t) pipWindow.document.documentElement.setAttribute('data-theme', t);
    else pipWindow.document.documentElement.removeAttribute('data-theme');
  }
  document.addEventListener('themechange', syncPipTheme);

  function copyStylesInto(targetDoc){
    [...document.styleSheets].forEach(sheet => {
      try{
        const rulesText = [...sheet.cssRules].map(r => r.cssText).join('\n');
        const styleTag = targetDoc.createElement('style');
        styleTag.textContent = rulesText;
        targetDoc.head.appendChild(styleTag);
      }catch(e){
        // não dá pra ler as regras (ex.: arquivo aberto direto do computador, ou fonte do Google):
        // então a janela carrega a mesma folha de estilos pelo endereço dela
        if(sheet.href){
          const linkTag = targetDoc.createElement('link');
          linkTag.rel = 'stylesheet';
          linkTag.href = sheet.href;
          targetDoc.head.appendChild(linkTag);
        }
      }
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
    syncPipTheme();
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
  const tabBtns = Array.prototype.slice.call(document.querySelectorAll('.tab-btn'));
  const appWrap = document.querySelector('.app-wrap');
  const panels = {
    timer: document.getElementById('panelTimer'),
    loot: document.getElementById('panelLoot'),
    imbue: document.getElementById('panelImbue')
  };

  function activateTab(name){
    tabBtns.forEach(b => b.classList.toggle('active', b.dataset.tab === name));
    Object.keys(panels).forEach(k => panels[k].classList.toggle('active', k === name));
    // a aba Imbuements usa a largura toda da tela; as outras seguem na coluna estreita
    appWrap.classList.toggle('wide', name === 'imbue');
  }
  tabBtns.forEach(b => b.addEventListener('click', () => activateTab(b.dataset.tab)));

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
  const lootSessionNameEl = document.getElementById('lootSessionName');

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
      addToHistory(text, sessionDuration, members, lootSessionNameEl.value.trim());
    }
  }

  lootCalcBtn.addEventListener('click', () => calculateLootSplit(false));
  lootClearBtn.addEventListener('click', () => {
    lootInput.value = '';
    lootSessionNameEl.value = '';
    lootErrorEl.textContent = '';
    lootResultsEl.style.display = 'none';
    lastComputation = null;
    currentMembers = [];
  });
  lootCopyAllBtn.addEventListener('click', () => {
    if(!lastComputation) return;
    copyText(buildSummaryText(lastComputation), lootCopyAllBtn);
  });

  // ---------- Link compartilhável ----------
  // O split inteiro (jogadores, valores e quem ficou de fora) vai codificado dentro da própria URL, depois do "#".
  // Não precisa de servidor: quem abre o link recebe o mesmo cálculo, na aba LootSplit.
  const lootShareBtn = document.getElementById('lootShareBtn');

  function toBase64Url(str){
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    bytes.forEach(b => { bin += String.fromCharCode(b); });
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function fromBase64Url(s){
    s = s.replace(/-/g, '+').replace(/_/g, '/');
    while(s.length % 4) s += '=';
    const bin = atob(s);
    const bytes = Uint8Array.from(bin, ch => ch.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  // Texto enxuto no mesmo formato do analyser (sem dano/cura) pra o link ficar curto.
  function compactAnalyserText(){
    const lines = [];
    if(currentSessionDuration) lines.push('Session: ' + currentSessionDuration);
    currentMembers.forEach(m => {
      lines.push(m.name + (m.isLeader ? ' (Leader)' : ''));
      lines.push('\tLoot: ' + m.loot);
      lines.push('\tSupplies: ' + m.supplies);
      lines.push('\tBalance: ' + m.balance);
    });
    return lines.join('\n');
  }

  function buildShareUrl(){
    const payload = {
      v: 1,
      t: compactAnalyserText(),
      x: currentMembers.filter(m => !m.included).map(m => m.name)
    };
    const sessionName = lootSessionNameEl.value.trim();
    if(sessionName) payload.n = sessionName;
    return location.href.split('#')[0] + '#ls=' + toBase64Url(JSON.stringify(payload));
  }

  lootShareBtn.addEventListener('click', () => {
    if(!currentMembers.length) return;
    copyText(buildShareUrl(), lootShareBtn);
  });

  function loadFromShareLink(){
    if(!location.hash.startsWith('#ls=')) return;
    try{
      const payload = JSON.parse(fromBase64Url(location.hash.slice(4)));
      if(!payload || typeof payload.t !== 'string') throw new Error('payload inválido');

      document.getElementById('tabBtnLoot').click();   // abre a aba LootSplit
      lootInput.value = payload.t;
      lootSessionNameEl.value = (typeof payload.n === 'string') ? payload.n.slice(0, 60) : '';
      calculateLootSplit(true);                          // true = não grava no histórico de quem abriu o link
      if(!currentMembers.length) throw new Error('sem jogadores');

      if(Array.isArray(payload.x) && payload.x.length){
        currentMembers.forEach(m => { if(payload.x.includes(m.name)) m.included = false; });
        applySplit();
      }
    }catch(e){
      lootErrorEl.textContent = 'Não consegui abrir o split desse link. Ele pode estar incompleto ou corrompido.';
    }
  }
  window.addEventListener('hashchange', loadFromShareLink);
  // espera os outros módulos (abas, barra lateral, histórico) terminarem de iniciar antes de abrir o link
  setTimeout(loadFromShareLink, 0);

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

  const lootHistorySearchEl = document.getElementById('lootHistorySearch');
  const lootHistoryPeriodEl = document.getElementById('lootHistoryPeriod');
  const lootHistoryCountEl = document.getElementById('lootHistoryCount');
  const lootHistoryToolsEl = document.getElementById('lootHistoryTools');
  const HISTORY_MAX = 100;

  // tira acento e maiúsculas pra a busca achar "joao" em "João"
  function plain(s){
    return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  function playersOf(entry){
    if(Array.isArray(entry.players)) return entry.players;
    try{ return parseAnalyser(entry.rawText).members.map(m => m.name); }catch(e){ return []; }
  }

  function entryMatches(entry, tokens){
    if(!tokens.length) return true;
    const d = new Date(entry.savedAt);
    const haystack = plain([
      entry.name || '',
      playersOf(entry).join(' '),
      fmtHistoryDate(entry.savedAt),
      d.toISOString().slice(0, 10),
      entry.sessionDuration || ''
    ].join(' '));
    return tokens.every(t => haystack.indexOf(t) !== -1);
  }

  function periodStart(){
    const p = lootHistoryPeriodEl.value;
    if(p === 'all') return 0;
    if(p === 'today'){ const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); }
    return Date.now() - parseInt(p, 10) * 86400000;
  }

  function showHistoryMessage(text){
    const div = document.createElement('div');
    div.className = 'loot-history-empty';
    div.textContent = text;
    lootHistoryListEl.appendChild(div);
  }

  function renameEntry(id, name){
    const all = loadHistory();
    const e = all.find(x => x.id === id);
    if(!e) return;
    e.name = name.trim().slice(0, 60);
    saveHistoryArray(all);
  }

  function startRename(entry, titleEl){
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'text-input history-rename-input';
    input.maxLength = 60;
    input.value = entry.name || '';
    input.placeholder = 'Nome da sessão';
    input.setAttribute('aria-label', 'Nome da sessão');
    let done = false;
    const finish = (save) => {
      if(done) return;
      done = true;
      if(save) renameEntry(entry.id, input.value);
      renderHistoryList();
    };
    input.addEventListener('keydown', e => {
      if(e.key === 'Enter'){ e.preventDefault(); finish(true); }
      else if(e.key === 'Escape'){ e.preventDefault(); finish(false); }
    });
    input.addEventListener('blur', () => finish(true));
    titleEl.replaceWith(input);
    input.focus();
    input.select();
  }

  function renderHistoryList(){
    const history = loadHistory();
    lootHistoryListEl.innerHTML = '';
    lootHistoryToolsEl.hidden = history.length === 0 || !storageAvailable;
    lootHistoryCountEl.textContent = '';

    if(!storageAvailable){
      showHistoryMessage('Histórico indisponível neste ambiente. Abra o arquivo .html direto no Chrome/Edge (fora do preview do Claude) pra usar o cache.');
      return;
    }
    if(history.length === 0){
      showHistoryMessage('Nenhuma sessão salva ainda: toda vez que você calcular um split, ele fica guardado aqui.');
      return;
    }

    const tokens = plain(lootHistorySearchEl.value).split(/\s+/).filter(Boolean);
    const since = periodStart();
    const list = history.filter(e => e.savedAt >= since && entryMatches(e, tokens));
    const filtering = tokens.length > 0 || since > 0;
    lootHistoryCountEl.textContent = filtering ? ('Mostrando ' + list.length + ' de ' + history.length + ' sessões') : (history.length + (history.length === 1 ? ' sessão salva' : ' sessões salvas'));

    if(list.length === 0){
      showHistoryMessage('Nenhuma sessão encontrada com esse filtro.');
      return;
    }

    list.forEach(entry => {
      const item = document.createElement('div');
      item.className = 'history-item';

      const info = document.createElement('div');
      info.className = 'history-item-info';
      const titleEl = document.createElement('div');
      titleEl.className = 'history-item-date';
      titleEl.textContent = entry.name ? entry.name : fmtHistoryDate(entry.savedAt);
      const metaDiv = document.createElement('div');
      metaDiv.className = 'history-item-meta';
      metaDiv.textContent = (entry.name ? fmtHistoryDate(entry.savedAt) + ' · ' : '') +
        (entry.sessionDuration ? 'Sessão ' + entry.sessionDuration + ' · ' : '') +
        entry.memberCount + ' jogadores · Balance ' + fmtMoney(entry.totalBalance) + ' gp';
      info.appendChild(titleEl);
      info.appendChild(metaDiv);

      const actions = document.createElement('div');
      actions.className = 'history-item-actions';

      const loadBtn = document.createElement('button');
      loadBtn.className = 'history-load-btn';
      loadBtn.textContent = 'Carregar';
      loadBtn.addEventListener('click', () => {
        lootInput.value = entry.rawText;
        lootSessionNameEl.value = entry.name || '';
        calculateLootSplit(true);
        lootInput.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });

      const renameBtn = document.createElement('button');
      renameBtn.className = 'history-delete-btn';
      renameBtn.title = entry.name ? 'Renomear sessão' : 'Dar um nome a esta sessão';
      renameBtn.setAttribute('aria-label', renameBtn.title);
      renameBtn.textContent = '✎';
      renameBtn.addEventListener('click', () => startRename(entry, titleEl));

      const delBtn = document.createElement('button');
      delBtn.className = 'history-delete-btn';
      delBtn.title = 'Remover do histórico';
      delBtn.setAttribute('aria-label', 'Remover do histórico');
      delBtn.textContent = '🗑';
      delBtn.addEventListener('click', () => {
        const updated = loadHistory().filter(e => e.id !== entry.id);
        saveHistoryArray(updated);
        renderHistoryList();
      });

      actions.appendChild(loadBtn);
      actions.appendChild(renameBtn);
      actions.appendChild(delBtn);
      item.appendChild(info);
      item.appendChild(actions);
      lootHistoryListEl.appendChild(item);
    });
  }

  function addToHistory(rawText, sessionDuration, members, name){
    if(!storageAvailable) return;
    const totalBalance = members.reduce((sum, m) => sum + m.balance, 0);
    const history = loadHistory();
    // o mesmo texto já salvo? atualiza (e sobe pro topo) em vez de duplicar
    const same = history.findIndex(e => e.rawText === rawText);
    let entry;
    if(same !== -1){
      entry = history.splice(same, 1)[0];
      entry.savedAt = Date.now();
      if(name) entry.name = name;
    } else {
      entry = {
        id: Date.now() + '-' + Math.random().toString(36).slice(2, 7),
        savedAt: Date.now(),
        name: name || '',
        sessionDuration,
        totalBalance,
        memberCount: members.length,
        players: members.map(m => m.name),
        rawText
      };
    }
    history.unshift(entry);
    while(history.length > HISTORY_MAX) history.pop();
    saveHistoryArray(history);
    renderHistoryList();
  }

  lootHistorySearchEl.addEventListener('input', renderHistoryList);
  lootHistoryPeriodEl.addEventListener('change', renderHistoryList);

  lootHistoryClearBtn.addEventListener('click', () => {
    if(loadHistory().length === 0) return;
    if(confirm('Apagar todas as ' + loadHistory().length + ' sessões do histórico de LootSplit neste navegador?')){
      saveHistoryArray([]);
      renderHistoryList();
    }
  });

  renderHistoryList();
})();

// ===========================================================
// IMBUEMENTS — calculadora de custo de imbuements por hora
// Lê o Hunt Analyser (solo) colado e soma o custo dos imbuements.
// ===========================================================
(function(){
  'use strict';


var FEES={1:7500,2:60000,3:250000};
var TOK={1:2,2:4,3:6};
var TIER=['Basic','Intricate','Powerful'];
var ROM=['I','II','III'];
var KEY='imbue_calc_v1';

var NPC={
 'Vampire Teeth':275,'Bloody Pincers':100,'Piece of Dead Brain':420,
 'Rope Belt':66,'Silencer Claws':390,'Some Grimeleech Wings':1200,
 'Protective Charm':60,'Sabretooth':400,'Vexclaw Talon':1100,
 'Fiery Heart':375,'Green Dragon Scale':100,'Demon Horn':1000,
 'Swamp Grass':20,'Poisonous Slime':50,'Slime Heart':160,
 'Frosty Heart':280,'Seacrest Hair':260,'Polar Bear Paw':30,
 'Rorc Feather':70,'Peacock Feather Fan':350,'Energy Vein':270,
 'Pile of Grave Earth':25,'Demonic Skeletal Hand':80,'Petrified Scream':250,
 'Elven Scouting Glass':50,'Elven Hoof':115,'Metal Spike':320,
 'Cyclops Toe':55,'Ogre Nose Ring':210,"Warmaster's Wristguards":200,
 "Lion's Mane":60,"Mooh'tah Shell":110,'War Crystal':460,
 'Orc Tooth':150,'Battle Stone':290,'Moohtant Horn':140,
 'Elvish Talisman':45,'Broken Shamanic Staff':35,'Strand of Medusa Hair':600,
 'Piece of Scarab Shell':45,'Brimstone Shell':210,'Frazzle Skin':400,
 'Damselfly Wing':20,'Compass':45,'Waspoid Wing':190,
 'Wereboar Hooves':175,'Crystallized Anger':400,'Quill':1100,
 'Fairy Wing':200,'Little Bowl of Myrrh':500,'Goosebump Leather':650,
 'Flask of Embalming Fluid':30,'Gloom Wolf Fur':70,'Mystical Hourglass':700,
 'Piece of Swampling Wood':30,'Snake Skin':400,'Brimstone Fangs':380,
 'Winter Wolf Fur':20,'Thick Fur':150,'Deepling Warts':180,
 'Green Dragon Leather':100,'Blazing Bone':610,'Draken Sulphur':550,
 'Wyvern Talisman':265,'Crawler Head Plating':210,'Wyrm Scale':400,
 'Cultish Robe':150,'Cultish Mask':280,'Hellspawn Tail':475
};

function pct(a,t){return a.map(function(p){return p+'% '+t;});}
function elem(t){return pct([10,25,50],'do dano físico vira '+t);}
function skill(n){return ['+1 '+n,'+2 '+n,'+4 '+n];}

var IMBS=[
 {id:'vampirism',name:'Vampirism',tag:'leech de vida',mats:[['Vampire Teeth',25],['Bloody Pincers',15],['Piece of Dead Brain',5]],token:1,ver:1,fx:pct([5,10,25],'do dano vira vida')},
 {id:'void',name:'Void',tag:'leech de mana',mats:[['Rope Belt',25],['Silencer Claws',25],['Some Grimeleech Wings',5]],token:1,ver:1,fx:pct([3,5,8],'do dano vira mana')},
 {id:'strike',name:'Strike',tag:'dano crítico',mats:[['Protective Charm',20],['Sabretooth',25],['Vexclaw Talon',5]],token:1,ver:1,fx:['+5% de dano e +5% de chance crítica','+15% de dano e +5% de chance crítica','+40% de dano e +5% de chance crítica']},
 {id:'scorch',name:'Scorch',tag:'dano de fogo',mats:[['Fiery Heart',25],['Green Dragon Scale',5],['Demon Horn',5]],ver:1,fx:elem('fogo')},
 {id:'venom',name:'Venom',tag:'dano de terra',mats:[['Swamp Grass',25],['Poisonous Slime',20],['Slime Heart',2]],ver:1,fx:elem('terra')},
 {id:'frost',name:'Frost',tag:'dano de gelo',mats:[['Frosty Heart',25],['Seacrest Hair',10],['Polar Bear Paw',5]],ver:1,fx:elem('gelo')},
 {id:'electrify',name:'Electrify',tag:'dano de energia',mats:[['Rorc Feather',25],['Peacock Feather Fan',5],['Energy Vein',1]],ver:1,fx:elem('energia')},
 {id:'reap',name:'Reap',tag:'dano de morte',mats:[['Pile of Grave Earth',25],['Demonic Skeletal Hand',20],['Petrified Scream',5]],ver:1,fx:elem('morte')},
 {id:'precision',name:'Precision',tag:'distance',mats:[['Elven Scouting Glass',25],['Elven Hoof',20],['Metal Spike',10]],ver:1,fx:skill('distance')},
 {id:'bash',name:'Bash',tag:'club',mats:[['Cyclops Toe',20],['Ogre Nose Ring',15],["Warmaster's Wristguards",10]],ver:0,fx:skill('club')},
 {id:'slash',name:'Slash',tag:'sword',mats:[["Lion's Mane",25],["Mooh'tah Shell",25],['War Crystal',5]],ver:1,fx:skill('sword')},
 {id:'chop',name:'Chop',tag:'axe',mats:[['Orc Tooth',20],['Battle Stone',25],['Moohtant Horn',20]],ver:0,fx:skill('axe')},
 {id:'epiphany',name:'Epiphany',tag:'magic level',mats:[['Elvish Talisman',25],['Broken Shamanic Staff',15],['Strand of Medusa Hair',15]],ver:0,fx:skill('magic level')},
 {id:'blockade',name:'Blockade',tag:'shielding',mats:[['Piece of Scarab Shell',20],['Brimstone Shell',25],['Frazzle Skin',25]],ver:0,fx:skill('shielding')},
 {id:'swiftness',name:'Swiftness',tag:'velocidade',mats:[['Damselfly Wing',15],['Compass',25],['Waspoid Wing',20]],ver:1,fx:['+10 de velocidade','+15 de velocidade','+30 de velocidade']},
 {id:'vibrancy',name:'Vibrancy',tag:'remove paralisia',mats:[['Wereboar Hooves',20],['Crystallized Anger',15],['Quill',5]],ver:0},
 {id:'featherweight',name:'Featherweight',tag:'capacidade',mats:[['Fairy Wing',20],['Little Bowl of Myrrh',10],['Goosebump Leather',5]],ver:0},
 {id:'lich',name:'Lich Shroud',tag:'proteção de morte',mats:[['Flask of Embalming Fluid',25],['Gloom Wolf Fur',20],['Mystical Hourglass',5]],ver:0},
 {id:'snake',name:'Snake Skin',tag:'proteção de terra',mats:[['Piece of Swampling Wood',25],['Snake Skin',20],['Brimstone Fangs',10]],ver:0},
 {id:'quara',name:'Quara Scale',tag:'proteção de gelo',mats:[['Winter Wolf Fur',25],['Thick Fur',15],['Deepling Warts',10]],ver:0},
 {id:'dragon',name:'Dragon Hide',tag:'proteção de fogo',mats:[['Green Dragon Leather',20],['Blazing Bone',10],['Draken Sulphur',5]],ver:0},
 {id:'cloud',name:'Cloud Fabric',tag:'proteção de energia',mats:[['Wyvern Talisman',20],['Crawler Head Plating',15],['Wyrm Scale',10]],ver:0},
 {id:'demon',name:'Demon Presence',tag:'proteção sagrada',mats:[['Cultish Robe',25],['Cultish Mask',25],['Hellspawn Tail',20]],ver:0}
];
var IMB={}; IMBS.forEach(function(i){IMB[i.id]=i;});

var uid=0;
function nid(){uid++;return 'i'+uid+Math.random().toString(36).slice(2,6);}
function num(v){var n=parseFloat(v);return isFinite(n)&&n>0?n:0;}
function fmt(n){return Math.round(n).toLocaleString('pt-BR');}
function fmtS(n){return (n<0?'−':'')+fmt(Math.abs(n));}
function esc(s){return String(s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function fmtDur(h){
  var s=Math.round(h*3600),hh=Math.floor(s/3600),mm=Math.floor((s%3600)/60),ss=s%60;
  function p(x){return (x<10?'0':'')+x;}
  return hh>0?hh+' h '+p(mm)+' min':mm+' min '+p(ss)+' s';
}

var state=null;
function price(m){var v=state.prices[m];return v!==undefined?num(v):(NPC[m]||0);}
function qtyOf(r){var q=Math.floor(num(r.qty));return q<1?1:q;}

function rowCalc(r){
  var imb=IMB[r.imb],t=r.tier,q=qtyOf(r);
  var mats=imb.mats.slice(0,t).map(function(m){return {n:m[0],a:m[1],p:price(m[0])};});
  var token=!!(r.token&&imb.token);
  var matCost=token?TOK[t]*num(state.tokenPrice):mats.reduce(function(x,m){return x+m.a*m.p;},0);
  var unit=matCost+FEES[t];
  return {imb:imb,mats:mats,token:token,matCost:matCost,fee:FEES[t],unit:unit,qty:q,total:unit*q,perHour:unit*q/20};
}

/* Lê o texto do Hunt Analyser do Tibia (inglês). */
function parseAnalyser(t){
  var r={hours:0,loot:null,supplies:null,balance:null,xph:null,found:[],missing:[]};
  function n(re){
    var m=t.match(re); if(!m)return null;
    var v=m[1].replace(/[^\d-]/g,'');
    return (v===''||v==='-')?null:parseInt(v,10);
  }
  r.loot=n(/^\s*Loot:\s*(-?[\d.,]+)/im);
  r.supplies=n(/^\s*Supplies:\s*(-?[\d.,]+)/im);
  r.balance=n(/^\s*Balance:\s*(-?[\d.,]+)/im);
  r.xph=n(/^\s*XP\/h:\s*(-?[\d.,]+)/im);
  var from=t.match(/From\s+(\d{4}-\d{2}-\d{2}),?\s*(\d{2}:\d{2}:\d{2})\s+to\s+(\d{4}-\d{2}-\d{2}),?\s*(\d{2}:\d{2}:\d{2})/i);
  if(from){
    var a=new Date(from[1]+'T'+from[2]),b=new Date(from[3]+'T'+from[4]);
    var d=(b-a)/3600000;
    if(isFinite(d)&&d>0)r.hours=d;
  }
  if(!r.hours){
    var s=t.match(/Session:\s*(\d+):(\d{2})\s*h/i);
    if(s)r.hours=parseInt(s[1],10)+parseInt(s[2],10)/60;
  }
  if(r.hours>0)r.found.push('Tempo'); else r.missing.push('tempo da sessão');
  if(r.loot!==null)r.found.push('Loot'); else r.missing.push('Loot');
  if(r.supplies!==null)r.found.push('Supplies'); else r.missing.push('Supplies');
  if(r.balance!==null)r.found.push('Balance'); else r.missing.push('Balance');
  return r;
}

function totalsCalc(){
  var imbH=0;
  state.rows.forEach(function(r){imbH+=rowCalc(r).perHour;});
  var a=parseAnalyser(state.analyser||'');
  var h=a.hours,out={imbH:imbH,a:a,hours:h,session:null,supH:null,lootH:null,net:null,netH:null,be:null};
  if(h>0){
    out.session=imbH*h;
    if(a.supplies!==null)out.supH=a.supplies/h;
    if(a.loot!==null)out.lootH=a.loot/h;
    if(a.balance!==null){out.net=a.balance-out.session;out.netH=out.net/h;}
    out.be=(out.supH===null?0:out.supH)+imbH;
  }
  return out;
}


var EXAMPLE_AN=[
'Session data: From 2026-10-31, 13:18:46 to 2026-10-31, 13:24:35',
'Session: 00:05h',
'XP Gain: 410,515',
'XP/h: 4,234,842',
'Loot: 94,047',
'Supplies: 8,060',
'Balance: 85,987',
'Damage: 354,955',
'Damage/h: 3,950,430',
'Healing: 65,455',
'Healing/h: 728,473',
'Killed Monsters:',
'  45x werelion',
'  58x werelioness',
'  18x white lion',
'Looted Items:',
'  19x a small enchanted sapphire',
'  18x a small enchanted ruby',
'  2x terra boots',
'  2x magma legs',
'  2x a white pearl',
'  1x a black pearl',
'  1x a small diamond',
'  3102x a gold coin',
'  313x a platinum coin',
'  1x a yellow gem',
'  6x an ankh',
'  1x a war hammer',
'  5x a serpent sword',
'  5x a soul orb',
'  1x a titan axe',
'  46x a great spirit potion',
'  22x a lion\'s mane',
'  2x an onyx chip',
'  1x a coral brooch',
'  1x a rainbow quartz',
'  2x an ivory carving'
].join('\n');

function sample(){
  return {
    analyser:EXAMPLE_AN,
    rows:[
      {id:nid(),imb:'void',tier:3,qty:2,token:false,open:false},
      {id:nid(),imb:'strike',tier:3,qty:1,token:false,open:false},
      {id:nid(),imb:'vampirism',tier:3,qty:1,token:false,open:false},
      {id:nid(),imb:'bash',tier:2,qty:1,token:false,open:false}
    ],
    prices:{},tokenPrice:0
  };
}
function save(){try{localStorage.setItem(KEY,JSON.stringify(state));}catch(e){}}
function load(){
  try{
    var raw=localStorage.getItem(KEY); if(!raw)return null;
    var s=JSON.parse(raw);
    if(!s||!Array.isArray(s.rows)||typeof s.analyser!=='string')return null;
    s.rows=s.rows.filter(function(r){return IMB[r.imb];});
    s.rows.forEach(function(r){r.id=r.id||nid();r.tier=(r.tier===1||r.tier===2||r.tier===3)?r.tier:3;r.qty=qtyOf(r);r.token=!!r.token;r.open=!!r.open;});
    s.prices=(s.prices&&typeof s.prices==='object')?s.prices:{};
    s.tokenPrice=num(s.tokenPrice);
    return s;
  }catch(e){return null;}
}


  // ---------- Interface ----------
  const $id = function(id){ return document.getElementById(id); };
  const panel = $id('panelImbue');
  const analyserEl = $id('imbAnalyser');
  const rowsEl = $id('imbRows');
  const tokenEl = $id('imbTokenPrice');
  const statusEl = $id('imbStatus');

  function setText(id, v){ $id(id).textContent = v; }

  function rowOf(el){
    const e = el.closest('[data-row]');
    return e ? state.rows.filter(function(x){ return x.id === e.dataset.row; })[0] : null;
  }

  function rowHTML(r){
    const c = rowCalc(r), imb = c.imb;
    const opts = IMBS.map(function(i){
      return '<option value="'+i.id+'"'+(i.id===r.imb?' selected':'')+'>'+esc(i.name)+' ('+esc(i.tag)+')</option>';
    }).join('');
    const tiers = [1,2,3].map(function(t){
      return '<button type="button" data-act="tier" data-t="'+t+'" aria-pressed="'+(r.tier===t)+'" title="'+TIER[t-1]+'">'+ROM[t-1]+'</button>';
    }).join('');

    let mats;
    if(c.token){
      mats = '<tr><td><span class="amt">'+TOK[r.tier]+'×</span>Gold Token</td>'+
        '<td><input class="imb-input" type="number" inputmode="numeric" min="0" step="1" value="'+num(state.tokenPrice)+'" data-f="tokenPrice" aria-label="Preço do Gold Token"></td>'+
        '<td data-sub="0">'+fmt(c.matCost)+'</td></tr>';
    } else {
      mats = c.mats.map(function(m, mi){
        return '<tr><td><span class="amt">'+m.a+'×</span>'+esc(m.n)+'</td>'+
          '<td><input class="imb-input" type="number" inputmode="numeric" min="0" step="1" value="'+m.p+'" data-f="price" data-mat="'+esc(m.n)+'" aria-label="Preço de '+esc(m.n)+'"></td>'+
          '<td data-sub="'+mi+'">'+fmt(m.a*m.p)+'</td></tr>';
      }).join('');
    }

    const fx = (imb.fx ? '<em>'+TIER[r.tier-1]+':</em> '+esc(imb.fx[r.tier-1]) : '<em>'+TIER[r.tier-1]+'</em>') +
      (imb.ver ? '' : ' · materiais de referência, confira no jogo');
    const tokenBox = imb.token
      ? '<label class="imb-check"><input type="checkbox" data-f="token"'+(r.token?' checked':'')+'> Comprar com Gold Tokens ('+TOK[r.tier]+' por imbuement)</label>' +
        (c.token && !num(state.tokenPrice) ? '<p class="imb-warn">Defina o preço do Gold Token acima.</p>' : '')
      : '';

    return '<div class="imb-row" data-row="'+r.id+'">'+
      '<div class="imb-row-main">'+
        '<select class="imb-select" data-f="imb" aria-label="Imbuement">'+opts+'</select>'+
        '<div class="imb-seg" role="group" aria-label="Tier">'+tiers+'</div>'+
        '<div class="imb-qty" role="group" aria-label="Quantidade"><button type="button" data-act="qminus" aria-label="Diminuir">−</button>'+
        '<input class="imb-input" data-f="qty" type="number" inputmode="numeric" min="1" step="1" value="'+c.qty+'" aria-label="Quantidade">'+
        '<button type="button" data-act="qplus" aria-label="Aumentar">+</button></div>'+
        '<div class="imb-ph"><span>por hora</span><b data-k="ph">'+fmt(c.perHour)+'</b></div>'+
        '<button type="button" class="imb-x" data-act="rm" aria-label="Remover imbuement" title="Remover">×</button>'+
      '</div>'+
      '<div class="imb-row-meta"><span class="imb-fx">'+fx+'</span>'+tokenBox+
      '<details'+(r.open?' open':'')+'><summary>Materiais e preços</summary><div class="imb-mats-wrap"><table class="imb-mats">'+
        '<thead><tr><th>Material</th><th>Preço un.</th><th>Subtotal</th></tr></thead><tbody>'+mats+
        '<tr><td>Taxa do NPC</td><td></td><td data-k="fee">'+fmt(c.fee)+'</td></tr>'+
        '<tr class="sum"><td>Custo por unidade</td><td></td><td data-k="unit">'+fmt(c.unit)+'</td></tr>'+
      '</tbody></table></div></details></div>'+
    '</div>';
  }

  function render(){
    rowsEl.innerHTML = state.rows.length
      ? state.rows.map(rowHTML).join('')
      : '<div class="loot-history-empty">Nenhum imbuement. Clique em + Imbuement.</div>';
    update();
  }

  function update(){
    const t = totalsCalc(), a = t.a, h = t.hours;
    lootRefresh();
    syncPresets();

    state.rows.forEach(function(r){
      const c = rowCalc(r);
      const el = panel.querySelector('[data-row="'+r.id+'"]');
      if(!el) return;
      function st(k, v){ const e = el.querySelector('[data-k="'+k+'"]'); if(e) e.textContent = v; }
      st('ph', fmt(c.perHour)); st('fee', fmt(c.fee)); st('unit', fmt(c.unit));
      if(c.token){
        const s0 = el.querySelector('[data-sub="0"]'); if(s0) s0.textContent = fmt(c.matCost);
      } else {
        c.mats.forEach(function(m, mi){
          const s = el.querySelector('[data-sub="'+mi+'"]'); if(s) s.textContent = fmt(m.a*m.p);
        });
      }
    });
    Array.prototype.forEach.call(panel.querySelectorAll('input[data-mat]'), function(i){
      if(i !== document.activeElement){ const v = String(price(i.dataset.mat)); if(i.value !== v) i.value = v; }
    });
    Array.prototype.forEach.call(panel.querySelectorAll('input[data-f="tokenPrice"]'), function(i){
      if(i !== document.activeElement){ const v = num(state.tokenPrice); const s = v ? String(v) : ''; if(i.value !== s) i.value = s; }
    });
    if(tokenEl !== document.activeElement){
      const v = num(state.tokenPrice); const s = v ? String(v) : '';
      if(tokenEl.value !== s) tokenEl.value = s;
    }

    // leitura do analyser
    if(!String(state.analyser).trim()){
      statusEl.className = 'imb-status';
      statusEl.textContent = 'Cole o texto do Hunt Analyser acima.';
    } else if(a.missing.length){
      statusEl.className = 'imb-status err';
      statusEl.textContent = 'Não encontrei: ' + a.missing.join(', ') + '. Confira se o texto está completo e em inglês.';
    } else {
      statusEl.className = 'imb-status ok';
      statusEl.textContent = 'Analyser lido: ' + a.found.join(', ') + '.';
    }

    // resultado
    const nUn = state.rows.reduce(function(x, r){ return x + qtyOf(r); }, 0);
    setText('imbPerHour', fmt(t.imbH));
    setText('imbPerHourNote', nUn + (nUn === 1 ? ' imbuement' : ' imbuements') + ' · cada um dura 20 h');
    setText('imbLegSup', t.supH !== null ? fmt(t.supH) + ' gp/h' : '—');
    setText('imbLegImb', fmt(t.imbH) + ' gp/h');
    const sup = t.supH || 0, tot = sup + t.imbH;
    const sp = tot > 0 ? sup / tot * 100 : 0, ip = tot > 0 ? t.imbH / tot * 100 : 0;
    $id('imbBarSup').style.width = sp + '%';
    $id('imbBarImb').style.width = ip + '%';
    $id('imbBar').setAttribute('aria-label', 'Suprimentos ' + Math.round(sp) + '% e imbuements ' + Math.round(ip) + '% do custo por hora');

    setText('imbSession', h > 0 ? fmt(t.session) : '—');
    setText('imbSessionNote', h > 0 ? 'Em ' + fmtDur(h) + ' de sessão.' : 'Cole o Hunt Analyser para ter o tempo da sessão.');
    const netEl = $id('imbNet');
    if(t.net !== null){
      netEl.textContent = fmtS(t.net) + ' gp';
      netEl.className = 'imb-stat-value ' + (t.net >= 0 ? 'imb-pos' : 'imb-neg');
      setText('imbNetNote', fmtS(a.balance) + ' de Balance menos ' + fmt(t.session) + ' de imbuements. Por hora: ' + fmtS(t.netH) + ' gp.');
    } else {
      netEl.textContent = '—';
      netEl.className = 'imb-stat-value';
      setText('imbNetNote', 'Cole o Hunt Analyser com Balance e tempo de sessão.');
    }
    setText('imbBreakeven', t.be !== null ? fmt(t.be) : '—');

    function tile(label, val, sub){
      return '<div class="imb-tile"><span class="imb-tile-label">'+label+'</span><b>'+val+'</b>'+(sub ? '<small>'+sub+'</small>' : '')+'</div>';
    }
    $id('imbTiles').innerHTML =
      tile('Tempo de sessão', h > 0 ? fmtDur(h) : '—', '') +
      tile('XP/h', a.xph !== null ? fmt(a.xph) : '—', '') +
      tile('Loot', a.loot !== null ? fmt(a.loot) : '—', t.lootH !== null ? fmt(t.lootH) + ' gp/h' : '') +
      tile('Supplies', a.supplies !== null ? fmt(a.supplies) : '—', t.supH !== null ? fmt(t.supH) + ' gp/h' : '') +
      tile('Balance', a.balance !== null ? fmtS(a.balance) : '—', (a.balance !== null && h > 0) ? fmtS(a.balance / h) + ' gp/h' : '');
    setText('imbTotalLabel', 'Total: ' + nUn + (nUn === 1 ? ' imbuement' : ' imbuements'));
    setText('imbTotalValue', fmt(t.imbH) + ' gp/h');
    save();
  }

  panel.addEventListener('click', function(e){
    const b = e.target.closest('[data-act]'); if(!b) return;
    const act = b.dataset.act, r = rowOf(b);
    if(act === 'add'){
      const used = state.rows.map(function(x){ return x.imb; });
      const pick = IMBS.filter(function(i){ return used.indexOf(i.id) < 0; })[0] || IMBS[0];
      state.rows.push({ id: nid(), imb: pick.id, tier: 3, qty: 1, token: false, open: false });
      render();
    }
    else if(act === 'rm' && r){ state.rows = state.rows.filter(function(x){ return x !== r; }); render(); }
    else if(act === 'tier' && r){ r.tier = parseInt(b.dataset.t, 10); render(); }
    else if(act === 'qplus' && r){ r.qty = qtyOf(r) + 1; render(); }
    else if(act === 'qminus' && r){ r.qty = Math.max(1, qtyOf(r) - 1); render(); }
    else if(act === 'sample'){
      const keepTok = state.tokenPrice, keepPrices = state.prices;
      state = sample();
      state.tokenPrice = keepTok; state.prices = keepPrices;
      analyserEl.value = state.analyser;
      render();
    }
    else if(act === 'clear-an'){ state.analyser = ''; analyserEl.value = ''; update(); analyserEl.focus(); }
  });

  panel.addEventListener('change', function(e){
    const t = e.target, f = t.dataset && t.dataset.f; if(!f) return;
    const r = rowOf(t);
    if(f === 'imb' && r){ r.imb = t.value; if(!IMB[r.imb].token) r.token = false; render(); }
    else if(f === 'token' && r){ r.token = t.checked; render(); }
    else if(f === 'qty' && r){ r.qty = qtyOf({ qty: t.value }); render(); }
  });

  panel.addEventListener('input', function(e){
    const t = e.target;
    if(t === analyserEl){ state.analyser = t.value; update(); return; }
    if(t === tokenEl){ state.tokenPrice = num(t.value); update(); return; }
    const f = t.dataset && t.dataset.f; if(!f) return;
    const r = rowOf(t);
    if(f === 'qty' && r){ r.qty = t.value; update(); }
    else if(f === 'price'){ state.prices[t.dataset.mat] = num(t.value); update(); }
    else if(f === 'tokenPrice'){ state.tokenPrice = num(t.value); update(); }
  });

  panel.addEventListener('toggle', function(e){
    const d = e.target;
    if(!d || d.tagName !== 'DETAILS') return;
    const r = rowOf(d);
    if(r){ r.open = d.open; save(); }
  }, true);

  // ---------- Loot da sessão (lista de itens do analyser, com tipo e preço de NPC) ----------
  function normItem(s){
    return String(s).toLowerCase().replace(/\s+/g, ' ').trim().replace(/^(a|an|the|some)\s+/, '');
  }
  var DELIV = {};
  String(window.TIBIA_DELIVERY_RAW || '').split('\n').forEach(function(line){
    var p = line.split('|');
    if(p.length < 2) return;
    var name = p[0].trim();
    if(name) DELIV[normItem(name)] = { name: name, price: parseInt(p[1], 10) || 0 };
  });
  var IMBMAT = {};
  Object.keys(NPC).forEach(function(k){ IMBMAT[normItem(k)] = { name: k, price: NPC[k] }; });
  var COINS = {
    'gold coin': { name: 'Gold Coin', price: 1 },
    'platinum coin': { name: 'Platinum Coin', price: 100 },
    'crystal coin': { name: 'Crystal Coin', price: 10000 }
  };

  function titleCase(s){
    var small = { of:1, the:1, a:1, an:1, and:1, in:1, to:1, with:1, for:1, on:1 };
    return s.split(' ').map(function(w, i){
      return (i > 0 && small[w]) ? w : w.charAt(0).toUpperCase() + w.slice(1);
    }).join(' ');
  }

  // lê a seção "Looted Items:" do Hunt Analyser (linhas como "22x a lion's mane")
  function parseLoot(text){
    var lines = String(text).split(/\r?\n/);
    var i = 0, found = false, out = [];
    for(; i < lines.length; i++){
      if(/^\s*Looted Items\s*:\s*$/i.test(lines[i])){ found = true; i++; break; }
    }
    if(!found) return { found: false, items: [] };
    var seen = {};
    for(; i < lines.length; i++){
      var ln = lines[i];
      if(!ln.trim()) continue;
      var m = ln.match(/^\s*(\d[\d,.]*)x\s+(.+?)\s*$/i);
      if(!m) break;                                   // acabou a seção
      var qty = parseInt(m[1].replace(/[^\d]/g, ''), 10) || 0;
      var key = normItem(m[2]);
      var it = seen[key];
      if(!it){
        var del = DELIV[key], imb = IMBMAT[key], coin = COINS[key];
        var price = null;
        if(del && del.price > 0) price = del.price;
        else if(imb) price = imb.price;
        else if(coin) price = coin.price;
        it = seen[key] = {
          key: key,
          name: (del && del.name) || (coin && coin.name) || titleCase(key),
          delivery: !!del, imbuement: !!imb, price: price, qty: 0, total: null
        };
        out.push(it);
      }
      it.qty += qty;
    }
    out.forEach(function(it){ it.total = it.price === null ? null : it.price * it.qty; });
    return { found: true, items: out };
  }

  // ícones (gifs da pasta imgs/): "Gold Coin.gif" ou "Gold_Coin.gif", tanto faz.
  // O GitHub Pages diferencia maiúsculas de minúsculas e o Windows não, então testa algumas grafias antes de desistir.
  var iconCache = {};   // chave do item -> endereço que funcionou ('' = não existe)
  var iconSep = ' ';    // separador que funcionou até agora: começa tentando espaço e aprende com o primeiro acerto
  function iconCandidates(it){
    var seps = iconSep === '_' ? ['_', ' '] : [' ', '_'];
    function file(n, sep){ return 'imgs/' + encodeURIComponent(n.replace(/\s+/g, sep)) + '.gif'; }
    var allCaps = it.key.split(' ').map(function(w){ return w.charAt(0).toUpperCase() + w.slice(1); }).join(' ');
    var out = [];
    [it.name, titleCase(it.key), allCaps, it.key].forEach(function(n){
      seps.forEach(function(sep){
        var u = file(n, sep);
        if(out.indexOf(u) === -1) out.push(u);
      });
    });
    return out;
  }
  function makeIcon(it){
    var wrap = document.createElement('span');
    wrap.className = 'li-ico';
    if(iconCache[it.key] === ''){ wrap.classList.add('missing'); return wrap; }
    var cands = iconCache[it.key] ? [iconCache[it.key]] : iconCandidates(it);
    var i = 0;
    var img = document.createElement('img');
    img.alt = '';
    img.decoding = 'async';
    img.onload = function(){
      iconCache[it.key] = cands[i];
      if(cands[i].indexOf('%20') !== -1) iconSep = ' ';          // aprende o padrão da sua pasta
      else if(cands[i].indexOf('_') !== -1) iconSep = '_';
    };
    img.onerror = function(){
      i++;
      if(i < cands.length){ img.src = cands[i]; }
      else { iconCache[it.key] = ''; img.remove(); wrap.classList.add('missing'); }
    };
    img.src = cands[0];
    wrap.appendChild(img);
    return wrap;
  }

  var lootCache = null, lootText = null;
  var lootFilter = 'all', lootQuery = '', lootSort = { key: 'total', dir: -1 };

  function lootRefresh(){
    var body = $id('imbLootBody');
    if(!body) return;
    var text = String(state.analyser || '');
    if(text !== lootText){ lootText = text; lootCache = parseLoot(text); renderLoot(); }
  }

  function lootKind(it){ return it.delivery ? 'delivery' : (it.imbuement ? 'imbuement' : 'other'); }

  function renderLoot(){
    var body = $id('imbLootBody'), empty = $id('imbLootEmpty'), sumEl = $id('imbLootSummary');
    var items = lootCache ? lootCache.items : [];
    var cnt = { all: items.length, delivery: 0, imbuement: 0, other: 0 };
    items.forEach(function(it){ cnt[lootKind(it)]++; });
    $id('imbCntAll').textContent = cnt.all;
    $id('imbCntDel').textContent = cnt.delivery;
    $id('imbCntImb').textContent = cnt.imbuement;
    $id('imbCntOth').textContent = cnt.other;

    var q = normItem(lootQuery);
    var list = items.filter(function(it){
      if(lootFilter !== 'all' && lootKind(it) !== lootFilter) return false;
      return !q || it.key.indexOf(q) !== -1 || it.name.toLowerCase().indexOf(q) !== -1;
    });
    var k = lootSort.key, d = lootSort.dir;
    list.sort(function(a, b){
      var r;
      if(k === 'name') r = a.name.localeCompare(b.name, 'pt-BR');
      else if(k === 'qty') r = a.qty - b.qty;
      else if(k === 'price') r = (a.price === null ? -1 : a.price) - (b.price === null ? -1 : b.price);
      else r = (a.total === null ? -1 : a.total) - (b.total === null ? -1 : b.total);
      if(r === 0) r = b.qty - a.qty || a.name.localeCompare(b.name, 'pt-BR');
      else r *= d;
      return r;
    });

    // resumo
    var known = 0, delTotal = 0, delQty = 0;
    items.forEach(function(it){
      if(it.total !== null) known += it.total;
      if(it.delivery){ delQty += it.qty; if(it.total !== null) delTotal += it.total; }
    });
    if(!items.length){
      sumEl.textContent = '';
    } else {
      sumEl.textContent = cnt.all + ' itens diferentes. Delivery: ' + cnt.delivery + ' itens (' + fmt(delQty) +
        ' unidades, ' + fmt(delTotal) + ' gp no NPC). Soma dos itens com preço conhecido: ' + fmt(known) + ' gp.';
    }

    // tabela
    body.innerHTML = '';
    list.forEach(function(it){
      var tr = document.createElement('tr');
      var tdName = document.createElement('td');
      tdName.className = 'li-name';
      var box = document.createElement('div');
      box.className = 'li-item';
      var label = document.createElement('span');
      label.textContent = it.name;
      box.appendChild(makeIcon(it));
      box.appendChild(label);
      tdName.appendChild(box);
      var tdTag = document.createElement('td');
      if(it.delivery) tdTag.appendChild(tag('Delivery', 'tag-del'));
      if(it.imbuement) tdTag.appendChild(tag('Imbuement', 'tag-imb'));
      if(!it.delivery && !it.imbuement) tdTag.appendChild(tag('Outro', 'tag-none'));
      var tdQty = document.createElement('td'); tdQty.className = 'num'; tdQty.textContent = fmt(it.qty);
      var tdPrice = document.createElement('td'); tdPrice.className = 'num';
      tdPrice.textContent = it.price === null ? '—' : fmt(it.price) + ' gp';
      var tdTotal = document.createElement('td'); tdTotal.className = 'num li-total';
      tdTotal.textContent = it.total === null ? '—' : fmt(it.total) + ' gp';
      [tdName, tdTag, tdQty, tdPrice, tdTotal].forEach(function(td){ tr.appendChild(td); });
      body.appendChild(tr);
    });

    // mensagens
    var msg = '';
    if(!String(state.analyser || '').trim()) msg = 'Cole o Hunt Analyser acima para ver os itens que você dropou.';
    else if(!lootCache.found) msg = 'Não encontrei a seção "Looted Items" no texto colado. Copie o analyser inteiro, em inglês.';
    else if(!items.length) msg = 'A seção "Looted Items" está vazia.';
    else if(!list.length) msg = 'Nenhum item encontrado com esse filtro.';
    empty.textContent = msg;
    empty.hidden = !msg;
    $id('imbLootTable').hidden = !list.length;

    // cabeçalhos ordenáveis
    Array.prototype.forEach.call(document.querySelectorAll('#imbLootTable th[aria-sort]'), function(th){
      var b = th.querySelector('[data-ls]');
      th.setAttribute('aria-sort', b.dataset.ls === k ? (d > 0 ? 'ascending' : 'descending') : 'none');
    });
  }

  function tag(text, cls){
    var s = document.createElement('span');
    s.className = 'tag ' + cls;
    s.textContent = text;
    return s;
  }

  $id('imbLootSearch').addEventListener('input', function(e){ lootQuery = e.target.value; renderLoot(); });
  Array.prototype.forEach.call(document.querySelectorAll('[data-lf]'), function(b){
    b.addEventListener('click', function(){
      lootFilter = b.dataset.lf;
      Array.prototype.forEach.call(document.querySelectorAll('[data-lf]'), function(x){
        var on = x === b;
        x.classList.toggle('active', on);
        x.setAttribute('aria-pressed', String(on));
      });
      renderLoot();
    });
  });
  Array.prototype.forEach.call(document.querySelectorAll('[data-ls]'), function(b){
    b.addEventListener('click', function(){
      var key = b.dataset.ls;
      if(lootSort.key === key) lootSort.dir = -lootSort.dir;
      else lootSort = { key: key, dir: key === 'name' ? 1 : -1 };
      renderLoot();
    });
  });

  // ---------- Presets de imbuements (um conjunto por hunt) ----------
  var PRESETS_KEY = 'imbue_presets_v1';
  var presets = [], lastPresetId = null, formMode = 'new', msgTimer = null;
  var pChips = $id('imbPresetChips'), pForm = $id('imbPresetForm'), pName = $id('imbPresetName');
  var pManage = $id('imbPresetManage'), pManageText = $id('imbPresetManageText');
  var pUpdate = $id('imbPresetUpdate'), pMsg = $id('imbPresetMsg'), pNew = $id('imbPresetNew');

  function snapRows(rows){
    return rows.filter(function(r){ return IMB[r.imb]; }).map(function(r){
      return { imb: r.imb, tier: (r.tier === 1 || r.tier === 2 || r.tier === 3) ? r.tier : 3, qty: qtyOf(r), token: !!(r.token && IMB[r.imb].token) };
    });
  }
  function rowsKey(rows){
    return JSON.stringify(rows.map(function(r){ return r.imb + ':' + r.tier + ':' + r.qty + ':' + (r.token ? 1 : 0); }).sort());
  }
  function findPreset(id){ return presets.filter(function(p){ return p.id === id; })[0] || null; }
  function presetByName(name, exceptId){
    var n = name.toLowerCase();
    return presets.filter(function(p){ return p.id !== exceptId && p.name.toLowerCase() === n; })[0] || null;
  }

  function loadPresets(){
    try{
      var s = JSON.parse(localStorage.getItem(PRESETS_KEY) || 'null');
      if(!s || !Array.isArray(s.presets)) return;
      presets = s.presets.filter(function(p){ return p && typeof p.name === 'string' && Array.isArray(p.rows); }).map(function(p){
        return { id: String(p.id || nid()), name: p.name.slice(0, 30), rows: snapRows(p.rows) };
      }).filter(function(p){ return p.rows.length; });
      lastPresetId = findPreset(s.last) ? s.last : null;
    }catch(e){ presets = []; }
  }
  function persistPresets(){
    try{ localStorage.setItem(PRESETS_KEY, JSON.stringify({ v: 1, presets: presets, last: lastPresetId })); }catch(e){ /* vale só nesta visita */ }
  }

  function showPresetMsg(text, undoFn){
    clearTimeout(msgTimer);
    pMsg.textContent = text;
    if(undoFn){
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'imb-preset-undo'; b.textContent = 'Desfazer';
      b.addEventListener('click', function(){ undoFn(); pMsg.textContent = ''; });
      pMsg.appendChild(b);
    }
    msgTimer = setTimeout(function(){ pMsg.textContent = ''; }, 8000);
  }

  function applyPreset(p){
    var before = state.rows, beforeLast = lastPresetId;
    state.rows = p.rows.map(function(r){ return { id: nid(), imb: r.imb, tier: r.tier, qty: r.qty, token: r.token, open: false }; });
    lastPresetId = p.id;
    persistPresets();
    render();
    showPresetMsg('Preset “' + p.name + '” aplicado.', function(){
      state.rows = before; lastPresetId = beforeLast; persistPresets(); render();
    });
  }

  function buildPresetChips(){
    pChips.innerHTML = '';
    if(!presets.length){
      var hint = document.createElement('span');
      hint.className = 'imb-presets-hint';
      hint.textContent = 'Monte seus imbuements abaixo e clique em “Salvar como preset” (ex: Warzone 3). Depois é só um clique pra trocar de conjunto.';
      pChips.appendChild(hint);
    }
    presets.forEach(function(p){
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'imb-chip'; b.dataset.pid = p.id;
      b.textContent = p.name;
      b.title = p.rows.length + (p.rows.length === 1 ? ' imbuement' : ' imbuements');
      b.addEventListener('click', function(){ applyPreset(p); });
      pChips.appendChild(b);
    });
    syncPresets();
  }

  // marca qual preset está ativo e mostra as ações do último preset usado
  function syncPresets(){
    if(!state) return;
    var cur = rowsKey(snapRows(state.rows));
    var activeId = null;
    // se dois presets forem idênticos, vale o que você usou por último
    var lastP = findPreset(lastPresetId);
    if(lastP && rowsKey(lastP.rows) === cur) activeId = lastP.id;
    presets.forEach(function(p){ if(!activeId && rowsKey(p.rows) === cur) activeId = p.id; });
    Array.prototype.forEach.call(pChips.querySelectorAll('[data-pid]'), function(b){
      var on = b.dataset.pid === activeId;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', String(on));
    });
    var focus = findPreset(activeId || lastPresetId);
    pManage.hidden = !focus;
    if(focus){
      var changed = !activeId;
      pManageText.textContent = changed ? ('“' + focus.name + '” foi alterado.') : ('Preset atual: “' + focus.name + '”.');
      pUpdate.hidden = !changed;
      pUpdate.dataset.pid = focus.id;
    }
    pNew.disabled = !state.rows.length;
  }

  function openPresetForm(mode, value){
    formMode = mode;
    pForm.hidden = false;
    pName.value = value || '';
    pName.focus();
    pName.select();
  }
  function closePresetForm(){ pForm.hidden = true; }

  pNew.addEventListener('click', function(){ openPresetForm('new', ''); });
  $id('imbPresetCancel').addEventListener('click', closePresetForm);
  pName.addEventListener('keydown', function(e){ if(e.key === 'Escape') closePresetForm(); });

  pForm.addEventListener('submit', function(e){
    e.preventDefault();
    var name = pName.value.trim().slice(0, 30);
    if(!name) return;
    if(formMode === 'rename'){
      var p = findPreset(pUpdate.dataset.pid);
      if(!p) return closePresetForm();
      if(presetByName(name, p.id)){ showPresetMsg('Já existe um preset com esse nome.'); return; }
      p.name = name;
      persistPresets(); buildPresetChips(); closePresetForm();
      showPresetMsg('Preset renomeado para “' + name + '”.');
      return;
    }
    var rows = snapRows(state.rows);
    if(!rows.length){ showPresetMsg('Adicione pelo menos um imbuement antes de salvar.'); return; }
    var same = presetByName(name, null), msg;
    if(same){ same.rows = rows; lastPresetId = same.id; msg = 'Preset “' + same.name + '” atualizado.'; }
    else {
      if(presets.length >= 20){ showPresetMsg('O limite é de 20 presets. Exclua algum para salvar outro.'); return; }
      var np = { id: nid(), name: name, rows: rows };
      presets.push(np); lastPresetId = np.id; msg = 'Preset “' + name + '” salvo.';
    }
    persistPresets(); buildPresetChips(); closePresetForm();
    showPresetMsg(msg);
  });

  pUpdate.addEventListener('click', function(){
    var p = findPreset(pUpdate.dataset.pid);
    if(!p) return;
    var rows = snapRows(state.rows);
    if(!rows.length){ showPresetMsg('Adicione pelo menos um imbuement antes de atualizar.'); return; }
    p.rows = rows; lastPresetId = p.id;
    persistPresets(); syncPresets();
    showPresetMsg('Preset “' + p.name + '” atualizado.');
  });
  $id('imbPresetRename').addEventListener('click', function(){
    var p = findPreset(pUpdate.dataset.pid);
    if(p) openPresetForm('rename', p.name);
  });
  $id('imbPresetDelete').addEventListener('click', function(){
    var p = findPreset(pUpdate.dataset.pid);
    if(!p || !confirm('Excluir o preset “' + p.name + '”?')) return;
    presets = presets.filter(function(x){ return x !== p; });
    if(lastPresetId === p.id) lastPresetId = null;
    persistPresets(); buildPresetChips(); closePresetForm();
    showPresetMsg('Preset excluído.');
  });

  loadPresets();
  buildPresetChips();

  state = load() || sample();
  analyserEl.value = state.analyser;
  render();
})();


// ===========================================================
// PALETAS DE COR — troca o tema do site e lembra a escolha
// ===========================================================
(function(){
  const THEMES = ['roxo', 'esmeralda', 'oceano', 'ambar', 'rubi', 'claro', 'claro-verde', 'claro-roxo', 'cinza'];
  const KEY = 'site_theme_v1';
  const root = document.documentElement;
  const btn = document.getElementById('themeBtn');
  const pop = document.getElementById('themePop');
  const opts = Array.prototype.slice.call(pop.querySelectorAll('.theme-opt'));

  function apply(name, persist){
    if(THEMES.indexOf(name) < 0) name = 'roxo';
    root.setAttribute('data-theme', name);
    opts.forEach(o => o.setAttribute('aria-checked', String(o.dataset.themeName === name)));
    if(persist){
      try{ localStorage.setItem(KEY, name); }catch(e){ /* sem armazenamento: vale só nesta visita */ }
    }
    document.dispatchEvent(new CustomEvent('themechange', { detail: name }));
  }

  function setOpen(open){
    pop.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
  }

  btn.addEventListener('click', e => { e.stopPropagation(); setOpen(pop.hidden); });
  opts.forEach(o => o.addEventListener('click', () => { apply(o.dataset.themeName, true); setOpen(false); btn.focus(); }));
  document.addEventListener('click', e => { if(!pop.hidden && !pop.contains(e.target)) setOpen(false); });
  document.addEventListener('keydown', e => { if(e.key === 'Escape' && !pop.hidden){ setOpen(false); btn.focus(); } });

  let saved = null;
  try{ saved = localStorage.getItem(KEY); }catch(e){}
  apply(saved || 'roxo', false);
})();

// ===========================================================
// BARRA LATERAL — recolher/expandir (computador) e gaveta (celular)
// ===========================================================
(function(){
  const root = document.documentElement;
  const KEY = 'site_sidebar_v1';
  const toggle = document.getElementById('sidebarToggle');
  const openBtn = document.getElementById('sidebarOpen');
  const closeBtn = document.getElementById('sidebarClose');
  const scrim = document.getElementById('sidebarScrim');
  const navBtns = Array.prototype.slice.call(document.querySelectorAll('.tab-btn'));
  const mobile = window.matchMedia('(max-width: 860px)');

  // ----- recolher / expandir (guarda a escolha no navegador) -----
  function setCollapsed(collapsed, persist){
    if(collapsed) root.setAttribute('data-sidebar', 'collapsed');
    else root.removeAttribute('data-sidebar');
    const label = collapsed ? 'Expandir menu' : 'Recolher menu';
    toggle.setAttribute('aria-expanded', String(!collapsed));
    toggle.setAttribute('aria-label', label);
    toggle.title = label;
    if(persist){
      try{ localStorage.setItem(KEY, collapsed ? 'collapsed' : 'expanded'); }catch(e){ /* vale só nesta visita */ }
    }
  }
  toggle.addEventListener('click', () => setCollapsed(root.getAttribute('data-sidebar') !== 'collapsed', true));
  setCollapsed(root.getAttribute('data-sidebar') === 'collapsed', false);

  // ----- gaveta no celular -----
  function setDrawer(open, returnFocus){
    root.classList.toggle('sidebar-open', open);
    scrim.hidden = !open;
    openBtn.setAttribute('aria-expanded', String(open));
    if(open){
      const active = document.querySelector('.tab-btn.active');
      if(active) active.focus();
    } else if(returnFocus){
      openBtn.focus();
    }
  }
  openBtn.addEventListener('click', () => setDrawer(true));
  closeBtn.addEventListener('click', () => setDrawer(false, true));
  scrim.addEventListener('click', () => setDrawer(false, true));
  document.addEventListener('keydown', e => {
    if(e.key === 'Escape' && root.classList.contains('sidebar-open')) setDrawer(false, true);
  });
  const onViewport = () => { if(!mobile.matches) setDrawer(false, false); };
  if(mobile.addEventListener) mobile.addEventListener('change', onViewport);
  else if(mobile.addListener) mobile.addListener(onViewport);

  // ----- ao trocar de página: marca o item atual, leva o foco pro título no celular -----
  navBtns.forEach(b => b.addEventListener('click', () => {
    navBtns.forEach(x => {
      if(x === b) x.setAttribute('aria-current', 'page');
      else x.removeAttribute('aria-current');
    });
    window.scrollTo(0, 0);
    if(mobile.matches){
      setDrawer(false, false);
      const h = document.querySelector('.tab-panel.active h1');
      if(h) h.focus({ preventScroll: true });
    }
  }));
})();

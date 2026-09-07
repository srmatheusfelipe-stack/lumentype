// js/engine.js — Motor do jogo (corrida.html)
// Relógio global sincronizado. Mesma sequência para todos. Termina para todos juntos.

(function () {
  'use strict';

  var P = new URLSearchParams(location.search);
  var salaId = P.get('sala_id');
  var jogadorId = P.get('jogador_id');
  var modo = P.get('modo');
  var ehSolo = (modo === 'solo');
  var SOLO_SEG = 300; // treino solo = 5 min

  // ---- elementos
  var $ = function (id) { return document.getElementById(id); };
  var elEspera = $('espera'), elGrid = $('gridEspera'), elEsperaMsg = $('esperaMsg');
  var elContagem = $('contagem'), elNum = $('numContagem');
  var elJogo = $('jogo'), elFaixa = $('faixaAtual'), elTimer = $('timer');
  var elQuadro = $('quadro'), elDica = $('dica'), elMCQ = $('mcq');
  var elCaptura = $('captura'), elTeclado = $('teclado');
  var elScore = $('vScore'), elPPM = $('vPPM'), elPrec = $('vPrec'), elCombo = $('vCombo');
  var elFinal = $('telaFinal');

  // ---- estado
  var dur = SOLO_SEG, comecoEm = 0, fimEm = 0;
  var seq = CONTENT.LISTA.slice(), ptr = 0, seg = null;
  var alvo = '', spans = [], ultimoLen = 0, idxErro = null, segIni = 0, mcqIni = 0;
  var totScore = 0, totChars = 0, totErrChars = 0, comboAtual = 0, comboMax = 0, nSeg = 0;
  var formFeitas = 0, mcqOk = 0, mcqTot = 0;   // desempenho de Excel
  var jogoAtivo = false, jaFinalizou = false, ultimoEnvio = 0, contagemRodando = false;
  var mcqTravado = false;

  // Voltar/avancar do navegador restaura a pagina congelada (bfcache) e o jogo
  // reaparece num estado velho. Forca recarga limpa.
  window.addEventListener('pageshow', function (e) {
    if (e.persisted) location.reload();
  });

  KB.mount(elTeclado, { legenda: true });
  SFX.montarBotao($('controles'));

  // no treino solo, uma saida visivel (na competicao NAO existe, pra ninguem sair sem querer)
  if (ehSolo) {
    var sair = document.createElement('button');
    sair.type = 'button';
    sair.className = 'btnSom';
    sair.textContent = '✕';
    sair.title = 'Sair do treino';
    sair.onclick = function () {
      if (confirm('Sair do treino solo?')) location.href = 'index.html';
    };
    $('controles').appendChild(sair);
  }

  // =========================================================
  //  BOOT
  // =========================================================
  async function init() {
    if (ehSolo) {
      elEspera.style.display = 'none';
      dur = SOLO_SEG;
      comecoEm = Date.now(); fimEm = comecoEm + dur * 1000;
      iniciarContagem();
      return;
    }

    await sincronizarSala();
    montarEspera();

    db.channel('eng-jog-' + salaId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jogadores', filter: 'sala_id=eq.' + salaId }, montarEspera)
      .subscribe();

    db.channel('eng-sala-' + salaId)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'salas', filter: 'id=eq.' + salaId }, function (pl) {
        aplicarEstadoSala(pl.new);
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'salas', filter: 'id=eq.' + salaId }, function () {
        location.href = 'index.html';
      })
      .subscribe();

    // rede de seguranca: se o realtime falhar, confere a sala a cada 2.5s
    setInterval(async function () {
      if (jogoAtivo || jaFinalizou) return;
      await sincronizarSala();
    }, 2500);
  }

  async function sincronizarSala() {
    var r = await db.from('salas').select('status, duracao_seg, started_at, ends_at').eq('id', salaId).single();
    if (r.error || !r.data) return;
    dur = r.data.duracao_seg || 900;
    aplicarEstadoSala(r.data);
  }

  function aplicarEstadoSala(s) {
    if (!s) return;
    if (s.duracao_seg) dur = s.duracao_seg;

    if (s.status === 'jogando' && !jogoAtivo && !jaFinalizou) {
      comecoEm = s.started_at ? new Date(s.started_at).getTime() : Date.now();
      fimEm = s.ends_at ? new Date(s.ends_at).getTime() : comecoEm + dur * 1000;
      if (Date.now() >= fimEm) { finalizar(); return; }
      iniciarContagem();
    } else if (s.status === 'fim' && !jaFinalizou) {
      finalizar();
    } else if (s.status === 'lobby' && (jogoAtivo || jaFinalizou || contagemRodando)) {
      location.reload(); // professor voltou ao lobby
    }
  }

  // =========================================================
  //  LOBBY DE ESPERA
  // =========================================================
  async function montarEspera() {
    if (jogoAtivo || jaFinalizou || contagemRodando) return;
    var r = await db.from('jogadores').select('nickname, avatar_id').eq('sala_id', salaId);
    if (!r.data) return;
    elGrid.innerHTML = r.data.map(function (j) {
      return '<div class="cardAvatar"><img src="img/' + j.avatar_id + '" alt=""><span>' + esc(j.nickname) + '</span></div>';
    }).join('');
    elEsperaMsg.textContent = r.data.length + ' na sala — aguardando o professor iniciar...';
  }

  // =========================================================
  //  CONTAGEM REGRESSIVA (sincronizada pelo started_at)
  // =========================================================
  function iniciarContagem() {
    if (contagemRodando || jogoAtivo) return;
    contagemRodando = true;
    elEspera.style.display = 'none';

    // refresh / entrada atrasada: a partida já rola -> entra direto, sem flash de contagem
    if (!ehSolo && Date.now() - comecoEm > 1500) {
      contagemRodando = false;
      comecarJogo();
      return;
    }

    elContagem.style.display = 'flex';

    if (ehSolo) {
      var n = 3;
      elNum.textContent = n; SFX.tick();
      var iv = setInterval(function () {
        n--;
        if (n > 0) { elNum.textContent = n; SFX.tick(); }
        else {
          clearInterval(iv); elNum.textContent = 'JÁ!'; SFX.ja();
          setTimeout(function () { elContagem.style.display = 'none'; contagemRodando = false; comecarJogo(); }, 450);
        }
      }, 700);
      return;
    }

    var ultimoBip = -1;
    var tick = function () {
      var falta = Math.ceil((comecoEm - Date.now()) / 1000);
      if (falta > 0) {
        elNum.textContent = falta;
        if (falta !== ultimoBip && falta <= 5) { ultimoBip = falta; SFX.tick(); }
        setTimeout(tick, 200);
      } else {
        elNum.textContent = 'JÁ!';
        SFX.ja();
        setTimeout(function () {
          elContagem.style.display = 'none';
          contagemRodando = false;
          comecarJogo();
        }, 450);
      }
    };
    tick();
  }

  // =========================================================
  //  JOGO
  // =========================================================
  function comecarJogo() {
    if (jogoAtivo || jaFinalizou) return;
    // no solo o relogio so vale a partir do "JA!" (senao a contagem come tempo e suja o PPM)
    if (ehSolo) { comecoEm = Date.now(); fimEm = comecoEm + dur * 1000; }
    jogoAtivo = true;
    elJogo.style.display = 'flex';
    proximoSegmento();
    loopRelogio();
    elCaptura.focus();
  }

  function loopRelogio() {
    if (!jogoAtivo) return;
    var falta = fimEm - Date.now();
    mostrarTimer(falta);
    if (falta <= 0) { finalizar(); return; }
    if (!ehSolo && Date.now() - ultimoEnvio > 1200) enviarBanco(false);
    setTimeout(loopRelogio, 250);
  }

  var ultimoSegBip = -1;
  function mostrarTimer(ms) {
    var s = Math.max(0, Math.ceil(ms / 1000));
    var m = Math.floor(s / 60);
    var r = s % 60;
    elTimer.textContent = m + ':' + (r < 10 ? '0' : '') + r;
    elTimer.classList.toggle('urgente', s <= 20);
    if (s <= 10 && s > 0 && s !== ultimoSegBip) { ultimoSegBip = s; SFX.urgente(); }
  }

  function proximoSegmento() {
    if (!jogoAtivo) return;
    if (ptr >= seq.length) {
      seq = seq.concat(shuffle(CONTENT.LISTA.slice(CONTENT.LOOP_FROM)));
    }
    seg = seq[ptr++];
    idxErro = new Set();
    elCaptura.value = '';
    ultimoLen = 0;
    segIni = Date.now();

    if (seg.t === 'mcq') montarMCQ();
    else montarTexto();
  }

  function montarTexto() {
    elMCQ.style.display = 'none';
    elQuadro.style.display = 'block';
    elQuadro.classList.remove('temErro');
    KB.show();

    alvo = seg.s;
    elFaixa.textContent = seg.t === 'formula' ? 'FÓRMULA DO EXCEL' : rotuloFaixa(seg.faixa);
    elDica.style.display = seg.dica ? 'block' : 'none';
    if (seg.dica) elDica.textContent = '💡 ' + seg.dica;

    var html = '', gi = 0;
    var palavras = alvo.split(' ');
    palavras.forEach(function (pal, pi) {
      html += '<span class="pal">';
      for (var c = 0; c < pal.length; c++) { html += '<span id="c' + gi + '">' + esc(pal[c]) + '</span>'; gi++; }
      html += '</span>';
      if (pi < palavras.length - 1) { html += '<span id="c' + gi + '" class="esp">&nbsp;</span>'; gi++; }
    });
    elQuadro.innerHTML = html;
    spans = [];
    for (var i = 0; i < alvo.length; i++) spans[i] = $('c' + i);
    if (spans[0]) spans[0].classList.add('atual');
    KB.cue(alvo[0]);
    elCaptura.focus();
  }

  function montarMCQ() {
    KB.hide();
    KB.cue(null);
    elQuadro.style.display = 'none';
    elDica.style.display = 'none';
    elMCQ.style.display = 'block';
    elFaixa.textContent = 'PERGUNTA DE EXCEL';
    mcqIni = Date.now();
    mcqTravado = false;

    var letras = ['1', '2', '3', '4'];
    elMCQ.innerHTML = '<p class="pergunta">' + esc(seg.q) + '</p><div class="ops">' +
      seg.op.map(function (o, i) {
        return '<button class="op" data-i="' + i + '"><b>' + letras[i] + '</b> ' + esc(o) + '</button>';
      }).join('') + '</div><p class="mcqDica">responda com as teclas 1 2 3 4 ou clique</p>';

    Array.prototype.forEach.call(elMCQ.querySelectorAll('.op'), function (b) {
      b.onclick = function () { responderMCQ(parseInt(b.dataset.i, 10)); };
    });
  }

  function responderMCQ(i) {
    if (mcqTravado || !jogoAtivo || !seg || seg.t !== 'mcq') return;
    mcqTravado = true;
    var certo = (i === seg.c);
    var botoes = elMCQ.querySelectorAll('.op');
    if (botoes[seg.c]) botoes[seg.c].classList.add('certo');
    if (!certo && botoes[i]) botoes[i].classList.add('errado');

    var t = (Date.now() - mcqIni) / 1000;
    var pts = 0;
    mcqTot++;
    if (certo) { mcqOk++; pts = 30 + (t < 3 ? 15 : t < 6 ? 8 : 0); comboAtual++; comboMax = Math.max(comboMax, comboAtual); SFX.acerto(); }
    else { comboAtual = 0; SFX.erro(); }
    totScore += pts;
    nSeg++;
    atualizarPainel();
    flutuarPontos(pts, certo);

    setTimeout(function () { proximoSegmento(); }, 750);
  }

  // ---- captura de digitacao (textarea escondida; cola bloqueada)
  elCaptura.addEventListener('paste', function (e) { e.preventDefault(); });
  elCaptura.addEventListener('drop', function (e) { e.preventDefault(); });
  elCaptura.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === 'Tab') e.preventDefault();
  });
  elCaptura.addEventListener('blur', function () {
    if (jogoAtivo) setTimeout(function () { elCaptura.focus(); }, 10);
  });
  elQuadro.addEventListener('click', function () { elCaptura.focus(); });
  document.addEventListener('keydown', function (e) {
    if (!jogoAtivo || !seg) return;
    if (seg.t === 'mcq') {
      if (['1', '2', '3', '4'].indexOf(e.key) >= 0) responderMCQ(parseInt(e.key, 10) - 1);
      return;
    }
    if (document.activeElement !== elCaptura) elCaptura.focus();
  });

  elCaptura.addEventListener('input', function () {
    if (!jogoAtivo || !seg || seg.t === 'mcq') return;

    var v = elCaptura.value;
    if (v.length > ultimoLen + 4) { v = v.slice(0, ultimoLen); elCaptura.value = v; }
    if (v.length > alvo.length) { v = v.slice(0, alvo.length); elCaptura.value = v; }

    var cur = v.length;

    for (var i = cur; i < ultimoLen; i++) if (spans[i]) spans[i].className = '';

    for (var j = ultimoLen; j < cur; j++) {
      var ok = v[j] === alvo[j];
      if (ok) { comboAtual++; comboMax = Math.max(comboMax, comboAtual); SFX.tecla(); }
      else { idxErro.add(j); comboAtual = 0; SFX.erro(); }
    }
    for (var k = 0; k < cur; k++) {
      if (spans[k]) spans[k].className = (v[k] === alvo[k]) ? 'ok' : 'x';
    }
    for (var m = 0; m < alvo.length; m++) if (spans[m]) spans[m].classList.remove('atual');
    if (cur < alvo.length && spans[cur]) spans[cur].classList.add('atual');

    ultimoLen = cur;
    atualizarPainel();
    KB.cue(cur < alvo.length ? alvo[cur] : null);

    // chegou ao fim mas não bate: mostra que falta corrigir
    if (cur === alvo.length && v !== alvo) {
      elQuadro.classList.add('temErro');
      elDica.style.display = 'block';
      elDica.textContent = '✋ Corrija o que está em vermelho (use Backspace)';
    } else {
      elQuadro.classList.remove('temErro');
      if (seg.dica) { elDica.style.display = 'block'; elDica.textContent = '💡 ' + seg.dica; }
      else elDica.style.display = 'none';
    }

    if (v === alvo) concluirTexto();
  });

  function concluirTexto() {
    var len = alvo.length;
    var erros = idxErro.size;
    var accSeg = Math.max(0, (len - erros) / len);
    var mins = Math.max(0.02, (Date.now() - segIni) / 60000);
    var ppmSeg = (len / 5) / mins;
    var mult = accSeg >= 0.98 ? 1.5 : accSeg >= 0.95 ? 1.3 : accSeg >= 0.90 ? 1.1 : 1;
    var flawless = erros === 0 ? 15 : 0;
    var base = seg.t === 'formula' ? 50 : (alvo.trim().split(/\s+/).length * 10);
    var pts = Math.round((base + Math.min(60, ppmSeg / 2)) * mult) + flawless;

    if (seg.t === 'formula') formFeitas++;
    totScore += pts;
    totChars += len;
    totErrChars += erros;
    nSeg++;
    atualizarPainel();
    flutuarPontos(pts, erros === 0);
    SFX.acerto();

    if (!ehSolo && Date.now() - ultimoEnvio > 800) enviarBanco(false);
    proximoSegmento();
  }

  var ultimoMult = 1;
  function atualizarPainel() {
    var mins = Math.max(0.02, (Date.now() - comecoEm) / 60000);
    var ppm = Math.round((totChars / 5) / mins);
    var prec = totChars + totErrChars > 0 ? Math.round(totChars / (totChars + totErrChars) * 100) : 100;
    var mult = comboMult();
    elScore.textContent = totScore;
    elPPM.textContent = ppm;
    elPrec.textContent = prec + '%';
    elCombo.textContent = 'x' + mult;
    elCombo.classList.toggle('quente', comboAtual >= 12);
    if (mult > ultimoMult) SFX.combo();
    ultimoMult = mult;
  }

  function comboMult() {
    if (comboAtual >= 40) return 3;
    if (comboAtual >= 25) return 2.5;
    if (comboAtual >= 12) return 2;
    if (comboAtual >= 5) return 1.5;
    return 1;
  }

  function flutuarPontos(pts, bom) {
    if (!pts) return;
    var f = document.createElement('div');
    f.className = 'floatPts' + (bom ? ' bom' : '');
    f.textContent = '+' + pts;
    elJogo.appendChild(f);
    setTimeout(function () { f.remove(); }, 900);
  }

  // =========================================================
  //  BANCO
  // =========================================================
  function metricas() {
    var mins = Math.max(0.02, (Date.now() - comecoEm) / 60000);
    var ppm = Math.round((totChars / 5) / mins);
    var prec = totChars + totErrChars > 0 ? +(totChars / (totChars + totErrChars) * 100).toFixed(2) : 100;
    var prog = Math.min(100, Math.round((Date.now() - comecoEm) / (dur * 1000) * 100));
    return {
      score: totScore, wpm: ppm, accuracy: prec, combo_max: comboMax,
      segmentos: nSeg, progresso: prog,
      form_feitas: formFeitas, mcq_ok: mcqOk, mcq_tot: mcqTot
    };
  }

  async function enviarBanco(fim) {
    if (ehSolo || !jogadorId) return;
    ultimoEnvio = Date.now();
    var d = metricas();
    if (fim) { d.progresso = 100; d.finished_at = new Date().toISOString(); }
    try { await db.from('jogadores').update(d).eq('id', jogadorId); } catch (e) {}
  }

  // =========================================================
  //  FIM
  // =========================================================
  async function finalizar() {
    if (jaFinalizou) return;
    jaFinalizou = true;
    jogoAtivo = false;
    contagemRodando = false;
    KB.cue(null);
    elCaptura.disabled = true;
    elContagem.style.display = 'none';
    elJogo.style.display = 'none';
    elEspera.style.display = 'none';

    if (ehSolo) { montarFinalSolo(); return; }

    await enviarBanco(true);
    elFinal.style.display = 'flex';
    elFinal.className = 'telaFinal';
    elFinal.innerHTML = '<div class="fCarregando">Fechando a rodada...<br><small>olhe para a TV</small></div>';

    setTimeout(async function () {
      var r = await db.from('jogadores').select('*').eq('sala_id', salaId).order('score', { ascending: false });
      var lista = r.data || [];
      var pos = lista.findIndex(function (j) { return String(j.id) === String(jogadorId); }) + 1;
      montarFinal(lista, pos || lista.length);
    }, 2200);
  }

  function premioDe(lista, id) {
    if (!lista.length) return null;
    var top = function (k) { return lista.slice().sort(function (a, b) { return (b[k] || 0) - (a[k] || 0); })[0]; };
    var metadeBaixo = lista.slice(Math.ceil(lista.length / 2));
    var esforco = metadeBaixo.slice().sort(function (a, b) { return (b.segmentos || 0) - (a.segmentos || 0); })[0];
    if (top('accuracy') && String(top('accuracy').id) === String(id) && top('accuracy').accuracy >= 90) return '🎯 MAIS PRECISO(A) DA SALA';
    if (top('wpm') && String(top('wpm').id) === String(id)) return '⚡ MAIS RÁPIDO(A) DA SALA';
    if (top('combo_max') && String(top('combo_max').id) === String(id) && top('combo_max').combo_max >= 10) return '🔥 MAIOR SEQUÊNCIA DA SALA';
    if (esforco && String(esforco.id) === String(id)) return '💪 MAIS ESFORÇADO(A) DA SALA';
    return null;
  }

  function montarFinal(lista, pos) {
    var n = lista.length || 1;
    var eu = lista[pos - 1] || metricas();
    var premio = premioDe(lista, jogadorId);

    var tipo, tit, sub, emoji;
    if (pos === 1) { tipo = 'ouro'; emoji = '🏆'; tit = 'CAMPEÃO(Ã)!'; sub = 'Primeiro lugar da sala. Digitação de outro nível!'; festa(); SFX.vitoria(); }
    else if (pos === 2) { tipo = 'prata'; emoji = '🥈'; tit = 'VICE-CAMPEÃO(Ã)!'; sub = 'Chegou pertinho do topo. Mandou muito bem!'; SFX.vitoria(); }
    else if (pos === 3) { tipo = 'bronze'; emoji = '🥉'; tit = 'TERCEIRO LUGAR!'; sub = 'Pódio garantido. Excelente desempenho!'; SFX.vitoria(); }
    else if (pos <= Math.ceil(n / 2)) { tipo = 'azul'; emoji = '💪'; tit = 'MANDOU MUITO BEM!'; sub = 'Ficou na metade de cima da sala. Consistência boa!'; SFX.bom(); }
    else { tipo = 'verde'; emoji = '🌱'; tit = 'BOM TREINO!'; sub = 'Cada tecla conta. Você está mais rápido do que ontem!'; SFX.neutro(); }

    elFinal.className = 'telaFinal ' + tipo;
    elFinal.innerHTML =
      '<div class="fEmoji">' + emoji + '</div>' +
      '<h1 class="fTit">' + tit + '</h1>' +
      '<p class="fSub">' + sub + '</p>' +
      '<div class="fPos"><b>' + pos + 'º</b> <span>de ' + n + '</span></div>' +
      (premio ? '<div class="fPremio">' + premio + '</div>' : '') +
      '<div class="fStats">' +
        stat(eu.score || 0, 'PONTOS') + stat(eu.wpm || 0, 'PPM') +
        stat(Math.round(eu.accuracy || 0) + '%', 'PRECISÃO') + stat('x' + comboMax, 'MAIOR COMBO') +
      '</div>' +
      '<div class="fExcel">📊 Excel: <b>' + (eu.form_feitas || 0) + '</b> fórmulas · <b>' +
        (eu.mcq_ok || 0) + '/' + (eu.mcq_tot || 0) + '</b> perguntas</div>' +
      '<p class="fTV">👀 Olhe para a TV para ver o pódio completo</p>';
  }

  function montarFinalSolo() {
    var m = metricas();
    SFX.bom();
    elFinal.style.display = 'flex';
    elFinal.className = 'telaFinal azul';
    elFinal.innerHTML =
      '<div class="fEmoji">🎮</div><h1 class="fTit">TREINO CONCLUÍDO!</h1>' +
      '<p class="fSub">Esse é o modo solo. Na sala com a turma vale o pódio.</p>' +
      '<div class="fStats">' + stat(m.score, 'PONTOS') + stat(m.wpm, 'PPM') +
        stat(Math.round(m.accuracy) + '%', 'PRECISÃO') + stat('x' + comboMax, 'MAIOR COMBO') + '</div>' +
      '<div class="fBtns"><button onclick="location.reload()">JOGAR DE NOVO</button>' +
      '<button class="sec" onclick="location.href=\'index.html\'">INÍCIO</button></div>';
  }

  function stat(v, l) { return '<div class="st"><b>' + v + '</b><span>' + l + '</span></div>'; }
  function rotuloFaixa(f) { return f === 1 ? 'AQUECIMENTO' : f === 2 ? 'PALAVRAS E FRASES' : 'TEXTO'; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  function festa() {
    for (var i = 0; i < 60; i++) {
      var c = document.createElement('i');
      c.className = 'confete';
      c.style.left = Math.random() * 100 + 'vw';
      c.style.background = ['#fbc531', '#4cd137', '#4facfe', '#e84118', '#9b59b6'][i % 5];
      c.style.animationDelay = (Math.random() * 0.8) + 's';
      c.style.animationDuration = (2 + Math.random() * 2) + 's';
      document.body.appendChild(c);
      setTimeout((function (x) { return function () { x.remove(); }; })(c), 4500);
    }
  }

  init();
})();

// js/tv.js — Painel do professor (tv.html)
// Lobby -> contagem -> ranking ao vivo (reordena animado) -> pódio final -> voltar ao lobby.

(function () {
  'use strict';

  var P = new URLSearchParams(location.search);
  var salaId = P.get('sala_id');
  var $ = function (id) { return document.getElementById(id); };

  var sala = null, dur = 900, comecoEm = 0, fimEm = 0;
  var fase = 'lobby'; // lobby | contagem | jogo | fim
  var nodes = {}, prevRank = {}, jaFechou = false;

  // =========================================================
  async function boot() {
    var r = await db.from('salas').select('*').eq('id', salaId).single();
    if (r.error || !r.data) { $('codigo').textContent = '??????'; return; }
    aplicar(r.data);

    db.channel('tv-sala-' + salaId)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'salas', filter: 'id=eq.' + salaId }, function (pl) { aplicar(pl.new); })
      .subscribe();

    db.channel('tv-jog-' + salaId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jogadores', filter: 'sala_id=eq.' + salaId }, tick)
      .subscribe();

    SFX.montarBotao($('controles'));
    tick();
    setInterval(tick, 1500);           // fallback do realtime
    setInterval(loopRelogio, 250);     // relógio global
  }

  function aplicar(s) {
    sala = s;
    dur = s.duracao_seg || 900;
    $('codigo').textContent = s.codigo;
    $('duracaoLabel').textContent = Math.round(dur / 60) + ' min';
    if (s.started_at) comecoEm = new Date(s.started_at).getTime();
    if (s.ends_at) fimEm = new Date(s.ends_at).getTime();

    if (s.status === 'jogando' && fase === 'lobby') irParaContagem();
    if (s.status === 'fim' && fase !== 'fim') mostrarPodio();
    if (s.status === 'lobby' && fase !== 'lobby') location.reload();
  }

  // =========================================================
  //  DADOS
  // =========================================================
  async function jogadores() {
    var r = await db.from('jogadores').select('*').eq('sala_id', salaId);
    var arr = r.data || [];
    arr.sort(function (a, b) {
      return (b.score || 0) - (a.score || 0) ||
             (b.accuracy || 0) - (a.accuracy || 0) ||
             (b.wpm || 0) - (a.wpm || 0);
    });
    return arr;
  }

  async function tick() {
    var js = await jogadores();
    $('contador').textContent = js.length;
    if (fase === 'lobby') renderLobby(js);
    else if (fase === 'jogo') renderRanking(js);
  }

  // =========================================================
  //  LOBBY
  // =========================================================
  function renderLobby(js) {
    var wrap = $('lobby');
    wrap.innerHTML = js.length
      ? js.map(function (j) {
          return '<div class="cardAvatar"><img src="img/' + j.avatar_id + '" alt=""><span>' + esc(j.nickname) + '</span></div>';
        }).join('')
      : '<p class="vazio">Aguardando os alunos entrarem com o código...</p>';

    var b = $('btnIniciar');
    if (js.length >= 1) {
      b.disabled = false;
      b.textContent = '▶ INICIAR COMPETIÇÃO (' + js.length + ')';
      b.classList.add('pronto');
    } else {
      b.disabled = true;
      b.textContent = 'AGUARDANDO ALUNOS...';
      b.classList.remove('pronto');
    }
  }

  window.iniciarCompeticao = async function () {
    if (fase !== 'lobby') return;
    var t0 = Date.now() + 7000;
    var t1 = t0 + dur * 1000;
    await db.from('salas').update({
      status: 'jogando',
      started_at: new Date(t0).toISOString(),
      ends_at: new Date(t1).toISOString()
    }).eq('id', salaId);
    comecoEm = t0; fimEm = t1;
    irParaContagem();
  };

  // =========================================================
  //  CONTAGEM
  // =========================================================
  function irParaContagem() {
    if (fase !== 'lobby') return;
    $('telaLobby').style.display = 'none';
    $('telaJogo').style.display = 'block';
    var tp = $('timer'); if (tp) tp.style.display = 'inline-block';

    // TV recarregada no meio da partida: entra direto no ranking
    if (Date.now() - comecoEm > 1500) { fase = 'jogo'; tick(); return; }

    fase = 'contagem';
    $('contagem').style.display = 'flex';

    var ultimoBip = -1;
    var tick2 = function () {
      var falta = Math.ceil((comecoEm - Date.now()) / 1000);
      if (falta > 0) {
        $('numContagem').textContent = falta;
        if (falta !== ultimoBip && falta <= 5) { ultimoBip = falta; SFX.tick(); }
        setTimeout(tick2, 200);
      } else {
        $('numContagem').textContent = 'JÁ!';
        SFX.ja();
        setTimeout(function () {
          $('contagem').style.display = 'none';
          fase = 'jogo';
          tick();
        }, 450);
      }
    };
    tick2();
  }

  // =========================================================
  //  RELÓGIO GLOBAL
  // =========================================================
  var ultimoSegBip = -1;
  function loopRelogio() {
    if (fase !== 'jogo' && fase !== 'contagem') return;
    var falta = fimEm - Date.now();
    var s = Math.max(0, Math.ceil(falta / 1000));
    var el = $('timer');
    if (el) {
      el.textContent = Math.floor(s / 60) + ':' + (s % 60 < 10 ? '0' : '') + (s % 60);
      el.classList.toggle('urgente', s <= 30);
    }
    if (fase === 'jogo' && s <= 10 && s > 0 && s !== ultimoSegBip) { ultimoSegBip = s; SFX.urgente(); }
    if (fase === 'jogo' && falta <= 0 && !jaFechou) {
      jaFechou = true;
      db.from('salas').update({ status: 'fim' }).eq('id', salaId);
      setTimeout(mostrarPodio, 1800);
    }
  }

  // =========================================================
  //  RANKING AO VIVO (técnica FLIP p/ animar a troca de posição)
  // =========================================================
  function criarRow(j) {
    var n = document.createElement('div');
    n.className = 'row entra';
    n.dataset.id = j.id;
    n.innerHTML =
      '<div class="pos"></div>' +
      '<img class="av" src="img/' + j.avatar_id + '" alt="">' +
      '<div class="meio"><div class="nome">' + esc(j.nickname) + '</div>' +
      '<div class="barra"><i></i></div></div>' +
      '<div class="dir"><div class="sc"></div><div class="ppm"></div></div>' +
      '<div class="delta"></div>';
    return n;
  }

  function atualizarRow(n, j, rank) {
    var medalha = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank + 'º';
    n.querySelector('.pos').textContent = medalha;
    n.querySelector('.pos').className = 'pos' + (rank <= 3 ? ' p' + rank : '');
    n.querySelector('.sc').textContent = (j.score || 0) + ' pts';
    n.querySelector('.ppm').textContent = (j.wpm || 0) + ' ppm · ' + Math.round(j.accuracy || 0) + '%';
    n.querySelector('.barra > i').style.width = Math.min(100, j.progresso || 0) + '%';
    n.classList.toggle('lider', rank === 1);

    var antes = prevRank[j.id];
    var d = n.querySelector('.delta');
    if (antes && antes > rank) { d.textContent = '▲'; d.className = 'delta sobe'; }
    else if (antes && antes < rank) { d.textContent = '▼'; d.className = 'delta desce'; }
    else { d.textContent = ''; d.className = 'delta'; }
  }

  function renderRanking(js) {
    var cont = $('ranking');
    cont.classList.toggle('compacto', js.length > 16);
    var first = {};
    Object.keys(nodes).forEach(function (id) { first[id] = nodes[id].getBoundingClientRect().top; });

    js.forEach(function (j, i) {
      var n = nodes[j.id];
      if (!n) { n = criarRow(j); nodes[j.id] = n; cont.appendChild(n); first[j.id] = n.getBoundingClientRect().top; }
      atualizarRow(n, j, i + 1);
    });

    js.forEach(function (j) { cont.appendChild(nodes[j.id]); });

    js.forEach(function (j) {
      var n = nodes[j.id];
      var last = n.getBoundingClientRect().top;
      var dy = (first[j.id] == null ? last : first[j.id]) - last;
      if (Math.abs(dy) > 1) {
        n.style.transition = 'none';
        n.style.transform = 'translateY(' + dy + 'px)';
        requestAnimationFrame(function () {
          n.style.transition = 'transform .5s cubic-bezier(.22,1,.36,1)';
          n.style.transform = '';
        });
      }
    });

    prevRank = {};
    js.forEach(function (j, i) { prevRank[j.id] = i + 1; });
  }

  // =========================================================
  //  PÓDIO FINAL
  // =========================================================
  async function mostrarPodio() {
    if (fase === 'fim') return;
    fase = 'fim';
    $('telaLobby').style.display = 'none';
    $('telaJogo').style.display = 'none';
    $('contagem').style.display = 'none';
    var tela = $('telaFim');
    tela.style.display = 'block';

    var js = await jogadores();
    var top3 = js.slice(0, 3);
    var resto = js.slice(3);

    var idsPodio = top3.map(function (j) { return j.id; });
    var fora = js.filter(function (j) { return idsPodio.indexOf(j.id) < 0; });

    var premios = [
      medal('🎯 Mais Preciso', js, function (j) { return j.accuracy || 0; }, function (j) { return Math.round(j.accuracy) + '%'; }),
      medal('⚡ Mais Rápido', js, function (j) { return j.wpm || 0; }, function (j) { return (j.wpm || 0) + ' ppm'; }),
      medal('📊 Craque do Excel', fora, function (j) { return (j.mcq_ok || 0) + (j.form_feitas || 0); }, function (j) { return (j.mcq_ok || 0) + '/' + (j.mcq_tot || 0) + ' · ' + (j.form_feitas || 0) + ' fórm.'; }),
      medal('🧗 Mais Esforçado', fora, function (j) { return j.segmentos || 0; }, function (j) { return (j.segmentos || 0) + ' trechos'; }),
      { t: '🪑 Melhor Postura', nome: '— o professor escolhe —', v: '' }
    ].filter(Boolean);

    tela.innerHTML =
      '<h1 class="fimTit">🏆 PÓDIO FINAL</h1>' +
      '<div class="podio">' +
        bloco(top3[1], 2) + bloco(top3[0], 1) + bloco(top3[2], 3) +
      '</div>' +
      (resto.length ? '<div class="tabela">' + resto.map(function (j, i) {
        return '<div class="lin"><b>' + (i + 4) + 'º</b><img src="img/' + j.avatar_id + '"><span>' + esc(j.nickname) +
          '</span><em>' + (j.score || 0) + ' pts</em></div>';
      }).join('') + '</div>' : '') +
      '<div class="premios">' + premios.map(function (p) {
        return '<div class="pr"><div class="prT">' + p.t + '</div><div class="prN">' + esc(p.nome) + '</div><div class="prV">' + p.v + '</div></div>';
      }).join('') + '</div>' +
      '<div class="fimBtns">' +
        '<button class="res" onclick="window.open(\'resultado.html?sala_id=' + salaId + '\',\'_blank\')">📋 RESULTADO / IMPRIMIR</button>' +
        '<button onclick="voltarLobby()">🔄 VOLTAR AO LOBBY</button>' +
        '<button class="sec" onclick="encerrarSala()">⏹ ENCERRAR SALA</button>' +
      '</div>' +
      '<p style="text-align:center;color:#fff;font-weight:800;margin-top:12px;opacity:.9">Abra o Resultado e imprima ANTES de voltar ao lobby ou encerrar — os pontos são apagados.</p>';

    festa();
    SFX.vitoria();
  }

  function bloco(j, lugar) {
    if (!j) return '<div class="pdBloco vazio p' + lugar + '"></div>';
    var m = lugar === 1 ? '🥇' : lugar === 2 ? '🥈' : '🥉';
    return '<div class="pdBloco p' + lugar + '">' +
      '<div class="pdMed">' + m + '</div>' +
      '<img src="img/' + j.avatar_id + '" alt="">' +
      '<div class="pdNome">' + esc(j.nickname) + '</div>' +
      '<div class="pdPts">' + (j.score || 0) + ' pts</div>' +
      '<div class="pdSub">' + (j.wpm || 0) + ' ppm · ' + Math.round(j.accuracy || 0) + '%</div>' +
      '</div>';
  }

  function medal(titulo, pool, valor, fmt) {
    var w = pool.slice().sort(function (a, b) { return valor(b) - valor(a); })[0];
    if (!w || !(valor(w) > 0)) return { t: titulo, nome: '—', v: '' };
    return { t: titulo, nome: w.nickname, v: fmt(w) };
  }

  // =========================================================
  //  BOTÕES DE FIM
  // =========================================================
  window.voltarLobby = async function () {
    await db.from('jogadores').update({
      score: 0, wpm: 0, accuracy: 100, combo_max: 0, segmentos: 0, progresso: 0, finished_at: null
    }).eq('sala_id', salaId);
    await db.from('salas').update({ status: 'lobby', started_at: null, ends_at: null }).eq('id', salaId);
    location.reload();
  };

  window.encerrarSala = async function () {
    if (!confirm('Encerrar a sala e apagar os dados desta partida?')) return;
    await db.from('jogadores').delete().eq('sala_id', salaId);
    await db.from('salas').delete().eq('id', salaId);
    location.href = 'index.html';
  };

  // =========================================================
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }
  function festa() {
    for (var i = 0; i < 90; i++) {
      var c = document.createElement('i');
      c.className = 'confete';
      c.style.left = Math.random() * 100 + 'vw';
      c.style.background = ['#fbc531', '#4cd137', '#4facfe', '#e84118', '#9b59b6'][i % 5];
      c.style.animationDelay = (Math.random() * 1.2) + 's';
      c.style.animationDuration = (2.4 + Math.random() * 2.4) + 's';
      document.body.appendChild(c);
      setTimeout((function (x) { return function () { x.remove(); }; })(c), 6000);
    }
  }

  boot();
})();

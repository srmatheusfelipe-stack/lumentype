// js/resultado.js — folha de resultado da sala (para consulta / impressão / avaliação)

(function () {
  'use strict';
  var salaId = new URLSearchParams(location.search).get('sala_id');
  var $ = function (id) { return document.getElementById(id); };

  // ---- Nível a partir de PPM + precisão. Ajuste os números depois do simulado. ----
  function nivel(ppm, prec) {
    if (ppm >= 35 && prec >= 96) return { n: 'Mestre', e: '👑' };
    if (ppm >= 25 && prec >= 93) return { n: 'Veloz', e: '🚀' };
    if (ppm >= 16 && prec >= 88) return { n: 'Ágil', e: '⚙️' };
    if (ppm >= 9) return { n: 'Praticante', e: '✏️' };
    return { n: 'Iniciante', e: '🌱' };
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c];
    });
  }

  function melhor(pool, valor) {
    var w = pool.slice().sort(function (a, b) { return valor(b) - valor(a); })[0];
    return (w && valor(w) > 0) ? w : null;
  }

  async function carregar() {
    var rs = await db.from('salas').select('codigo, duracao_seg').eq('id', salaId).single();
    var rj = await db.from('jogadores').select('*').eq('sala_id', salaId);
    if (rj.error || !rj.data) { $('conteudo').innerHTML = '<p class="erro">Não consegui carregar a sala.</p>'; return; }

    var js = rj.data.slice().sort(function (a, b) {
      return (b.score || 0) - (a.score || 0) || (b.accuracy || 0) - (a.accuracy || 0) || (b.wpm || 0) - (a.wpm || 0);
    });

    var cod = rs.data ? rs.data.codigo : '—';
    var dur = rs.data ? Math.round((rs.data.duracao_seg || 0) / 60) : '—';
    var hoje = new Date().toLocaleDateString('pt-BR');

    var top3 = js.slice(0, 3);
    var idsPodio = top3.map(function (j) { return j.id; });
    var fora = js.filter(function (j) { return idsPodio.indexOf(j.id) < 0; });

    var preciso = melhor(js, function (j) { return j.accuracy || 0; });
    var rapido = melhor(js, function (j) { return j.wpm || 0; });
    var excel = melhor(fora, function (j) { return (j.mcq_ok || 0) + (j.form_feitas || 0); });
    var esforcado = melhor(fora, function (j) { return j.segmentos || 0; });

    var linhaPremio = function (icone, titulo, jog, extra) {
      return '<tr><td class="pi">' + icone + '</td><td class="pt">' + titulo + '</td>' +
        '<td class="pn">' + (jog ? esc(jog.nickname) : '<i>ninguém</i>') + '</td>' +
        '<td class="pv">' + (jog ? extra(jog) : '') + '</td></tr>';
    };

    var podioHTML = top3.map(function (j, i) {
      var m = ['🥇', '🥈', '🥉'][i];
      return '<div class="pod pod' + (i + 1) + '">' +
        '<div class="pm">' + m + '</div>' +
        '<div class="pnome">' + esc(j.nickname) + '</div>' +
        '<div class="ppts">' + (j.score || 0) + ' pts</div>' +
        '<div class="psub">' + (j.wpm || 0) + ' PPM · ' + Math.round(j.accuracy || 0) + '% · ' +
          (j.mcq_ok || 0) + '/' + (j.mcq_tot || 0) + ' Excel</div>' +
        '</div>';
    }).join('');

    var tabelaHTML = js.map(function (j, i) {
      var nv = nivel(j.wpm || 0, j.accuracy || 0);
      return '<tr>' +
        '<td>' + (i + 1) + 'º</td>' +
        '<td class="nome">' + esc(j.nickname) + '</td>' +
        '<td>' + nv.e + ' ' + nv.n + '</td>' +
        '<td>' + (j.wpm || 0) + '</td>' +
        '<td>' + Math.round(j.accuracy || 0) + '%</td>' +
        '<td>x' + (j.combo_max || 0) + '</td>' +
        '<td>' + (j.segmentos || 0) + '</td>' +
        '<td>' + (j.form_feitas || 0) + '</td>' +
        '<td>' + (j.mcq_ok || 0) + '/' + (j.mcq_tot || 0) + '</td>' +
        '<td>' + (j.score || 0) + '</td>' +
        '</tr>';
    }).join('');

    // contagem de medalhas
    var N = js.length;
    var medalhas =
      '<p class="med"><b>Medalhas para esta turma (' + N + ' alunos):</b> ' +
      '3 pódio + ' + Math.max(0, N - 3) + ' participação + 5 insígnia = <b>' + (Math.max(0, N - 3) + 8) + '</b> no total. ' +
      '<span class="obs">(pódio não recebe participação; alguns alunos ganham 2 medalhas)</span></p>';

    $('conteudo').innerHTML =
      '<div class="cab">' +
        '<h1>Resultado — Sala ' + esc(cod) + '</h1>' +
        '<p>' + hoje + ' · ' + dur + ' min · ' + N + ' alunos</p>' +
        '<button class="imp" onclick="window.print()">🖨️ Imprimir</button>' +
      '</div>' +

      '<h2>Pódio</h2><div class="podio">' + podioHTML + '</div>' +

      '<h2>Insígnias</h2>' +
      '<table class="premios">' +
        linhaPremio('🎯', 'Mais Preciso(a)', preciso, function (j) { return Math.round(j.accuracy) + '% de precisão'; }) +
        linhaPremio('⚡', 'Mais Rápido(a)', rapido, function (j) { return (j.wpm || 0) + ' PPM'; }) +
        linhaPremio('📊', 'Craque do Excel', excel, function (j) { return (j.mcq_ok || 0) + '/' + (j.mcq_tot || 0) + ' perguntas · ' + (j.form_feitas || 0) + ' fórmulas'; }) +
        linhaPremio('🧗', 'Mais Esforçado(a)', esforcado, function (j) { return (j.segmentos || 0) + ' trechos completados'; }) +
        '<tr><td class="pi">🪑</td><td class="pt">Melhor Postura</td><td class="pn">________________________</td><td class="pv">(você escolhe durante a aula)</td></tr>' +
      '</table>' +
      '<p class="nota">🎯 e ⚡ podem ser de qualquer aluno. 📊 🧗 são de quem ficou fora do pódio.</p>' +

      '<h2>Turma completa</h2>' +
      '<table class="turma">' +
        '<thead><tr><th>#</th><th>Nome</th><th>Nível</th><th>PPM</th><th>Precisão</th><th>Combo</th><th>Trechos</th><th>Fórm.</th><th>Perg.</th><th>Pontos</th></tr></thead>' +
        '<tbody>' + tabelaHTML + '</tbody>' +
      '</table>' +
      medalhas +
      '<p class="rodape">Guarde/imprima esta página antes de reiniciar ou encerrar a sala — os dados são apagados.</p>';
  }

  carregar();
})();

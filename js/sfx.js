// js/sfx.js — sons sintetizados (Web Audio). Sem arquivos, sem download.
// SFX.tecla() SFX.erro() SFX.acerto() SFX.combo() SFX.tick() SFX.ja()
// SFX.urgente() SFX.vitoria() SFX.bom() SFX.neutro()
// SFX.ligado / SFX.alternar() / SFX.montarBotao(el)

(function (global) {
  'use strict';

  var ctx = null, master = null;
  // som LIGADO por padrao; so fica mudo se o usuario desativar de proposito.
  // (chave nova: reseta quem tinha mutado em testes antigos)
  var CHAVE = 'lumen_som3';
  var ligado = true;
  try { ligado = localStorage.getItem(CHAVE) !== '0'; } catch (e) {}

  function init() {
    if (ctx) return ctx;
    var AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    } catch (e) { ctx = null; }
    return ctx;
  }

  // navegadores só liberam áudio depois de um clique/tecla do usuário
  function acordar() {
    var c = init();
    if (c && c.state === 'suspended') c.resume();
  }
  ['pointerdown', 'keydown'].forEach(function (ev) {
    global.addEventListener(ev, acordar, { once: false, passive: true });
  });

  // ---- bloco básico: um oscilador com envelope ----
  function nota(o) {
    var c = init();
    if (!c || !ligado) return;
    var t = c.currentTime + (o.atraso || 0);
    var osc = c.createOscillator();
    var g = c.createGain();
    var destino = g;

    osc.type = o.tipo || 'triangle';
    osc.frequency.setValueAtTime(o.f, t);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, t + (o.dur || 0.1));

    if (o.filtro) {
      var lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = o.filtro;
      g.connect(lp); lp.connect(master);
      destino = g;
    } else {
      g.connect(master);
    }

    var vol = o.vol == null ? 0.2 : o.vol;
    var dur = o.dur || 0.1;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    osc.connect(destino);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function acorde(notas, tipo, vol) {
    notas.forEach(function (n, i) {
      nota({ f: n.f, dur: n.d || 0.16, atraso: n.t || i * 0.08, tipo: tipo || 'triangle', vol: vol || 0.22 });
    });
  }

  var API = {
    // clique curto e macio a cada tecla certa (frequência varia um pouco)
    tecla: function () {
      nota({ f: 900 + Math.random() * 220, f2: 560, dur: 0.045, tipo: 'triangle', vol: 0.11 });
    },
    // tecla errada: grave e curto
    erro: function () {
      nota({ f: 170, f2: 110, dur: 0.13, tipo: 'sawtooth', vol: 0.16, filtro: 700 });
    },
    // trecho concluído
    acerto: function () {
      acorde([{ f: 660, t: 0 }, { f: 880, t: 0.07 }], 'triangle', 0.2);
    },
    // subiu de nível no combo
    combo: function () {
      acorde([{ f: 880, t: 0, d: 0.08 }, { f: 1320, t: 0.06, d: 0.1 }], 'square', 0.13);
    },
    // contagem regressiva 3 2 1
    tick: function () {
      nota({ f: 720, dur: 0.11, tipo: 'square', vol: 0.2 });
    },
    ja: function () {
      acorde([{ f: 660, t: 0, d: 0.1 }, { f: 990, t: 0.08, d: 0.22 }], 'square', 0.26);
    },
    // últimos segundos do cronômetro
    urgente: function () {
      nota({ f: 480, dur: 0.09, tipo: 'square', vol: 0.18 });
    },
    // final: campeão / pódio
    vitoria: function () {
      acorde([
        { f: 523, t: 0.00, d: 0.16 }, { f: 659, t: 0.11, d: 0.16 },
        { f: 784, t: 0.22, d: 0.16 }, { f: 1047, t: 0.33, d: 0.42 }
      ], 'triangle', 0.26);
    },
    // final: metade de cima
    bom: function () {
      acorde([{ f: 523, t: 0, d: 0.18 }, { f: 659, t: 0.12, d: 0.18 }, { f: 784, t: 0.24, d: 0.3 }], 'triangle', 0.22);
    },
    // final: encorajador
    neutro: function () {
      acorde([{ f: 440, t: 0, d: 0.2 }, { f: 587, t: 0.14, d: 0.32 }], 'triangle', 0.2);
    },

    get ligado() { return ligado; },

    alternar: function () {
      ligado = !ligado;
      try { localStorage.setItem(CHAVE, ligado ? '1' : '0'); } catch (e) {}
      if (ligado) { acordar(); API.tecla(); }
      return ligado;
    },

    // cria o botãozinho de mudo dentro de um elemento
    montarBotao: function (host) {
      if (!host) return;
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'btnSom';
      var pinta = function () {
        b.textContent = ligado ? '🔊' : '🔇';
        b.title = ligado ? 'Desligar sons' : 'Ligar sons';
        b.classList.toggle('mudo', !ligado);
      };
      b.onclick = function () { API.alternar(); pinta(); };
      pinta();
      host.appendChild(b);
      return b;
    }
  };

  global.SFX = API;
})(window);

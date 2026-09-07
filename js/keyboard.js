// js/keyboard.js — Teclado ABNT2 (Brasil) em SVG, com guia de dedos.
// API:
//   KB.mount(elemento, { legenda:true })
//   KB.cue('á')   -> acende a(s) tecla(s) para digitar esse caractere
//   KB.cue(null)  -> apaga
//   KB.hide() / KB.show()

(function (global) {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';

  // Cor por dedo
  var DEDOS = {
    lm: { c: '#a855f7', n: 'Mín. E' },
    la: { c: '#3b82f6', n: 'Anel. E' },
    lc: { c: '#06b6d4', n: 'Méd. E' },
    li: { c: '#22c55e', n: 'Ind. E' },
    ri: { c: '#eab308', n: 'Ind. D' },
    rc: { c: '#f97316', n: 'Méd. D' },
    ra: { c: '#ec4899', n: 'Anel. D' },
    rm: { c: '#ef4444', n: 'Mín. D' },
    pl: { c: '#94a3b8', n: 'Polegar' }
  };

  // Layout: cada tecla = [id, largura(u), dedo, rótulo, subrótulo]
  var LINHAS = [
    [['APOS',1,'lm',"'",'"'],['1',1,'lm','1','!'],['2',1,'la','2','@'],['3',1,'lc','3','#'],
     ['4',1,'li','4','$'],['5',1,'li','5','%'],['6',1,'ri','6','¨'],['7',1,'ri','7','&'],
     ['8',1,'rc','8','*'],['9',1,'ra','9','('],['0',1,'rm','0',')'],['MINUS',1,'rm','-','_'],
     ['EQUAL',1,'rm','=','+'],['BACK',2,'rm','⌫','']],

    [['TAB',1.5,'lm','⇥',''],['Q',1,'lm','Q',''],['W',1,'la','W',''],['E',1,'lc','E',''],
     ['R',1,'li','R',''],['T',1,'li','T',''],['Y',1,'ri','Y',''],['U',1,'ri','U',''],
     ['I',1,'rc','I',''],['O',1,'ra','O',''],['P',1,'rm','P',''],['ACUTE',1,'rm','´','`'],
     ['BRAL',1,'rm','[','{'],['ENTER',1.5,'rm','⏎','']],

    [['CAPS',1.5,'lm','⇪',''],['A',1,'lm','A',''],['S',1,'la','S',''],['D',1,'lc','D',''],
     ['F',1,'li','F',''],['G',1,'li','G',''],['H',1,'ri','H',''],['J',1,'ri','J',''],
     ['K',1,'rc','K',''],['L',1,'ra','L',''],['CC',1,'rm','Ç',''],['TILDE',1,'rm','~','^'],
     ['BRAR',1,'rm',']','}']],

    [['LSHIFT',1.5,'lm','⇧',''],['BSLASH',1,'lm','\\','|'],['Z',1,'lm','Z',''],['X',1,'la','X',''],
     ['C',1,'lc','C',''],['V',1,'li','V',''],['B',1,'li','B',''],['N',1,'ri','N',''],
     ['M',1,'ri','M',''],['COMMA',1,'rc',',','<'],['DOT',1,'ra','.','>'],['SEMI',1,'rm',';',':'],
     ['SLASH',1,'rm','/','?'],['RSHIFT',1.5,'rm','⇧','']],

    [['LCTRL',1.25,'lm','Ctrl',''],['LWIN',1.25,'lm','❖',''],['LALT',1.25,'lc','Alt',''],
     ['SPACE',6.25,'pl','',''],['ALTGR',1.25,'rc','AltGr',''],['RWIN',1.25,'ra','❖',''],
     ['MENU',1.25,'rm','☰',''],['RCTRL',1.25,'rm','Ctrl','']]
  ];

  var TECLA_DEDO = {};
  LINHAS.forEach(function (l) { l.forEach(function (k) { TECLA_DEDO[k[0]] = k[2]; }); });

  var U = 76, GAP = 7, STEP = U + GAP, PADX = 16, PADY = 16;
  var LARG = 15 * STEP - GAP + PADX * 2;
  var ALT = 5 * STEP - GAP + PADY * 2;

  var refs = {};   // id -> { g, rect, badge }
  var root, svg, legendaEl;

  function el(name, attrs) {
    var e = document.createElementNS(NS, name);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }

  function injetarCSS() {
    if (document.getElementById('kb-css')) return;
    var s = document.createElement('style');
    s.id = 'kb-css';
    s.textContent = [
      '.kb-wrap{width:100%;max-width:1040px;margin:0 auto}',
      '.kb-wrap svg{width:100%;height:auto;display:block;overflow:visible}',
      '.kb-key rect.cap{fill:#fff;stroke:#dbe3ea;stroke-width:2;transition:stroke .12s}',
      '.kb-key text{font-family:Nunito,system-ui,sans-serif;font-weight:900;fill:#5b6b7c;pointer-events:none;transition:fill .12s}',
      '.kb-key text.sub{fill:#aab7c4;font-weight:800}',
      '.kb-key rect.strip{opacity:.75}',
      '.kb-key{transition:transform .1s}',
      '.kb-key.cue{transform:translateY(-1px)}',
      '.kb-key.cue rect.cap{stroke-width:2.5}',
      '.kb-key.cue text{fill:#fff}',
      '.kb-key.cue text.sub{fill:rgba(255,255,255,.75)}',
      '.kb-key.cue rect.strip{opacity:0}',
      '.kb-key.step2 rect.cap{opacity:.82}',
      '.kb-key text.kb-badge{fill:#0f172a;font-size:15px;font-weight:900}',
      '.kb-key .kb-badge-bg{fill:#fff;stroke:#0f172a;stroke-width:2}',
      '@keyframes kbpulse{0%,100%{stroke-opacity:1}50%{stroke-opacity:.2}}',
      '.kb-key.cue rect.ring{stroke:#0f172a;stroke-width:3;fill:none;animation:kbpulse 1s ease-in-out infinite}',
      '.kb-legenda{display:flex;flex-wrap:wrap;gap:8px 16px;justify-content:center;margin-top:14px}',
      '.kb-legenda span{display:flex;align-items:center;gap:6px;font-size:.82rem;font-weight:800;color:#5b6b7c}',
      '.kb-legenda i{width:13px;height:13px;border-radius:4px;display:block}'
    ].join('');
    document.head.appendChild(s);
  }

  function mount(container, opts) {
    opts = opts || {};
    injetarCSS();
    root = document.createElement('div');
    root.className = 'kb-wrap';
    svg = el('svg', { viewBox: '0 0 ' + LARG + ' ' + ALT, role: 'img', 'aria-label': 'Teclado guia' });

    var y = PADY;
    LINHAS.forEach(function (linha) {
      var x = PADX;
      linha.forEach(function (k) {
        var id = k[0], w = k[1], dedo = k[2], rot = k[3], sub = k[4];
        var kw = w * STEP - GAP;
        var kh = (id === 'ENTER') ? (2 * STEP - GAP) : (STEP - GAP);
        var g = el('g', { class: 'kb-key', 'data-id': id });

        g.appendChild(el('rect', { class: 'cap', x: x, y: y, width: kw, height: kh, rx: 8 }));

        if (DEDOS[dedo]) {
          g.appendChild(el('rect', {
            class: 'strip', x: x + 8, y: y + kh - 8, width: kw - 16, height: 5, rx: 2.5,
            fill: DEDOS[dedo].c
          }));
        }

        var ring = el('rect', { class: 'ring', x: x + 2, y: y + 2, width: kw - 4, height: kh - 4, rx: 8 });
        ring.style.display = 'none';
        g.appendChild(ring);

        // legenda principal: grande e centralizada (Ctrl/Alt/AltGr ficam menores)
        var longa = rot.length > 2;
        var diacritico = '´`~^¨'.indexOf(rot) >= 0;   // acentos: glifo minusculo, precisa de corpo maior
        var fs = longa ? 15 : diacritico ? 40 : 26;
        var cy = sub ? (y + kh * 0.66) : (y + kh / 2 + fs * 0.35);
        if (diacritico) cy = y + kh * 0.78;
        var big = el('text', { x: x + kw / 2, y: cy, 'font-size': fs, 'text-anchor': 'middle' });
        big.textContent = rot;
        g.appendChild(big);

        // segundo caractere (Shift) no canto de cima
        if (sub) {
          var st = el('text', { class: 'sub', x: x + kw / 2, y: y + 22, 'font-size': 15, 'text-anchor': 'middle' });
          st.textContent = sub;
          g.appendChild(st);
        }

        var bg = el('circle', { class: 'kb-badge-bg', cx: x + kw - 12, cy: y + 12, r: 11 });
        var bt = el('text', { class: 'kb-badge', x: x + kw - 12, y: y + 17, 'text-anchor': 'middle' });
        bg.style.display = 'none'; bt.style.display = 'none';
        g.appendChild(bg); g.appendChild(bt);

        svg.appendChild(g);
        refs[id] = { g: g, cap: g.querySelector('.cap'), dedo: dedo, ring: ring, bg: bg, bt: bt };
        x += w * STEP;
      });
      y += STEP;
    });

    root.appendChild(svg);

    if (opts.legenda) {
      legendaEl = document.createElement('div');
      legendaEl.className = 'kb-legenda';
      ['lm', 'la', 'lc', 'li', 'ri', 'rc', 'ra', 'rm', 'pl'].forEach(function (d) {
        var s = document.createElement('span');
        s.innerHTML = '<i style="background:' + DEDOS[d].c + '"></i>' + DEDOS[d].n;
        legendaEl.appendChild(s);
      });
      root.appendChild(legendaEl);
    }

    container.appendChild(root);
  }

  // caractere -> lista de passos [{id, shift}]
  function sequencia(ch) {
    if (ch === ' ') return [{ id: 'SPACE' }];
    if (ch === '\n' || ch === '\t') return null;

    var acentos = {
      'á': ['ACUTE', 'A'], 'é': ['ACUTE', 'E'], 'í': ['ACUTE', 'I'], 'ó': ['ACUTE', 'O'], 'ú': ['ACUTE', 'U'],
      'ç': ['CC'], 'ã': ['TILDE', 'A'], 'õ': ['TILDE', 'O'],
      'â': [{ id: 'TILDE', shift: true }, 'A'], 'ê': [{ id: 'TILDE', shift: true }, 'E'], 'ô': [{ id: 'TILDE', shift: true }, 'O'],
      'à': [{ id: 'ACUTE', shift: true }, 'A']
    };
    var low = ch.toLowerCase();
    if (acentos[low]) {
      var maiusc = (low !== ch);
      return acentos[low].map(function (p, i, arr) {
        var o = (typeof p === 'string') ? { id: p } : { id: p.id, shift: p.shift };
        if (i === arr.length - 1 && maiusc) o.shift = true;
        return o;
      });
    }
    if (ch >= 'a' && ch <= 'z') return [{ id: ch.toUpperCase() }];
    if (ch >= 'A' && ch <= 'Z') return [{ id: ch, shift: true }];
    if (ch >= '0' && ch <= '9') return [{ id: ch }];

    var direto = { "'": 'APOS', ',': 'COMMA', '.': 'DOT', ';': 'SEMI', '/': 'SLASH',
      '-': 'MINUS', '=': 'EQUAL', '[': 'BRAL', ']': 'BRAR', '\\': 'BSLASH', '´': 'ACUTE', '~': 'TILDE' };
    var comShift = { '!': '1', '@': '2', '#': '3', '$': '4', '%': '5', '&': '7', '*': '8',
      '(': '9', ')': '0', '_': 'MINUS', '+': 'EQUAL', '"': 'APOS', ':': 'SEMI', '?': 'SLASH',
      '<': 'COMMA', '>': 'DOT', '{': 'BRAL', '}': 'BRAR', '|': 'BSLASH', '`': 'ACUTE', '^': 'TILDE' };

    if (direto[ch]) return [{ id: direto[ch] }];
    if (comShift[ch]) return [{ id: comShift[ch], shift: true }];
    return null;
  }

  function limpar() {
    for (var id in refs) {
      var r = refs[id];
      r.g.classList.remove('cue', 'step2');
      r.cap.style.fill = '';
      r.ring.style.display = 'none';
      r.bg.style.display = 'none';
      r.bt.style.display = 'none';
    }
  }

  function marca(id, ordem, total) {
    var r = refs[id];
    if (!r) return;
    r.g.classList.add('cue');
    if (ordem === 2) r.g.classList.add('step2');
    var cor = DEDOS[r.dedo] ? DEDOS[r.dedo].c : '#0f172a';
    r.cap.style.fill = cor;                 // style vence o CSS da folha
    r.ring.style.display = '';
    if (total > 1) {
      r.bg.style.display = '';
      r.bt.style.display = '';
      r.bt.textContent = ordem;
    }
  }

  function cue(ch) {
    limpar();
    if (ch == null) return;
    var seq = sequencia(ch);
    if (!seq) return;
    seq.forEach(function (passo, i) {
      marca(passo.id, i + 1, seq.length);
      if (passo.shift) {
        var dedo = TECLA_DEDO[passo.id] || '';
        var sh = (dedo.charAt(0) === 'l') ? 'RSHIFT' : 'LSHIFT';
        marca(sh, i + 1, seq.length);
      }
    });
  }

  function hide() { if (root) root.style.display = 'none'; }
  function show() { if (root) root.style.display = ''; }

  global.KB = { mount: mount, cue: cue, hide: hide, show: show };

})(window);

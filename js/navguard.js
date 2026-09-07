// js/navguard.js — trava a setinha "voltar" do navegador (e o F5 / fechar aba).
//
// NavGuard.instalar(decidir)
//   decidir() deve devolver, conforme o momento da tela:
//     'livre'                          -> deixa sair normalmente
//     { bloqueado: 'aviso' }           -> nao deixa sair de jeito nenhum
//     { pergunta: 'texto', sair: fn }  -> confirma; se aceitar, chama sair()
//
// NavGuard.liberar()  -> desarma antes de uma navegacao que o proprio app faz
//                        (senao o navegador pergunta duas vezes).
//
// Detalhe importante: uma barreira so no historico nao segura. Se a pessoa
// aperta "voltar" varias vezes rapido, os popstate chegam em rajada e um deles
// escapa antes da gente repor a barreira. Por isso mantemos VARIAS entradas
// empilhadas e repomos de forma sincrona, antes de qualquer alert/confirm
// (que travam a thread).

(function (global) {
  'use strict';

  var FOLGA = 5;               // quantas entradas de barreira manter
  var decidir = null, armado = false, barreiras = 0;

  function empilhar(n) {
    for (var i = 0; i < n; i++) {
      try { history.pushState({ ng: ++barreiras }, '', location.href); } catch (e) { return; }
    }
  }

  function reporBarreiras() {
    // sincrono e antes de qualquer dialogo
    empilhar(Math.max(1, FOLGA - 1));
  }

  function estado() {
    if (!decidir) return 'livre';
    return decidir() || 'livre';
  }

  function aoVoltar() {
    var d = estado();

    if (d === 'livre') {
      // sair de verdade: pula todas as barreiras que empilhamos
      var pulos = barreiras + 1;
      barreiras = 0;
      try { history.go(-pulos); } catch (e) { history.back(); }
      return;
    }

    reporBarreiras();

    if (d.bloqueado) { alert(d.bloqueado); return; }
    if (d.pergunta && confirm(d.pergunta)) {
      liberar();
      if (typeof d.sair === 'function') d.sair();
    }
  }

  // cobre F5 e fechar a aba (o navegador mostra o aviso padrao dele)
  function aoDescarregar(e) {
    if (estado() === 'livre') return;
    e.preventDefault();
    e.returnValue = '';
    return '';
  }

  function liberar() {
    decidir = null;
    global.removeEventListener('beforeunload', aoDescarregar);
  }

  global.NavGuard = {
    instalar: function (fn) {
      decidir = fn;
      if (armado) return;
      armado = true;
      empilhar(FOLGA);
      global.addEventListener('popstate', aoVoltar);
      global.addEventListener('beforeunload', aoDescarregar);
    },
    liberar: liberar
  };

})(window);

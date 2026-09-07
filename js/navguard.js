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

(function (global) {
  'use strict';

  var decidir = null, armado = false;

  function barreira() {
    try { history.pushState({ ng: 1 }, '', location.href); } catch (e) {}
  }

  function estado() {
    if (!decidir) return 'livre';
    var d = decidir();
    return d || 'livre';
  }

  function aoVoltar() {
    var d = estado();
    if (d === 'livre') { history.back(); return; }   // deixa a setinha funcionar

    barreira();                                       // recoloca a trava
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
      barreira();
      global.addEventListener('popstate', aoVoltar);
      global.addEventListener('beforeunload', aoDescarregar);
    },
    liberar: liberar
  };

})(window);

// js/lobby.js — tela de perfil (escolher avatar + nome)

var params = new URLSearchParams(location.search);
var salaId = params.get('sala_id');
var modo = params.get('modo');

var avatarAtual = 1;
var totalImagens = 17;

function mudarAvatar(dir) {
  avatarAtual += dir;
  if (avatarAtual > totalImagens) avatarAtual = 1;
  if (avatarAtual < 1) avatarAtual = totalImagens;

  var img = document.getElementById('avatarImg');
  img.src = 'img/img' + avatarAtual + '.jpeg';
  img.style.transform = 'scale(1.12)';
  setTimeout(function () { img.style.transform = 'scale(1)'; }, 150);
}

async function entrarNaCorrida() {
  var nick = document.getElementById('nickname').value.trim().toUpperCase();
  if (!nick) return alert('Ei! Digite o seu nome antes de entrar!');

  var img = 'img' + avatarAtual + '.jpeg';

  if (modo === 'solo') {
    location.href = 'corrida.html?modo=solo&nick=' + encodeURIComponent(nick) + '&avatar=' + img;
    return;
  }

  var r = await db.from('jogadores').insert([{
    sala_id: salaId,
    nickname: nick,
    avatar_id: img,
    progresso: 0,
    wpm: 0,
    score: 0
  }]).select();

  if (r.error) { alert('Erro ao entrar: ' + r.error.message); return; }
  location.href = 'corrida.html?sala_id=' + salaId + '&jogador_id=' + r.data[0].id;
}

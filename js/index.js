// js/index.js

function mostrarConfiguracoes() {
  document.getElementById('painelPrincipal').style.display = 'none';
  document.getElementById('painelConfig').style.display = 'block';
}

function voltarPrincipal() {
  document.getElementById('painelConfig').style.display = 'none';
  document.getElementById('painelPrincipal').style.display = 'block';
}

async function gerarSala() {
  var min = parseInt(document.getElementById('duracao').value, 10) || 15;
  var codigo = Math.floor(100000 + Math.random() * 900000).toString();

  var r = await db.from('salas').insert([{
    codigo: codigo,
    texto_desafio: 'trilha',
    limite_jogadores: 25,
    duracao_seg: min * 60,
    status: 'lobby'
  }]).select();

  if (r.error) {
    alert('Erro ao criar a sala. Rodou o supabase_setup.sql?\n\n' + r.error.message);
    console.error(r.error);
    return;
  }
  location.href = 'tv.html?sala_id=' + r.data[0].id;
}

async function entrarNaSala() {
  var codigo = document.getElementById('codigoSala').value.trim();
  if (!codigo) return alert('Digite o código da sala!');

  var r = await db.from('salas').select('id, status').eq('codigo', codigo).single();
  if (r.error || !r.data) {
    alert('Sala não encontrada. Confira o código!');
    return;
  }
  location.href = 'lobby.html?sala_id=' + r.data.id;
}

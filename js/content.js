// js/content.js — Trilha de conteúdo do LumenType
// Mesma sequência para todos os alunos (é avaliação). Dificuldade sobe aos poucos.
// Quando o aluno termina toda a lista, a "cauda" (faixa média) volta embaralhada
// até o relógio global zerar.

(function (global) {

  // -------- FAIXA 1 — Aquecimento (linha de base: a s d f g h j k l ç + espaço)
  const aquecimento = [
    'fff jjj fff jjj fj fj jf jf fj jf',
    'ddd kkk sss lll ded kik sls lkl',
    'asdf jklç asdf jklç asdf jklç',
    'gg hh gh hg fg jh fg jh dg hk',
    'sala gala fada lala haja asas',
    'dedo lado jaca faca gado laje',
  ].map(function (s) { return { t: 'text', s: s, faixa: 1 }; });

  // -------- FAIXA 2 — Palavras e frases curtas
  const curtas = [
    'o rato roeu a roupa do rei de roma',
    'hoje o dia esta bonito e ensolarado',
    'gosto de estudar informatica na escola',
    'a raposa marrom pula sobre o cachorro',
    'meu computador liga bem mais rapido agora',
    'vamos aprender a digitar sem olhar o teclado',
    'o teclado tem letras numeros e simbolos',
    'pratique um pouco todos os dias para melhorar',
    'a barra de espaco separa uma palavra da outra',
    'clique com o mouse e depois comece a escrever',
    'salvar o arquivo evita perder o trabalho feito',
    'cada pasta guarda arquivos de um mesmo assunto',
  ].map(function (s) { return { t: 'text', s: s, faixa: 2 }; });

  // -------- EXCEL — digitar fórmula
  const formulas = [
    { t: 'formula', s: '=SOMA(A1:A10)', dica: 'Soma tudo de A1 até A10' },
    { t: 'formula', s: '=MÉDIA(B2:B9)', dica: 'Média dos valores de B2 a B9' },
    { t: 'formula', s: '=MÁXIMO(C1:C20)', dica: 'Maior valor do intervalo' },
    { t: 'formula', s: '=SE(D2>=7;"APROVADO";"REPROVADO")', dica: 'Se a nota for 7 ou mais, aprova' },
    { t: 'formula', s: '=CONT.SE(E2:E30;">5")', dica: 'Conta quantas células são maiores que 5' },
    { t: 'formula', s: '=PROCV(A2;G:H;2;FALSO)', dica: 'Procura A2 na tabela e traz a 2ª coluna' },
    { t: 'formula', s: '=HOJE()', dica: 'Mostra a data de hoje' },
    { t: 'formula', s: '=ARRED(F2;2)', dica: 'Arredonda F2 com 2 casas decimais' },
  ];

  // -------- EXCEL — múltipla escolha (responde com 1 2 3 4 ou clique)
  const quiz = [
    { t: 'mcq', q: 'Qual função soma um intervalo de células?', op: ['=MÉDIA', '=SOMA', '=CONT.SE', '=SE'], c: 1 },
    { t: 'mcq', q: 'Toda fórmula do Excel começa com qual símbolo?', op: ['+', '#', '=', '@'], c: 2 },
    { t: 'mcq', q: 'Em =SE(A1>10;"SIM";"NÃO"), se A1 vale 5 aparece:', op: ['SIM', 'NÃO', '10', 'ERRO'], c: 1 },
    { t: 'mcq', q: 'O sinal de multiplicação no Excel é:', op: ['x', '*', '.', ':'], c: 1 },
    { t: 'mcq', q: '=PROCV serve para:', op: ['Somar valores', 'Procurar um valor numa tabela', 'Contar células', 'Arredondar'], c: 1 },
    { t: 'mcq', q: 'Qual função mostra a data atual?', op: ['=DIA()', '=DATA()', '=HOJE()', '=MÊS()'], c: 2 },
    { t: 'mcq', q: 'Para somar as células A1 e B1 você escreve:', op: ['=A1+B1', 'A1+B1', 'SOMA A1 B1', '+A1B1'], c: 0 },
    { t: 'mcq', q: '=MÉDIA(A1:A4) calcula:', op: ['A soma', 'O maior valor', 'A média aritmética', 'A quantidade'], c: 2 },
  ];

  // -------- FAIXA 4 — Frases médias / parágrafos curtos (neutros) => é a CAUDA que repete
  const medias = [
    'A internet é uma rede que conecta milhões de computadores no mundo inteiro e permite trocar informações em segundos.',
    'O mouse e o teclado são os principais dispositivos de entrada: é por meio deles que enviamos comandos para a máquina.',
    'Salvar o trabalho com frequência evita a perda de arquivos quando falta energia ou o programa fecha sem avisar.',
    'Uma planilha organiza dados em linhas e colunas, e cada cruzamento de uma linha com uma coluna é chamado de célula.',
    'A digitação com todos os dedos exige treino, mas depois de algumas semanas as mãos aprendem o caminho das teclas.',
    'O sistema operacional é o programa que controla o computador e faz com que os outros aplicativos funcionem.',
    'Fazer cópias de segurança dos arquivos importantes em outro lugar protege contra defeitos no disco e imprevistos.',
    'Use a tecla Shift para as letras maiúsculas e a barra de espaço para separar cada palavra da seguinte.',
    'Um bom nome de arquivo descreve o conteúdo e ajuda a encontrar o documento depois, sem abrir um por um.',
    'A pasta funciona como uma gaveta digital: dentro dela guardamos arquivos parecidos para manter tudo organizado.',
  ].map(function (s) { return { t: 'text', s: s, faixa: 4 }; });

  // -------- Monta a ordem final, intercalando Excel no meio
  var extras = [];
  for (var i = 0; i < Math.max(formulas.length, quiz.length); i++) {
    if (formulas[i]) extras.push(formulas[i]);
    if (quiz[i]) extras.push(quiz[i]);
  }

  var base = aquecimento.concat(curtas).concat(medias);
  var LISTA = [];
  var ei = 0;
  for (var k = 0; k < base.length; k++) {
    LISTA.push(base[k]);
    // a cada 3 segmentos, depois do aquecimento, encaixa um de Excel
    if (k >= aquecimento.length && (k - aquecimento.length) % 3 === 2 && ei < extras.length) {
      LISTA.push(extras[ei++]);
    }
  }
  while (ei < extras.length) LISTA.push(extras[ei++]);

  var LOOP_FROM = LISTA.findIndex(function (x) { return x.faixa === 4; });
  if (LOOP_FROM < 0) LOOP_FROM = LISTA.length - medias.length;

  global.CONTENT = { LISTA: LISTA, LOOP_FROM: LOOP_FROM };

})(window);

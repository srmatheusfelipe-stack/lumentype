# LumenType — Projeto Lumen (Lar de Maria)

Jogo de digitação para a avaliação/competição dos alunos de informática.
Mini-maratona de 10 a 20 minutos: aquecimento na linha de base → palavras e frases →
fórmulas de Excel e perguntas rápidas → parágrafos curtos. Todos começam e terminam
juntos; o professor acompanha o ranking ao vivo no telão.

HTML/CSS/JS puro + Supabase. Sem build, sem servidor próprio.

## Como colocar no ar (GitHub Pages)

1. **Banco (uma vez):** no painel do Supabase → *SQL Editor* → cole e rode o
   conteúdo de [`supabase_setup.sql`](supabase_setup.sql). Confirme também que o
   *Realtime* está ligado nas tabelas `salas` e `jogadores`.
2. **Repositório:** suba esta pasta para um repositório **público** no GitHub.
3. **Pages:** *Settings → Pages → Build and deployment → Source: Deploy from a branch*,
   branch `main`, pasta `/ (root)`. Em ~1 min sai a URL fixa
   (`https://SEU-USUARIO.github.io/NOME-DO-REPO/`).
4. Nos 15 notebooks: abrir a URL (um QR code na lousa ajuda) e digitar o código da sala.

O `.nojekyll` já está incluído para o GitHub Pages servir os arquivos como estão.

## Como usar na aula

1. Professor abre a URL → **Criar Sala (Professor)** → escolhe a duração → a tela do
   telão aparece com o código de 6 dígitos. Deixe essa tela no projetor.
2. Alunos abrem a URL → digitam o código → escolhem avatar e nome → caem no lobby.
3. Quando a turma estiver dentro, o professor clica **Iniciar Competição**.
   Contagem sincronizada, todos jogam ao mesmo tempo.
4. Durante o jogo: ranking ao vivo no telão (reordena sozinho), cronômetro global.
5. No fim: pódio + prêmios (Mais Preciso, Mais Rápido, Maior Sequência, Mais Esforçado).
   - **Voltar ao Lobby** → zera os pontos, mantém os perfis, todos voltam para a espera.
   - **Encerrar Sala** → apaga os dados da partida e volta ao início.

## Modo Solo

Botão **Treino Solo** na tela inicial: 5 minutos, sem sala e sem banco. Serve para
testar o jogo sozinho.

## Estrutura

| Arquivo | O que faz |
|---|---|
| `index.html` / `js/index.js` | entrada, criar/entrar na sala |
| `lobby.html` / `js/lobby.js` | escolher avatar e nome |
| `corrida.html` / `js/engine.js` | o jogo (aluno) |
| `tv.html` / `js/tv.js` | painel do professor: lobby, ranking ao vivo, pódio |
| `js/content.js` | a trilha de conteúdo (frases, fórmulas, perguntas) |
| `js/keyboard.js` | teclado ABNT2 em SVG com guia de dedos |
| `js/supabase.js` | conexão com o Supabase |

Para mudar/adicionar textos, fórmulas ou perguntas, edite `js/content.js`.

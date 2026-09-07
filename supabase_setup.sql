-- ============================================================
-- LumenType — setup do banco (rodar no SQL Editor do Supabase)
-- Idempotente: seguro rodar mais de uma vez.
-- ATENCAO: os nomes das colunas abaixo sao exatamente os que o
-- codigo usa. Nao traduza para portugues.
-- ============================================================

-- 1. Colunas em SALAS
alter table public.salas
  add column if not exists status            text,
  add column if not exists limite_jogadores  integer default 25,
  add column if not exists duracao_seg       integer not null default 900,
  add column if not exists started_at        timestamptz,
  add column if not exists ends_at           timestamptz;

alter table public.salas alter column status set default 'lobby';
update public.salas set status = 'lobby' where status is null;

-- 2. Colunas em JOGADORES
alter table public.jogadores
  add column if not exists progresso   integer      not null default 0,
  add column if not exists wpm         integer      not null default 0,
  add column if not exists score       integer      not null default 0,
  add column if not exists accuracy    numeric(5,2) not null default 100,
  add column if not exists combo_max   integer      not null default 0,
  add column if not exists segmentos   integer      not null default 0,
  add column if not exists finished_at timestamptz;

-- 3. Realtime
do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname='supabase_realtime' and schemaname='public' and tablename='salas') then
    execute 'alter publication supabase_realtime add table public.salas';
  end if;
  if not exists (select 1 from pg_publication_tables
                 where pubname='supabase_realtime' and schemaname='public' and tablename='jogadores') then
    execute 'alter publication supabase_realtime add table public.jogadores';
  end if;
end $$;

-- 4. RLS — sala de aula sem login: chave anonima liberada
alter table public.salas     enable row level security;
alter table public.jogadores enable row level security;

drop policy if exists "salas_all" on public.salas;
create policy "salas_all" on public.salas
  for all to anon using (true) with check (true);

drop policy if exists "jogadores_all" on public.jogadores;
create policy "jogadores_all" on public.jogadores
  for all to anon using (true) with check (true);

-- 5. Conferencia: deve listar as colunas novas
select table_name, column_name
from information_schema.columns
where table_schema='public'
  and table_name in ('salas','jogadores')
  and column_name in ('status','duracao_seg','started_at','ends_at',
                      'score','accuracy','combo_max','segmentos','finished_at')
order by table_name, column_name;

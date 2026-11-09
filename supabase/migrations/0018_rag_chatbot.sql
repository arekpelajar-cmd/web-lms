create extension if not exists vector with schema extensions;

create table public.modul_embeddings (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.materials (id) on delete cascade,
  module_id uuid not null references public.modules (id) on delete cascade,
  class_id uuid not null references public.classes (id) on delete cascade,
  material_title text not null,
  module_title text not null,
  chunk_index integer not null check (chunk_index >= 0),
  content text not null check (length(trim(content)) > 0),
  embedding extensions.vector(768) not null,
  created_at timestamptz not null default now(),
  unique (material_id, chunk_index)
);

create index modul_embeddings_class_id_idx
  on public.modul_embeddings (class_id);

create index modul_embeddings_embedding_idx
  on public.modul_embeddings
  using hnsw (embedding extensions.vector_cosine_ops);

alter table public.modul_embeddings enable row level security;

create policy modul_embeddings_admin_all on public.modul_embeddings
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy modul_embeddings_teacher_select on public.modul_embeddings
  for select to authenticated
  using (public.teaches_class(class_id));

create policy modul_embeddings_teacher_insert on public.modul_embeddings
  for insert to authenticated
  with check (public.teaches_class(class_id));

create policy modul_embeddings_teacher_update on public.modul_embeddings
  for update to authenticated
  using (public.teaches_class(class_id))
  with check (public.teaches_class(class_id));

create policy modul_embeddings_teacher_delete on public.modul_embeddings
  for delete to authenticated
  using (public.teaches_class(class_id));

create policy modul_embeddings_student_select on public.modul_embeddings
  for select to authenticated
  using (
    class_id = public.my_class_id()
    and public.can_access_material(material_id)
  );

create or replace function public.match_modul(
  query_embedding extensions.vector(768),
  filter_class_id uuid,
  match_threshold double precision default 0.35,
  match_count integer default 5
)
returns table (
  material_id uuid,
  material_title text,
  module_title text,
  chunk_index integer,
  content text,
  similarity double precision
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    me.material_id,
    me.material_title,
    me.module_title,
    me.chunk_index,
    me.content,
    (1 - (me.embedding OPERATOR(extensions.<=>) query_embedding))::double precision as similarity
  from public.modul_embeddings as me
  where me.class_id = filter_class_id
    and (1 - (me.embedding OPERATOR(extensions.<=>) query_embedding)) >= match_threshold
  order by me.embedding OPERATOR(extensions.<=>) query_embedding
  limit least(greatest(coalesce(match_count, 5), 1), 10);
$$;

revoke all on function public.match_modul(extensions.vector, uuid, double precision, integer)
  from public, anon;
grant execute on function public.match_modul(extensions.vector, uuid, double precision, integer)
  to authenticated;

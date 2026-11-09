alter table public.materials
  add column if not exists is_pre_class boolean not null default false,
  add column if not exists pre_class_due_at timestamptz;

alter table public.quizzes
  add column if not exists purpose text not null default 'practice';

alter table public.quizzes
  drop constraint if exists quizzes_purpose_check,
  add constraint quizzes_purpose_check
    check (purpose in ('practice', 'pre_test'));

create or replace function public.can_access_material(p_material_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_module_id uuid;
  v_class_id uuid;
  v_order_idx integer;
  v_is_pre_class boolean;
  v_prev_uncompleted integer;
begin
  select p.role into v_role
  from public.profiles p
  where p.id = auth.uid();

  if v_role is null then
    return false;
  end if;

  if v_role = 'admin' then
    return true;
  end if;

  select mat.module_id, mod.class_id, mat.order_index, mat.is_pre_class
  into v_module_id, v_class_id, v_order_idx, v_is_pre_class
  from public.materials mat
  join public.modules mod on mod.id = mat.module_id
  where mat.id = p_material_id;

  if v_module_id is null then
    return false;
  end if;

  if v_role = 'teacher' then
    return public.teaches_class(v_class_id);
  end if;

  if v_role = 'student' then
    if not exists (
      select 1
      from public.enrollments e
      where e.student_id = auth.uid() and e.class_id = v_class_id
    ) then
      return false;
    end if;

    if v_is_pre_class then
      return true;
    end if;

    select count(*) into v_prev_uncompleted
    from public.materials prev_mat
    where prev_mat.module_id = v_module_id
      and prev_mat.order_index < v_order_idx
      and not exists (
        select 1
        from public.material_completions mc
        where mc.student_id = auth.uid() and mc.material_id = prev_mat.id
      );

    return v_prev_uncompleted = 0;
  end if;

  return false;
end;
$$;

create table public.gamification_events (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  class_id uuid not null references public.classes (id) on delete cascade,
  event_key text not null,
  event_type text not null check (
    event_type in (
      'preclass_material_completed',
      'pretest_submitted',
      'pretest_passed',
      'pretest_perfect'
    )
  ),
  points integer not null check (points > 0),
  created_at timestamptz not null default now(),
  unique (student_id, event_key)
);

create index gamification_events_class_points_idx
  on public.gamification_events (class_id, student_id);

create table public.student_badges (
  student_id uuid not null references public.profiles (id) on delete cascade,
  class_id uuid not null references public.classes (id) on delete cascade,
  badge_code text not null check (
    badge_code in ('preclass_ready', 'pretest_pass', 'perfect_score')
  ),
  earned_at timestamptz not null default now(),
  primary key (student_id, class_id, badge_code)
);

alter table public.gamification_events enable row level security;
alter table public.student_badges enable row level security;

create policy gamification_events_read_authorized on public.gamification_events
  for select to authenticated
  using (
    student_id = auth.uid()
    or public.is_admin()
    or public.teaches_class(class_id)
  );

create policy student_badges_read_authorized on public.student_badges
  for select to authenticated
  using (
    student_id = auth.uid()
    or public.is_admin()
    or public.teaches_class(class_id)
  );

revoke all on public.gamification_events, public.student_badges from anon, authenticated;
grant select on public.gamification_events, public.student_badges to authenticated;

create or replace function public.award_gamification_points(
  p_student_id uuid,
  p_class_id uuid,
  p_event_key text,
  p_event_type text,
  p_points integer
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.gamification_events (
    student_id, class_id, event_key, event_type, points
  )
  values (p_student_id, p_class_id, p_event_key, p_event_type, p_points)
  on conflict (student_id, event_key) do nothing;
$$;

revoke all on function public.award_gamification_points(uuid, uuid, text, text, integer)
  from public, anon, authenticated;

create or replace function public.award_preclass_ready_badge(
  p_student_id uuid,
  p_class_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.materials mat
    join public.modules mod on mod.id = mat.module_id
    where mod.class_id = p_class_id and mat.is_pre_class
  ) or exists (
    select 1
    from public.materials mat
    join public.modules mod on mod.id = mat.module_id
    where mod.class_id = p_class_id
      and mat.is_pre_class
      and not exists (
        select 1
        from public.material_completions mc
        where mc.student_id = p_student_id and mc.material_id = mat.id
      )
  ) then
    return;
  end if;

  if not exists (
    select 1
    from public.quizzes q
    left join public.modules mod on mod.id = q.module_id
    where q.purpose = 'pre_test'
      and coalesce(q.class_id, mod.class_id) = p_class_id
  ) or exists (
    select 1
    from public.quizzes q
    left join public.modules mod on mod.id = q.module_id
    where q.purpose = 'pre_test'
      and coalesce(q.class_id, mod.class_id) = p_class_id
      and not exists (
        select 1
        from public.quiz_attempts qa
        where qa.student_id = p_student_id
          and qa.quiz_id = q.id
          and qa.status = 'submitted'
      )
  ) then
    return;
  end if;

  insert into public.student_badges (student_id, class_id, badge_code)
  values (p_student_id, p_class_id, 'preclass_ready')
  on conflict (student_id, class_id, badge_code) do nothing;
end;
$$;

revoke all on function public.award_preclass_ready_badge(uuid, uuid)
  from public, anon, authenticated;

create or replace function public.award_preclass_material_completion(
  p_student_id uuid,
  p_material_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_class_id uuid;
begin
  select mod.class_id into v_class_id
  from public.materials mat
  join public.modules mod on mod.id = mat.module_id
  where mat.id = p_material_id and mat.is_pre_class;

  if v_class_id is null then
    return;
  end if;

  if not exists (
    select 1
    from public.enrollments e
    where e.student_id = p_student_id and e.class_id = v_class_id
  ) then
    return;
  end if;

  perform public.award_gamification_points(
    p_student_id,
    v_class_id,
    'preclass-material:' || p_material_id::text,
    'preclass_material_completed',
    5
  );

  perform public.award_preclass_ready_badge(p_student_id, v_class_id);
end;
$$;

revoke all on function public.award_preclass_material_completion(uuid, uuid)
  from public, anon, authenticated;

create or replace function public.handle_preclass_material_completion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.award_preclass_material_completion(new.student_id, new.material_id);
  return new;
end;
$$;

create trigger material_completion_gamification
  after insert on public.material_completions
  for each row execute function public.handle_preclass_material_completion();

create or replace function public.sync_preclass_material_gamification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_completion record;
begin
  if new.is_pre_class and not old.is_pre_class then
    for v_completion in
      select mc.student_id
      from public.material_completions mc
      where mc.material_id = new.id
    loop
      perform public.award_preclass_material_completion(v_completion.student_id, new.id);
    end loop;
  end if;
  return new;
end;
$$;

create trigger material_preclass_gamification_sync
  after update of is_pre_class on public.materials
  for each row execute function public.sync_preclass_material_gamification();

create or replace function public.award_pretest_attempt(p_attempt_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt record;
begin
  select
    qa.student_id,
    qa.quiz_id,
    qa.score,
    qa.passed,
    qa.status,
    q.purpose,
    coalesce(q.class_id, mod.class_id) as class_id
  into v_attempt
  from public.quiz_attempts qa
  join public.quizzes q on q.id = qa.quiz_id
  left join public.modules mod on mod.id = q.module_id
  where qa.id = p_attempt_id;

  if v_attempt.status <> 'submitted'
    or v_attempt.purpose <> 'pre_test'
    or v_attempt.class_id is null
  then
    return;
  end if;

  if not exists (
    select 1
    from public.enrollments e
    where e.student_id = v_attempt.student_id
      and e.class_id = v_attempt.class_id
  ) then
    return;
  end if;

  perform public.award_gamification_points(
    v_attempt.student_id,
    v_attempt.class_id,
    'pretest-submitted:' || v_attempt.quiz_id::text,
    'pretest_submitted',
    10
  );

  if v_attempt.passed then
    perform public.award_gamification_points(
      v_attempt.student_id,
      v_attempt.class_id,
      'pretest-passed:' || v_attempt.quiz_id::text,
      'pretest_passed',
      10
    );

    insert into public.student_badges (student_id, class_id, badge_code)
    values (v_attempt.student_id, v_attempt.class_id, 'pretest_pass')
    on conflict (student_id, class_id, badge_code) do nothing;
  end if;

  if v_attempt.score >= 100 then
    perform public.award_gamification_points(
      v_attempt.student_id,
      v_attempt.class_id,
      'pretest-perfect:' || v_attempt.quiz_id::text,
      'pretest_perfect',
      10
    );

    insert into public.student_badges (student_id, class_id, badge_code)
    values (v_attempt.student_id, v_attempt.class_id, 'perfect_score')
    on conflict (student_id, class_id, badge_code) do nothing;
  end if;

  perform public.award_preclass_ready_badge(v_attempt.student_id, v_attempt.class_id);
end;
$$;

revoke all on function public.award_pretest_attempt(uuid)
  from public, anon, authenticated;

create or replace function public.handle_pretest_attempt_gamification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.award_pretest_attempt(new.id);
  return new;
end;
$$;

create trigger quiz_attempt_gamification
  after insert or update of status, score, passed on public.quiz_attempts
  for each row execute function public.handle_pretest_attempt_gamification();

create or replace function public.sync_pretest_gamification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt record;
begin
  if new.purpose = 'pre_test' and old.purpose <> 'pre_test' then
    for v_attempt in
      select id
      from public.quiz_attempts
      where quiz_id = new.id and status = 'submitted'
    loop
      perform public.award_pretest_attempt(v_attempt.id);
    end loop;
  end if;
  return new;
end;
$$;

create trigger quiz_pretest_gamification_sync
  after update of purpose on public.quizzes
  for each row execute function public.sync_pretest_gamification();

create or replace function public.get_class_gamification(p_class_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_result jsonb;
begin
  select p.role into v_role
  from public.profiles p
  where p.id = auth.uid();

  if v_role is null then
    raise exception 'Profil pengguna tidak ditemukan';
  end if;

  if v_role = 'student' and not exists (
    select 1 from public.enrollments e
    where e.student_id = auth.uid() and e.class_id = p_class_id
  ) then
    raise exception 'Anda tidak terdaftar di kelas ini';
  end if;

  if v_role = 'teacher' and not public.teaches_class(p_class_id) then
    raise exception 'Anda tidak mengajar di kelas ini';
  end if;

  if v_role not in ('student', 'teacher', 'admin') then
    raise exception 'Role pengguna tidak diizinkan';
  end if;

  with standings as (
    select
      e.student_id,
      p.name,
      coalesce(sum(ge.points), 0)::integer as points,
      row_number() over (
        order by coalesce(sum(ge.points), 0) desc, p.name asc, e.student_id
      )::integer as rank
    from public.enrollments e
    join public.profiles p on p.id = e.student_id
    left join public.gamification_events ge
      on ge.student_id = e.student_id and ge.class_id = e.class_id
    where e.class_id = p_class_id
    group by e.student_id, p.name
  )
  select jsonb_build_object(
    'my_points',
    coalesce((
      select sum(ge.points)::integer
      from public.gamification_events ge
      where ge.student_id = auth.uid() and ge.class_id = p_class_id
    ), 0),
    'my_rank',
    (select s.rank from standings s where s.student_id = auth.uid()),
    'badges',
    coalesce((
      select jsonb_agg(
        jsonb_build_object('code', b.badge_code, 'earned_at', b.earned_at)
        order by b.earned_at
      )
      from public.student_badges b
      where b.student_id = auth.uid() and b.class_id = p_class_id
    ), '[]'::jsonb),
    'leaderboard',
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'student_id', top_students.student_id,
          'name', top_students.name,
          'points', top_students.points,
          'rank', top_students.rank
        )
        order by top_students.rank
      )
      from (
        select s.student_id, s.name, s.points, s.rank
        from standings s
        order by s.rank
        limit 10
      ) top_students
    ), '[]'::jsonb)
  )
  into v_result;

  return v_result;
end;
$$;

revoke all on function public.get_class_gamification(uuid) from public, anon;
grant execute on function public.get_class_gamification(uuid) to authenticated;

create table public.fe_user_memory (
 user_id uuid primary key references auth.users(id) on delete cascade,
 consent boolean not null default false,
 preferences text not null default '' check (char_length(preferences)<=1000),
 messages jsonb not null default '[]'::jsonb check (jsonb_typeof(messages)='array' and jsonb_array_length(messages)<=100 and octet_length(messages::text)<=250000),
 updated_at timestamptz not null default now(),
 check (consent or (preferences='' and messages='[]'::jsonb))
);
alter table public.fe_user_memory enable row level security;
revoke all on public.fe_user_memory from public, anon, authenticated;
grant select,insert,update,delete on public.fe_user_memory to authenticated;
grant all on public.fe_user_memory to service_role;
create policy fe_memory_select on public.fe_user_memory for select to authenticated using ((select auth.uid())=user_id);
create policy fe_memory_insert on public.fe_user_memory for insert to authenticated with check ((select auth.uid())=user_id);
create policy fe_memory_update on public.fe_user_memory for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy fe_memory_delete on public.fe_user_memory for delete to authenticated using ((select auth.uid())=user_id);

-- F35: agregar solo genero en usuarios (fechaNacimiento ya existe)

alter table public.usuarios
  add column if not exists genero text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'usuarios_genero_check'
      and conrelid = 'public.usuarios'::regclass
  ) then
    alter table public.usuarios
      add constraint usuarios_genero_check
      check (
        genero is null
        or lower(trim(genero)) in ('hombre', 'mujer', 'no_definido')
      );
  end if;

end $$;

create index if not exists usuarios_genero_idx on public.usuarios (genero);

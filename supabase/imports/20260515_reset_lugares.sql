begin;

create table if not exists public."_bak_LugaresTuristicos_20260515" as
select * from public."LugaresTuristicos";

create table if not exists public."_bak_lugarCategoria_20260515" as
select * from public."lugarCategoria";

create table if not exists public."_bak_imagenesLugares_20260515" as
select * from public."imagenesLugares";

create table if not exists public."_bak_horariosLugares_20260515" as
select * from public."horariosLugares";

create table if not exists public."_bak_favoritosLugares_20260515" as
select * from public."favoritosLugares";

delete from public."favoritosLugares";
delete from public."horariosLugares";
delete from public."imagenesLugares";
delete from public."lugarCategoria";
delete from public."LugaresTuristicos";

commit;

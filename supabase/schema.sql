-- Seawolf SAI · esquema de reservas
-- Ejecutar completo en Supabase > SQL Editor. Es idempotente (se puede correr varias veces).

create extension if not exists pgcrypto;

-- ---------- Tablas ----------
create table if not exists public.sw_config (
  k text primary key,
  v text not null
);

create table if not exists public.sw_catalogo (
  id text primary key,
  tipo text not null check (tipo in ('hotel','embarcacion','vehiculo')),
  nombre text not null,
  descripcion text default '',
  precio numeric not null default 0,      -- hotel: por noche · embarcación: por persona · vehículo: por día
  capacidad int not null default 1,       -- hotel: huéspedes · embarcación: cupos por día · vehículo: puestos
  unidades int not null default 1,        -- hotel: apartamentos iguales · vehículo: unidades en flota
  imagenes text[] not null default '{}',
  activo boolean not null default true,
  orden int not null default 0
);

create table if not exists public.sw_reservas (
  id uuid primary key default gen_random_uuid(),
  codigo text unique not null,
  tipo text not null,
  item_id text references public.sw_catalogo(id) on delete set null,
  item_nombre text,
  nombre text not null,
  email text,
  telefono text,
  ciudad text,
  personas int not null default 1,
  cantidad int not null default 1,
  fecha_inicio date not null,
  fecha_fin date not null,
  total numeric not null default 0,
  notas text,
  estado text not null default 'pendiente' check (estado in ('pendiente','activo','usado','cancelado')),
  creado timestamptz not null default now(),
  activado timestamptz,
  usado timestamptz
);

create index if not exists sw_reservas_item_fechas on public.sw_reservas (item_id, fecha_inicio, fecha_fin);

alter table public.sw_config   enable row level security;
alter table public.sw_catalogo enable row level security;
alter table public.sw_reservas enable row level security;

-- El catálogo es público para lectura; reservas y config solo vía funciones.
drop policy if exists sw_catalogo_read on public.sw_catalogo;
create policy sw_catalogo_read on public.sw_catalogo for select using (true);

insert into public.sw_config (k, v) values ('admin_pass', extensions.crypt('1234', extensions.gen_salt('bf')))
on conflict (k) do nothing;

-- ---------- Utilidades ----------
create or replace function public.sw_es_admin(p_pass text) returns boolean
language sql security definer set search_path = public, extensions as $$
  select exists (select 1 from sw_config where k = 'admin_pass' and v = crypt(p_pass, v));
$$;

create or replace function public.sw_assert_admin(p_pass text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not sw_es_admin(p_pass) then raise exception 'Contraseña de administrador incorrecta'; end if;
end $$;

-- Unidades / cupos ya tomados de un ítem en un rango de fechas
create or replace function public.sw_ocupado(p_item text, p_ini date, p_fin date) returns int
language plpgsql security definer set search_path = public as $$
declare t text; n int;
begin
  select tipo into t from sw_catalogo where id = p_item;
  if t = 'embarcacion' then
    select coalesce(sum(personas),0) into n from sw_reservas
     where item_id = p_item and estado <> 'cancelado' and fecha_inicio = p_ini;
  elsif t = 'hotel' then
    -- noches: [inicio, fin)
    select coalesce(sum(cantidad),0) into n from sw_reservas
     where item_id = p_item and estado <> 'cancelado'
       and fecha_inicio < p_fin and fecha_fin > p_ini;
  else
    -- días de alquiler: [inicio, fin] inclusivo
    select coalesce(sum(cantidad),0) into n from sw_reservas
     where item_id = p_item and estado <> 'cancelado'
       and fecha_inicio <= p_fin and fecha_fin >= p_ini;
  end if;
  return n;
end $$;

-- Disponibilidad pública: cuántas unidades (hotel/vehículo) o cupos (embarcación) quedan
create or replace function public.sw_disponible(p_item text, p_ini date, p_fin date) returns int
language plpgsql security definer set search_path = public as $$
declare c sw_catalogo;
begin
  select * into c from sw_catalogo where id = p_item and activo;
  if not found then return 0; end if;
  if c.tipo = 'embarcacion' then
    return greatest(c.capacidad - sw_ocupado(p_item, p_ini, p_ini), 0);
  end if;
  return greatest(c.unidades - sw_ocupado(p_item, p_ini, p_fin), 0);
end $$;

-- ---------- Público: crear reserva ----------
create or replace function public.sw_crear_reserva(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  c sw_catalogo;
  v_ini date := (p->>'fecha_inicio')::date;
  v_fin date := coalesce(nullif(p->>'fecha_fin','')::date, (p->>'fecha_inicio')::date);
  v_personas int := greatest(coalesce((p->>'personas')::int, 1), 1);
  v_cant int := greatest(coalesce((p->>'cantidad')::int, 1), 1);
  v_libre int; v_total numeric; v_dias int; v_codigo text; r sw_reservas;
begin
  select * into c from sw_catalogo where id = p->>'item_id' and activo;
  if not found then raise exception 'El servicio no existe o no está disponible'; end if;
  if coalesce(trim(p->>'nombre'),'') = '' then raise exception 'Escribe tu nombre'; end if;
  if v_ini is null or v_ini < current_date then raise exception 'Elige una fecha desde hoy en adelante'; end if;
  if v_fin < v_ini then raise exception 'La fecha final debe ser posterior a la inicial'; end if;

  -- serializa reservas del mismo ítem para no sobrevender
  perform pg_advisory_xact_lock(hashtext(c.id));
  v_libre := sw_disponible(c.id, v_ini, v_fin);

  if c.tipo = 'hotel' then
    if v_fin = v_ini then raise exception 'La salida debe ser al menos una noche después de la llegada'; end if;
    v_cant := 1;
    if v_personas > c.capacidad then raise exception 'Este alojamiento admite máximo % personas', c.capacidad; end if;
    if v_libre < 1 then raise exception 'No hay disponibilidad para esas fechas'; end if;
    v_dias := v_fin - v_ini;
    v_total := c.precio * v_dias;
  elsif c.tipo = 'embarcacion' then
    v_fin := v_ini; v_cant := 1;
    if v_libre < v_personas then raise exception 'Solo quedan % cupos ese día', v_libre; end if;
    v_total := c.precio * v_personas;
  else
    if v_libre < v_cant then raise exception 'Solo quedan % unidades para esas fechas', v_libre; end if;
    v_dias := v_fin - v_ini + 1;
    v_total := c.precio * v_dias * v_cant;
  end if;

  loop
    v_codigo := 'SW-' || upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 10));
    exit when not exists (select 1 from sw_reservas where codigo = v_codigo);
  end loop;

  insert into sw_reservas (codigo, tipo, item_id, item_nombre, nombre, email, telefono, ciudad,
                           personas, cantidad, fecha_inicio, fecha_fin, total, notas)
  values (v_codigo, c.tipo, c.id, c.nombre, trim(p->>'nombre'), p->>'email', p->>'telefono',
          initcap(trim(coalesce(p->>'ciudad',''))), v_personas, v_cant, v_ini, v_fin, v_total, p->>'notas')
  returning * into r;

  return jsonb_build_object('codigo', r.codigo, 'total', r.total, 'estado', r.estado,
    'item_nombre', r.item_nombre, 'fecha_inicio', r.fecha_inicio, 'fecha_fin', r.fecha_fin,
    'personas', r.personas, 'cantidad', r.cantidad, 'nombre', r.nombre);
end $$;

-- ---------- Público / trabajador: consultar y validar QR ----------
create or replace function public.sw_validar_qr(p_codigo text) returns jsonb
language sql security definer set search_path = public as $$
  select jsonb_build_object('codigo', codigo, 'estado', estado, 'tipo', tipo, 'item_nombre', item_nombre,
    'nombre', nombre, 'personas', personas, 'cantidad', cantidad, 'fecha_inicio', fecha_inicio,
    'fecha_fin', fecha_fin, 'total', total, 'activado', activado, 'usado', usado)
  from sw_reservas where codigo = upper(trim(p_codigo));
$$;

create or replace function public.sw_registrar_ingreso(p_codigo text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r sw_reservas;
begin
  update sw_reservas set estado = 'usado', usado = now()
   where codigo = upper(trim(p_codigo)) and estado = 'activo'
  returning * into r;
  if not found then raise exception 'Solo se puede registrar el ingreso de un QR activo'; end if;
  return sw_validar_qr(r.codigo);
end $$;

-- ---------- Admin (todas exigen la contraseña) ----------
create or replace function public.sw_admin_login(p_pass text) returns boolean
language sql security definer set search_path = public, extensions as $$ select sw_es_admin(p_pass); $$;

create or replace function public.sw_admin_reservas(p_pass text) returns setof public.sw_reservas
language plpgsql security definer set search_path = public as $$
begin
  perform sw_assert_admin(p_pass);
  return query select * from sw_reservas order by creado desc;
end $$;

create or replace function public.sw_admin_estado(p_pass text, p_id uuid, p_estado text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform sw_assert_admin(p_pass);
  update sw_reservas set estado = p_estado,
    activado = case when p_estado = 'activo' then coalesce(activado, now()) when p_estado = 'pendiente' then null else activado end,
    usado = case when p_estado = 'usado' then coalesce(usado, now()) when p_estado in ('pendiente','activo') then null else usado end
  where id = p_id;
end $$;

create or replace function public.sw_admin_editar_reserva(p_pass text, p_id uuid, p jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform sw_assert_admin(p_pass);
  update sw_reservas set
    nombre = coalesce(p->>'nombre', nombre),
    email = coalesce(p->>'email', email),
    telefono = coalesce(p->>'telefono', telefono),
    ciudad = coalesce(initcap(p->>'ciudad'), ciudad),
    personas = coalesce((p->>'personas')::int, personas),
    cantidad = coalesce((p->>'cantidad')::int, cantidad),
    fecha_inicio = coalesce((p->>'fecha_inicio')::date, fecha_inicio),
    fecha_fin = coalesce((p->>'fecha_fin')::date, fecha_fin),
    total = coalesce((p->>'total')::numeric, total),
    notas = coalesce(p->>'notas', notas)
  where id = p_id;
end $$;

create or replace function public.sw_admin_borrar_reserva(p_pass text, p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform sw_assert_admin(p_pass);
  delete from sw_reservas where id = p_id;
end $$;

create or replace function public.sw_admin_guardar_item(p_pass text, p jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform sw_assert_admin(p_pass);
  insert into sw_catalogo (id, tipo, nombre, descripcion, precio, capacidad, unidades, imagenes, activo, orden)
  values (p->>'id', p->>'tipo', p->>'nombre', coalesce(p->>'descripcion',''), coalesce((p->>'precio')::numeric,0),
          coalesce((p->>'capacidad')::int,1), coalesce((p->>'unidades')::int,1),
          coalesce(array(select jsonb_array_elements_text(p->'imagenes')), '{}'),
          coalesce((p->>'activo')::boolean, true), coalesce((p->>'orden')::int, 0))
  on conflict (id) do update set tipo = excluded.tipo, nombre = excluded.nombre, descripcion = excluded.descripcion,
    precio = excluded.precio, capacidad = excluded.capacidad, unidades = excluded.unidades,
    imagenes = excluded.imagenes, activo = excluded.activo, orden = excluded.orden;
end $$;

create or replace function public.sw_admin_borrar_item(p_pass text, p_id text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform sw_assert_admin(p_pass);
  delete from sw_catalogo where id = p_id;
end $$;

create or replace function public.sw_admin_cambiar_pass(p_pass text, p_nueva text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform sw_assert_admin(p_pass);
  if length(coalesce(p_nueva,'')) < 4 then raise exception 'La nueva contraseña necesita al menos 4 caracteres'; end if;
  update sw_config set v = crypt(p_nueva, gen_salt('bf')) where k = 'admin_pass';
end $$;

-- Permisos: el rol anónimo solo ejecuta funciones, nunca toca tablas de reservas directamente
revoke all on public.sw_reservas, public.sw_config from anon, authenticated;
grant select on public.sw_catalogo to anon, authenticated;
revoke execute on function public.sw_es_admin(text), public.sw_assert_admin(text), public.sw_ocupado(text,date,date) from public, anon, authenticated;
grant execute on function
  public.sw_disponible(text,date,date), public.sw_crear_reserva(jsonb), public.sw_validar_qr(text),
  public.sw_registrar_ingreso(text), public.sw_admin_login(text), public.sw_admin_reservas(text),
  public.sw_admin_estado(text,uuid,text), public.sw_admin_editar_reserva(text,uuid,jsonb),
  public.sw_admin_borrar_reserva(text,uuid), public.sw_admin_guardar_item(text,jsonb),
  public.sw_admin_borrar_item(text,text), public.sw_admin_cambiar_pass(text,text)
to anon, authenticated;

-- ---------- Catálogo inicial (precios en COP, editables desde el dashboard) ----------
insert into public.sw_catalogo (id, tipo, nombre, descripcion, precio, capacidad, unidades, imagenes, orden) values
 ('apto-economico', 'hotel', 'Apartamento económico centro', 'En plena zona comercial. Cocina equipada, aire acondicionado, baño privado, Wi-Fi y dos camas dobles.', 280000, 4, 2, '{img/i17.webp,img/i16.webp}', 1),
 ('apto-vista-mar', 'hotel', 'Apartamento con vista al mar', 'Zona tranquila y céntrica, a pasos de la playa y el muelle. Piscina al aire libre y portería 24 horas.', 420000, 6, 1, '{img/i16.webp,img/i7.webp}', 2),
 ('loft-piscina', 'hotel', 'Loft con piscina en el centro', 'Frente a la playa y el comercio, con piscina al aire libre y portería 24 horas.', 360000, 4, 1, '{img/i17.webp,img/i9.webp}', 3),
 ('mystic-blue', 'hotel', 'Mystic Blue House', 'Casa campestre con piscina privada, cuatro habitaciones y aseo diario, a 5 minutos de Spratt Bay.', 950000, 8, 1, '{img/i5.webp,img/i16.webp}', 4),
 ('apto-lujo', 'hotel', 'Apartamento de lujo', 'A 100 m de la playa y el malecón. Agua caliente, internet rápido y capacidad para seis personas.', 520000, 6, 1, '{img/i17.webp,img/i3.webp}', 5),
 ('atico-lujo', 'hotel', 'Ático de lujo', 'Vistas abiertas, piscina privada y la playa a dos minutos caminando.', 780000, 6, 1, '{img/i16.webp,img/i7.webp}', 6),
 ('lancha-deportiva', 'embarcacion', 'Lancha deportiva · tour de cayos', 'Johnny Cay, Acuario y Haynes Cay con capitán y acompañamiento.', 180000, 12, 1, '{img/i6.webp,img/i11.webp}', 1),
 ('yate-pesca', 'embarcacion', 'Yate de pesca deportiva', 'Media jornada de pesca con equipo incluido y tripulación local.', 350000, 8, 1, '{img/i14.webp,img/i11.webp}', 2),
 ('velero-atardecer', 'embarcacion', 'Velero al atardecer', 'Navegación tranquila para ver caer el sol sobre el mar de siete colores.', 220000, 10, 1, '{img/i3.webp,img/i7.webp}', 3),
 ('ponton-snorkel', 'embarcacion', 'Pontón snorkel y buceo', 'Salida a los arrecifes con equipo de snorkel e instructor.', 200000, 14, 1, '{img/i15.webp,img/i12.webp}', 4),
 ('mulita-4', 'vehiculo', 'Mulita 4 puestos', 'El carrito de golf isleño para recorrer la vuelta a la isla a tu ritmo.', 250000, 4, 6, '{img/i13.webp}', 1),
 ('mulita-6', 'vehiculo', 'Mulita 6 puestos', 'Más espacio para familias y grupos de amigos.', 320000, 6, 4, '{img/i13.webp}', 2),
 ('cuatrimoto', 'vehiculo', 'Cuatrimoto', 'Libertad total sobre ruedas para dos personas.', 220000, 2, 5, '{img/i10.webp}', 3)
on conflict (id) do nothing;

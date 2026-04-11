-- Migracion para automatizar recordatorios mensuales por WhatsApp.
-- Ejecutar en Supabase SQL Editor.

create extension if not exists pgcrypto;

alter table public.afiliaciones
  add column if not exists dia_recordatorio smallint not null default 20,
  add column if not exists plantilla_mensaje text not null default 'Hola {{nombre}}, este es un recordatorio para renovar tu afiliacion.',
  add column if not exists whatsapp_activo boolean not null default true,
  add column if not exists timezone text not null default 'America/Bogota';

-- Limite recomendado para evitar problemas con meses cortos (Febrero).
alter table public.afiliaciones
  drop constraint if exists afiliaciones_dia_recordatorio_check;

alter table public.afiliaciones
  add constraint afiliaciones_dia_recordatorio_check
  check (dia_recordatorio between 1 and 28);

alter table public.recordatorios
  add column if not exists periodo_mes date,
  add column if not exists estado_envio text not null default 'pendiente',
  add column if not exists enviado_at timestamptz,
  add column if not exists proveedor text,
  add column if not exists proveedor_msg_id text,
  add column if not exists ultimo_error text,
  add column if not exists telefono_destino text;

alter table public.recordatorios
  drop constraint if exists recordatorios_estado_envio_check;

alter table public.recordatorios
  add constraint recordatorios_estado_envio_check
  check (estado_envio in ('pendiente', 'enviado', 'error'));

update public.recordatorios
set periodo_mes = date_trunc('month', coalesce(fecha_recordatorio, created_at::date))::date
where periodo_mes is null;

update public.recordatorios r
set telefono_destino = c.telefono
from public.afiliaciones a
join public.clientes c on c.id = a.cliente_id
where r.afiliacion_id = a.id
  and (r.telefono_destino is null or r.telefono_destino = '');

create unique index if not exists ux_recordatorios_afiliacion_periodo
  on public.recordatorios (afiliacion_id, periodo_mes);

create index if not exists ix_afiliaciones_programacion
  on public.afiliaciones (estado, whatsapp_activo, dia_recordatorio);

create index if not exists ix_recordatorios_pendientes
  on public.recordatorios (estado_envio, enviado, fecha_recordatorio);

create or replace function public.render_plantilla_recordatorio(
  p_plantilla text,
  p_nombre text,
  p_fecha date
)
returns text
language sql
immutable
as $$
  select replace(
    replace(
      replace(coalesce(p_plantilla, ''), '{{nombre}}', coalesce(p_nombre, 'cliente')),
      '{{fecha}}',
      to_char(p_fecha, 'YYYY-MM-DD')
    ),
    '{{mes}}',
    to_char(p_fecha, 'YYYY-MM')
  );
$$;

create or replace function public.crear_recordatorios_del_dia(
  p_target_date date default ((now() at time zone 'America/Bogota')::date)
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted integer := 0;
begin
  insert into public.recordatorios (
    afiliacion_id,
    fecha_recordatorio,
    mensaje,
    enviado,
    created_at,
    periodo_mes,
    estado_envio,
    telefono_destino,
    proveedor
  )
  select
    a.id,
    p_target_date,
    public.render_plantilla_recordatorio(a.plantilla_mensaje, c.nombre, p_target_date),
    false,
    now(),
    date_trunc('month', p_target_date)::date,
    'pendiente',
    c.telefono,
    'twilio-whatsapp'
  from public.afiliaciones a
  join public.clientes c on c.id = a.cliente_id
  where a.estado = 'activa'
    and a.whatsapp_activo = true
    and a.dia_recordatorio = extract(day from p_target_date)::int
    and c.telefono is not null
    and c.telefono <> ''
    and not exists (
      select 1
      from public.recordatorios r
      where r.afiliacion_id = a.id
        and r.periodo_mes = date_trunc('month', p_target_date)::date
    );

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

create or replace view public.recordatorios_pendientes_whatsapp as
select
  r.id,
  r.afiliacion_id,
  r.telefono_destino as telefono,
  r.mensaje
from public.recordatorios r
where r.estado_envio = 'pendiente'
  and r.enviado = false
  and r.fecha_recordatorio <= ((now() at time zone 'America/Bogota')::date);

comment on function public.crear_recordatorios_del_dia(date)
is 'Crea recordatorios solo para afiliaciones activas cuyo dia_recordatorio coincide con la fecha objetivo.';

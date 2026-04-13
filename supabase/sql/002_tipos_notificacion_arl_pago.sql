-- Migracion para cambiar la programacion de recordatorios a tipos:
-- 1) arl: envia 2 dias antes del vencimiento del siguiente mes.
-- 2) pago: envia el mismo dia del siguiente mes.
-- La referencia siempre es fecha_inicio.

alter table public.afiliaciones
  add column if not exists tipo_notificacion text not null default 'arl';

alter table public.afiliaciones
  drop constraint if exists afiliaciones_tipo_notificacion_check;

alter table public.afiliaciones
  add constraint afiliaciones_tipo_notificacion_check
  check (tipo_notificacion in ('arl', 'pago'));

drop index if exists ix_afiliaciones_programacion;

create index if not exists ix_afiliaciones_programacion_tipo
  on public.afiliaciones (estado, whatsapp_activo, tipo_notificacion, fecha_inicio);

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
  with base as (
    select
      a.id as afiliacion_id,
      a.fecha_inicio,
      coalesce(a.tipo_notificacion, 'arl') as tipo_notificacion,
      a.plantilla_mensaje,
      c.nombre,
      c.telefono,
      make_date(
        extract(year from p_target_date)::int,
        extract(month from p_target_date)::int,
        least(
          extract(day from a.fecha_inicio)::int,
          extract(day from (date_trunc('month', p_target_date)::date + interval '1 month - 1 day'))::int
        )
      )::date as fecha_base_mes
    from public.afiliaciones a
    join public.clientes c on c.id = a.cliente_id
    where a.estado = 'activa'
      and a.whatsapp_activo = true
      and a.fecha_inicio is not null
      and c.telefono is not null
      and c.telefono <> ''
  ),
  programacion as (
    select
      b.*,
      case
        when b.tipo_notificacion = 'arl' then (b.fecha_base_mes - interval '2 day')::date
        else b.fecha_base_mes
      end as fecha_programada
    from base b
  )
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
    p.afiliacion_id,
    p_target_date,
    public.render_plantilla_recordatorio(p.plantilla_mensaje, p.nombre, p_target_date),
    false,
    now(),
    date_trunc('month', p_target_date)::date,
    'pendiente',
    p.telefono,
    'twilio-whatsapp'
  from programacion p
  where p.fecha_programada = p_target_date
    and p_target_date > p.fecha_inicio
    and not exists (
      select 1
      from public.recordatorios r
      where r.afiliacion_id = p.afiliacion_id
        and r.periodo_mes = date_trunc('month', p_target_date)::date
    );

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

comment on function public.crear_recordatorios_del_dia(date)
is 'Crea recordatorios automáticos según tipo_notificacion: arl (2 días antes) o pago (mismo día), tomando fecha_inicio como referencia mensual.';

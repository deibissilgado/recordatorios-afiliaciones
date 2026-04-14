-- Limpieza final del esquema antiguo:
-- ya no usamos dia_recordatorio porque la fecha se calcula por tipo_notificacion.

alter table public.afiliaciones
  drop constraint if exists afiliaciones_dia_recordatorio_check;

alter table public.afiliaciones
  drop column if exists dia_recordatorio;

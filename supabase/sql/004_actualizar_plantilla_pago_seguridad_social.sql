-- Ajusta la plantilla de afiliaciones tipo "pago" que aún tengan textos antiguos.

update public.afiliaciones
set plantilla_mensaje = 'Hola {{nombre}}, este es un recordatorio de pago de seguridad social. Fecha sugerida: {{fecha}}.'
where coalesce(tipo_notificacion, 'arl') = 'pago'
  and (
    plantilla_mensaje is null
    or plantilla_mensaje = ''
    or plantilla_mensaje = 'Hola {{nombre}}, este es un recordatorio para renovar tu afiliacion.'
    or plantilla_mensaje = 'Hola {{nombre}}, recuerda renovar tu afiliación. Fecha sugerida: {{fecha}}.'
  );

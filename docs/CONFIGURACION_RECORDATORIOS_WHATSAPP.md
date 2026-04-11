# Configuración de recordatorios automáticos por WhatsApp

Arquitectura objetivo:
- Vercel: frontend y endpoint cron (`/api/cron/recordatorios`)
- Supabase: base de datos y generación de pendientes
- Twilio: envío de mensajes de WhatsApp

## 1) Aplicar migración en Supabase

1. Abre Supabase SQL Editor.
2. Ejecuta el script:
   - `supabase/sql/001_recordatorios_whatsapp.sql`

Qué agrega esta migración:
- Nuevas columnas en `afiliaciones` para programación mensual:
  - `dia_recordatorio` (1-28)
  - `plantilla_mensaje`
  - `whatsapp_activo`
  - `timezone`
- Nuevas columnas en `recordatorios` para trazabilidad de envío.
- Función `crear_recordatorios_del_dia(date)`.
- Vista `recordatorios_pendientes_whatsapp`.

## 2) Variables de entorno en Vercel

Configura estas variables en el proyecto de Vercel:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_WHATSAPP_FROM` (ejemplo: `whatsapp:+14155238886`)

## 3) Configurar Twilio WhatsApp

1. Crea cuenta en Twilio.
2. Activa sandbox o número de WhatsApp Business.
3. Guarda SID, token y remitente (`From`) en variables de entorno.
4. Verifica que los números destino puedan recibir mensajes en tu configuración (sandbox requiere opt-in).

## 4) Programar ejecución automática (Vercel Cron)

Crea un cron diario (ejemplo 9:00 AM Bogotá) que llame:

- `GET /api/cron/recordatorios`
- Header: `Authorization: Bearer <CRON_SECRET>`

Recomendación: ejecutarlo diario. La base solo crea recordatorios cuando coincida `dia_recordatorio`, por ejemplo el 20 de cada mes.

## 5) Prueba manual

Puedes probar manualmente con una fecha específica:

- `GET /api/cron/recordatorios?date=2026-04-20`
- Header: `Authorization: Bearer <CRON_SECRET>`

La respuesta JSON devuelve:
- `recordatoriosCreadosHoy`
- `pendientesRevisados`
- `enviados`
- `errores`
- `telefonosInvalidos`

## 6) Uso desde la app

El formulario de crear cliente ya está preparado para:
- Guardar cliente.
- Crear afiliación activa.
- Definir día de recordatorio (ej. 20).
- Definir plantilla de mensaje.

Variables de plantilla soportadas:
- `{{nombre}}`
- `{{fecha}}`
- `{{mes}}`

## 7) Consulta útil para auditoría

```sql
select
  r.id,
  c.nombre,
  r.fecha_recordatorio,
  r.estado_envio,
  r.enviado,
  r.proveedor_msg_id,
  r.ultimo_error,
  r.enviado_at
from recordatorios r
join afiliaciones a on a.id = r.afiliacion_id
join clientes c on c.id = a.cliente_id
order by r.created_at desc
limit 100;
```

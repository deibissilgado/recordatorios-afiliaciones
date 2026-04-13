# Configuración de recordatorios automáticos por WhatsApp

Arquitectura objetivo:
- Vercel: frontend y endpoint cron (`/api/cron/recordatorios`)
- Supabase: base de datos y generación de pendientes
- Twilio: envío de mensajes de WhatsApp

## 1) Aplicar migración en Supabase

1. Abre Supabase SQL Editor.
2. Ejecuta los scripts en este orden:
   - `supabase/sql/001_recordatorios_whatsapp.sql`
   - `supabase/sql/002_tipos_notificacion_arl_pago.sql`

Qué agregan estas migraciones:
- Nuevas columnas en `afiliaciones` para programación mensual:
  - `tipo_notificacion` (`arl` o `pago`)
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
- `TWILIO_PHONE` (opcional, alternativa a `TWILIO_WHATSAPP_FROM`)

## 3) Configurar Twilio WhatsApp

1. Crea cuenta en Twilio.
2. Activa sandbox o número de WhatsApp Business.
3. Guarda SID, token y remitente (`From`) en variables de entorno.
4. Verifica que los números destino puedan recibir mensajes en tu configuración (sandbox requiere opt-in).

Dónde encontrar cada dato en Twilio:
- `TWILIO_ACCOUNT_SID`: `Twilio Console > Account Dashboard > Account SID`.
- `TWILIO_AUTH_TOKEN`: `Twilio Console > Account Dashboard > Auth Token` (botón Show).
- `TWILIO_WHATSAPP_FROM`:
  - Sandbox: `Messaging > Try it out > Send a WhatsApp message` (valor `From`, normalmente `whatsapp:+14155238886`).
  - Producción: el remitente WhatsApp aprobado en tu cuenta (también en formato `whatsapp:+...`).
- `TWILIO_PHONE` (si lo usas): número Twilio en `Phone Numbers > Manage > Active numbers` (ejemplo `+1...`).

## 3.1) Recuperación de contraseña (Supabase Auth)

Para que funcione `Recuperar clave`:

1. En Supabase ve a `Authentication > URL Configuration`.
2. Define `Site URL` con el dominio de producción de Vercel.
3. Agrega como redirect permitido:
   - `https://TU_DOMINIO/auth/reset-password`
   - `http://localhost:3000/auth/reset-password` (desarrollo)
4. En Vercel define `NEXT_PUBLIC_APP_URL=https://TU_DOMINIO`.

Nota importante:
- Si `redirectTo` no coincide con una URL permitida, Supabase hace fallback a `Site URL`.
- Si `Site URL` está en `localhost`, el correo puede enviarte a `localhost` incluso en producción.

## 4) Programar ejecución automática (Vercel Cron)

Crea un cron diario (ejemplo 9:00 AM Bogotá) que llame:

- `GET /api/cron/recordatorios`
- Header: `Authorization: Bearer <CRON_SECRET>`

Recomendación: ejecutarlo diario. La base crea recordatorios automáticamente según `tipo_notificacion` y `fecha_inicio`.

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

Prueba directa de envío (sin esperar cron):

- `POST /api/enviar-sms`
- Header: `Authorization: Bearer <CRON_SECRET>`
- Body JSON:

```json
{
  "telefono": "3001234567",
  "mensaje": "Prueba real de WhatsApp desde recordatorios"
}
```

## 6) Uso desde la app

El formulario de crear cliente ya está preparado para:
- Guardar cliente.
- Crear afiliación activa.
- Definir tipo de notificación:
  - `Afiliación ARL`: envía 2 días antes del vencimiento del siguiente mes.
  - `Pago seguridad social`: envía el mismo día del siguiente mes.
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

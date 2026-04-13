import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { normalizeWhatsappNumber, sendWhatsappTwilio } from '@/lib/twilio'

type PendienteWhatsapp = {
  id: string
  telefono: string | null
  mensaje: string | null
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function bogotaToday(): string {
  // Fecha en zona horaria de Colombia para que el corte diario sea consistente.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.')
  }

  // Cliente con service role para operar cron interno de forma segura.
  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

export async function GET(request: Request) {
  try {
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret) {
      return NextResponse.json(
        { ok: false, error: 'Falta configurar CRON_SECRET.' },
        { status: 500 }
      )
    }

    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ ok: false, error: 'No autorizado.' }, { status: 401 })
    }

    const url = new URL(request.url)
    const targetDate = url.searchParams.get('date') ?? bogotaToday()

    const supabase = getAdminSupabase()

    // 1) Crear los pendientes del día según la regla mensual de cada afiliación.
    const { data: insertedCount, error: insertError } = await supabase.rpc('crear_recordatorios_del_dia', {
      p_target_date: targetDate,
    })

    if (insertError) {
      return NextResponse.json(
        { ok: false, step: 'crear_recordatorios_del_dia', error: insertError.message },
        { status: 500 }
      )
    }

    // 2) Buscar recordatorios pendientes para enviarlos por WhatsApp.
    const { data: pendingRows, error: pendingError } = await supabase
      .from('recordatorios_pendientes_whatsapp')
      .select('id,telefono,mensaje')
      .limit(500)

    if (pendingError) {
      return NextResponse.json(
        { ok: false, step: 'consultar_pendientes', error: pendingError.message },
        { status: 500 }
      )
    }

    const pendientes = (pendingRows ?? []) as PendienteWhatsapp[]

    let enviados = 0
    let errores = 0
    let telefonosInvalidos = 0

    for (const pendiente of pendientes) {
      const to = normalizeWhatsappNumber(pendiente.telefono)

      if (!to) {
        telefonosInvalidos += 1
        errores += 1

        await supabase
          .from('recordatorios')
          .update({
            estado_envio: 'error',
            ultimo_error: 'Telefono invalido para formato WhatsApp.',
          })
          .eq('id', pendiente.id)

        continue
      }

      const result = await sendWhatsappTwilio(to, pendiente.mensaje ?? '')

      if (result.ok) {
        enviados += 1

        await supabase
          .from('recordatorios')
          .update({
            enviado: true,
            estado_envio: 'enviado',
            enviado_at: new Date().toISOString(),
            proveedor: 'twilio-whatsapp',
            proveedor_msg_id: result.sid ?? null,
            ultimo_error: null,
          })
          .eq('id', pendiente.id)
      } else {
        errores += 1

        await supabase
          .from('recordatorios')
          .update({
            estado_envio: 'error',
            ultimo_error: result.error ?? 'Error desconocido en envío.',
          })
          .eq('id', pendiente.id)
      }
    }

    return NextResponse.json({
      ok: true,
      targetDate,
      pendientesRevisados: pendientes.length,
      recordatoriosCreadosHoy: insertedCount ?? 0,
      enviados,
      errores,
      telefonosInvalidos,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error inesperado en cron.'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

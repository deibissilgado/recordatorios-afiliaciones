import { NextResponse } from 'next/server'
import { normalizeWhatsappNumber, sendWhatsappTwilio } from '@/lib/twilio'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const cronSecret = process.env.CRON_SECRET
    const authHeader = req.headers.get('authorization')

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ ok: false, error: 'No autorizado.' }, { status: 401 })
    }

    const { telefono, mensaje } = await req.json()

    if (!telefono || typeof telefono !== 'string') {
      return NextResponse.json(
        { ok: false, error: 'Debes enviar un teléfono válido.' },
        { status: 400 }
      )
    }

    if (!mensaje || typeof mensaje !== 'string') {
      return NextResponse.json(
        { ok: false, error: 'Debes enviar un mensaje válido.' },
        { status: 400 }
      )
    }

    const to = normalizeWhatsappNumber(telefono)

    if (!to) {
      return NextResponse.json(
        { ok: false, error: 'El teléfono no tiene formato válido para WhatsApp.' },
        { status: 400 }
      )
    }

    const result = await sendWhatsappTwilio(to, mensaje)

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error ?? 'Error enviando mensaje por WhatsApp.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true, to, sid: result.sid })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ ok: false, error: 'Error enviando mensaje por WhatsApp.' }, { status: 500 })
  }
}

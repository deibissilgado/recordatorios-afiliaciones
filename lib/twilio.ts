import twilio from 'twilio'

export type TwilioSendResult = {
  ok: boolean
  sid?: string
  error?: string
}

function normalizeWhatsappFrom(rawFrom: string | undefined): string | null {
  if (!rawFrom) return null

  const trimmed = rawFrom.trim()
  if (!trimmed) return null

  // Permite usar +57... o whatsapp:+57...
  if (trimmed.startsWith('whatsapp:')) {
    return trimmed
  }

  return `whatsapp:${trimmed}`
}

export function normalizeWhatsappNumber(rawPhone: string | null): string | null {
  if (!rawPhone) return null

  // Limpia espacios y símbolos para admitir entradas como "+57 300 123 45 67".
  const digits = rawPhone.replace(/\D/g, '')

  if (digits.length === 10) {
    return `whatsapp:+57${digits}`
  }

  if (digits.length === 12 && digits.startsWith('57')) {
    return `whatsapp:+${digits}`
  }

  if (digits.length >= 8 && digits.length <= 15) {
    return `whatsapp:+${digits}`
  }

  return null
}

export async function sendWhatsappTwilio(to: string, body: string): Promise<TwilioSendResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const from = normalizeWhatsappFrom(
    process.env.TWILIO_WHATSAPP_FROM ?? process.env.TWILIO_PHONE
  )

  if (!accountSid || !authToken || !from) {
    return {
      ok: false,
      error:
        'Faltan variables TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN y TWILIO_WHATSAPP_FROM (o TWILIO_PHONE).',
    }
  }

  try {
    const client = twilio(accountSid, authToken)

    // Usa el SDK oficial de Twilio para estandarizar el envío y el manejo de errores.
    const response = await client.messages.create({
      body,
      from,
      to,
    })

    return {
      ok: true,
      sid: response.sid,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido al enviar.'
    return {
      ok: false,
      error: errorMessage,
    }
  }
}

export function traducirMensajeError(rawMessage: string): string {
  const message = (rawMessage || '').trim()
  const normalized = message.toLowerCase()

  const includes = (text: string) => normalized.includes(text)

  // Traducciones frecuentes de Supabase Auth.
  if (normalized === 'invalid login credentials') return 'Credenciales inválidas.'
  if (includes('email not confirmed')) return 'Debes confirmar tu correo electrónico primero.'
  if (includes('user already registered')) return 'Este correo ya está registrado.'
  if (includes('password should be at least'))
    return 'La contraseña debe tener al menos 6 caracteres.'
  if (includes('unable to validate email address'))
    return 'El correo electrónico no tiene un formato válido.'
  if (includes('signup is disabled'))
    return 'El registro de usuarios está deshabilitado en este momento.'
  if (includes('otp has expired') || includes('token has expired'))
    return 'El enlace o código expiró. Solicita uno nuevo.'
  if (includes('invalid or expired') && includes('link'))
    return 'El enlace no es válido o ya expiró.'
  if (includes('for security purposes') && includes('request this after'))
    return 'Por seguridad, debes esperar antes de solicitar otro intento.'

  // Traducciones comunes de Postgres/Supabase DB.
  if (includes('duplicate key value'))
    return 'Ya existe un registro con ese valor único (por ejemplo documento o correo repetido).'
  if (includes('violates foreign key constraint'))
    return 'No se puede completar la operación por una relación de datos existente.'
  if (includes('violates row-level security policy'))
    return 'No tienes permisos para realizar esta acción (política de seguridad).'
  if (includes('permission denied'))
    return 'No tienes permisos para realizar esta acción.'
  if (includes('null value in column'))
    return 'Faltan datos obligatorios para completar la operación.'
  if (includes('invalid input syntax'))
    return 'Alguno de los datos enviados tiene un formato inválido.'

  return message || 'Ocurrió un error inesperado.'
}

export function traducirErrorConContexto(contexto: string, rawMessage: string): string {
  return `${contexto}: ${traducirMensajeError(rawMessage)}`
}

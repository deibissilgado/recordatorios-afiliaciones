'use client'

import { supabase } from '@/lib/supabase'
import { traducirMensajeError } from '@/lib/mensajes'
import Link from 'next/link'
import { type FormEvent, useEffect, useState } from 'react'

// Renderiza el icono de "ojo" abierto/cerrado para mostrar u ocultar contraseñas.
function EyeIcon({ abierto }: { abierto: boolean }) {
  if (abierto) {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M2 12s3.8-7 10-7 10 7 10 7-3.8 7-10 7-10-7-10-7z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    )
  }

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 12s3.8-7 10-7 10 7 10 7-3.8 7-10 7-10-7-10-7z" />
      <path d="M4 4l16 16" />
      <path d="M8 3l-1-2M12 2V1M16 3l1-2" />
    </svg>
  )
}

export default function ResetPasswordPage() {
  const [hasRecoverySession, setHasRecoverySession] = useState<boolean | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [mostrarNewPassword, setMostrarNewPassword] = useState(false)
  const [mostrarConfirmPassword, setMostrarConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    let mounted = true

    const limpiarUrlDespuesDeAuth = () => {
      if (typeof window === 'undefined') return

      const url = new URL(window.location.href)
      url.hash = ''
      url.searchParams.delete('code')
      url.searchParams.delete('type')
      url.searchParams.delete('error')
      url.searchParams.delete('error_code')
      url.searchParams.delete('error_description')
      window.history.replaceState({}, '', url.toString())
    }

    const restaurarSesionDesdeUrl = async () => {
      if (typeof window === 'undefined') return false

      const hash = window.location.hash?.startsWith('#')
        ? window.location.hash.slice(1)
        : window.location.hash
      const hashParams = new URLSearchParams(hash)
      const accessToken = hashParams.get('access_token')
      const refreshToken = hashParams.get('refresh_token')
      const hashType = hashParams.get('type')

      // Maneja enlaces que llegan con tokens en el hash (#access_token=...).
      if (accessToken && refreshToken && (hashType === 'recovery' || hashType === 'signup')) {
        const { error: setSessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })

        if (setSessionError) {
          setError(traducirMensajeError(setSessionError.message))
          return false
        }

        limpiarUrlDespuesDeAuth()
        return true
      }

      const currentUrl = new URL(window.location.href)
      const tokenHash = currentUrl.searchParams.get('token_hash')
      const queryType = currentUrl.searchParams.get('type')
      const code = currentUrl.searchParams.get('code')

      // Maneja enlaces que llegan con token_hash en query (?token_hash=...&type=recovery).
      if (tokenHash && queryType === 'recovery') {
        const { error: verifyError } = await supabase.auth.verifyOtp({
          type: 'recovery',
          token_hash: tokenHash,
        })

        if (verifyError) {
          setError(traducirMensajeError(verifyError.message))
          return false
        }

        limpiarUrlDespuesDeAuth()
        return true
      }

      // Maneja enlaces que llegan con código (PKCE) en query (?code=...).
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

        if (exchangeError) {
          setError(traducirMensajeError(exchangeError.message))
          return false
        }

        limpiarUrlDespuesDeAuth()
        return true
      }

      return false
    }

    const validarSesionRecuperacion = async () => {
      // Intenta restaurar sesión desde el enlace y luego valida sesión activa.
      await restaurarSesionDesdeUrl()

      const { data, error: sessionError } = await supabase.auth.getSession()

      if (!mounted) return

      if (sessionError) {
        setError(traducirMensajeError(sessionError.message))
        setHasRecoverySession(false)
        return
      }

      setHasRecoverySession(Boolean(data.session))
    }

    void validarSesionRecuperacion()

    const { data } = supabase.auth.onAuthStateChange((event, currentSession) => {
      if (!mounted) return

      // Actualiza el estado al detectar flujo de recuperación o sesión activa.
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        setHasRecoverySession(Boolean(currentSession))
      }
    })

    return () => {
      mounted = false
      data.subscription.unsubscribe()
    }
  }, [])

  const actualizarContrasena = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setMessage('')

    if (newPassword.length < 6) {
      setError('La nueva contraseña debe tener mínimo 6 caracteres.')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('La confirmación no coincide con la nueva contraseña.')
      return
    }

    setLoading(true)

    // Aplica la nueva contraseña al usuario autenticado por el enlace de recuperación.
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    })

    if (updateError) {
      setError(traducirMensajeError(updateError.message))
      setLoading(false)
      return
    }

    setMessage('Contraseña actualizada correctamente. Ya puedes iniciar sesión.')
    setNewPassword('')
    setConfirmPassword('')
    setLoading(false)
  }

  return (
    <main className="auth-shell">
      <div className="auth-card">
        <h1>Recuperar contraseña</h1>

        {error ? <p className="status error">{error}</p> : null}
        {message ? <p className="status success">{message}</p> : null}

        {hasRecoverySession === null ? (
          <p className="hint-text">Validando enlace de recuperación...</p>
        ) : hasRecoverySession ? (
          <form className="form-grid" onSubmit={actualizarContrasena}>
            <label htmlFor="newPassword">Nueva contraseña</label>
            <div className="password-field">
              <input
                id="newPassword"
                type={mostrarNewPassword ? 'text' : 'password'}
                className="input"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                minLength={6}
                required
              />
              <button
                type="button"
                className="eye-btn"
                onClick={() => setMostrarNewPassword((prev) => !prev)}
                aria-label={mostrarNewPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                title={mostrarNewPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                <EyeIcon abierto={mostrarNewPassword} />
              </button>
            </div>

            <label htmlFor="confirmPassword">Confirmar nueva contraseña</label>
            <div className="password-field">
              <input
                id="confirmPassword"
                type={mostrarConfirmPassword ? 'text' : 'password'}
                className="input"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                minLength={6}
                required
              />
              <button
                type="button"
                className="eye-btn"
                onClick={() => setMostrarConfirmPassword((prev) => !prev)}
                aria-label={mostrarConfirmPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                title={mostrarConfirmPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                <EyeIcon abierto={mostrarConfirmPassword} />
              </button>
            </div>

            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Guardando...' : 'Actualizar contraseña'}
            </button>
          </form>
        ) : (
          <div className="form-grid">
            <p className="hint-text">
              El enlace no es válido o expiró. Solicita nuevamente la recuperación desde la pantalla
              de inicio de sesión.
            </p>
          </div>
        )}

        <Link href="/" className="btn btn-soft back-link">
          Volver al inicio
        </Link>
      </div>

      <style jsx>{`
        .auth-shell {
          min-height: 100vh;
          background:
            radial-gradient(circle at 8% -10%, #bbf7d0 0%, transparent 38%),
            radial-gradient(circle at 95% 10%, #fde68a 0%, transparent 32%),
            linear-gradient(145deg, #0b1020 0%, #121f3f 45%, #0f2f2b 100%);
          display: grid;
          place-items: center;
          padding: 16px;
        }

        .auth-card {
          width: min(560px, 95vw);
          background: #ffffff;
          border-radius: 18px;
          border: 1px solid #dbeafe;
          padding: 20px;
          box-shadow: 0 18px 42px rgba(2, 6, 23, 0.25);
          display: grid;
          gap: 10px;
        }

        .auth-card h1 {
          margin: 0;
          color: #0f172a;
          font-size: 1.35rem;
        }

        .form-grid {
          display: grid;
          gap: 10px;
        }

        .form-grid label {
          font-size: 0.88rem;
          font-weight: 700;
          color: #334155;
        }

        .input {
          border: 1px solid #cbd5e1;
          border-radius: 10px;
          padding: 10px 12px;
          font-size: 0.94rem;
          color: #0f172a;
          background: #ffffff;
          outline: none;
        }

        .password-field {
          position: relative;
          display: flex;
          align-items: center;
        }

        .password-field .input {
          width: 100%;
          padding-right: 44px;
        }

        .eye-btn {
          position: absolute;
          right: 8px;
          display: grid;
          place-items: center;
          width: 30px;
          height: 30px;
          border: none;
          border-radius: 8px;
          background: transparent;
          color: #334155;
          cursor: pointer;
        }

        .eye-btn:hover {
          background: #e2e8f0;
        }

        .eye-btn svg {
          width: 18px;
          height: 18px;
        }

        .input:focus {
          border-color: #14b8a6;
          box-shadow: 0 0 0 3px rgba(20, 184, 166, 0.2);
        }

        .hint-text {
          margin: 0;
          color: #64748b;
          font-size: 0.9rem;
          line-height: 1.5;
        }

        .status {
          border-radius: 10px;
          padding: 10px 12px;
          margin: 0;
          font-size: 0.9rem;
        }

        .status.error {
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #b91c1c;
        }

        .status.success {
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          color: #166534;
        }

        .btn {
          border: 1px solid transparent;
          border-radius: 10px;
          padding: 9px 12px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.18s ease;
          text-align: center;
          text-decoration: none;
        }

        .btn:disabled {
          opacity: 0.72;
          cursor: not-allowed;
        }

        .btn-primary {
          background: #0f766e;
          color: #f8fafc;
          border-color: #0f766e;
        }

        .btn-soft {
          background: #e2e8f0;
          color: #0f172a;
          border-color: #cbd5e1;
        }

        .back-link {
          margin-top: 4px;
          display: inline-block;
        }
      `}</style>
    </main>
  )
}

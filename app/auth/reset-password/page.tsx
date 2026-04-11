'use client'

import { supabase } from '@/lib/supabase'
import { traducirMensajeError } from '@/lib/mensajes'
import Link from 'next/link'
import { type FormEvent, useEffect, useState } from 'react'

export default function ResetPasswordPage() {
  const [hasRecoverySession, setHasRecoverySession] = useState<boolean | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    let mounted = true

    const validarSesionRecuperacion = async () => {
      // Verifica si el enlace de recuperación abrió una sesión válida de Supabase.
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
            <input
              id="newPassword"
              type="password"
              className="input"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              minLength={6}
              required
            />

            <label htmlFor="confirmPassword">Confirmar nueva contraseña</label>
            <input
              id="confirmPassword"
              type="password"
              className="input"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              minLength={6}
              required
            />

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

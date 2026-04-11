'use client'

import { supabase } from '@/lib/supabase'
import type { Session } from '@supabase/supabase-js'
import { type FormEvent, useEffect, useState } from 'react'

type AuthMode = 'login' | 'signup'

export default function Home() {
  const [session, setSession] = useState<Session | null>(null)
  const [loadingSession, setLoadingSession] = useState(true)
  const [authMode, setAuthMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState('')
  const [authMessage, setAuthMessage] = useState('')

  const [nombre, setNombre] = useState('')
  const [documento, setDocumento] = useState('')
  const [telefono, setTelefono] = useState('')
  const [clientLoading, setClientLoading] = useState(false)
  const [clientError, setClientError] = useState('')
  const [clientMessage, setClientMessage] = useState('')

  useEffect(() => {
    let isMounted = true

    const cargarSesion = async () => {
      const { data, error } = await supabase.auth.getSession()

      if (!isMounted) return

      if (error) {
        setAuthError('No se pudo validar la sesión actual.')
      }

      setSession(data.session ?? null)
      setLoadingSession(false)
    }

    cargarSesion()

    const { data } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      if (!isMounted) return
      setSession(currentSession)
    })

    return () => {
      isMounted = false
      data.subscription.unsubscribe()
    }
  }, [])

  const cambiarModo = (mode: AuthMode) => {
    setAuthMode(mode)
    setAuthError('')
    setAuthMessage('')
  }

  const handleAuthSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setAuthError('')
    setAuthMessage('')

    if (!email || !password) {
      setAuthError('Debes completar correo y contraseña.')
      return
    }

    setAuthLoading(true)

    try {
      if (authMode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email, password })

        if (error) {
          setAuthError(error.message)
          return
        }

        if (data.session) {
          setAuthMessage('Cuenta creada e inicio de sesión exitoso.')
        } else {
          setAuthMessage('Cuenta creada. Revisa tu correo para confirmar el acceso.')
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })

        if (error) {
          setAuthError(error.message)
          return
        }

        setAuthMessage('Inicio de sesión exitoso.')
      }
    } finally {
      setAuthLoading(false)
    }
  }

  const handleLogout = async () => {
    setAuthError('')
    setAuthMessage('')

    const { error } = await supabase.auth.signOut()

    if (error) {
      setAuthError(error.message)
      return
    }

    setAuthMessage('Sesión cerrada correctamente.')
    setEmail('')
    setPassword('')
    setClientMessage('')
    setClientError('')
  }

  const guardarCliente = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!session) {
      setClientError('Debes iniciar sesión para guardar clientes.')
      return
    }

    setClientError('')
    setClientMessage('')
    setClientLoading(true)

    const { error } = await supabase.from('clientes').insert([{ nombre, documento, telefono }])

    if (error) {
      setClientError(error.message)
    } else {
      setClientMessage('Cliente guardado correctamente.')
      setNombre('')
      setDocumento('')
      setTelefono('')
    }

    setClientLoading(false)
  }

  return (
    <div className="screen-bg">
      <div className="container">
        <header className="topbar">
          <div>
            <p className="eyebrow">Plataforma</p>
            <h1 className="brand">Control de afiliaciones de clientes</h1>
          </div>

          <nav className="menu" aria-label="Menú de autenticación">
            {session ? (
              <>
                <span className="user-email">{session.user.email}</span>
                <button type="button" className="btn btn-primary" onClick={handleLogout}>
                  Cerrar sesión
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className={`btn btn-ghost ${authMode === 'login' ? 'is-active' : ''}`}
                  onClick={() => cambiarModo('login')}
                >
                  Iniciar sesión
                </button>
                <button
                  type="button"
                  className={`btn btn-ghost ${authMode === 'signup' ? 'is-active' : ''}`}
                  onClick={() => cambiarModo('signup')}
                >
                  Crear cuenta
                </button>
              </>
            )}
          </nav>
        </header>

        <main className="main-grid">
          <section className="hero-card">
            <p className="hero-kicker">Bienvenido</p>
            <h2>Controla afiliaciones, estados y recordatorios desde un solo lugar.</h2>
            <p>
              Registra clientes, organiza su información y mantén el seguimiento de cada proceso
              con un flujo simple y seguro.
            </p>
            <div className="hero-pills">
              <span>Registro rápido</span>
              <span>Historial ordenado</span>
              <span>Acceso seguro</span>
            </div>
          </section>

          <section className="panel-card">
            {loadingSession ? (
              <p className="muted">Validando sesión...</p>
            ) : session ? (
              <>
                <h3>Registrar cliente</h3>
                <p className="muted">Sesión activa: {session.user.email}</p>

                {clientError ? <p className="status error">{clientError}</p> : null}
                {clientMessage ? <p className="status success">{clientMessage}</p> : null}

                <form className="form" onSubmit={guardarCliente}>
                  <label htmlFor="nombre">Nombre</label>
                  <input
                    id="nombre"
                    className="input"
                    placeholder="Nombre completo"
                    value={nombre}
                    onChange={(event) => setNombre(event.target.value)}
                    required
                  />

                  <label htmlFor="documento">Documento</label>
                  <input
                    id="documento"
                    className="input"
                    placeholder="Número de documento"
                    value={documento}
                    onChange={(event) => setDocumento(event.target.value)}
                    required
                  />

                  <label htmlFor="telefono">Teléfono</label>
                  <input
                    id="telefono"
                    className="input"
                    placeholder="Número de contacto"
                    value={telefono}
                    onChange={(event) => setTelefono(event.target.value)}
                    required
                  />

                  <button type="submit" className="btn btn-primary btn-block" disabled={clientLoading}>
                    {clientLoading ? 'Guardando...' : 'Guardar cliente'}
                  </button>
                </form>
              </>
            ) : (
              <>
                <h3>{authMode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}</h3>
                <p className="muted">
                  {authMode === 'login'
                    ? 'Ingresa para gestionar afiliaciones y clientes.'
                    : 'Registra tu cuenta para comenzar.'}
                </p>

                {authError ? <p className="status error">{authError}</p> : null}
                {authMessage ? <p className="status success">{authMessage}</p> : null}

                <form className="form" onSubmit={handleAuthSubmit}>
                  <label htmlFor="email">Correo electrónico</label>
                  <input
                    id="email"
                    type="email"
                    className="input"
                    placeholder="tu@correo.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                  />

                  <label htmlFor="password">Contraseña</label>
                  <input
                    id="password"
                    type="password"
                    className="input"
                    placeholder="Mínimo 6 caracteres"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    minLength={6}
                    required
                  />

                  <button type="submit" className="btn btn-primary btn-block" disabled={authLoading}>
                    {authLoading ? 'Procesando...' : authMode === 'login' ? 'Entrar' : 'Crear cuenta'}
                  </button>
                </form>
              </>
            )}
          </section>
        </main>
      </div>

      <style jsx>{`
        .screen-bg {
          min-height: 100vh;
          background:
            radial-gradient(circle at 8% -10%, #bbf7d0 0%, transparent 38%),
            radial-gradient(circle at 95% 10%, #fde68a 0%, transparent 32%),
            linear-gradient(145deg, #0b1020 0%, #121f3f 45%, #0f2f2b 100%);
          color: #0f172a;
          padding: 20px;
        }

        .container {
          max-width: 1120px;
          margin: 0 auto;
          display: grid;
          gap: 16px;
        }

        .topbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 14px;
          border: 1px solid rgba(255, 255, 255, 0.28);
          border-radius: 18px;
          padding: 14px 18px;
          background: rgba(255, 255, 255, 0.18);
          backdrop-filter: blur(12px);
          color: #f8fafc;
        }

        .eyebrow {
          margin: 0;
          font-size: 11px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #d1fae5;
          font-weight: 700;
        }

        .brand {
          margin: 4px 0 0;
          font-size: 1.3rem;
          line-height: 1.2;
          font-weight: 800;
        }

        .menu {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .user-email {
          font-size: 0.84rem;
          color: #e2e8f0;
        }

        .main-grid {
          display: grid;
          grid-template-columns: 1.2fr 1fr;
          gap: 16px;
        }

        .hero-card,
        .panel-card {
          background: #ffffff;
          border-radius: 20px;
          border: 1px solid #dbe7ff;
          padding: 26px;
          box-shadow: 0 22px 55px rgba(2, 6, 23, 0.24);
        }

        .hero-kicker {
          margin: 0;
          color: #0f766e;
          font-size: 0.8rem;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          font-weight: 700;
        }

        .hero-card h2 {
          margin: 10px 0 0;
          font-size: clamp(1.5rem, 2.8vw, 2.1rem);
          line-height: 1.2;
          color: #0f172a;
        }

        .hero-card p {
          margin: 12px 0 0;
          color: #334155;
          line-height: 1.6;
        }

        .hero-pills {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 18px;
        }

        .hero-pills span {
          font-size: 0.8rem;
          padding: 6px 10px;
          border-radius: 999px;
          background: #ecfeff;
          border: 1px solid #99f6e4;
          color: #0f766e;
          font-weight: 700;
        }

        .panel-card h3 {
          margin: 0;
          font-size: 1.4rem;
          color: #0f172a;
        }

        .muted {
          margin: 8px 0 18px;
          color: #475569;
        }

        .status {
          margin: 0 0 12px;
          border-radius: 12px;
          padding: 10px 12px;
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

        .form {
          display: grid;
          gap: 10px;
        }

        .form label {
          font-size: 0.88rem;
          font-weight: 700;
          color: #334155;
        }

        .input {
          border: 1px solid #cbd5e1;
          border-radius: 11px;
          padding: 11px 12px;
          font-size: 0.95rem;
          outline: none;
          transition: all 0.18s ease;
          background: #ffffff;
          color: #0f172a;
        }

        .input:focus {
          border-color: #14b8a6;
          box-shadow: 0 0 0 3px rgba(20, 184, 166, 0.22);
        }

        .btn {
          border: 1px solid transparent;
          border-radius: 999px;
          padding: 8px 14px;
          font-weight: 700;
          cursor: pointer;
          transition: transform 0.15s ease, background 0.2s ease, color 0.2s ease;
        }

        .btn:hover {
          transform: translateY(-1px);
        }

        .btn:disabled {
          opacity: 0.72;
          cursor: not-allowed;
          transform: none;
        }

        .btn-ghost {
          background: rgba(255, 255, 255, 0.12);
          border-color: rgba(255, 255, 255, 0.35);
          color: #f8fafc;
        }

        .btn-ghost.is-active {
          background: #ffffff;
          color: #0f172a;
          border-color: #ffffff;
        }

        .btn-primary {
          background: linear-gradient(120deg, #0f766e 0%, #0d9488 100%);
          color: #f8fafc;
        }

        .btn-primary:hover {
          background: linear-gradient(120deg, #115e59 0%, #0f766e 100%);
        }

        .btn-block {
          margin-top: 10px;
          width: 100%;
          padding: 11px 16px;
          border-radius: 12px;
        }

        @media (max-width: 920px) {
          .main-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 720px) {
          .screen-bg {
            padding: 12px;
          }

          .topbar {
            flex-direction: column;
            align-items: flex-start;
          }

          .menu {
            justify-content: flex-start;
          }

          .hero-card,
          .panel-card {
            padding: 18px;
          }
        }
      `}</style>
    </div>
  )
}

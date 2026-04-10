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
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        })

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
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

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

    const { error } = await supabase
      .from('clientes')
      .insert([
        {
          nombre,
          documento,
          telefono
        }
      ])

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
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <p className="brand-kicker">Plataforma</p>
          <h1 className="brand-title">Control de afiliaciones</h1>
        </div>

        <nav className="auth-nav" aria-label="Menú de sesión">
          {session ? (
            <>
              <span className="session-email">{session.user.email}</span>
              <button className="menu-button primary" onClick={handleLogout} type="button">
                Cerrar sesión
              </button>
            </>
          ) : (
            <>
              <button
                className={`menu-button ${authMode === 'login' ? 'active' : ''}`}
                onClick={() => cambiarModo('login')}
                type="button"
              >
                Iniciar sesión
              </button>
              <button
                className={`menu-button ${authMode === 'signup' ? 'active' : ''}`}
                onClick={() => cambiarModo('signup')}
                type="button"
              >
                Crear cuenta
              </button>
            </>
          )}
        </nav>
      </header>

      <main className="main-content">
        <section className="hero-card">
          <h2>Bienvenido a control de afiliaciones de clientes</h2>
          <p>
            Centraliza el seguimiento de tus afiliaciones y registra información de clientes de
            forma segura.
          </p>
        </section>

        {loadingSession ? (
          <section className="panel">
            <p className="status-text">Validando sesión...</p>
          </section>
        ) : session ? (
          <section className="panel">
            <h3>Registrar cliente</h3>
            <p className="panel-description">Sesión activa: {session.user.email}</p>

            {clientError ? <p className="status-banner error">{clientError}</p> : null}
            {clientMessage ? <p className="status-banner success">{clientMessage}</p> : null}

            <form className="form-grid" onSubmit={guardarCliente}>
              <label htmlFor="nombre">Nombre</label>
              <input
                className="input-field"
                id="nombre"
                placeholder="Nombre completo"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                required
              />

              <label htmlFor="documento">Documento</label>
              <input
                className="input-field"
                id="documento"
                placeholder="Documento"
                value={documento}
                onChange={(e) => setDocumento(e.target.value)}
                required
              />

              <label htmlFor="telefono">Teléfono</label>
              <input
                className="input-field"
                id="telefono"
                placeholder="Teléfono"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                required
              />

              <button className="submit-button" type="submit" disabled={clientLoading}>
                {clientLoading ? 'Guardando...' : 'Guardar cliente'}
              </button>
            </form>
          </section>
        ) : (
          <section className="panel">
            <h3>{authMode === 'login' ? 'Iniciar sesión' : 'Crear una cuenta'}</h3>
            <p className="panel-description">
              {authMode === 'login'
                ? 'Ingresa para gestionar clientes y afiliaciones.'
                : 'Regístrate para comenzar a usar la plataforma.'}
            </p>

            {authError ? <p className="status-banner error">{authError}</p> : null}
            {authMessage ? <p className="status-banner success">{authMessage}</p> : null}

            <form className="form-grid" onSubmit={handleAuthSubmit}>
              <label htmlFor="email">Correo electrónico</label>
              <input
                className="input-field"
                id="email"
                type="email"
                placeholder="tu@correo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />

              <label htmlFor="password">Contraseña</label>
              <input
                className="input-field"
                id="password"
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                required
              />

              <button className="submit-button" type="submit" disabled={authLoading}>
                {authLoading
                  ? 'Procesando...'
                  : authMode === 'login'
                    ? 'Entrar'
                    : 'Crear cuenta'}
              </button>
            </form>
          </section>
        )}
      </main>
    </div>
  )
}

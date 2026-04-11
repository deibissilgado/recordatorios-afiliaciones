'use client'

import { supabase } from '@/lib/supabase'
import type { Session } from '@supabase/supabase-js'
import { type FormEvent, useCallback, useEffect, useState } from 'react'

type AuthMode = 'login' | 'signup'
type Cliente = {
  id: string
  nombre: string
  documento: string
  telefono: string | null
  created_at: string
}

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
  const [diaRecordatorio, setDiaRecordatorio] = useState(20)
  const [plantillaMensaje, setPlantillaMensaje] = useState(
    'Hola {{nombre}}, recuerda renovar tu afiliación. Fecha sugerida: {{fecha}}.'
  )
  const [fechaInicioAfiliacion, setFechaInicioAfiliacion] = useState(() =>
    new Date().toISOString().slice(0, 10)
  )
  const [fechaFinAfiliacion, setFechaFinAfiliacion] = useState('')
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [clientesLoading, setClientesLoading] = useState(false)
  const [clientesError, setClientesError] = useState('')
  const [clientesMessage, setClientesMessage] = useState('')
  const [clienteEditId, setClienteEditId] = useState<string | null>(null)
  const [editNombre, setEditNombre] = useState('')
  const [editDocumento, setEditDocumento] = useState('')
  const [editTelefono, setEditTelefono] = useState('')
  const [clienteActionLoading, setClienteActionLoading] = useState(false)

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

  const cargarClientes = useCallback(async () => {
    if (!session) {
      setClientes([])
      return
    }

    setClientesLoading(true)
    setClientesError('')

    // Carga el listado principal de clientes para gestionar edición y borrado.
    const { data, error } = await supabase
      .from('clientes')
      .select('id,nombre,documento,telefono,created_at')
      .order('created_at', { ascending: false })
      .limit(200)

    if (error) {
      setClientesError(`No se pudieron cargar clientes: ${error.message}`)
    } else {
      setClientes((data ?? []) as Cliente[])
    }

    setClientesLoading(false)
  }, [session])

  useEffect(() => {
    void cargarClientes()
  }, [cargarClientes])

  const iniciarEdicionCliente = (cliente: Cliente) => {
    setClienteEditId(cliente.id)
    setEditNombre(cliente.nombre)
    setEditDocumento(cliente.documento)
    setEditTelefono(cliente.telefono ?? '')
    setClientesError('')
    setClientesMessage('')
  }

  const cancelarEdicionCliente = () => {
    setClienteEditId(null)
    setEditNombre('')
    setEditDocumento('')
    setEditTelefono('')
  }

  const guardarEdicionCliente = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!clienteEditId) return

    setClienteActionLoading(true)
    setClientesError('')
    setClientesMessage('')

    // Actualiza datos básicos del cliente manteniendo el mismo registro.
    const { error } = await supabase
      .from('clientes')
      .update({
        nombre: editNombre,
        documento: editDocumento,
        telefono: editTelefono,
      })
      .eq('id', clienteEditId)

    if (error) {
      setClientesError(`No se pudo actualizar el cliente: ${error.message}`)
      setClienteActionLoading(false)
      return
    }

    setClientesMessage('Cliente actualizado correctamente.')
    cancelarEdicionCliente()
    await cargarClientes()
    setClienteActionLoading(false)
  }

  const borrarCliente = async (cliente: Cliente) => {
    const confirmacion = window.confirm(
      `¿Seguro que deseas borrar a ${cliente.nombre}? También se borrarán afiliaciones y recordatorios asociados.`
    )

    if (!confirmacion) return

    setClienteActionLoading(true)
    setClientesError('')
    setClientesMessage('')

    // 1) Busca afiliaciones del cliente para limpiar primero sus recordatorios relacionados.
    const { data: afiliaciones, error: afiliacionesError } = await supabase
      .from('afiliaciones')
      .select('id')
      .eq('cliente_id', cliente.id)

    if (afiliacionesError) {
      setClientesError(`No se pudieron consultar afiliaciones: ${afiliacionesError.message}`)
      setClienteActionLoading(false)
      return
    }

    const afiliacionIds = (afiliaciones ?? []).map((afiliacion) => afiliacion.id)

    if (afiliacionIds.length > 0) {
      const { error: recordatoriosError } = await supabase
        .from('recordatorios')
        .delete()
        .in('afiliacion_id', afiliacionIds)

      if (recordatoriosError) {
        setClientesError(`No se pudieron borrar recordatorios: ${recordatoriosError.message}`)
        setClienteActionLoading(false)
        return
      }

      const { error: borrarAfiliacionesError } = await supabase
        .from('afiliaciones')
        .delete()
        .eq('cliente_id', cliente.id)

      if (borrarAfiliacionesError) {
        setClientesError(`No se pudieron borrar afiliaciones: ${borrarAfiliacionesError.message}`)
        setClienteActionLoading(false)
        return
      }
    }

    // 2) Borra el cliente después de limpiar dependencias.
    const { error: borrarClienteError } = await supabase.from('clientes').delete().eq('id', cliente.id)

    if (borrarClienteError) {
      setClientesError(`No se pudo borrar el cliente: ${borrarClienteError.message}`)
      setClienteActionLoading(false)
      return
    }

    setClientesMessage('Cliente borrado correctamente.')
    if (clienteEditId === cliente.id) {
      cancelarEdicionCliente()
    }
    await cargarClientes()
    setClienteActionLoading(false)
  }

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
    setClientes([])
    setClientesError('')
    setClientesMessage('')
    cancelarEdicionCliente()
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

    const { data: nuevoCliente, error: errorCliente } = await supabase
      .from('clientes')
      .insert([{ nombre, documento, telefono }])
      .select('id')
      .single()

    if (errorCliente) {
      setClientError(errorCliente.message)
      setClientLoading(false)
      return
    }

    const baseAfiliacion = {
      cliente_id: nuevoCliente.id,
      fecha_inicio: fechaInicioAfiliacion || new Date().toISOString().slice(0, 10),
      fecha_fin: fechaFinAfiliacion || null,
      estado: 'activa',
    }

    const { error: errorAfiliacion } = await supabase.from('afiliaciones').insert([
      {
        ...baseAfiliacion,
        dia_recordatorio: diaRecordatorio,
        plantilla_mensaje: plantillaMensaje,
        whatsapp_activo: true,
      },
    ])

    if (errorAfiliacion) {
      // Compatibilidad temporal: permite guardar afiliación básica si aún no aplicaste la migración.
      const columnasNuevasNoExisten =
        errorAfiliacion.message.includes('dia_recordatorio') ||
        errorAfiliacion.message.includes('plantilla_mensaje') ||
        errorAfiliacion.message.includes('whatsapp_activo')

      if (columnasNuevasNoExisten) {
        const { error: errorAfiliacionBasica } = await supabase
          .from('afiliaciones')
          .insert([baseAfiliacion])

        if (errorAfiliacionBasica) {
          setClientError(`Cliente creado, pero afiliación falló: ${errorAfiliacionBasica.message}`)
          setClientLoading(false)
          return
        }

        setClientMessage(
          'Cliente y afiliación creados. Ejecuta la migración SQL para activar recordatorios automáticos.'
        )
      } else {
        setClientError(`Cliente creado, pero afiliación falló: ${errorAfiliacion.message}`)
        setClientLoading(false)
        return
      }
    } else {
      setClientMessage('Cliente y afiliación creados correctamente.')
    }

    setNombre('')
    setDocumento('')
    setTelefono('')
    setDiaRecordatorio(20)
    setPlantillaMensaje(
      'Hola {{nombre}}, recuerda renovar tu afiliación. Fecha sugerida: {{fecha}}.'
    )
    setFechaInicioAfiliacion(new Date().toISOString().slice(0, 10))
    setFechaFinAfiliacion('')
    setClientesMessage('Nuevo cliente agregado al listado.')

    await cargarClientes()
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

                  <label htmlFor="diaRecordatorio">Día de recordatorio mensual</label>
                  <input
                    id="diaRecordatorio"
                    type="number"
                    min={1}
                    max={28}
                    className="input"
                    value={diaRecordatorio}
                    onChange={(event) => setDiaRecordatorio(Number(event.target.value) || 20)}
                    required
                  />

                  <label htmlFor="fechaInicioAfiliacion">Fecha inicio de afiliación</label>
                  <input
                    id="fechaInicioAfiliacion"
                    type="date"
                    className="input"
                    value={fechaInicioAfiliacion}
                    onChange={(event) => setFechaInicioAfiliacion(event.target.value)}
                    required
                  />

                  <label htmlFor="fechaFinAfiliacion">Fecha fin (opcional)</label>
                  <input
                    id="fechaFinAfiliacion"
                    type="date"
                    className="input"
                    value={fechaFinAfiliacion}
                    onChange={(event) => setFechaFinAfiliacion(event.target.value)}
                  />

                  <label htmlFor="plantillaMensaje">Plantilla de mensaje</label>
                  <textarea
                    id="plantillaMensaje"
                    className="textarea"
                    rows={4}
                    value={plantillaMensaje}
                    onChange={(event) => setPlantillaMensaje(event.target.value)}
                    required
                  />
                  <p className="muted-note">
                    Variables disponibles: <code>{'{{nombre}}'}</code>,{' '}
                    <code>{'{{fecha}}'}</code>, <code>{'{{mes}}'}</code>.
                  </p>

                  <button type="submit" className="btn btn-primary btn-block" disabled={clientLoading}>
                    {clientLoading ? 'Guardando...' : 'Guardar cliente y afiliación'}
                  </button>
                </form>

                <div className="clientes-section">
                  <div className="clientes-head">
                    <h4>Clientes registrados</h4>
                    <button
                      type="button"
                      className="btn btn-soft"
                      onClick={() => void cargarClientes()}
                      disabled={clientesLoading || clienteActionLoading}
                    >
                      Actualizar lista
                    </button>
                  </div>

                  {clientesError ? <p className="status error">{clientesError}</p> : null}
                  {clientesMessage ? <p className="status success">{clientesMessage}</p> : null}

                  {clientesLoading ? (
                    <p className="muted">Cargando clientes...</p>
                  ) : clientes.length === 0 ? (
                    <p className="muted">Aún no hay clientes registrados.</p>
                  ) : (
                    <ul className="clientes-list">
                      {clientes.map((cliente) => (
                        <li key={cliente.id} className="cliente-item">
                          <div className="cliente-row">
                            <div>
                              <p className="cliente-name">{cliente.nombre}</p>
                              <p className="cliente-meta">
                                Documento: {cliente.documento} | Teléfono: {cliente.telefono ?? 'N/A'}
                              </p>
                            </div>
                            <div className="cliente-actions">
                              <button
                                type="button"
                                className="btn btn-soft"
                                onClick={() => iniciarEdicionCliente(cliente)}
                                disabled={clienteActionLoading}
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                className="btn btn-danger"
                                onClick={() => void borrarCliente(cliente)}
                                disabled={clienteActionLoading}
                              >
                                Borrar
                              </button>
                            </div>
                          </div>

                          {clienteEditId === cliente.id ? (
                            <form className="form cliente-edit-form" onSubmit={guardarEdicionCliente}>
                              <label htmlFor={`editNombre-${cliente.id}`}>Nombre</label>
                              <input
                                id={`editNombre-${cliente.id}`}
                                className="input"
                                value={editNombre}
                                onChange={(event) => setEditNombre(event.target.value)}
                                required
                              />

                              <label htmlFor={`editDocumento-${cliente.id}`}>Documento</label>
                              <input
                                id={`editDocumento-${cliente.id}`}
                                className="input"
                                value={editDocumento}
                                onChange={(event) => setEditDocumento(event.target.value)}
                                required
                              />

                              <label htmlFor={`editTelefono-${cliente.id}`}>Teléfono</label>
                              <input
                                id={`editTelefono-${cliente.id}`}
                                className="input"
                                value={editTelefono}
                                onChange={(event) => setEditTelefono(event.target.value)}
                                required
                              />

                              <div className="edit-actions">
                                <button
                                  type="submit"
                                  className="btn btn-primary"
                                  disabled={clienteActionLoading}
                                >
                                  Guardar cambios
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-soft"
                                  onClick={cancelarEdicionCliente}
                                  disabled={clienteActionLoading}
                                >
                                  Cancelar
                                </button>
                              </div>
                            </form>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
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

        .clientes-section {
          margin-top: 20px;
          border-top: 1px solid #e2e8f0;
          padding-top: 16px;
        }

        .clientes-head {
          align-items: center;
          display: flex;
          justify-content: space-between;
          gap: 8px;
          margin-bottom: 10px;
        }

        .clientes-head h4 {
          margin: 0;
          font-size: 1.05rem;
          color: #0f172a;
        }

        .clientes-list {
          display: grid;
          gap: 12px;
          margin: 0;
          padding: 0;
        }

        .cliente-item {
          border: 1px solid #dbeafe;
          border-radius: 14px;
          padding: 12px;
          list-style: none;
          background: #f8fbff;
        }

        .cliente-row {
          align-items: center;
          display: flex;
          gap: 10px;
          justify-content: space-between;
        }

        .cliente-name {
          margin: 0;
          font-size: 0.98rem;
          font-weight: 800;
          color: #0f172a;
        }

        .cliente-meta {
          margin: 4px 0 0;
          color: #475569;
          font-size: 0.85rem;
        }

        .cliente-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .cliente-edit-form {
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px dashed #cbd5e1;
        }

        .edit-actions {
          display: flex;
          gap: 8px;
          margin-top: 8px;
          flex-wrap: wrap;
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

        .textarea {
          border: 1px solid #cbd5e1;
          border-radius: 11px;
          padding: 11px 12px;
          font-size: 0.95rem;
          outline: none;
          transition: all 0.18s ease;
          background: #ffffff;
          color: #0f172a;
          min-height: 105px;
          resize: vertical;
        }

        .input:focus {
          border-color: #14b8a6;
          box-shadow: 0 0 0 3px rgba(20, 184, 166, 0.22);
        }

        .textarea:focus {
          border-color: #14b8a6;
          box-shadow: 0 0 0 3px rgba(20, 184, 166, 0.22);
        }

        .muted-note {
          margin: 0 0 2px;
          font-size: 0.82rem;
          color: #64748b;
          line-height: 1.4;
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

        .btn-soft {
          background: #e2e8f0;
          border-color: #cbd5e1;
          color: #0f172a;
        }

        .btn-soft:hover {
          background: #cbd5e1;
        }

        .btn-danger {
          background: #fee2e2;
          border-color: #fecaca;
          color: #b91c1c;
        }

        .btn-danger:hover {
          background: #fecaca;
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

          .cliente-row {
            align-items: flex-start;
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  )
}

'use client'

import { supabase } from '@/lib/supabase'
import { traducirErrorConContexto, traducirMensajeError } from '@/lib/mensajes'
import type { Session } from '@supabase/supabase-js'
import { type FormEvent, useCallback, useEffect, useState } from 'react'

type AuthMode = 'login' | 'signup' | 'recover'
type Seccion = 'usuario' | 'clientes'
type ClientesVista = 'lista' | 'crear' | 'editar'
type TipoNotificacion = 'arl' | 'pago'

type Cliente = {
  id: string
  nombre: string
  documento: string
  telefono: string | null
  created_at: string
}

type AfiliacionEdit = {
  id: string
  fecha_inicio: string | null
  fecha_fin: string | null
  estado: string | null
  tipo_notificacion: TipoNotificacion | null
  plantilla_mensaje: string | null
  whatsapp_activo: boolean | null
}

const PLANTILLA_POR_TIPO: Record<TipoNotificacion, string> = {
  arl: 'Hola {{nombre}}, recuerda renovar tu afiliación. Fecha sugerida: {{fecha}}.',
  pago: 'Hola {{nombre}}, este es un recordatorio de pago de seguridad social. Fecha sugerida: {{fecha}}.',
}

const PLANTILLA_POR_DEFECTO = PLANTILLA_POR_TIPO.arl
const PLANTILLAS_PREDEFINIDAS = Object.values(PLANTILLA_POR_TIPO)

function sincronizarPlantillaSegunTipo(plantillaActual: string, tipoNotificacion: TipoNotificacion): string {
  const trimmed = plantillaActual.trim()
  if (PLANTILLAS_PREDEFINIDAS.includes(trimmed)) return PLANTILLA_POR_TIPO[tipoNotificacion]
  return plantillaActual
}

function hoyIsoDate() { return new Date().toISOString().slice(0, 10) }

function getAppBaseUrl() {
  if (typeof window !== 'undefined') return window.location.origin
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (fromEnv) return fromEnv.replace(/\/$/, '')
  return ''
}

function columnasNuevasNoExisten(message: string) {
  return message.includes('tipo_notificacion') || message.includes('plantilla_mensaje') || message.includes('whatsapp_activo')
}

function EyeIcon({ abierto }: { abierto: boolean }) {
  if (abierto) {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 12s3.8-7 10-7 10 7 10 7-3.8 7-10 7-10-7-10-7z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    )
  }
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3.8-7 10-7 10 7 10 7-3.8 7-10 7-10-7-10-7z" />
      <path d="M4 4l16 16" />
      <path d="M8 3l-1-2M12 2V1M16 3l1-2" />
    </svg>
  )
}

export default function V2() {
  const [session, setSession] = useState<Session | null>(null)
  const [loadingSession, setLoadingSession] = useState(true)
  const [authMode, setAuthMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mostrarPassword, setMostrarPassword] = useState(false)
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState('')
  const [authMessage, setAuthMessage] = useState('')
  const [seccion, setSeccion] = useState<Seccion>('usuario')
  const [clientesVista, setClientesVista] = useState<ClientesVista>('lista')
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [clientesLoading, setClientesLoading] = useState(false)
  const [clientesError, setClientesError] = useState('')
  const [clientesMessage, setClientesMessage] = useState('')
  const [clienteActionLoading, setClienteActionLoading] = useState(false)
  const [busquedaCliente, setBusquedaCliente] = useState('')
  const [busquedaUsuario, setBusquedaUsuario] = useState('')
  const [nombre, setNombre] = useState('')
  const [documento, setDocumento] = useState('')
  const [telefono, setTelefono] = useState('')
  const [tipoNotificacion, setTipoNotificacion] = useState<TipoNotificacion>('arl')
  const [plantillaMensaje, setPlantillaMensaje] = useState(PLANTILLA_POR_DEFECTO)
  const [fechaInicioAfiliacion, setFechaInicioAfiliacion] = useState(hoyIsoDate)
  const [fechaFinAfiliacion, setFechaFinAfiliacion] = useState('')
  const [estadoAfiliacion, setEstadoAfiliacion] = useState('activa')
  const [whatsappActivo, setWhatsappActivo] = useState(true)
  const [crearLoading, setCrearLoading] = useState(false)
  const [editClienteId, setEditClienteId] = useState<string | null>(null)
  const [editAfiliacionId, setEditAfiliacionId] = useState<string | null>(null)
  const [editNombre, setEditNombre] = useState('')
  const [editDocumento, setEditDocumento] = useState('')
  const [editTelefono, setEditTelefono] = useState('')
  const [editTipoNotificacion, setEditTipoNotificacion] = useState<TipoNotificacion>('arl')
  const [editPlantillaMensaje, setEditPlantillaMensaje] = useState(PLANTILLA_POR_DEFECTO)
  const [editFechaInicioAfiliacion, setEditFechaInicioAfiliacion] = useState(hoyIsoDate)
  const [editFechaFinAfiliacion, setEditFechaFinAfiliacion] = useState('')
  const [editEstadoAfiliacion, setEditEstadoAfiliacion] = useState('activa')
  const [editWhatsappActivo, setEditWhatsappActivo] = useState(true)
  const [editarLoading, setEditarLoading] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const { pathname, search, hash } = window.location
    const hashParams = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash)
    const queryParams = new URLSearchParams(search)
    const hasRecoveryType = hashParams.get('type') === 'recovery' || queryParams.get('type') === 'recovery'
    const hasRecoveryTokens = Boolean(hashParams.get('access_token') && hashParams.get('refresh_token')) || Boolean(queryParams.get('token_hash'))
    if (pathname === '/v2' && (hasRecoveryType || hasRecoveryTokens)) {
      window.location.replace(`/auth/reset-password${search}${hash}`)
    }
  }, [])

  useEffect(() => {
    let isMounted = true
    const cargarSesion = async () => {
      const { data, error } = await supabase.auth.getSession()
      if (!isMounted) return
      if (error) setAuthError('No se pudo validar la sesión actual.')
      setSession(data.session ?? null)
      setLoadingSession(false)
    }
    void cargarSesion()
    const { data } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      if (!isMounted) return
      setSession(currentSession)
    })
    return () => { isMounted = false; data.subscription.unsubscribe() }
  }, [])

  const resetCrearForm = useCallback(() => {
    setNombre(''); setDocumento(''); setTelefono(''); setTipoNotificacion('arl')
    setPlantillaMensaje(PLANTILLA_POR_DEFECTO); setFechaInicioAfiliacion(hoyIsoDate())
    setFechaFinAfiliacion(''); setEstadoAfiliacion('activa'); setWhatsappActivo(true)
  }, [])

  const resetEditarForm = useCallback(() => {
    setEditClienteId(null); setEditAfiliacionId(null); setEditNombre(''); setEditDocumento('')
    setEditTelefono(''); setEditTipoNotificacion('arl'); setEditPlantillaMensaje(PLANTILLA_POR_DEFECTO)
    setEditFechaInicioAfiliacion(hoyIsoDate()); setEditFechaFinAfiliacion('')
    setEditEstadoAfiliacion('activa'); setEditWhatsappActivo(true)
  }, [])

  const cargarClientes = useCallback(async () => {
    if (!session) { setClientes([]); return }
    setClientesLoading(true); setClientesError('')
    const { data, error } = await supabase.from('clientes').select('id,nombre,documento,telefono,created_at').order('created_at', { ascending: false }).limit(300)
    if (error) setClientesError(traducirErrorConContexto('No se pudieron cargar clientes', error.message))
    else setClientes((data ?? []) as Cliente[])
    setClientesLoading(false)
  }, [session])

  useEffect(() => {
    if (!session) { setSeccion('usuario'); setClientesVista('lista'); setClientes([]); setClientesError(''); setClientesMessage(''); resetCrearForm(); resetEditarForm(); return }
    void cargarClientes()
  }, [session, cargarClientes, resetCrearForm, resetEditarForm])

  const cargarAfiliacionParaEdicion = async (clienteId: string) => {
    const avanzada = await supabase.from('afiliaciones').select('id,fecha_inicio,fecha_fin,estado,tipo_notificacion,plantilla_mensaje,whatsapp_activo').eq('cliente_id', clienteId).order('created_at', { ascending: false }).limit(1)
    if (!avanzada.error) return (avanzada.data?.[0] ?? null) as AfiliacionEdit | null
    if (!columnasNuevasNoExisten(avanzada.error.message)) throw new Error(traducirMensajeError(avanzada.error.message))
    const basica = await supabase.from('afiliaciones').select('id,fecha_inicio,fecha_fin,estado').eq('cliente_id', clienteId).order('created_at', { ascending: false }).limit(1)
    if (basica.error) throw new Error(traducirMensajeError(basica.error.message))
    const filaBasica = basica.data?.[0] as { id: string; fecha_inicio: string | null; fecha_fin: string | null; estado: string | null } | null
    if (!filaBasica) return null
    return { id: filaBasica.id, fecha_inicio: filaBasica.fecha_inicio, fecha_fin: filaBasica.fecha_fin, estado: filaBasica.estado, tipo_notificacion: 'arl', plantilla_mensaje: PLANTILLA_POR_DEFECTO, whatsapp_activo: true } satisfies AfiliacionEdit
  }

  const cambiarModo = (mode: AuthMode) => { setAuthMode(mode); setAuthError(''); setAuthMessage(''); setMostrarPassword(false); if (mode === 'recover') setPassword('') }

  const handleAuthSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setAuthError(''); setAuthMessage('')
    if (!email || (authMode !== 'recover' && !password)) { setAuthError(authMode === 'recover' ? 'Debes ingresar tu correo para recuperar contraseña.' : 'Debes completar correo y contraseña.'); return }
    setAuthLoading(true)
    try {
      if (authMode === 'recover') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: getAppBaseUrl() ? `${getAppBaseUrl()}/auth/reset-password` : undefined })
        if (error) { setAuthError(traducirMensajeError(error.message)); return }
        setAuthMessage('Te enviamos un enlace para recuperar tu contraseña.')
      } else if (authMode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) { setAuthError(traducirMensajeError(error.message)); return }
        setAuthMessage(data.session ? 'Cuenta creada e inicio de sesión exitoso.' : 'Cuenta creada. Revisa tu correo para confirmar el acceso.')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) { setAuthError(traducirMensajeError(error.message)); return }
        setAuthMessage('Inicio de sesión exitoso.')
      }
    } finally { setAuthLoading(false) }
  }

  const handleLogout = async () => {
    setAuthError(''); setAuthMessage('')
    const { error } = await supabase.auth.signOut()
    if (error) { setAuthError(traducirMensajeError(error.message)); return }
    setAuthMessage('Sesión cerrada.'); setClientesMessage(''); setClientesError(''); resetCrearForm(); resetEditarForm()
  }

  const abrirVistaCrearCliente = () => { setClientesError(''); setClientesMessage(''); resetCrearForm(); setClientesVista('crear') }

  const abrirVistaEditarCliente = async (cliente: Cliente) => {
    setClientesError(''); setClientesMessage(''); setEditarLoading(true)
    try {
      const afiliacion = await cargarAfiliacionParaEdicion(cliente.id)
      setEditClienteId(cliente.id); setEditAfiliacionId(afiliacion?.id ?? null)
      setEditNombre(cliente.nombre); setEditDocumento(cliente.documento); setEditTelefono(cliente.telefono ?? '')
      const tipoAfiliacion = afiliacion?.tipo_notificacion ?? 'arl'
      setEditTipoNotificacion(tipoAfiliacion); setEditPlantillaMensaje(afiliacion?.plantilla_mensaje ?? PLANTILLA_POR_TIPO[tipoAfiliacion])
      setEditFechaInicioAfiliacion(afiliacion?.fecha_inicio ?? hoyIsoDate()); setEditFechaFinAfiliacion(afiliacion?.fecha_fin ?? '')
      setEditEstadoAfiliacion(afiliacion?.estado ?? 'activa'); setEditWhatsappActivo(afiliacion?.whatsapp_activo ?? true)
      setClientesVista('editar')
    } catch (error) {
      setClientesError(error instanceof Error ? error.message : 'No fue posible abrir la edición.')
    } finally { setEditarLoading(false) }
  }

  const guardarCliente = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!session) { setClientesError('Debes iniciar sesión.'); return }
    setCrearLoading(true); setClientesError(''); setClientesMessage('')
    const { data: nuevoCliente, error: errorCliente } = await supabase.from('clientes').insert([{ nombre, documento, telefono }]).select('id').single()
    if (errorCliente) { setClientesError(traducirMensajeError(errorCliente.message)); setCrearLoading(false); return }
    const baseAfiliacion = { cliente_id: nuevoCliente.id, fecha_inicio: fechaInicioAfiliacion || hoyIsoDate(), fecha_fin: fechaFinAfiliacion || null, estado: estadoAfiliacion }
    const { error: errorAfiliacion } = await supabase.from('afiliaciones').insert([{ ...baseAfiliacion, tipo_notificacion: tipoNotificacion, plantilla_mensaje: plantillaMensaje, whatsapp_activo: whatsappActivo }])
    if (errorAfiliacion) {
      if (columnasNuevasNoExisten(errorAfiliacion.message)) {
        const { error: errorBasica } = await supabase.from('afiliaciones').insert([baseAfiliacion])
        if (errorBasica) { setClientesError(traducirErrorConContexto('Cliente creado, pero afiliación falló', errorBasica.message)); setCrearLoading(false); return }
        setClientesMessage('Cliente creado. Migración SQL pendiente para recordatorios avanzados.')
      } else { setClientesError(traducirErrorConContexto('Cliente creado, pero afiliación falló', errorAfiliacion.message)); setCrearLoading(false); return }
    } else { setClientesMessage('Cliente y afiliación creados correctamente.') }
    resetCrearForm(); setClientesVista('lista'); await cargarClientes(); setCrearLoading(false)
  }

  const guardarEdicionCliente = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editClienteId) { setClientesError('No hay cliente seleccionado.'); return }
    setEditarLoading(true); setClientesError(''); setClientesMessage('')
    const { error: errorCliente } = await supabase.from('clientes').update({ nombre: editNombre, documento: editDocumento, telefono: editTelefono }).eq('id', editClienteId)
    if (errorCliente) { setClientesError(traducirErrorConContexto('No se pudo actualizar el cliente', errorCliente.message)); setEditarLoading(false); return }
    const afiliacionDataBasica = { cliente_id: editClienteId, fecha_inicio: editFechaInicioAfiliacion || hoyIsoDate(), fecha_fin: editFechaFinAfiliacion || null, estado: editEstadoAfiliacion }
    const afiliacionDataCompleta = { ...afiliacionDataBasica, tipo_notificacion: editTipoNotificacion, plantilla_mensaje: editPlantillaMensaje, whatsapp_activo: editWhatsappActivo }
    if (editAfiliacionId) {
      const { error: errorAfiliacion } = await supabase.from('afiliaciones').update(afiliacionDataCompleta).eq('id', editAfiliacionId)
      if (errorAfiliacion) {
        if (!columnasNuevasNoExisten(errorAfiliacion.message)) { setClientesError(traducirErrorConContexto('No se pudo actualizar afiliación', errorAfiliacion.message)); setEditarLoading(false); return }
        const { error: errorBasica } = await supabase.from('afiliaciones').update(afiliacionDataBasica).eq('id', editAfiliacionId)
        if (errorBasica) { setClientesError(traducirErrorConContexto('No se pudo actualizar afiliación básica', errorBasica.message)); setEditarLoading(false); return }
        setClientesMessage('Cliente actualizado. Migración SQL pendiente.')
      } else { setClientesMessage('Cliente y afiliación actualizados correctamente.') }
    } else {
      const { data: nuevaAfiliacion, error: insertError } = await supabase.from('afiliaciones').insert([afiliacionDataCompleta]).select('id').single()
      if (insertError) {
        if (!columnasNuevasNoExisten(insertError.message)) { setClientesError(traducirErrorConContexto('No se pudo crear afiliación', insertError.message)); setEditarLoading(false); return }
        const { data: afiliacionBasica, error: errorBasica } = await supabase.from('afiliaciones').insert([afiliacionDataBasica]).select('id').single()
        if (errorBasica) { setClientesError(traducirErrorConContexto('Afiliación básica falló', errorBasica.message)); setEditarLoading(false); return }
        setEditAfiliacionId(afiliacionBasica.id); setClientesMessage('Cliente actualizado con afiliación básica.')
      } else { setEditAfiliacionId(nuevaAfiliacion.id); setClientesMessage('Cliente y afiliación actualizados.') }
    }
    resetEditarForm(); setClientesVista('lista'); await cargarClientes(); setEditarLoading(false)
  }

  const borrarCliente = async (cliente: Cliente) => {
    if (!window.confirm(`¿Borrar a ${cliente.nombre}? Se eliminarán afiliaciones y recordatorios.`)) return
    setClienteActionLoading(true); setClientesError(''); setClientesMessage('')
    const { data: afiliaciones, error: afiliacionesError } = await supabase.from('afiliaciones').select('id').eq('cliente_id', cliente.id)
    if (afiliacionesError) { setClientesError(traducirErrorConContexto('No se pudieron consultar afiliaciones', afiliacionesError.message)); setClienteActionLoading(false); return }
    const afiliacionIds = (afiliaciones ?? []).map((a) => a.id)
    if (afiliacionIds.length > 0) {
      const { error: recordatoriosError } = await supabase.from('recordatorios').delete().in('afiliacion_id', afiliacionIds)
      if (recordatoriosError) { setClientesError(traducirErrorConContexto('No se pudieron borrar recordatorios', recordatoriosError.message)); setClienteActionLoading(false); return }
      const { error: borrarAfiliacionesError } = await supabase.from('afiliaciones').delete().eq('cliente_id', cliente.id)
      if (borrarAfiliacionesError) { setClientesError(traducirErrorConContexto('No se pudieron borrar afiliaciones', borrarAfiliacionesError.message)); setClienteActionLoading(false); return }
    }
    const { error: borrarClienteError } = await supabase.from('clientes').delete().eq('id', cliente.id)
    if (borrarClienteError) { setClientesError(traducirErrorConContexto('No se pudo borrar el cliente', borrarClienteError.message)); setClienteActionLoading(false); return }
    setClientesMessage('Cliente borrado.'); await cargarClientes(); setClienteActionLoading(false)
  }

  const terminoCliente = busquedaCliente.trim().toLowerCase()
  const clientesFiltrados = clientes.filter((c) => !terminoCliente || [c.nombre, c.documento, c.telefono ?? ''].join(' ').toLowerCase().includes(terminoCliente))
  const terminoUsuario = busquedaUsuario.trim().toLowerCase()
  const usuarioCoincide = !terminoUsuario || (session?.user.email ?? '').toLowerCase().includes(terminoUsuario)
  const limpiarBusqueda = () => { if (seccion === 'usuario') { setBusquedaUsuario(''); return }; setBusquedaCliente('') }

  const FormCliente = ({ onSubmit, loading, vals }: {
    onSubmit: (e: FormEvent<HTMLFormElement>) => Promise<void>
    loading: boolean
    vals: {
      nombre: string; setNombre: (v: string) => void
      documento: string; setDocumento: (v: string) => void
      telefono: string; setTelefono: (v: string) => void
      tipo: TipoNotificacion; setTipo: (v: TipoNotificacion) => void
      plantilla: string; setPlantilla: (v: string) => void
      fechaInicio: string; setFechaInicio: (v: string) => void
      fechaFin: string; setFechaFin: (v: string) => void
      estado: string; setEstado: (v: string) => void
      whatsapp: boolean; setWhatsapp: (v: boolean) => void
      prefix: string
    }
  }) => (
    <form className="form-grid" onSubmit={onSubmit}>
      <label htmlFor={`${vals.prefix}nombre`}>Nombre</label>
      <input id={`${vals.prefix}nombre`} className="input" value={vals.nombre} onChange={(e) => vals.setNombre(e.target.value)} required />
      <label htmlFor={`${vals.prefix}documento`}>Documento</label>
      <input id={`${vals.prefix}documento`} className="input" value={vals.documento} onChange={(e) => vals.setDocumento(e.target.value)} required />
      <label htmlFor={`${vals.prefix}telefono`}>Teléfono</label>
      <input id={`${vals.prefix}telefono`} className="input" value={vals.telefono} onChange={(e) => vals.setTelefono(e.target.value)} required />
      <label htmlFor={`${vals.prefix}tipo`}>Tipo de notificación</label>
      <select id={`${vals.prefix}tipo`} className="input" value={vals.tipo} onChange={(e) => { const t = e.target.value as TipoNotificacion; vals.setTipo(t); vals.setPlantilla(sincronizarPlantillaSegunTipo(vals.plantilla, t)) }}>
        <option value="arl">Afiliación ARL (2 días antes del vencimiento)</option>
        <option value="pago">Pago seguridad social (mismo día del siguiente mes)</option>
      </select>
      <label htmlFor={`${vals.prefix}fechaInicio`}>Fecha inicio</label>
      <input id={`${vals.prefix}fechaInicio`} type="date" className="input" value={vals.fechaInicio} onChange={(e) => vals.setFechaInicio(e.target.value)} required />
      <label htmlFor={`${vals.prefix}fechaFin`}>Fecha fin (opcional)</label>
      <input id={`${vals.prefix}fechaFin`} type="date" className="input" value={vals.fechaFin} onChange={(e) => vals.setFechaFin(e.target.value)} />
      <label htmlFor={`${vals.prefix}estado`}>Estado</label>
      <select id={`${vals.prefix}estado`} className="input" value={vals.estado} onChange={(e) => vals.setEstado(e.target.value)}>
        <option value="activa">Activa</option>
        <option value="inactiva">Inactiva</option>
        <option value="suspendida">Suspendida</option>
      </select>
      <label className="switch-row" htmlFor={`${vals.prefix}whatsapp`}>
        <input id={`${vals.prefix}whatsapp`} type="checkbox" checked={vals.whatsapp} onChange={(e) => vals.setWhatsapp(e.target.checked)} />
        Envío WhatsApp activo
      </label>
      <label htmlFor={`${vals.prefix}plantilla`}>Plantilla de mensaje</label>
      <textarea id={`${vals.prefix}plantilla`} className="textarea" rows={4} value={vals.plantilla} onChange={(e) => vals.setPlantilla(e.target.value)} required />
      <p className="hint-text">Variables: <code>{'{{nombre}}'}</code>, <code>{'{{fecha}}'}</code>, <code>{'{{mes}}'}</code></p>
      <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Guardando...' : 'Guardar'}</button>
    </form>
  )

  const renderVistaClientes = () => {
    if (clientesVista === 'crear') {
      return (
        <div className="content-card">
          <div className="section-head">
            <h3>Nuevo cliente</h3>
            <button type="button" className="btn btn-soft" onClick={() => setClientesVista('lista')}>Volver</button>
          </div>
          <FormCliente onSubmit={guardarCliente} loading={crearLoading} vals={{ nombre, setNombre, documento, setDocumento, telefono, setTelefono, tipo: tipoNotificacion, setTipo: setTipoNotificacion, plantilla: plantillaMensaje, setPlantilla: setPlantillaMensaje, fechaInicio: fechaInicioAfiliacion, setFechaInicio: setFechaInicioAfiliacion, fechaFin: fechaFinAfiliacion, setFechaFin: setFechaFinAfiliacion, estado: estadoAfiliacion, setEstado: setEstadoAfiliacion, whatsapp: whatsappActivo, setWhatsapp: setWhatsappActivo, prefix: 'crear-' }} />
        </div>
      )
    }

    if (clientesVista === 'editar') {
      return (
        <div className="content-card">
          <div className="section-head">
            <h3>Editar cliente</h3>
            <button type="button" className="btn btn-soft" onClick={() => setClientesVista('lista')}>Cancelar</button>
          </div>
          <FormCliente onSubmit={guardarEdicionCliente} loading={editarLoading} vals={{ nombre: editNombre, setNombre: setEditNombre, documento: editDocumento, setDocumento: setEditDocumento, telefono: editTelefono, setTelefono: setEditTelefono, tipo: editTipoNotificacion, setTipo: setEditTipoNotificacion, plantilla: editPlantillaMensaje, setPlantilla: setEditPlantillaMensaje, fechaInicio: editFechaInicioAfiliacion, setFechaInicio: setEditFechaInicioAfiliacion, fechaFin: editFechaFinAfiliacion, setFechaFin: setEditFechaFinAfiliacion, estado: editEstadoAfiliacion, setEstado: setEditEstadoAfiliacion, whatsapp: editWhatsappActivo, setWhatsapp: setEditWhatsappActivo, prefix: 'editar-' }} />
        </div>
      )
    }

    return (
      <div className="content-card">
        <div className="section-head">
          <h3>Clientes</h3>
          <div className="head-actions">
            <button type="button" className="btn btn-soft" onClick={() => void cargarClientes()} disabled={clientesLoading || clienteActionLoading}>Actualizar</button>
            <button type="button" className="btn btn-primary" onClick={abrirVistaCrearCliente}>+ Nuevo cliente</button>
          </div>
        </div>
        {clientesLoading ? <p className="hint-text">Cargando...</p> : null}
        {clientes.length === 0 && !clientesLoading ? <p className="hint-text">Sin clientes registrados.</p> : null}
        {clientes.length > 0 && clientesFiltrados.length === 0 && !clientesLoading ? <p className="hint-text">Sin coincidencias.</p> : null}
        <ul className="clientes-list">
          {clientesFiltrados.map((cliente) => (
            <li key={cliente.id} className="cliente-item">
              <div className="cliente-dot" aria-hidden="true" />
              <div style={{ flex: 1 }}>
                <p className="cliente-name">{cliente.nombre}</p>
                <p className="cliente-meta">Doc: {cliente.documento} &middot; Tel: {cliente.telefono ?? 'N/A'}</p>
              </div>
              <div className="cliente-actions">
                <button type="button" className="btn btn-soft" onClick={() => void abrirVistaEditarCliente(cliente)} disabled={clienteActionLoading || editarLoading}>Editar</button>
                <button type="button" className="btn btn-danger" onClick={() => void borrarCliente(cliente)} disabled={clienteActionLoading}>Borrar</button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  if (loadingSession) {
    return (
      <main className="auth-shell">
        <div className="auth-card">
          <h2>Cargando...</h2>
          <p>Validando sesión.</p>
        </div>
        <style jsx>{styles}</style>
      </main>
    )
  }

  if (!session) {
    return (
      <main className="auth-shell">
        <div className="auth-card">
          <div className="auth-logo" aria-hidden="true">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="8" fill="rgba(99,102,241,0.15)" />
              <path d="M16 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10zM8 26c0-4.4 3.6-8 8-8s8 3.6 8 8" stroke="#6366f1" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <h1>Afiliaciones</h1>
          <p>Panel de gestión de clientes y recordatorios.</p>
          {authError ? <p className="status error">{authError}</p> : null}
          {authMessage ? <p className="status success">{authMessage}</p> : null}
          <div className="auth-tabs">
            <button type="button" className={`btn ${authMode === 'login' ? 'btn-primary' : 'btn-soft'}`} onClick={() => cambiarModo('login')}>Iniciar sesión</button>
            <button type="button" className={`btn ${authMode === 'signup' ? 'btn-primary' : 'btn-soft'}`} onClick={() => cambiarModo('signup')}>Crear cuenta</button>
            <button type="button" className={`btn ${authMode === 'recover' ? 'btn-primary' : 'btn-soft'}`} onClick={() => cambiarModo('recover')}>Recuperar clave</button>
          </div>
          <form className="form-grid" onSubmit={handleAuthSubmit}>
            <label htmlFor="email">Correo electrónico</label>
            <input id="email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required />
            {authMode === 'recover' ? (
              <p className="hint-text">Te enviaremos un enlace para restablecer tu contraseña.</p>
            ) : (
              <>
                <label htmlFor="password">Contraseña</label>
                <div className="password-field">
                  <input id="password" type={mostrarPassword ? 'text' : 'password'} className="input" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required />
                  <button type="button" className="eye-btn" onClick={() => setMostrarPassword((p) => !p)} aria-label={mostrarPassword ? 'Ocultar' : 'Mostrar'}>
                    <EyeIcon abierto={mostrarPassword} />
                  </button>
                </div>
              </>
            )}
            <button type="submit" className="btn btn-primary" disabled={authLoading}>
              {authLoading ? 'Procesando...' : authMode === 'login' ? 'Entrar' : authMode === 'signup' ? 'Crear cuenta' : 'Enviar enlace'}
            </button>
          </form>
        </div>
        <style jsx>{styles}</style>
      </main>
    )
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="top-icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>
          </div>
          <div>
            <p className="top-kicker">Panel de control</p>
            <h1 className="top-title">Afiliaciones</h1>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span className="version-badge">V2 — Dark</span>
          <button type="button" className="btn btn-soft" onClick={handleLogout}>Cerrar sesión</button>
        </div>
      </header>
      <div className="workspace">
        <aside className="sidebar">
          <h2>Menú</h2>
          <button type="button" className={`menu-btn ${seccion === 'usuario' ? 'active' : ''}`} onClick={() => { setSeccion('usuario'); setClientesError(''); setClientesMessage('') }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
            Usuario
          </button>
          <button type="button" className={`menu-btn ${seccion === 'clientes' ? 'active' : ''}`} onClick={() => { setSeccion('clientes'); setClientesVista('lista'); void cargarClientes() }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            Clientes
          </button>
        </aside>
        <section className="content-area">
          {clientesError ? <p className="status error">{clientesError}</p> : null}
          {clientesMessage ? <p className="status success">{clientesMessage}</p> : null}
          <div className="search-shell">
            <label className="search-label" htmlFor="buscadorContextual">{seccion === 'usuario' ? 'Buscar usuario' : 'Buscar cliente'}</label>
            <div className="search-row">
              <input id="buscadorContextual" className="search-input" placeholder={seccion === 'usuario' ? 'Correo...' : 'Nombre, documento o teléfono...'} value={seccion === 'usuario' ? busquedaUsuario : busquedaCliente} onChange={(e) => { if (seccion === 'usuario') setBusquedaUsuario(e.target.value); else setBusquedaCliente(e.target.value) }} />
              <button type="button" className="btn btn-soft" onClick={limpiarBusqueda}>Limpiar</button>
            </div>
          </div>
          {seccion === 'usuario' ? (
            <div className="content-card">
              <h3>Usuario</h3>
              {usuarioCoincide ? (
                <>
                  <p className="hint-text">Sesión activa: {session.user.email}</p>
                  <p className="hint-text">Desde el menú puedes acceder a Clientes.</p>
                </>
              ) : <p className="hint-text">Sin coincidencias.</p>}
            </div>
          ) : renderVistaClientes()}
        </section>
      </div>
      <style jsx>{styles}</style>
    </div>
  )
}

/* =====================================================================
   V2 — Dark mode macOS Ventura
   Paleta: #1c1c1e fondo, #2c2c2e superficie, #6366f1 acento índigo
   Estilo: oscuro profundo, sidebar ahumado, tipografía clara
   ===================================================================== */
const styles = `
  .app-shell {
    --bg: #161618;
    --surface: #1c1c1e;
    --surface-alt: #252528;
    --border: rgba(255,255,255,0.08);
    --border-strong: rgba(255,255,255,0.14);
    --sidebar-bg: #1c1c1e;
    --accent: #6366f1;
    --accent-hover: #4f46e5;
    --text-1: #f2f2f7;
    --text-2: #aeaeb2;
    --text-3: #636366;
    width: 100%;
    min-height: 100vh;
    background: var(--bg);
    padding: clamp(10px, 1.4vw, 18px);
    display: flex;
    flex-direction: column;
    gap: 10px;
    font-family: -apple-system, 'Helvetica Neue', sans-serif;
    color: var(--text-1);
  }

  .topbar {
    background: rgba(30,30,32,0.85);
    backdrop-filter: blur(20px) saturate(1.4);
    -webkit-backdrop-filter: blur(20px) saturate(1.4);
    border: 1px solid var(--border);
    border-radius: 13px;
    box-shadow: 0 1px 0 rgba(255,255,255,0.05) inset, 0 4px 20px rgba(0,0,0,0.4);
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    padding: 11px 16px;
  }

  .top-icon {
    width: 34px; height: 34px;
    background: rgba(99,102,241,0.15);
    border: 1px solid rgba(99,102,241,0.25);
    border-radius: 9px;
    display: grid;
    place-items: center;
    color: var(--accent);
    flex-shrink: 0;
  }

  .top-kicker { margin: 0; font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-3); font-weight: 600; }
  .top-title { margin: 1px 0 0; font-size: clamp(0.95rem, 1.5vw, 1.18rem); font-weight: 700; color: var(--text-1); letter-spacing: -0.018em; }

  .version-badge { font-size: 11px; font-weight: 600; color: var(--accent); background: rgba(99,102,241,0.12); border: 1px solid rgba(99,102,241,0.22); border-radius: 20px; padding: 3px 10px; }

  .workspace { flex: 1; display: grid; grid-template-columns: 210px minmax(0,1fr); gap: 10px; align-items: start; }

  .sidebar {
    background: var(--sidebar-bg);
    border: 1px solid var(--border);
    border-radius: 13px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.35);
    padding: 8px 6px;
    display: flex;
    flex-direction: column;
    gap: 1px;
    position: sticky;
    top: 10px;
  }

  .sidebar h2 { margin: 0 0 5px; font-size: 10px; font-weight: 600; color: var(--text-3); text-transform: uppercase; letter-spacing: 0.09em; padding: 0 8px; }

  .menu-btn { border: none; background: transparent; color: var(--text-2); border-radius: 8px; padding: 8px 10px; font-weight: 500; font-size: 0.88rem; text-align: left; cursor: pointer; transition: background 0.12s, color 0.12s; display: flex; align-items: center; gap: 8px; width: 100%; font-family: inherit; }
  .menu-btn:hover { background: rgba(255,255,255,0.06); color: var(--text-1); }
  .menu-btn.active { background: var(--accent); color: #fff; font-weight: 600; }
  .menu-btn.active:hover { background: var(--accent-hover); }

  .content-area { display: flex; flex-direction: column; gap: 10px; min-width: 0; }

  .search-shell {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.3);
    padding: 9px 12px;
    display: grid;
    gap: 6px;
    position: sticky;
    top: 10px;
    z-index: 5;
  }

  .search-label { font-size: 10px; font-weight: 600; color: var(--text-3); text-transform: uppercase; letter-spacing: 0.07em; }
  .search-row { display: grid; grid-template-columns: 1fr auto; gap: 8px; }

  .search-input { border: 1px solid var(--border-strong); border-radius: 8px; padding: 7px 10px; font-size: 0.88rem; outline: none; color: var(--text-1); background: var(--surface-alt); transition: border-color 0.12s, box-shadow 0.12s; font-family: inherit; }
  .search-input::placeholder { color: var(--text-3); }
  .search-input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(99,102,241,0.2); }

  .content-card { background: var(--surface); border: 1px solid var(--border); border-radius: 13px; box-shadow: 0 4px 20px rgba(0,0,0,0.3); padding: clamp(14px,1.5vw,20px); }
  .content-card h3 { margin: 0 0 10px; font-size: clamp(1rem,1.4vw,1.18rem); color: var(--text-1); font-weight: 600; letter-spacing: -0.014em; }

  .section-head { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-bottom: 12px; }
  .head-actions { display: flex; gap: 7px; flex-wrap: wrap; }

  .form-grid { display: grid; gap: 9px; max-width: min(760px, 100%); }
  .form-grid label { font-size: 0.82rem; font-weight: 600; color: var(--text-2); }

  .input, .textarea { border: 1px solid var(--border-strong); border-radius: 8px; padding: 8px 10px; font-size: 0.88rem; color: var(--text-1); background: var(--surface-alt); outline: none; transition: border-color 0.12s, box-shadow 0.12s; font-family: inherit; width: 100%; box-sizing: border-box; }
  .input::placeholder, .textarea::placeholder { color: var(--text-3); }
  .input:focus, .textarea:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(99,102,241,0.18); }
  .textarea { min-height: 90px; resize: vertical; }

  .password-field { position: relative; display: flex; align-items: center; }
  .password-field .input { padding-right: 40px; }
  .eye-btn { position: absolute; right: 7px; display: grid; place-items: center; width: 26px; height: 26px; border: none; border-radius: 6px; background: transparent; color: var(--text-2); cursor: pointer; transition: background 0.12s; }
  .eye-btn:hover { background: rgba(255,255,255,0.07); }
  .eye-btn svg { width: 15px; height: 15px; }

  .switch-row { display: flex; align-items: center; gap: 7px; font-size: 0.85rem; color: var(--text-2); cursor: pointer; }
  .hint-text { margin: 0; color: var(--text-3); font-size: 0.82rem; line-height: 1.5; }
  code { background: rgba(255,255,255,0.06); border-radius: 4px; padding: 1px 5px; font-size: 0.8rem; color: var(--accent); }

  .clientes-list { display: flex; flex-direction: column; gap: 1px; margin: 6px 0 0; padding: 0; background: var(--border); border-radius: 10px; overflow: hidden; }
  .cliente-item { list-style: none; padding: 11px 13px; display: flex; gap: 12px; align-items: center; background: var(--surface); transition: background 0.1s; }
  .cliente-item:first-child { border-radius: 10px 10px 0 0; }
  .cliente-item:last-child { border-radius: 0 0 10px 10px; }
  .cliente-item:only-child { border-radius: 10px; }
  .cliente-item:hover { background: var(--surface-alt); }

  .cliente-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--accent); flex-shrink: 0; margin-top: 4px; }
  .cliente-name { margin: 0; font-size: 0.92rem; font-weight: 600; color: var(--text-1); }
  .cliente-meta { margin: 2px 0 0; color: var(--text-3); font-size: 0.79rem; }
  .cliente-actions { display: flex; gap: 7px; flex-wrap: wrap; flex-shrink: 0; margin-left: auto; }

  .status { border-radius: 9px; padding: 9px 11px; margin: 0; font-size: 0.84rem; font-weight: 500; line-height: 1.4; }
  .status.error { background: rgba(255,59,48,0.1); border: 1px solid rgba(255,59,48,0.22); color: #ff6b6b; }
  .status.success { background: rgba(52,199,89,0.08); border: 1px solid rgba(52,199,89,0.2); color: #4ade80; }

  .btn { border: none; border-radius: 8px; padding: 7px 12px; font-weight: 500; font-size: 0.84rem; cursor: pointer; transition: all 0.12s; font-family: inherit; white-space: nowrap; }
  .btn:disabled { opacity: 0.45; cursor: not-allowed; }

  .btn-primary { background: var(--accent); color: #fff; box-shadow: 0 2px 8px rgba(99,102,241,0.35); }
  .btn-primary:hover:not(:disabled) { background: var(--accent-hover); }

  .btn-soft { background: rgba(255,255,255,0.07); color: var(--text-1); border: 1px solid var(--border); }
  .btn-soft:hover:not(:disabled) { background: rgba(255,255,255,0.11); }

  .btn-danger { background: rgba(255,59,48,0.1); color: #ff6b6b; border: 1px solid rgba(255,59,48,0.2); }
  .btn-danger:hover:not(:disabled) { background: rgba(255,59,48,0.18); }

  .auth-shell { min-height: 100vh; background: var(--bg); display: grid; place-items: center; padding: 16px; }

  .auth-card {
    width: min(420px, 95vw);
    background: var(--surface);
    border-radius: 18px;
    border: 1px solid var(--border);
    padding: clamp(22px,4vw,34px);
    box-shadow: 0 0 0 1px rgba(255,255,255,0.04) inset, 0 20px 60px rgba(0,0,0,0.6);
    display: grid;
    gap: 12px;
  }

  .auth-logo { display: flex; justify-content: center; }
  .auth-card h1, .auth-card h2 { margin: 0; color: var(--text-1); font-size: 1.18rem; font-weight: 700; letter-spacing: -0.02em; }
  .auth-card > p { margin: 0; color: var(--text-3); font-size: 0.87rem; }

  .auth-tabs { display: flex; gap: 2px; background: rgba(255,255,255,0.05); border-radius: 9px; padding: 3px; }
  .auth-tabs .btn { flex: 1; border-radius: 6px; padding: 6px 8px; font-size: 0.82rem; box-shadow: none; background: transparent; color: var(--text-2); border: none; }
  .auth-tabs .btn-primary { background: rgba(99,102,241,0.2); color: var(--text-1); box-shadow: none; font-weight: 600; border: 1px solid rgba(99,102,241,0.3); }
  .auth-tabs .btn-primary:hover:not(:disabled) { background: rgba(99,102,241,0.28); }
  .auth-tabs .btn-soft { background: transparent; border: none; }
  .auth-tabs .btn-soft:hover:not(:disabled) { background: rgba(255,255,255,0.05); }

  @media (max-width: 860px) {
    .workspace { grid-template-columns: 1fr; }
    .sidebar { position: static; flex-direction: row; flex-wrap: wrap; }
    .sidebar h2 { width: 100%; }
    .menu-btn { flex: 1; min-width: 100px; justify-content: center; }
  }
  @media (max-width: 560px) {
    .app-shell { padding: 9px; }
    .topbar { flex-direction: column; align-items: flex-start; }
    .search-row { grid-template-columns: 1fr; }
    .cliente-item { flex-direction: column; align-items: flex-start; }
    .section-head { flex-direction: column; align-items: flex-start; }
  }
`

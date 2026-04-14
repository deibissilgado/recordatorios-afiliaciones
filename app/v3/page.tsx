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

export default function V3() {
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
    if (pathname === '/v3' && (hasRecoveryType || hasRecoveryTokens)) {
      window.location.replace(`/auth/reset-password${search}${hash}`)
    }
  }, [])

  useEffect(() => {
    let isMounted = true
    const cargarSesion = async () => {
      const { data, error } = await supabase.auth.getSession()
      if (!isMounted) return
      if (error) setAuthError('No se pudo validar la sesión.')
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
    if (!email || (authMode !== 'recover' && !password)) { setAuthError(authMode === 'recover' ? 'Debes ingresar tu correo.' : 'Completa correo y contraseña.'); return }
    setAuthLoading(true)
    try {
      if (authMode === 'recover') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: getAppBaseUrl() ? `${getAppBaseUrl()}/auth/reset-password` : undefined })
        if (error) { setAuthError(traducirMensajeError(error.message)); return }
        setAuthMessage('Enlace de recuperación enviado.')
      } else if (authMode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) { setAuthError(traducirMensajeError(error.message)); return }
        setAuthMessage(data.session ? 'Cuenta creada exitosamente.' : 'Cuenta creada. Revisa tu correo.')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) { setAuthError(traducirMensajeError(error.message)); return }
        setAuthMessage('Sesión iniciada.')
      }
    } finally { setAuthLoading(false) }
  }

  const handleLogout = async () => {
    setAuthError(''); setAuthMessage('')
    const { error } = await supabase.auth.signOut()
    if (error) { setAuthError(traducirMensajeError(error.message)); return }
    setClientesMessage(''); setClientesError(''); resetCrearForm(); resetEditarForm()
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
        if (errorBasica) { setClientesError(traducirErrorConContexto('Afiliación falló', errorBasica.message)); setCrearLoading(false); return }
        setClientesMessage('Cliente creado. Migración SQL pendiente.')
      } else { setClientesError(traducirErrorConContexto('Afiliación falló', errorAfiliacion.message)); setCrearLoading(false); return }
    } else { setClientesMessage('Cliente y afiliación creados.') }
    resetCrearForm(); setClientesVista('lista'); await cargarClientes(); setCrearLoading(false)
  }

  const guardarEdicionCliente = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editClienteId) { setClientesError('Sin cliente seleccionado.'); return }
    setEditarLoading(true); setClientesError(''); setClientesMessage('')
    const { error: errorCliente } = await supabase.from('clientes').update({ nombre: editNombre, documento: editDocumento, telefono: editTelefono }).eq('id', editClienteId)
    if (errorCliente) { setClientesError(traducirErrorConContexto('No se actualizó el cliente', errorCliente.message)); setEditarLoading(false); return }
    const afiliacionDataBasica = { cliente_id: editClienteId, fecha_inicio: editFechaInicioAfiliacion || hoyIsoDate(), fecha_fin: editFechaFinAfiliacion || null, estado: editEstadoAfiliacion }
    const afiliacionDataCompleta = { ...afiliacionDataBasica, tipo_notificacion: editTipoNotificacion, plantilla_mensaje: editPlantillaMensaje, whatsapp_activo: editWhatsappActivo }
    if (editAfiliacionId) {
      const { error: errorAfiliacion } = await supabase.from('afiliaciones').update(afiliacionDataCompleta).eq('id', editAfiliacionId)
      if (errorAfiliacion) {
        if (!columnasNuevasNoExisten(errorAfiliacion.message)) { setClientesError(traducirErrorConContexto('No se actualizó afiliación', errorAfiliacion.message)); setEditarLoading(false); return }
        const { error: errorBasica } = await supabase.from('afiliaciones').update(afiliacionDataBasica).eq('id', editAfiliacionId)
        if (errorBasica) { setClientesError(traducirErrorConContexto('No se actualizó afiliación básica', errorBasica.message)); setEditarLoading(false); return }
        setClientesMessage('Actualizado. Migración SQL pendiente.')
      } else { setClientesMessage('Cliente y afiliación actualizados.') }
    } else {
      const { data: nuevaAfiliacion, error: insertError } = await supabase.from('afiliaciones').insert([afiliacionDataCompleta]).select('id').single()
      if (insertError) {
        if (!columnasNuevasNoExisten(insertError.message)) { setClientesError(traducirErrorConContexto('No se creó afiliación', insertError.message)); setEditarLoading(false); return }
        const { data: afiliacionBasica, error: errorBasica } = await supabase.from('afiliaciones').insert([afiliacionDataBasica]).select('id').single()
        if (errorBasica) { setClientesError(traducirErrorConContexto('Afiliación básica falló', errorBasica.message)); setEditarLoading(false); return }
        setEditAfiliacionId(afiliacionBasica.id); setClientesMessage('Cliente actualizado con afiliación básica.')
      } else { setEditAfiliacionId(nuevaAfiliacion.id); setClientesMessage('Cliente y afiliación actualizados.') }
    }
    resetEditarForm(); setClientesVista('lista'); await cargarClientes(); setEditarLoading(false)
  }

  const borrarCliente = async (cliente: Cliente) => {
    if (!window.confirm(`¿Borrar a ${cliente.nombre}?`)) return
    setClienteActionLoading(true); setClientesError(''); setClientesMessage('')
    const { data: afiliaciones, error: afiliacionesError } = await supabase.from('afiliaciones').select('id').eq('cliente_id', cliente.id)
    if (afiliacionesError) { setClientesError(traducirErrorConContexto('Error consultando afiliaciones', afiliacionesError.message)); setClienteActionLoading(false); return }
    const afiliacionIds = (afiliaciones ?? []).map((a) => a.id)
    if (afiliacionIds.length > 0) {
      const { error: recordatoriosError } = await supabase.from('recordatorios').delete().in('afiliacion_id', afiliacionIds)
      if (recordatoriosError) { setClientesError(traducirErrorConContexto('Error borrando recordatorios', recordatoriosError.message)); setClienteActionLoading(false); return }
      const { error: borrarAfiliacionesError } = await supabase.from('afiliaciones').delete().eq('cliente_id', cliente.id)
      if (borrarAfiliacionesError) { setClientesError(traducirErrorConContexto('Error borrando afiliaciones', borrarAfiliacionesError.message)); setClienteActionLoading(false); return }
    }
    const { error: borrarClienteError } = await supabase.from('clientes').delete().eq('id', cliente.id)
    if (borrarClienteError) { setClientesError(traducirErrorConContexto('Error borrando cliente', borrarClienteError.message)); setClienteActionLoading(false); return }
    setClientesMessage('Cliente eliminado.'); await cargarClientes(); setClienteActionLoading(false)
  }

  const terminoCliente = busquedaCliente.trim().toLowerCase()
  const clientesFiltrados = clientes.filter((c) => !terminoCliente || [c.nombre, c.documento, c.telefono ?? ''].join(' ').toLowerCase().includes(terminoCliente))
  const terminoUsuario = busquedaUsuario.trim().toLowerCase()
  const usuarioCoincide = !terminoUsuario || (session?.user.email ?? '').toLowerCase().includes(terminoUsuario)
  const limpiarBusqueda = () => { if (seccion === 'usuario') { setBusquedaUsuario(''); return }; setBusquedaCliente('') }

  const renderFormCliente = (isEdit: boolean) => {
    const vals = isEdit
      ? { nombre: editNombre, doc: editDocumento, tel: editTelefono, tipo: editTipoNotificacion, plantilla: editPlantillaMensaje, fi: editFechaInicioAfiliacion, ff: editFechaFinAfiliacion, estado: editEstadoAfiliacion, wa: editWhatsappActivo }
      : { nombre, doc: documento, tel: telefono, tipo: tipoNotificacion, plantilla: plantillaMensaje, fi: fechaInicioAfiliacion, ff: fechaFinAfiliacion, estado: estadoAfiliacion, wa: whatsappActivo }
    const loading = isEdit ? editarLoading : crearLoading
    const prefix = isEdit ? 'e-' : 'c-'

    return (
      <form className="form-grid" onSubmit={isEdit ? guardarEdicionCliente : guardarCliente}>
        <div className="field-group">
          <label className="field-label" htmlFor={`${prefix}nombre`}>Nombre completo</label>
          <input id={`${prefix}nombre`} className="input" value={vals.nombre} onChange={(e) => isEdit ? setEditNombre(e.target.value) : setNombre(e.target.value)} placeholder="Ej. María García" required />
        </div>
        <div className="field-row">
          <div className="field-group">
            <label className="field-label" htmlFor={`${prefix}doc`}>Documento</label>
            <input id={`${prefix}doc`} className="input" value={vals.doc} onChange={(e) => isEdit ? setEditDocumento(e.target.value) : setDocumento(e.target.value)} placeholder="CC / NIT" required />
          </div>
          <div className="field-group">
            <label className="field-label" htmlFor={`${prefix}tel`}>Teléfono</label>
            <input id={`${prefix}tel`} className="input" value={vals.tel} onChange={(e) => isEdit ? setEditTelefono(e.target.value) : setTelefono(e.target.value)} placeholder="+57 300..." required />
          </div>
        </div>
        <div className="field-group">
          <label className="field-label" htmlFor={`${prefix}tipo`}>Tipo de notificación</label>
          <select id={`${prefix}tipo`} className="input" value={vals.tipo} onChange={(e) => { const t = e.target.value as TipoNotificacion; if (isEdit) { setEditTipoNotificacion(t); setEditPlantillaMensaje((p) => sincronizarPlantillaSegunTipo(p, t)) } else { setTipoNotificacion(t); setPlantillaMensaje((p) => sincronizarPlantillaSegunTipo(p, t)) } }}>
            <option value="arl">ARL — 2 días antes del vencimiento</option>
            <option value="pago">Seguridad social — mismo día del siguiente mes</option>
          </select>
        </div>
        <div className="field-row">
          <div className="field-group">
            <label className="field-label" htmlFor={`${prefix}fi`}>Fecha inicio</label>
            <input id={`${prefix}fi`} type="date" className="input" value={vals.fi} onChange={(e) => isEdit ? setEditFechaInicioAfiliacion(e.target.value) : setFechaInicioAfiliacion(e.target.value)} required />
          </div>
          <div className="field-group">
            <label className="field-label" htmlFor={`${prefix}ff`}>Fecha fin (opcional)</label>
            <input id={`${prefix}ff`} type="date" className="input" value={vals.ff} onChange={(e) => isEdit ? setEditFechaFinAfiliacion(e.target.value) : setFechaFinAfiliacion(e.target.value)} />
          </div>
        </div>
        <div className="field-row">
          <div className="field-group">
            <label className="field-label" htmlFor={`${prefix}estado`}>Estado</label>
            <select id={`${prefix}estado`} className="input" value={vals.estado} onChange={(e) => isEdit ? setEditEstadoAfiliacion(e.target.value) : setEstadoAfiliacion(e.target.value)}>
              <option value="activa">Activa</option>
              <option value="inactiva">Inactiva</option>
              <option value="suspendida">Suspendida</option>
            </select>
          </div>
          <div className="field-group" style={{ justifyContent: 'flex-end' }}>
            <label className="field-label">&nbsp;</label>
            <label className="switch-row" htmlFor={`${prefix}wa`}>
              <input id={`${prefix}wa`} type="checkbox" checked={vals.wa} onChange={(e) => isEdit ? setEditWhatsappActivo(e.target.checked) : setWhatsappActivo(e.target.checked)} />
              WhatsApp activo
            </label>
          </div>
        </div>
        <div className="field-group">
          <label className="field-label" htmlFor={`${prefix}plantilla`}>Plantilla de mensaje</label>
          <textarea id={`${prefix}plantilla`} className="textarea" rows={3} value={vals.plantilla} onChange={(e) => isEdit ? setEditPlantillaMensaje(e.target.value) : setPlantillaMensaje(e.target.value)} required />
          <p className="hint-text">Variables disponibles: <code>{'{{nombre}}'}</code> <code>{'{{fecha}}'}</code> <code>{'{{mes}}'}</code></p>
        </div>
        <div className="form-footer">
          <button type="button" className="btn btn-soft" onClick={() => setClientesVista('lista')}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Guardando...' : 'Guardar'}</button>
        </div>
      </form>
    )
  }

  const renderVistaClientes = () => {
    if (clientesVista === 'crear') {
      return (
        <div className="content-card">
          <div className="card-header">
            <div>
              <h3>Nuevo cliente</h3>
              <p className="card-sub">Completa los datos para registrar un cliente.</p>
            </div>
          </div>
          {renderFormCliente(false)}
        </div>
      )
    }

    if (clientesVista === 'editar') {
      return (
        <div className="content-card">
          <div className="card-header">
            <div>
              <h3>Editar — {editNombre}</h3>
              <p className="card-sub">Modifica los datos del cliente seleccionado.</p>
            </div>
          </div>
          {renderFormCliente(true)}
        </div>
      )
    }

    return (
      <div className="content-card">
        <div className="card-header">
          <div>
            <h3>Clientes</h3>
            <p className="card-sub">{clientes.length} registros totales</p>
          </div>
          <div className="head-actions">
            <button type="button" className="btn btn-soft" onClick={() => void cargarClientes()} disabled={clientesLoading || clienteActionLoading}>Actualizar</button>
            <button type="button" className="btn btn-primary" onClick={abrirVistaCrearCliente}>Nuevo cliente</button>
          </div>
        </div>
        {clientesLoading ? (
          <div className="empty-state">
            <p>Cargando clientes...</p>
          </div>
        ) : clientes.length === 0 ? (
          <div className="empty-state">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            <p>Sin clientes registrados todavía.</p>
            <button type="button" className="btn btn-primary" onClick={abrirVistaCrearCliente}>Agregar el primero</button>
          </div>
        ) : clientesFiltrados.length === 0 ? (
          <div className="empty-state"><p>Sin coincidencias con la búsqueda.</p></div>
        ) : null}
        {clientesFiltrados.length > 0 && (
          <table className="clientes-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Documento</th>
                <th>Teléfono</th>
                <th style={{ textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {clientesFiltrados.map((cliente) => (
                <tr key={cliente.id}>
                  <td><span className="cell-name">{cliente.nombre}</span></td>
                  <td><span className="cell-meta">{cliente.documento}</span></td>
                  <td><span className="cell-meta">{cliente.telefono ?? '—'}</span></td>
                  <td>
                    <div className="row-actions">
                      <button type="button" className="btn btn-soft btn-sm" onClick={() => void abrirVistaEditarCliente(cliente)} disabled={clienteActionLoading || editarLoading}>Editar</button>
                      <button type="button" className="btn btn-danger btn-sm" onClick={() => void borrarCliente(cliente)} disabled={clienteActionLoading}>Borrar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    )
  }

  if (loadingSession) {
    return (
      <main className="auth-shell">
        <div className="auth-card">
          <div className="auth-loading">
            <div className="loading-ring" aria-hidden="true" />
            <p>Cargando...</p>
          </div>
        </div>
        <style jsx>{styles}</style>
      </main>
    )
  }

  if (!session) {
    return (
      <main className="auth-shell">
        <div className="auth-card">
          <div className="auth-brand">
            <div className="brand-mark" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
            </div>
            <span className="brand-name">Afiliaciones</span>
          </div>
          <h1>Bienvenido</h1>
          <p className="auth-sub">Gestiona clientes y recordatorios de afiliaciones.</p>
          {authError ? <p className="status error">{authError}</p> : null}
          {authMessage ? <p className="status success">{authMessage}</p> : null}
          <div className="auth-tabs">
            <button type="button" className={`tab-btn ${authMode === 'login' ? 'active' : ''}`} onClick={() => cambiarModo('login')}>Iniciar sesión</button>
            <button type="button" className={`tab-btn ${authMode === 'signup' ? 'active' : ''}`} onClick={() => cambiarModo('signup')}>Crear cuenta</button>
            <button type="button" className={`tab-btn ${authMode === 'recover' ? 'active' : ''}`} onClick={() => cambiarModo('recover')}>Recuperar clave</button>
          </div>
          <form className="form-grid" onSubmit={handleAuthSubmit}>
            <div className="field-group">
              <label className="field-label" htmlFor="email">Correo electrónico</label>
              <input id="email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nombre@empresa.com" required />
            </div>
            {authMode === 'recover' ? (
              <p className="hint-text">Te enviaremos un enlace por correo para restablecer tu contraseña.</p>
            ) : (
              <div className="field-group">
                <label className="field-label" htmlFor="password">Contraseña</label>
                <div className="password-field">
                  <input id="password" type={mostrarPassword ? 'text' : 'password'} className="input" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" minLength={6} required />
                  <button type="button" className="eye-btn" onClick={() => setMostrarPassword((p) => !p)} aria-label={mostrarPassword ? 'Ocultar' : 'Mostrar'}>
                    <EyeIcon abierto={mostrarPassword} />
                  </button>
                </div>
              </div>
            )}
            <button type="submit" className="btn btn-primary btn-full" disabled={authLoading}>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div className="brand-mark sm" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
          </div>
          <h1 className="top-title">Afiliaciones</h1>
          <span className="version-badge">V3 — Minimal</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="user-chip">{session.user.email}</span>
          <button type="button" className="btn btn-soft btn-sm" onClick={handleLogout}>Salir</button>
        </div>
      </header>
      <div className="workspace">
        <nav className="sidebar" aria-label="Menú principal">
          <p className="nav-section-label">Panel</p>
          <button type="button" className={`nav-item ${seccion === 'usuario' ? 'active' : ''}`} onClick={() => { setSeccion('usuario'); setClientesError(''); setClientesMessage('') }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
            <span>Usuario</span>
          </button>
          <button type="button" className={`nav-item ${seccion === 'clientes' ? 'active' : ''}`} onClick={() => { setSeccion('clientes'); setClientesVista('lista'); void cargarClientes() }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            <span>Clientes</span>
            {clientes.length > 0 && <span className="nav-count">{clientes.length}</span>}
          </button>
        </nav>
        <section className="content-area">
          {clientesError ? <p className="status error">{clientesError}</p> : null}
          {clientesMessage ? <p className="status success">{clientesMessage}</p> : null}
          <div className="search-shell">
            <div className="search-inner">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, color: '#9ca3af' }}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <input id="buscadorContextual" className="search-input" placeholder={seccion === 'usuario' ? 'Buscar usuario...' : 'Buscar por nombre, documento o teléfono...'} value={seccion === 'usuario' ? busquedaUsuario : busquedaCliente} onChange={(e) => { if (seccion === 'usuario') setBusquedaUsuario(e.target.value); else setBusquedaCliente(e.target.value) }} />
              {(seccion === 'usuario' ? busquedaUsuario : busquedaCliente) && (
                <button type="button" className="search-clear" onClick={limpiarBusqueda} aria-label="Limpiar búsqueda">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
              )}
            </div>
          </div>
          {seccion === 'usuario' ? (
            <div className="content-card">
              <div className="card-header">
                <div>
                  <h3>Perfil de usuario</h3>
                  <p className="card-sub">Información de la sesión activa.</p>
                </div>
              </div>
              {usuarioCoincide ? (
                <div className="user-info-row">
                  <div className="user-avatar" aria-hidden="true">{session.user.email?.[0]?.toUpperCase() ?? 'U'}</div>
                  <div>
                    <p className="cell-name">{session.user.email}</p>
                    <p className="cell-meta">Sesión activa &middot; Acceso completo</p>
                  </div>
                </div>
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
   V3 — Minimalista blanco
   Paleta: #ffffff fondo, #f9fafb superficie, #111827 texto, #2563eb acento
   Estilo: tabla estilo Notion, sin blur, tipografía Inter, iconos finos
   ===================================================================== */
const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

  .app-shell {
    --bg: #f9fafb;
    --surface: #ffffff;
    --border: #e5e7eb;
    --border-strong: #d1d5db;
    --accent: #2563eb;
    --accent-hover: #1d4ed8;
    --accent-light: #eff6ff;
    --text-1: #111827;
    --text-2: #374151;
    --text-3: #9ca3af;
    --danger: #dc2626;
    --danger-bg: #fef2f2;
    --success-bg: #f0fdf4;
    --success: #16a34a;
    width: 100%;
    min-height: 100vh;
    background: var(--bg);
    padding: 0;
    display: flex;
    flex-direction: column;
    font-family: 'Inter', -apple-system, sans-serif;
    color: var(--text-1);
    font-size: 14px;
  }

  .topbar {
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    padding: 0 20px;
    height: 52px;
    flex-shrink: 0;
  }

  .top-title { margin: 0; font-size: 0.95rem; font-weight: 700; color: var(--text-1); letter-spacing: -0.01em; }
  .version-badge { font-size: 10.5px; font-weight: 600; color: var(--accent); background: var(--accent-light); border: 1px solid #bfdbfe; border-radius: 20px; padding: 2px 8px; }
  .user-chip { font-size: 12px; color: var(--text-3); max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  .workspace { flex: 1; display: flex; min-height: 0; }

  .sidebar {
    width: 200px;
    flex-shrink: 0;
    background: var(--surface);
    border-right: 1px solid var(--border);
    padding: 16px 8px;
    display: flex;
    flex-direction: column;
    gap: 1px;
    position: sticky;
    top: 52px;
    height: calc(100vh - 52px);
    overflow-y: auto;
  }

  .nav-section-label { font-size: 10.5px; font-weight: 600; color: var(--text-3); text-transform: uppercase; letter-spacing: 0.08em; padding: 0 8px; margin: 0 0 4px; }

  .nav-item { border: none; background: transparent; color: var(--text-2); border-radius: 7px; padding: 7px 8px; font-weight: 500; font-size: 0.87rem; text-align: left; cursor: pointer; display: flex; align-items: center; gap: 8px; width: 100%; font-family: inherit; transition: background 0.1s; }
  .nav-item:hover { background: var(--bg); }
  .nav-item.active { background: var(--accent-light); color: var(--accent); font-weight: 600; }
  .nav-count { margin-left: auto; font-size: 10.5px; font-weight: 600; color: var(--text-3); background: var(--bg); border: 1px solid var(--border); border-radius: 20px; padding: 1px 7px; }

  .content-area { flex: 1; display: flex; flex-direction: column; gap: 0; min-width: 0; padding: 20px; gap: 12px; }

  .search-shell { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
  .search-inner { display: flex; align-items: center; gap: 8px; padding: 8px 12px; }
  .search-input { border: none; outline: none; font-size: 0.88rem; color: var(--text-1); background: transparent; flex: 1; font-family: inherit; }
  .search-input::placeholder { color: var(--text-3); }
  .search-clear { border: none; background: transparent; color: var(--text-3); cursor: pointer; display: grid; place-items: center; width: 20px; height: 20px; border-radius: 4px; }
  .search-clear:hover { background: var(--bg); color: var(--text-1); }

  .content-card { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }

  .card-header { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 16px 20px; border-bottom: 1px solid var(--border); }
  .card-header h3 { margin: 0; font-size: 0.95rem; font-weight: 700; color: var(--text-1); letter-spacing: -0.01em; }
  .card-sub { margin: 2px 0 0; font-size: 0.8rem; color: var(--text-3); }
  .head-actions { display: flex; gap: 6px; }

  .form-grid { display: flex; flex-direction: column; gap: 14px; padding: 20px; }
  .field-group { display: flex; flex-direction: column; gap: 5px; }
  .field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .field-label { font-size: 12px; font-weight: 600; color: var(--text-2); }
  .form-footer { display: flex; justify-content: flex-end; gap: 8px; padding-top: 4px; border-top: 1px solid var(--border); margin-top: 4px; }

  .input, .textarea { border: 1px solid var(--border-strong); border-radius: 7px; padding: 7px 10px; font-size: 0.88rem; color: var(--text-1); background: var(--surface); outline: none; transition: border-color 0.12s, box-shadow 0.12s; font-family: inherit; width: 100%; box-sizing: border-box; }
  .input::placeholder, .textarea::placeholder { color: var(--text-3); }
  .input:focus, .textarea:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(37,99,235,0.1); }
  .textarea { min-height: 80px; resize: vertical; }

  .password-field { position: relative; display: flex; align-items: center; }
  .password-field .input { padding-right: 38px; }
  .eye-btn { position: absolute; right: 7px; display: grid; place-items: center; width: 24px; height: 24px; border: none; border-radius: 5px; background: transparent; color: var(--text-3); cursor: pointer; transition: background 0.1s; }
  .eye-btn:hover { background: var(--bg); }
  .eye-btn svg { width: 14px; height: 14px; }

  .switch-row { display: flex; align-items: center; gap: 7px; font-size: 0.85rem; color: var(--text-2); cursor: pointer; }
  .hint-text { margin: 0; color: var(--text-3); font-size: 0.8rem; line-height: 1.5; }
  code { background: var(--bg); border: 1px solid var(--border); border-radius: 4px; padding: 1px 5px; font-size: 0.78rem; color: var(--accent); }

  .clientes-table { width: 100%; border-collapse: collapse; }
  .clientes-table thead tr { border-bottom: 1px solid var(--border); }
  .clientes-table th { padding: 10px 20px; text-align: left; font-size: 11px; font-weight: 600; color: var(--text-3); text-transform: uppercase; letter-spacing: 0.06em; background: var(--bg); }
  .clientes-table td { padding: 12px 20px; border-bottom: 1px solid var(--border); }
  .clientes-table tr:last-child td { border-bottom: none; }
  .clientes-table tbody tr:hover td { background: #f9fafb; }

  .cell-name { font-weight: 600; color: var(--text-1); font-size: 0.88rem; }
  .cell-meta { color: var(--text-3); font-size: 0.82rem; margin: 0; }
  .row-actions { display: flex; gap: 6px; justify-content: flex-end; }

  .empty-state { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 48px 20px; color: var(--text-3); text-align: center; }
  .empty-state svg { color: var(--text-3); opacity: 0.5; }
  .empty-state p { margin: 0; font-size: 0.88rem; }

  .user-info-row { display: flex; align-items: center; gap: 12px; padding: 16px 20px; }
  .user-avatar { width: 38px; height: 38px; border-radius: 50%; background: var(--accent-light); border: 2px solid var(--accent); color: var(--accent); font-weight: 700; font-size: 0.95rem; display: grid; place-items: center; flex-shrink: 0; }

  .status { border-radius: 8px; padding: 9px 12px; margin: 0; font-size: 0.84rem; font-weight: 500; line-height: 1.4; }
  .status.error { background: var(--danger-bg); border: 1px solid #fecaca; color: var(--danger); }
  .status.success { background: var(--success-bg); border: 1px solid #bbf7d0; color: var(--success); }

  .btn { border: none; border-radius: 7px; padding: 7px 13px; font-weight: 500; font-size: 0.84rem; cursor: pointer; transition: all 0.1s; font-family: inherit; white-space: nowrap; }
  .btn-sm { padding: 5px 10px; font-size: 0.8rem; }
  .btn-full { width: 100%; padding: 9px 13px; }
  .btn:disabled { opacity: 0.45; cursor: not-allowed; }

  .btn-primary { background: var(--accent); color: #fff; }
  .btn-primary:hover:not(:disabled) { background: var(--accent-hover); }

  .btn-soft { background: var(--bg); color: var(--text-1); border: 1px solid var(--border-strong); }
  .btn-soft:hover:not(:disabled) { background: var(--border); }

  .btn-danger { background: var(--danger-bg); color: var(--danger); border: 1px solid #fecaca; }
  .btn-danger:hover:not(:disabled) { background: #fee2e2; }

  .auth-shell { min-height: 100vh; background: var(--bg); display: grid; place-items: center; padding: 16px; }
  .auth-card { width: min(440px, 95vw); background: var(--surface); border-radius: 14px; border: 1px solid var(--border); padding: clamp(24px,4vw,36px); box-shadow: 0 4px 24px rgba(0,0,0,0.07); display: flex; flex-direction: column; gap: 14px; }

  .auth-brand { display: flex; align-items: center; gap: 8px; }
  .brand-mark { width: 32px; height: 32px; background: var(--accent); border-radius: 8px; display: grid; place-items: center; color: #fff; flex-shrink: 0; }
  .brand-mark.sm { width: 28px; height: 28px; border-radius: 7px; }
  .brand-name { font-size: 1rem; font-weight: 700; color: var(--text-1); letter-spacing: -0.01em; }
  .auth-card h1 { margin: 0; color: var(--text-1); font-size: 1.35rem; font-weight: 700; letter-spacing: -0.02em; }
  .auth-sub { margin: 0; color: var(--text-3); font-size: 0.88rem; }
  .auth-loading { display: flex; align-items: center; gap: 10px; }

  .loading-ring { width: 18px; height: 18px; border: 2px solid var(--border-strong); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.7s linear infinite; flex-shrink: 0; }
  @keyframes spin { to { transform: rotate(360deg); } }

  .auth-tabs { display: flex; border-bottom: 1px solid var(--border); }
  .tab-btn { border: none; background: transparent; color: var(--text-3); padding: 8px 12px; font-size: 0.84rem; font-weight: 500; cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -1px; transition: all 0.1s; font-family: inherit; }
  .tab-btn:hover { color: var(--text-1); }
  .tab-btn.active { color: var(--accent); border-bottom-color: var(--accent); font-weight: 600; }

  @media (max-width: 820px) {
    .workspace { flex-direction: column; }
    .sidebar { width: 100%; height: auto; position: static; flex-direction: row; flex-wrap: wrap; border-right: none; border-bottom: 1px solid var(--border); padding: 8px; gap: 2px; }
    .nav-section-label { display: none; }
    .nav-item { flex: 1; min-width: 80px; justify-content: center; }
    .content-area { padding: 12px; }
  }
  @media (max-width: 520px) {
    .field-row { grid-template-columns: 1fr; }
    .card-header { flex-direction: column; align-items: flex-start; }
    .topbar { padding: 0 12px; }
    .topbar > div:last-child { display: none; }
  }
`

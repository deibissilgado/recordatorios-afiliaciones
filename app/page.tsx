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

const PLANTILLA_POR_DEFECTO =
  'Hola {{nombre}}, recuerda renovar tu afiliación. Fecha sugerida: {{fecha}}.'

function hoyIsoDate() {
  return new Date().toISOString().slice(0, 10)
}

function getAppBaseUrl() {
  if (typeof window !== 'undefined') {
    return window.location.origin
  }

  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (fromEnv) {
    return fromEnv.replace(/\/$/, '')
  }

  return ''
}

function columnasNuevasNoExisten(message: string) {
  return (
    message.includes('tipo_notificacion') ||
    message.includes('plantilla_mensaje') ||
    message.includes('whatsapp_activo')
  )
}

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

export default function Home() {
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

  // Formulario de creación.
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

  // Formulario de edición exclusiva por cliente.
  const [editClienteId, setEditClienteId] = useState<string | null>(null)
  const [editAfiliacionId, setEditAfiliacionId] = useState<string | null>(null)
  const [editNombre, setEditNombre] = useState('')
  const [editDocumento, setEditDocumento] = useState('')
  const [editTelefono, setEditTelefono] = useState('')
  const [editTipoNotificacion, setEditTipoNotificacion] =
    useState<TipoNotificacion>('arl')
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

    const hasRecoveryType =
      hashParams.get('type') === 'recovery' || queryParams.get('type') === 'recovery'
    const hasRecoveryTokens =
      Boolean(hashParams.get('access_token') && hashParams.get('refresh_token')) ||
      Boolean(queryParams.get('token_hash'))

    // Si el enlace de recuperación cae en "/", lo reenviamos a la pantalla correcta.
    if (pathname === '/' && (hasRecoveryType || hasRecoveryTokens)) {
      window.location.replace(`/auth/reset-password${search}${hash}`)
    }
  }, [])

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

    void cargarSesion()

    const { data } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      if (!isMounted) return
      setSession(currentSession)
    })

    return () => {
      isMounted = false
      data.subscription.unsubscribe()
    }
  }, [])

  const resetCrearForm = useCallback(() => {
    setNombre('')
    setDocumento('')
    setTelefono('')
    setTipoNotificacion('arl')
    setPlantillaMensaje(PLANTILLA_POR_DEFECTO)
    setFechaInicioAfiliacion(hoyIsoDate())
    setFechaFinAfiliacion('')
    setEstadoAfiliacion('activa')
    setWhatsappActivo(true)
  }, [])

  const resetEditarForm = useCallback(() => {
    setEditClienteId(null)
    setEditAfiliacionId(null)
    setEditNombre('')
    setEditDocumento('')
    setEditTelefono('')
    setEditTipoNotificacion('arl')
    setEditPlantillaMensaje(PLANTILLA_POR_DEFECTO)
    setEditFechaInicioAfiliacion(hoyIsoDate())
    setEditFechaFinAfiliacion('')
    setEditEstadoAfiliacion('activa')
    setEditWhatsappActivo(true)
  }, [])

  const cargarClientes = useCallback(async () => {
    if (!session) {
      setClientes([])
      return
    }

    setClientesLoading(true)
    setClientesError('')

    // Trae los clientes para la vista de gestión.
    const { data, error } = await supabase
      .from('clientes')
      .select('id,nombre,documento,telefono,created_at')
      .order('created_at', { ascending: false })
      .limit(300)

    if (error) {
      setClientesError(traducirErrorConContexto('No se pudieron cargar clientes', error.message))
    } else {
      setClientes((data ?? []) as Cliente[])
    }

    setClientesLoading(false)
  }, [session])

  useEffect(() => {
    if (!session) {
      setSeccion('usuario')
      setClientesVista('lista')
      setClientes([])
      setClientesError('')
      setClientesMessage('')
      resetCrearForm()
      resetEditarForm()
      return
    }

    void cargarClientes()
  }, [session, cargarClientes, resetCrearForm, resetEditarForm])

  const cargarAfiliacionParaEdicion = async (clienteId: string) => {
    // Intenta leer afiliación con columnas nuevas; si aún no existen, cae al modo básico.
    const avanzada = await supabase
      .from('afiliaciones')
      .select('id,fecha_inicio,fecha_fin,estado,tipo_notificacion,plantilla_mensaje,whatsapp_activo')
      .eq('cliente_id', clienteId)
      .order('created_at', { ascending: false })
      .limit(1)

    if (!avanzada.error) {
      const fila = (avanzada.data?.[0] ?? null) as AfiliacionEdit | null
      return fila
    }

    if (!columnasNuevasNoExisten(avanzada.error.message)) {
      throw new Error(traducirMensajeError(avanzada.error.message))
    }

    const basica = await supabase
      .from('afiliaciones')
      .select('id,fecha_inicio,fecha_fin,estado')
      .eq('cliente_id', clienteId)
      .order('created_at', { ascending: false })
      .limit(1)

    if (basica.error) {
      throw new Error(traducirMensajeError(basica.error.message))
    }

    const filaBasica = basica.data?.[0] as {
      id: string
      fecha_inicio: string | null
      fecha_fin: string | null
      estado: string | null
    } | null

    if (!filaBasica) return null

    return {
      id: filaBasica.id,
      fecha_inicio: filaBasica.fecha_inicio,
      fecha_fin: filaBasica.fecha_fin,
      estado: filaBasica.estado,
      tipo_notificacion: 'arl',
      plantilla_mensaje: PLANTILLA_POR_DEFECTO,
      whatsapp_activo: true,
    } satisfies AfiliacionEdit
  }

  const cambiarModo = (mode: AuthMode) => {
    setAuthMode(mode)
    setAuthError('')
    setAuthMessage('')
    setMostrarPassword(false)
    if (mode === 'recover') {
      setPassword('')
    }
  }

  const handleAuthSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setAuthError('')
    setAuthMessage('')

    if (!email || (authMode !== 'recover' && !password)) {
      setAuthError(
        authMode === 'recover'
          ? 'Debes ingresar tu correo para recuperar contraseña.'
          : 'Debes completar correo y contraseña.'
      )
      return
    }

    setAuthLoading(true)

    try {
      if (authMode === 'recover') {
        // Envía correo de recuperación a una pantalla segura para actualizar contraseña.
        const appBaseUrl = getAppBaseUrl()
        const redirectTo = appBaseUrl ? `${appBaseUrl}/auth/reset-password` : undefined

        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })

        if (error) {
          setAuthError(traducirMensajeError(error.message))
          return
        }

        setAuthMessage('Te enviamos un enlace para recuperar tu contraseña.')
      } else if (authMode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email, password })

        if (error) {
          setAuthError(traducirMensajeError(error.message))
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
          setAuthError(traducirMensajeError(error.message))
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
      setAuthError(traducirMensajeError(error.message))
      return
    }

    setAuthMessage('Sesión cerrada correctamente.')
    setClientesMessage('')
    setClientesError('')
    resetCrearForm()
    resetEditarForm()
  }

  const abrirVistaCrearCliente = () => {
    setClientesError('')
    setClientesMessage('')
    resetCrearForm()
    setClientesVista('crear')
  }

  const abrirVistaEditarCliente = async (cliente: Cliente) => {
    setClientesError('')
    setClientesMessage('')
    setEditarLoading(true)

    try {
      const afiliacion = await cargarAfiliacionParaEdicion(cliente.id)

      setEditClienteId(cliente.id)
      setEditAfiliacionId(afiliacion?.id ?? null)
      setEditNombre(cliente.nombre)
      setEditDocumento(cliente.documento)
      setEditTelefono(cliente.telefono ?? '')
      setEditTipoNotificacion(afiliacion?.tipo_notificacion ?? 'arl')
      setEditPlantillaMensaje(afiliacion?.plantilla_mensaje ?? PLANTILLA_POR_DEFECTO)
      setEditFechaInicioAfiliacion(afiliacion?.fecha_inicio ?? hoyIsoDate())
      setEditFechaFinAfiliacion(afiliacion?.fecha_fin ?? '')
      setEditEstadoAfiliacion(afiliacion?.estado ?? 'activa')
      setEditWhatsappActivo(afiliacion?.whatsapp_activo ?? true)
      setClientesVista('editar')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No fue posible abrir la edición.'
      setClientesError(message)
    } finally {
      setEditarLoading(false)
    }
  }

  const guardarCliente = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!session) {
      setClientesError('Debes iniciar sesión para guardar clientes.')
      return
    }

    setCrearLoading(true)
    setClientesError('')
    setClientesMessage('')

    const { data: nuevoCliente, error: errorCliente } = await supabase
      .from('clientes')
      .insert([{ nombre, documento, telefono }])
      .select('id')
      .single()

    if (errorCliente) {
      setClientesError(traducirMensajeError(errorCliente.message))
      setCrearLoading(false)
      return
    }

    const baseAfiliacion = {
      cliente_id: nuevoCliente.id,
      fecha_inicio: fechaInicioAfiliacion || hoyIsoDate(),
      fecha_fin: fechaFinAfiliacion || null,
      estado: estadoAfiliacion,
    }

    const { error: errorAfiliacion } = await supabase.from('afiliaciones').insert([
      {
        ...baseAfiliacion,
        tipo_notificacion: tipoNotificacion,
        plantilla_mensaje: plantillaMensaje,
        whatsapp_activo: whatsappActivo,
      },
    ])

    if (errorAfiliacion) {
      // Mantiene compatibilidad si todavía no aplicaste la migración con columnas nuevas.
      if (columnasNuevasNoExisten(errorAfiliacion.message)) {
        const { error: errorAfiliacionBasica } = await supabase
          .from('afiliaciones')
          .insert([baseAfiliacion])

        if (errorAfiliacionBasica) {
          setClientesError(
            traducirErrorConContexto(
              'Cliente creado, pero afiliación falló',
              errorAfiliacionBasica.message
            )
          )
          setCrearLoading(false)
          return
        }

        setClientesMessage(
          'Cliente y afiliación creados. Ejecuta la migración SQL para activar recordatorios avanzados.'
        )
      } else {
        setClientesError(
          traducirErrorConContexto('Cliente creado, pero afiliación falló', errorAfiliacion.message)
        )
        setCrearLoading(false)
        return
      }
    } else {
      setClientesMessage('Cliente y afiliación creados correctamente.')
    }

    resetCrearForm()
    setClientesVista('lista')
    await cargarClientes()
    setCrearLoading(false)
  }

  const guardarEdicionCliente = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!editClienteId) {
      setClientesError('No hay cliente seleccionado para editar.')
      return
    }

    setEditarLoading(true)
    setClientesError('')
    setClientesMessage('')

    // 1) Actualiza los datos principales del cliente.
    const { error: errorCliente } = await supabase
      .from('clientes')
      .update({
        nombre: editNombre,
        documento: editDocumento,
        telefono: editTelefono,
      })
      .eq('id', editClienteId)

    if (errorCliente) {
      setClientesError(
        traducirErrorConContexto('No se pudo actualizar el cliente', errorCliente.message)
      )
      setEditarLoading(false)
      return
    }

    const afiliacionDataBasica = {
      cliente_id: editClienteId,
      fecha_inicio: editFechaInicioAfiliacion || hoyIsoDate(),
      fecha_fin: editFechaFinAfiliacion || null,
      estado: editEstadoAfiliacion,
    }

    const afiliacionDataCompleta = {
      ...afiliacionDataBasica,
      tipo_notificacion: editTipoNotificacion,
      plantilla_mensaje: editPlantillaMensaje,
      whatsapp_activo: editWhatsappActivo,
    }

    if (editAfiliacionId) {
      // 2) Actualiza afiliación existente, con fallback si faltan columnas nuevas.
      const { error: errorAfiliacion } = await supabase
        .from('afiliaciones')
        .update(afiliacionDataCompleta)
        .eq('id', editAfiliacionId)

      if (errorAfiliacion) {
        if (!columnasNuevasNoExisten(errorAfiliacion.message)) {
          setClientesError(
            traducirErrorConContexto('No se pudo actualizar afiliación', errorAfiliacion.message)
          )
          setEditarLoading(false)
          return
        }

        const { error: errorBasica } = await supabase
          .from('afiliaciones')
          .update(afiliacionDataBasica)
          .eq('id', editAfiliacionId)

        if (errorBasica) {
          setClientesError(
            traducirErrorConContexto('No se pudo actualizar afiliación básica', errorBasica.message)
          )
          setEditarLoading(false)
          return
        }

        setClientesMessage(
          'Cliente actualizado. Aplica la migración SQL para editar tipo de notificación y plantilla.'
        )
      } else {
        setClientesMessage('Cliente y afiliación actualizados correctamente.')
      }
    } else {
      // 3) Si no existe afiliación, la crea desde la pantalla de edición.
      const { data: nuevaAfiliacion, error: insertAfiliacionError } = await supabase
        .from('afiliaciones')
        .insert([afiliacionDataCompleta])
        .select('id')
        .single()

      if (insertAfiliacionError) {
        if (!columnasNuevasNoExisten(insertAfiliacionError.message)) {
          setClientesError(
            traducirErrorConContexto(
              'Cliente actualizado, pero no se pudo crear afiliación',
              insertAfiliacionError.message
            )
          )
          setEditarLoading(false)
          return
        }

        const { data: afiliacionBasica, error: errorBasica } = await supabase
          .from('afiliaciones')
          .insert([afiliacionDataBasica])
          .select('id')
          .single()

        if (errorBasica) {
          setClientesError(
            traducirErrorConContexto('Cliente actualizado, pero afiliación falló', errorBasica.message)
          )
          setEditarLoading(false)
          return
        }

        setEditAfiliacionId(afiliacionBasica.id)
        setClientesMessage(
          'Cliente actualizado y afiliación creada en modo básico. Ejecuta la migración SQL para campos avanzados.'
        )
      } else {
        setEditAfiliacionId(nuevaAfiliacion.id)
        setClientesMessage('Cliente actualizado y afiliación creada correctamente.')
      }
    }

    resetEditarForm()
    setClientesVista('lista')
    await cargarClientes()
    setEditarLoading(false)
  }

  const borrarCliente = async (cliente: Cliente) => {
    const confirmacion = window.confirm(
      `¿Seguro que deseas borrar a ${cliente.nombre}? También se borrarán afiliaciones y recordatorios asociados.`
    )

    if (!confirmacion) return

    setClienteActionLoading(true)
    setClientesError('')
    setClientesMessage('')

    // 1) Busca afiliaciones para limpiar primero recordatorios relacionados.
    const { data: afiliaciones, error: afiliacionesError } = await supabase
      .from('afiliaciones')
      .select('id')
      .eq('cliente_id', cliente.id)

    if (afiliacionesError) {
      setClientesError(
        traducirErrorConContexto('No se pudieron consultar afiliaciones', afiliacionesError.message)
      )
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
        setClientesError(
          traducirErrorConContexto('No se pudieron borrar recordatorios', recordatoriosError.message)
        )
        setClienteActionLoading(false)
        return
      }

      const { error: borrarAfiliacionesError } = await supabase
        .from('afiliaciones')
        .delete()
        .eq('cliente_id', cliente.id)

      if (borrarAfiliacionesError) {
        setClientesError(
          traducirErrorConContexto(
            'No se pudieron borrar afiliaciones',
            borrarAfiliacionesError.message
          )
        )
        setClienteActionLoading(false)
        return
      }
    }

    // 2) Borra cliente al final para respetar dependencias.
    const { error: borrarClienteError } = await supabase.from('clientes').delete().eq('id', cliente.id)

    if (borrarClienteError) {
      setClientesError(
        traducirErrorConContexto('No se pudo borrar el cliente', borrarClienteError.message)
      )
      setClienteActionLoading(false)
      return
    }

    setClientesMessage('Cliente borrado correctamente.')
    await cargarClientes()
    setClienteActionLoading(false)
  }

  const terminoCliente = busquedaCliente.trim().toLowerCase()
  const clientesFiltrados = clientes.filter((cliente) => {
    if (!terminoCliente) return true

    // Filtro rápido por nombre, documento o teléfono en la lista de clientes.
    return [cliente.nombre, cliente.documento, cliente.telefono ?? '']
      .join(' ')
      .toLowerCase()
      .includes(terminoCliente)
  })
  const terminoUsuario = busquedaUsuario.trim().toLowerCase()
  const usuarioCoincide =
    !terminoUsuario ||
    (session?.user.email ?? '').toLowerCase().includes(terminoUsuario)
  const limpiarBusqueda = () => {
    if (seccion === 'usuario') {
      setBusquedaUsuario('')
      return
    }
    setBusquedaCliente('')
  }

  const renderVistaClientes = () => {
    if (clientesVista === 'crear') {
      return (
        <div className="content-card">
          <div className="section-head">
            <h3>Nuevo cliente</h3>
            <button type="button" className="btn btn-soft" onClick={() => setClientesVista('lista')}>
              Volver a la lista
            </button>
          </div>

          <form className="form-grid" onSubmit={guardarCliente}>
            <label htmlFor="nombre">Nombre</label>
            <input
              id="nombre"
              className="input"
              value={nombre}
              onChange={(event) => setNombre(event.target.value)}
              required
            />

            <label htmlFor="documento">Documento</label>
            <input
              id="documento"
              className="input"
              value={documento}
              onChange={(event) => setDocumento(event.target.value)}
              required
            />

            <label htmlFor="telefono">Teléfono</label>
            <input
              id="telefono"
              className="input"
              value={telefono}
              onChange={(event) => setTelefono(event.target.value)}
              required
            />

            <label htmlFor="tipoNotificacion">Tipo de notificación</label>
            <select
              id="tipoNotificacion"
              className="input"
              value={tipoNotificacion}
              onChange={(event) => setTipoNotificacion(event.target.value as TipoNotificacion)}
            >
              <option value="arl">Afiliación ARL (2 días antes del vencimiento del siguiente mes)</option>
              <option value="pago">Pago seguridad social (mismo día del siguiente mes)</option>
            </select>
            <p className="hint-text">
              El sistema calcula automáticamente la fecha de envío usando la fecha de inicio.
            </p>

            <label htmlFor="fechaInicioAfiliacion">Fecha inicio afiliación</label>
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

            <label htmlFor="estadoAfiliacion">Estado de afiliación</label>
            <select
              id="estadoAfiliacion"
              className="input"
              value={estadoAfiliacion}
              onChange={(event) => setEstadoAfiliacion(event.target.value)}
            >
              <option value="activa">Activa</option>
              <option value="inactiva">Inactiva</option>
              <option value="suspendida">Suspendida</option>
            </select>

            <label className="switch-row" htmlFor="whatsappActivo">
              <input
                id="whatsappActivo"
                type="checkbox"
                checked={whatsappActivo}
                onChange={(event) => setWhatsappActivo(event.target.checked)}
              />
              Envío WhatsApp activo
            </label>

            <label htmlFor="plantillaMensaje">Plantilla de mensaje</label>
            <textarea
              id="plantillaMensaje"
              className="textarea"
              rows={4}
              value={plantillaMensaje}
              onChange={(event) => setPlantillaMensaje(event.target.value)}
              required
            />
            <p className="hint-text">
              Variables: <code>{'{{nombre}}'}</code>, <code>{'{{fecha}}'}</code>,{' '}
              <code>{'{{mes}}'}</code>
            </p>

            <button type="submit" className="btn btn-primary" disabled={crearLoading}>
              {crearLoading ? 'Guardando...' : 'Guardar cliente'}
            </button>
          </form>
        </div>
      )
    }

    if (clientesVista === 'editar') {
      return (
        <div className="content-card">
          <div className="section-head">
            <h3>Editar cliente</h3>
            <button type="button" className="btn btn-soft" onClick={() => setClientesVista('lista')}>
              Cancelar edición
            </button>
          </div>

          <p className="hint-text">Esta pantalla muestra solo la edición del cliente seleccionado.</p>

          <form className="form-grid" onSubmit={guardarEdicionCliente}>
            <label htmlFor="editNombre">Nombre</label>
            <input
              id="editNombre"
              className="input"
              value={editNombre}
              onChange={(event) => setEditNombre(event.target.value)}
              required
            />

            <label htmlFor="editDocumento">Documento</label>
            <input
              id="editDocumento"
              className="input"
              value={editDocumento}
              onChange={(event) => setEditDocumento(event.target.value)}
              required
            />

            <label htmlFor="editTelefono">Teléfono</label>
            <input
              id="editTelefono"
              className="input"
              value={editTelefono}
              onChange={(event) => setEditTelefono(event.target.value)}
              required
            />

            <label htmlFor="editTipoNotificacion">Tipo de notificación</label>
            <select
              id="editTipoNotificacion"
              className="input"
              value={editTipoNotificacion}
              onChange={(event) => setEditTipoNotificacion(event.target.value as TipoNotificacion)}
            >
              <option value="arl">Afiliación ARL (2 días antes del vencimiento del siguiente mes)</option>
              <option value="pago">Pago seguridad social (mismo día del siguiente mes)</option>
            </select>
            <p className="hint-text">
              El sistema calculará automáticamente la fecha de envío según el tipo y la fecha de inicio.
            </p>

            <label htmlFor="editFechaInicio">Fecha inicio afiliación</label>
            <input
              id="editFechaInicio"
              type="date"
              className="input"
              value={editFechaInicioAfiliacion}
              onChange={(event) => setEditFechaInicioAfiliacion(event.target.value)}
              required
            />

            <label htmlFor="editFechaFin">Fecha fin (opcional)</label>
            <input
              id="editFechaFin"
              type="date"
              className="input"
              value={editFechaFinAfiliacion}
              onChange={(event) => setEditFechaFinAfiliacion(event.target.value)}
            />

            <label htmlFor="editEstado">Estado de afiliación</label>
            <select
              id="editEstado"
              className="input"
              value={editEstadoAfiliacion}
              onChange={(event) => setEditEstadoAfiliacion(event.target.value)}
            >
              <option value="activa">Activa</option>
              <option value="inactiva">Inactiva</option>
              <option value="suspendida">Suspendida</option>
            </select>

            <label className="switch-row" htmlFor="editWhatsappActivo">
              <input
                id="editWhatsappActivo"
                type="checkbox"
                checked={editWhatsappActivo}
                onChange={(event) => setEditWhatsappActivo(event.target.checked)}
              />
              Envío WhatsApp activo
            </label>

            <label htmlFor="editPlantilla">Plantilla de mensaje</label>
            <textarea
              id="editPlantilla"
              className="textarea"
              rows={4}
              value={editPlantillaMensaje}
              onChange={(event) => setEditPlantillaMensaje(event.target.value)}
              required
            />
            <p className="hint-text">
              Variables: <code>{'{{nombre}}'}</code>, <code>{'{{fecha}}'}</code>,{' '}
              <code>{'{{mes}}'}</code>
            </p>

            <button type="submit" className="btn btn-primary" disabled={editarLoading}>
              {editarLoading ? 'Guardando cambios...' : 'Guardar cambios'}
            </button>
          </form>
        </div>
      )
    }

    return (
      <div className="content-card">
        <div className="section-head">
          <h3>Clientes</h3>
          <div className="head-actions">
            <button
              type="button"
              className="btn btn-soft"
              onClick={() => void cargarClientes()}
              disabled={clientesLoading || clienteActionLoading}
            >
              Actualizar
            </button>
            <button type="button" className="btn btn-primary" onClick={abrirVistaCrearCliente}>
              Nuevo cliente
            </button>
          </div>
        </div>

        {clientesLoading ? <p className="hint-text">Cargando clientes...</p> : null}
        {clientes.length === 0 && !clientesLoading ? (
          <p className="hint-text">No hay clientes registrados todavía.</p>
        ) : null}
        {clientes.length > 0 && clientesFiltrados.length === 0 && !clientesLoading ? (
          <p className="hint-text">No hay clientes que coincidan con la búsqueda actual.</p>
        ) : null}

        <ul className="clientes-list">
          {clientesFiltrados.map((cliente) => (
            <li key={cliente.id} className="cliente-item">
              <div>
                <p className="cliente-name">{cliente.nombre}</p>
                <p className="cliente-meta">Documento: {cliente.documento}</p>
                <p className="cliente-meta">Teléfono: {cliente.telefono ?? 'N/A'}</p>
              </div>

              <div className="cliente-actions">
                <button
                  type="button"
                  className="btn btn-soft"
                  onClick={() => void abrirVistaEditarCliente(cliente)}
                  disabled={clienteActionLoading || editarLoading}
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
          <h2>Validando sesión...</h2>
          <p>Espera un momento.</p>
        </div>

        <style jsx>{styles}</style>
      </main>
    )
  }

  if (!session) {
    return (
      <main className="auth-shell">
        <div className="auth-card">
          <h1>Control de afiliaciones de clientes</h1>
          <p>
            Inicia sesión, crea tu cuenta o recupera contraseña para gestionar clientes y
            recordatorios por WhatsApp.
          </p>

          {authError ? <p className="status error">{authError}</p> : null}
          {authMessage ? <p className="status success">{authMessage}</p> : null}

          <div className="auth-tabs">
            <button
              type="button"
              className={`btn ${authMode === 'login' ? 'btn-primary' : 'btn-soft'}`}
              onClick={() => cambiarModo('login')}
            >
              Iniciar sesión
            </button>
            <button
              type="button"
              className={`btn ${authMode === 'signup' ? 'btn-primary' : 'btn-soft'}`}
              onClick={() => cambiarModo('signup')}
            >
              Crear cuenta
            </button>
            <button
              type="button"
              className={`btn ${authMode === 'recover' ? 'btn-primary' : 'btn-soft'}`}
              onClick={() => cambiarModo('recover')}
            >
              Recuperar clave
            </button>
          </div>

          <form className="form-grid" onSubmit={handleAuthSubmit}>
            <label htmlFor="email">Correo electrónico</label>
            <input
              id="email"
              type="email"
              className="input"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />

            {authMode === 'recover' ? (
              <p className="hint-text">
                Te enviaremos un enlace por correo para crear una nueva contraseña.
              </p>
            ) : (
              <>
                <label htmlFor="password">Contraseña</label>
                <div className="password-field">
                  <input
                    id="password"
                    type={mostrarPassword ? 'text' : 'password'}
                    className="input"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    minLength={6}
                    required
                  />
                  <button
                    type="button"
                    className="eye-btn"
                    onClick={() => setMostrarPassword((prev) => !prev)}
                    aria-label={mostrarPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    title={mostrarPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    <EyeIcon abierto={mostrarPassword} />
                  </button>
                </div>
              </>
            )}

            <button type="submit" className="btn btn-primary" disabled={authLoading}>
              {authLoading
                ? 'Procesando...'
                : authMode === 'login'
                  ? 'Entrar'
                  : authMode === 'signup'
                    ? 'Crear cuenta'
                    : 'Enviar enlace de recuperación'}
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
        <div>
          <p className="top-kicker">Plataforma</p>
          <h1 className="top-title">Control de afiliaciones de clientes</h1>
        </div>
        <button type="button" className="btn btn-primary" onClick={handleLogout}>
          Cerrar sesión
        </button>
      </header>

      <div className="workspace">
        <aside className="sidebar">
          <h2>Menú</h2>
          <button
            type="button"
            className={`menu-btn ${seccion === 'usuario' ? 'active' : ''}`}
            onClick={() => {
              setSeccion('usuario')
              setClientesError('')
              setClientesMessage('')
            }}
          >
            Usuario
          </button>
          <button
            type="button"
            className={`menu-btn ${seccion === 'clientes' ? 'active' : ''}`}
            onClick={() => {
              setSeccion('clientes')
              setClientesVista('lista')
              void cargarClientes()
            }}
          >
            Clientes
          </button>
        </aside>

        <section className="content-area">
          {clientesError ? <p className="status error">{clientesError}</p> : null}
          {clientesMessage ? <p className="status success">{clientesMessage}</p> : null}

          <div className="search-shell">
            <label className="search-label" htmlFor="buscadorContextual">
              {seccion === 'usuario' ? 'Buscar usuario' : 'Buscar cliente'}
            </label>
            <div className="search-row">
              <input
                id="buscadorContextual"
                className="search-input"
                placeholder={
                  seccion === 'usuario'
                    ? 'Escribe correo del usuario...'
                    : 'Buscar por nombre, documento o teléfono...'
                }
                value={seccion === 'usuario' ? busquedaUsuario : busquedaCliente}
                onChange={(event) => {
                  if (seccion === 'usuario') {
                    setBusquedaUsuario(event.target.value)
                  } else {
                    setBusquedaCliente(event.target.value)
                  }
                }}
              />
              <button type="button" className="btn btn-soft" onClick={limpiarBusqueda}>
                Limpiar
              </button>
            </div>
          </div>

          {seccion === 'usuario' ? (
            <div className="content-card">
              <h3>Usuario</h3>
              {usuarioCoincide ? (
                <>
                  <p className="hint-text">Sesión activa: {session.user.email}</p>
                  <p className="hint-text">
                    Desde el menú puedes entrar a Clientes para crear, editar o borrar.
                  </p>
                </>
              ) : (
                <p className="hint-text">No se encontró un usuario que coincida con esa búsqueda.</p>
              )}
            </div>
          ) : (
            renderVistaClientes()
          )}
        </section>
      </div>

      <style jsx>{styles}</style>
    </div>
  )
}

const styles = `
  .app-shell {
    /* Variables visuales del dashboard para mantener consistencia de color y espaciado. */
    --bg-1: #f4f8ff;
    --ink-900: #10233f;
    --ink-700: #324866;
    --ink-500: #5f7492;
    --line: #d9e4f2;
    --panel: rgba(255, 255, 255, 0.86);
    --panel-strong: #ffffff;
    width: 100%;
    max-width: none;
    min-height: 100vh;
    background:
      radial-gradient(62rem 32rem at 0% -18%, #cde0ff 0%, transparent 68%),
      radial-gradient(52rem 26rem at 105% 12%, #c5f3dd 0%, transparent 65%),
      radial-gradient(34rem 18rem at 82% 100%, #ffe9c9 0%, transparent 66%),
      linear-gradient(180deg, var(--bg-1) 0%, #eef5ff 100%);
    padding: clamp(14px, 2vw, 28px);
  }

  .topbar {
    width: 100%;
    margin: 0;
    padding: clamp(16px, 1.6vw, 22px);
    border-radius: 22px;
    background: linear-gradient(110deg, rgba(17, 58, 114, 0.82) 0%, rgba(15, 118, 110, 0.78) 100%);
    border: 1px solid rgba(255, 255, 255, 0.32);
    box-shadow: 0 22px 52px rgba(15, 23, 42, 0.2);
    backdrop-filter: blur(8px);
    color: #f8fafc;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    animation: fadeSlide 0.45s ease both;
  }

  .top-kicker {
    margin: 0;
    font-size: 11px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #b8ffda;
    font-weight: 700;
  }

  .top-title {
    margin: 4px 0 0;
    font-size: clamp(1.2rem, 2.1vw, 1.7rem);
    line-height: 1.2;
    font-weight: 800;
    font-family: var(--font-geist-sans), 'Avenir Next', 'Segoe UI', sans-serif;
  }

  .workspace {
    width: 100%;
    max-width: none;
    margin: clamp(14px, 1.5vw, 20px) 0 0;
    display: grid;
    grid-template-columns: minmax(220px, 260px) minmax(0, 1fr);
    gap: clamp(14px, 1.6vw, 22px);
  }

  .sidebar {
    background: var(--panel);
    border-radius: 18px;
    border: 1px solid var(--line);
    padding: 14px;
    box-shadow: 0 16px 36px rgba(15, 23, 42, 0.12);
    backdrop-filter: blur(6px);
    display: grid;
    gap: 10px;
    align-content: start;
    position: sticky;
    top: 14px;
    animation: fadeSlide 0.55s ease both;
  }

  .sidebar h2 {
    margin: 0;
    font-size: 0.98rem;
    color: var(--ink-900);
    letter-spacing: 0.01em;
  }

  .menu-btn {
    border: 1px solid #cfdaea;
    background: #f9fbff;
    color: var(--ink-900);
    border-radius: 12px;
    padding: 11px 13px;
    font-weight: 700;
    font-size: 0.94rem;
    text-align: left;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .menu-btn:hover {
    border-color: #b8c8df;
    background: #f2f7ff;
  }

  .menu-btn.active {
    background: linear-gradient(145deg, #1554a8 0%, #0f766e 100%);
    border-color: transparent;
    color: #f8fafc;
    box-shadow: 0 10px 24px rgba(15, 118, 110, 0.26);
  }

  .content-area {
    display: grid;
    gap: 12px;
    min-width: 0;
    animation: fadeSlide 0.65s ease both;
  }

  .search-shell {
    background: var(--panel);
    border: 1px solid #d6e5d9;
    border-radius: 16px;
    padding: 12px 14px;
    display: grid;
    gap: 8px;
    position: sticky;
    top: 10px;
    z-index: 5;
    box-shadow: 0 14px 28px rgba(15, 23, 42, 0.08);
    backdrop-filter: blur(6px);
  }

  .search-label {
    font-size: 0.84rem;
    font-weight: 700;
    color: #135f57;
  }

  .search-row {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 8px;
  }

  .search-input {
    border: 1px solid #b9d9bf;
    border-radius: 10px;
    padding: 10px 12px;
    font-size: 0.95rem;
    outline: none;
    color: var(--ink-900);
    background: #ffffff;
  }

  .search-input:focus {
    border-color: #0f766e;
    box-shadow: 0 0 0 3px rgba(15, 118, 110, 0.17);
  }

  .content-card {
    background: var(--panel-strong);
    border-radius: 20px;
    border: 1px solid var(--line);
    padding: clamp(18px, 1.7vw, 24px);
    box-shadow: 0 18px 40px rgba(15, 23, 42, 0.13);
    width: 100%;
  }

  .content-card h3 {
    margin: 0 0 10px;
    font-size: clamp(1.15rem, 1.8vw, 1.45rem);
    color: var(--ink-900);
  }

  .section-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    margin-bottom: 14px;
  }

  .head-actions {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }

  .form-grid {
    display: grid;
    gap: 11px;
    max-width: min(860px, 100%);
  }

  .form-grid label {
    font-size: 0.9rem;
    font-weight: 700;
    color: #3c4f6a;
  }

  .input,
  .textarea {
    border: 1px solid #cfdbeb;
    border-radius: 12px;
    padding: 11px 12px;
    font-size: 0.95rem;
    color: var(--ink-900);
    background: #ffffff;
    outline: none;
    transition: all 0.18s ease;
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
    background: #edf3ff;
  }

  .eye-btn svg {
    width: 18px;
    height: 18px;
  }

  .input:focus,
  .textarea:focus {
    border-color: #1774c9;
    box-shadow: 0 0 0 3px rgba(23, 116, 201, 0.15);
  }

  .textarea {
    min-height: 120px;
    resize: vertical;
  }

  .switch-row {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.92rem;
    color: var(--ink-700);
  }

  .hint-text {
    margin: 0;
    color: var(--ink-500);
    font-size: 0.9rem;
    line-height: 1.5;
  }

  .clientes-list {
    display: grid;
    gap: 12px;
    margin: 10px 0 0;
    padding: 0;
  }

  .cliente-item {
    list-style: none;
    border: 1px solid #d7e3f3;
    border-radius: 14px;
    padding: 14px;
    display: flex;
    justify-content: space-between;
    gap: 14px;
    align-items: center;
    background:
      linear-gradient(180deg, #f9fbff 0%, #ffffff 100%),
      radial-gradient(circle at 0% 0%, #eef8ff 0%, transparent 50%);
    transition: transform 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease;
  }

  .cliente-item:hover {
    transform: translateY(-1px);
    border-color: #bfd4ee;
    box-shadow: 0 10px 24px rgba(15, 23, 42, 0.09);
  }

  .cliente-name {
    margin: 0;
    font-size: 1.04rem;
    font-weight: 800;
    color: var(--ink-900);
  }

  .cliente-meta {
    margin: 4px 0 0;
    color: var(--ink-700);
    font-size: 0.9rem;
  }

  .cliente-actions {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }

  .status {
    border-radius: 12px;
    padding: 11px 12px;
    margin: 0;
    font-size: 0.92rem;
    font-weight: 600;
  }

  .status.error {
    background: #fff2f2;
    border: 1px solid #fdc9c9;
    color: #b91c1c;
  }

  .status.success {
    background: #ecfff3;
    border: 1px solid #b4f0cb;
    color: #166534;
  }

  .btn {
    border: 1px solid transparent;
    border-radius: 11px;
    padding: 10px 13px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn:hover {
    transform: translateY(-1px);
  }

  .btn:disabled {
    opacity: 0.72;
    cursor: not-allowed;
    transform: none;
  }

  .btn-primary {
    background: linear-gradient(145deg, #1554a8 0%, #0f766e 100%);
    color: #f8fafc;
    border-color: transparent;
    box-shadow: 0 10px 22px rgba(21, 84, 168, 0.26);
  }

  .btn-primary:hover {
    background: linear-gradient(145deg, #124a94 0%, #0c665f 100%);
  }

  .btn-soft {
    background: #edf3fb;
    color: var(--ink-900);
    border-color: #d0dff0;
  }

  .btn-soft:hover {
    background: #dfebf8;
  }

  .btn-danger {
    background: #ffeaea;
    color: #b91c1c;
    border-color: #fecaca;
  }

  .btn-danger:hover {
    background: #fecaca;
  }

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

  .auth-card h1,
  .auth-card h2 {
    margin: 0;
    color: #0f172a;
    font-size: 1.35rem;
  }

  .auth-card p {
    margin: 0;
    color: #475569;
  }

  .auth-tabs {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  @keyframes fadeSlide {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @media (max-width: 980px) {
    .workspace {
      grid-template-columns: 1fr;
    }

    .sidebar {
      position: static;
      grid-template-columns: 1fr 1fr;
      align-items: center;
    }

    .sidebar h2 {
      grid-column: 1 / -1;
    }
  }

  @media (max-width: 680px) {
    .app-shell {
      padding: 12px;
    }

    .topbar {
      flex-direction: column;
      align-items: flex-start;
    }

    .search-row {
      grid-template-columns: 1fr;
    }

    .cliente-item {
      flex-direction: column;
      align-items: flex-start;
    }

    .section-head {
      flex-direction: column;
      align-items: flex-start;
    }
  }
`

'use client'

import { supabase } from '@/lib/supabase'
import { traducirErrorConContexto, traducirMensajeError } from '@/lib/mensajes'
import type { Session } from '@supabase/supabase-js'
import { type FormEvent, useCallback, useEffect, useState } from 'react'

type AuthMode = 'login' | 'signup' | 'recover'
type Seccion = 'usuario' | 'clientes'
type ClientesVista = 'lista' | 'crear' | 'editar'

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
  dia_recordatorio: number | null
  plantilla_mensaje: string | null
  whatsapp_activo: boolean | null
}

const PLANTILLA_POR_DEFECTO =
  'Hola {{nombre}}, recuerda renovar tu afiliación. Fecha sugerida: {{fecha}}.'

function hoyIsoDate() {
  return new Date().toISOString().slice(0, 10)
}

function columnasNuevasNoExisten(message: string) {
  return (
    message.includes('dia_recordatorio') ||
    message.includes('plantilla_mensaje') ||
    message.includes('whatsapp_activo')
  )
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
  const [diaRecordatorio, setDiaRecordatorio] = useState(20)
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
  const [editDiaRecordatorio, setEditDiaRecordatorio] = useState(20)
  const [editPlantillaMensaje, setEditPlantillaMensaje] = useState(PLANTILLA_POR_DEFECTO)
  const [editFechaInicioAfiliacion, setEditFechaInicioAfiliacion] = useState(hoyIsoDate)
  const [editFechaFinAfiliacion, setEditFechaFinAfiliacion] = useState('')
  const [editEstadoAfiliacion, setEditEstadoAfiliacion] = useState('activa')
  const [editWhatsappActivo, setEditWhatsappActivo] = useState(true)
  const [editarLoading, setEditarLoading] = useState(false)

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
    setDiaRecordatorio(20)
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
    setEditDiaRecordatorio(20)
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
      .select('id,fecha_inicio,fecha_fin,estado,dia_recordatorio,plantilla_mensaje,whatsapp_activo')
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
      dia_recordatorio: 20,
      plantilla_mensaje: PLANTILLA_POR_DEFECTO,
      whatsapp_activo: true,
    } satisfies AfiliacionEdit
  }

  const cambiarModo = (mode: AuthMode) => {
    setAuthMode(mode)
    setAuthError('')
    setAuthMessage('')
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
        const redirectTo =
          typeof window !== 'undefined'
            ? `${window.location.origin}/auth/reset-password`
            : undefined

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
      setEditDiaRecordatorio(afiliacion?.dia_recordatorio ?? 20)
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
        dia_recordatorio: diaRecordatorio,
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
      dia_recordatorio: editDiaRecordatorio,
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
          'Cliente actualizado. Aplica la migración SQL para editar día de recordatorio y plantilla.'
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

            <label htmlFor="editDiaRecordatorio">Día de recordatorio mensual</label>
            <input
              id="editDiaRecordatorio"
              type="number"
              min={1}
              max={28}
              className="input"
              value={editDiaRecordatorio}
              onChange={(event) => setEditDiaRecordatorio(Number(event.target.value) || 20)}
              required
            />

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
                <input
                  id="password"
                  type="password"
                  className="input"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  minLength={6}
                  required
                />
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
    min-height: 100vh;
    background:
      radial-gradient(circle at 10% -20%, #bfdbfe 0%, transparent 35%),
      radial-gradient(circle at 90% 5%, #bbf7d0 0%, transparent 28%),
      linear-gradient(140deg, #0f172a 0%, #1e293b 100%);
    padding: 20px;
  }

  .topbar {
    max-width: 1200px;
    margin: 0 auto;
    padding: 14px 18px;
    border-radius: 16px;
    background: rgba(255, 255, 255, 0.12);
    border: 1px solid rgba(255, 255, 255, 0.28);
    color: #f8fafc;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
  }

  .top-kicker {
    margin: 0;
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #bbf7d0;
    font-weight: 800;
  }

  .top-title {
    margin: 4px 0 0;
    font-size: 1.2rem;
    font-weight: 800;
  }

  .workspace {
    max-width: 1200px;
    margin: 14px auto 0;
    display: grid;
    grid-template-columns: 230px 1fr;
    gap: 14px;
  }

  .sidebar {
    background: #ffffff;
    border-radius: 16px;
    border: 1px solid #dbeafe;
    padding: 14px;
    display: grid;
    gap: 8px;
    align-content: start;
  }

  .sidebar h2 {
    margin: 0 0 4px;
    font-size: 1rem;
    color: #0f172a;
  }

  .menu-btn {
    border: 1px solid #cbd5e1;
    background: #f8fafc;
    color: #0f172a;
    border-radius: 10px;
    padding: 10px 12px;
    font-weight: 700;
    text-align: left;
    cursor: pointer;
  }

  .menu-btn.active {
    background: #0f766e;
    border-color: #0f766e;
    color: #f8fafc;
  }

  .content-area {
    display: grid;
    gap: 10px;
  }

  .search-shell {
    background: #eef7f1;
    border: 1px solid #bbf7d0;
    border-radius: 12px;
    padding: 10px 12px;
    display: grid;
    gap: 6px;
    position: sticky;
    top: 8px;
    z-index: 5;
    box-shadow: 0 8px 18px rgba(15, 23, 42, 0.08);
  }

  .search-label {
    font-size: 0.82rem;
    font-weight: 700;
    color: #166534;
  }

  .search-row {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 8px;
  }

  .search-input {
    border: 1px solid #86efac;
    border-radius: 8px;
    padding: 9px 10px;
    font-size: 0.92rem;
    outline: none;
    color: #0f172a;
    background: #ffffff;
  }

  .search-input:focus {
    border-color: #16a34a;
    box-shadow: 0 0 0 3px rgba(22, 163, 74, 0.18);
  }

  .content-card {
    background: #ffffff;
    border-radius: 16px;
    border: 1px solid #dbeafe;
    padding: 18px;
    box-shadow: 0 16px 38px rgba(2, 6, 23, 0.18);
  }

  .content-card h3 {
    margin: 0 0 8px;
    font-size: 1.2rem;
    color: #0f172a;
  }

  .section-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    margin-bottom: 10px;
  }

  .head-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
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

  .input,
  .textarea {
    border: 1px solid #cbd5e1;
    border-radius: 10px;
    padding: 10px 12px;
    font-size: 0.94rem;
    color: #0f172a;
    background: #ffffff;
    outline: none;
  }

  .input:focus,
  .textarea:focus {
    border-color: #14b8a6;
    box-shadow: 0 0 0 3px rgba(20, 184, 166, 0.2);
  }

  .textarea {
    min-height: 110px;
    resize: vertical;
  }

  .switch-row {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.9rem;
  }

  .hint-text {
    margin: 0;
    color: #64748b;
    font-size: 0.86rem;
    line-height: 1.45;
  }

  .clientes-list {
    display: grid;
    gap: 10px;
    margin: 10px 0 0;
    padding: 0;
  }

  .cliente-item {
    list-style: none;
    border: 1px solid #dbeafe;
    border-radius: 12px;
    padding: 12px;
    display: flex;
    justify-content: space-between;
    gap: 10px;
    align-items: flex-start;
    background: #f8fbff;
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
    font-size: 0.86rem;
  }

  .cliente-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
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
    background: #0f766e;
    color: #f8fafc;
    border-color: #0f766e;
  }

  .btn-primary:hover {
    background: #115e59;
  }

  .btn-soft {
    background: #e2e8f0;
    color: #0f172a;
    border-color: #cbd5e1;
  }

  .btn-soft:hover {
    background: #cbd5e1;
  }

  .btn-danger {
    background: #fee2e2;
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

  @media (max-width: 980px) {
    .workspace {
      grid-template-columns: 1fr;
    }

    .sidebar {
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

    .cliente-item {
      flex-direction: column;
    }

    .section-head {
      flex-direction: column;
      align-items: flex-start;
    }
  }
`

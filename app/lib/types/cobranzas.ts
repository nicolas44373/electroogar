// /app/lib/types/cobranzas.ts

export interface Cliente {
  id: string
  nombre: string
  apellido: string
  documento: string
  telefono?: string
  direccion?: string
  email?: string
  estado?: string
  fecha_nacimiento?: string
  observaciones?: string
  limite_credito?: number
  created_at: string
}

export interface Producto {
  id: string
  nombre: string
  descripcion?: string
  precio: number
  precio_unitario?: number
  codigo?: string
  categoria?: string
  garantia_meses?: number
  estado?: string
  tipo?: string
  stock?: number
  created_at: string
}

export interface Transaccion {
  id: string
  cliente_id: string
  producto_id: string
  tipo_transaccion: string
  monto_total: number
  tipo_pago: string
  numero_cuotas: number
  monto_cuota: number
  fecha_inicio: string
  fecha_venta?: string
  numero_factura?: string
  observaciones?: string
  descuento?: number
  interes?: number
  vendedor_id?: string
  estado?: string
  created_at: string
  
  // Nuevas propiedades para préstamos
  monto_original?: number      // Monto antes de aplicar intereses
  interes_porcentaje?: number  // Porcentaje de interés aplicado
  
  // Relaciones
  cliente?: Cliente
  producto?: Producto
  vendedor?: Vendedor
}

export interface Pago {
  id: string
  transaccion_id: string
  numero_cuota: number
  monto_pagado: number
  monto_cuota?: number
  fecha_pago: string | null
  fecha_vencimiento: string
  numero_recibo?: string
  metodo_pago?: 'efectivo' | 'transferencia' | 'cheque' | 'tarjeta'
  observaciones?: string
  usuario_registro?: string
  comprobante_url?: string
  referencia_externa?: string
  
  // ✅ NUEVAS PROPIEDADES AGREGADAS:
  intereses_mora?: number           // Intereses por mora aplicados
  fecha_reprogramacion?: string     // Fecha cuando se reprogramó el pago
  motivo_reprogramacion?: string    // Motivo de la reprogramación
  
  // ✅ ESTADO ACTUALIZADO para incluir 'reprogramado':
  estado: 'pendiente' | 'parcial' | 'pagado' | 'reprogramado'
  
  created_at: string
  
  // Relación
  transaccion?: Transaccion
}

// También actualiza el enum EstadoPago para incluir el nuevo estado:
export enum EstadoPago {
  PENDIENTE = 'pendiente',
  PARCIAL = 'parcial',
  PAGADO = 'pagado',
  REPROGRAMADO = 'reprogramado'  // ✅ NUEVO ESTADO AGREGADO
}

export interface Vendedor {
  id: string
  nombre: string
  apellido: string
  email: string
  telefono?: string
  comision?: number
  estado?: string
  fecha_ingreso?: string
  created_at: string
  updated_at: string
}

export interface Notificacion {
  id: string
  cliente_id: string
  pago_id?: string
  tipo: 'vencimiento' | 'recordatorio' | 'mora'
  titulo: string
  mensaje: string
  fecha_programada: string
  fecha_enviada?: string
  metodo_envio?: 'email' | 'whatsapp' | 'sms'
  estado: 'pendiente' | 'enviado' | 'fallido'
  respuesta_cliente?: string
  created_at: string
  
  // Relaciones
  cliente?: Cliente
  pago?: Pago
}

export interface Comunicacion {
  id: string
  cliente_id: string
  tipo: 'llamada' | 'whatsapp' | 'email' | 'visita'
  asunto?: string
  descripcion: string
  resultado?: string
  fecha_contacto: string
  proximo_contacto?: string
  usuario?: string
  adjuntos?: string[]
  created_at: string
  
  // Relación
  cliente?: Cliente
}

export interface Configuracion {
  id: string
  clave: string
  valor: string
  descripcion?: string
  tipo: 'text' | 'number' | 'boolean' | 'json'
  categoria: string
  created_at: string
  updated_at: string
}

export interface Auditoria {
  id: string
  tabla: string
  registro_id: string
  accion: 'INSERT' | 'UPDATE' | 'DELETE'
  datos_anteriores?: any
  datos_nuevos?: any
  usuario?: string
  ip_address?: string
  created_at: string
}

export interface PlantillaDocumento {
  id: string
  nombre: string
  tipo: 'recibo' | 'factura' | 'carta_mora' | 'contrato'
  contenido_html: string
  contenido_css?: string
  variables_disponibles?: string[]
  estado?: string
  es_default?: boolean
  created_at: string
  updated_at: string
}

// Interfaces para vistas y reportes
export interface PagoCompleto {
  id: string
  transaccion_id: string
  numero_cuota: number
  monto_pagado: number
  monto_cuota: number
  fecha_pago: string | null
  fecha_vencimiento: string
  numero_recibo?: string
  metodo_pago?: string
  observaciones?: string
  estado: string
  estado_vencimiento: 'vencido' | 'vence_hoy' | 'vigente' | 'pagado'
  dias_para_vencimiento: number
  
  // Datos del cliente
  cliente_nombre: string
  cliente_apellido: string
  cliente_documento: string
  cliente_telefono?: string
  cliente_email?: string
  
  // Datos del producto
  producto_nombre: string
  producto_precio: number
  
  // Datos de la transacción
  transaccion_monto_total: number
  transaccion_numero_cuotas: number
  numero_factura?: string
}

export interface CuentaCorriente {
  cliente_id: string
  cliente_nombre: string
  total_pagado: number
  total_pendiente: number
  cuotas_vencidas: number
  proximo_vencimiento?: string
}

export interface EstadisticasDashboard {
  totalClientes: number
  clientesActivos: number
  clientesConMora: number
  ventasDelMes: number
  ventasDelAno: number
  cobrosDelMes: number
  cobrosDelAno: number
  montoTotalPendiente: number
  cuotasVencidas: number
  cuotasDelDia: number
  cuotasProximaSemana: number
  efectividadCobranza: number
  promedioTicket: number
}

// ✅ ACTUALIZADO: NotificacionVencimiento con fecha_inicio
export interface NotificacionVencimiento {
  id: string
  cliente_id: string
  cliente_nombre: string
  cliente_apellido?: string
  cliente_telefono?: string
  cliente_email?: string
  monto: number
  monto_cuota: number
  monto_cuota_total: number
  monto_pagado: number
  monto_restante: number
  fecha_vencimiento: string
  dias_vencimiento: number
  tipo: 'vencido' | 'por_vencer' | 'hoy'
  numero_cuota: number
  producto_nombre: string
  transaccion_id: string
  saldo_total_cliente: number
  tipo_transaccion: string
  numero_factura?: string
  fecha_inicio: string  // ✅ NUEVO CAMPO AGREGADO
  transaccion?: Transaccion  // ✅ NUEVO CAMPO AGREGADO
}

// Interfaces para formularios
export interface FormularioVenta {
  cliente_id: string
  producto_id: string
  monto_total: number
  tipo_pago: 'contado' | 'cuotas'
  numero_cuotas: number
  descuento?: number
  interes?: number
  fecha_inicio: string
  observaciones?: string
}

// ADD: FormVenta interface for the component
export interface FormVenta {
  producto_id: string
  tipo_transaccion: 'venta' | 'prestamo'
  monto_total: string
  tipo_pago: 'semanal' | 'quincenal' | 'mensual'
  numero_cuotas: string
  fecha_inicio: string
}

export interface FormularioPago {
  pago_id: string
  monto_pago: number
  fecha_pago: string
  metodo_pago: 'efectivo' | 'transferencia' | 'cheque' | 'tarjeta'
  observaciones?: string
  referencia_externa?: string
}

export interface FiltrosPagos {
  cliente_id?: string
  estado?: 'todos' | 'pendiente' | 'parcial' | 'vencido' | 'pagado'
  fecha_desde?: string
  fecha_hasta?: string
  metodo_pago?: string
  busqueda?: string
}

export interface FiltrosTransacciones {
  cliente_id?: string
  producto_id?: string
  estado?: string
  fecha_desde?: string
  fecha_hasta?: string
  vendedor_id?: string
  busqueda?: string
}

export interface OpcionesPaginacion {
  pagina: number
  limite: number
  total: number
  totalPaginas: number
}

// Tipos para respuestas de API
export interface RespuestaAPI<T> {
  success: boolean
  data?: T
  error?: string
  mensaje?: string
}

export interface RespuestaPaginada<T> extends RespuestaAPI<T[]> {
  paginacion?: OpcionesPaginacion
}

// Enums para valores constantes
export enum EstadoCliente {
  ACTIVO = 'activo',
  INACTIVO = 'inactivo',
  SUSPENDIDO = 'suspendido'
}

export enum EstadoTransaccion {
  ACTIVO = 'activo',
  COMPLETADO = 'completado',
  CANCELADO = 'cancelado',
  SUSPENDIDO = 'suspendido'
}

export enum MetodoPago {
  EFECTIVO = 'efectivo',
  TRANSFERENCIA = 'transferencia',
  CHEQUE = 'cheque',
  TARJETA = 'tarjeta'
}

export enum TipoNotificacion {
  VENCIMIENTO = 'vencimiento',
  RECORDATORIO = 'recordatorio',
  MORA = 'mora'
}

export enum TipoComunicacion {
  LLAMADA = 'llamada',
  WHATSAPP = 'whatsapp',
  EMAIL = 'email',
  VISITA = 'visita'
}
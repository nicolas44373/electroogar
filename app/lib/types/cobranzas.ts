export interface Cliente {
  id: string
  nombre: string
  apellido?: string
  telefono?: string
  email?: string
  documento?: string
  direccion?: string
  observaciones?: string | null
  latitud?: number | null
  longitud?: number | null
  ubicacion_actualizada?: string | null
  created_at?: string
}

export interface Producto {
  id: string
  nombre: string
  descripcion?: string
  precio?: number
  precio_unitario?: number
  tipo?: string
  stock?: number
  created_at?: string
}

export interface Transaccion {
  id: string
  cliente_id: string
  producto_id?: string
  tipo_transaccion: 'venta' | 'prestamo'
  monto_total: number
  monto_cuota: number
  monto_original?: number
  interes_porcentaje?: number
  tipo_pago: string
  numero_cuotas: number
  fecha_inicio: string
  estado?: 'activo' | 'completado' | 'moroso'
  descripcion?: string
  numero_factura?: string
  created_at?: string
  producto?: {
    nombre: string
    precio_unitario?: number
  }
}

export interface Pago {
  id: string
  transaccion_id: string
  numero_cuota?: number
  monto_cuota: number
  monto_pagado: number
  fecha_vencimiento: string
  fecha_pago?: string
  estado: 'pendiente' | 'parcial' | 'pagado' | 'reprogramado'
  metodo_pago?: 'efectivo' | 'transferencia' | 'cheque' | 'tarjeta'
  observaciones?: string
  numero_recibo?: string
  fecha_reprogramacion?: string
  motivo_reprogramacion?: string
  intereses_mora?: number
  created_at?: string
}

export interface NotificacionVencimiento {
  id: string
  cliente_id: string
  cliente_nombre: string
  cliente_apellido?: string
  cliente_telefono?: string
  cliente_email?: string

  monto: number
  monto_cuota?: number
  monto_cuota_total: number
  monto_pagado: number
  monto_restante?: number

  fecha_vencimiento: string
  dias_vencimiento: number
  tipo: 'vencido' | 'por_vencer' | 'hoy'

  numero_cuota: number
  producto_nombre: string
  transaccion_id: string
  saldo_total_cliente: number

  tipo_transaccion: string
  numero_factura?: string
  fecha_inicio: string

  fecha_reprogramacion?: string
  intereses_mora?: number
  motivo_reprogramacion?: string

  transaccion?: any
}
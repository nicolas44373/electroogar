import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  AlertCircle,
  CircleDashed,
  CalendarClock,
  CircleSlash,
  Circle,
  type LucideIcon,
} from 'lucide-react'

// Presentación visual de un estado. Recibe el valor interno tal cual viene de la base
// y lo traduce a color + ícono + texto (nunca depende solo del color).
export type VarianteEstado =
  | 'pagado'
  | 'pendiente'
  | 'por_vencer'
  | 'hoy'
  | 'vencido'
  | 'parcial'
  | 'reprogramado'
  | 'activo'
  | 'completado'
  | 'moroso'
  | 'inactivo'

const VARIANTES: Record<VarianteEstado, { clase: string; icono: LucideIcon; texto: string }> = {
  pagado: { clase: 'badge-success', icono: CheckCircle2, texto: 'Pagada' },
  pendiente: { clase: 'badge-primary', icono: Circle, texto: 'Pendiente' },
  por_vencer: { clase: 'badge-warning', icono: Clock, texto: 'Por vencer' },
  hoy: { clase: 'badge-warning', icono: AlertCircle, texto: 'Vence hoy' },
  vencido: { clase: 'badge-danger', icono: AlertTriangle, texto: 'Vencida' },
  parcial: { clase: 'badge-info', icono: CircleDashed, texto: 'Pago parcial' },
  reprogramado: { clase: 'badge-reprog', icono: CalendarClock, texto: 'Reprogramada' },
  activo: { clase: 'badge-primary', icono: Circle, texto: 'Activa' },
  completado: { clase: 'badge-success', icono: CheckCircle2, texto: 'Completada' },
  moroso: { clase: 'badge-danger', icono: AlertTriangle, texto: 'En mora' },
  inactivo: { clase: 'badge-neutral', icono: CircleSlash, texto: 'Inactiva' },
}

interface EstadoBadgeProps {
  estado: VarianteEstado
  texto?: string
  className?: string
}

export default function EstadoBadge({ estado, texto, className = '' }: EstadoBadgeProps) {
  const v = VARIANTES[estado] ?? VARIANTES.inactivo
  const Icono = v.icono
  return (
    <span className={`${v.clase} ${className}`}>
      <Icono className="w-3.5 h-3.5" aria-hidden="true" />
      {texto ?? v.texto}
    </span>
  )
}

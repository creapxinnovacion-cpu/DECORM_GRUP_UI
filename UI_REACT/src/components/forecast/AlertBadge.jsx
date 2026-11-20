import React from 'react';
import { AlertOctagon, AlertTriangle, AlertCircle, CheckCircle2, HelpCircle } from 'lucide-react';

const CONFIG = {
  ROJO: {
    label: 'Crítico / Agotado',
    bg: 'bg-rose-500/15',
    text: 'text-rose-400',
    border: 'border-rose-500/30',
    dot: 'bg-rose-500',
    icon: AlertOctagon,
  },
  NARANJA: {
    label: 'Reorden Inminente',
    bg: 'bg-amber-500/15',
    text: 'text-amber-400',
    border: 'border-amber-500/30',
    dot: 'bg-amber-500',
    icon: AlertTriangle,
  },
  AMARILLO: {
    label: 'Preventiva',
    bg: 'bg-yellow-500/15',
    text: 'text-yellow-400',
    border: 'border-yellow-500/30',
    dot: 'bg-yellow-500',
    icon: AlertCircle,
  },
  VERDE: {
    label: 'Óptimo',
    bg: 'bg-emerald-500/15',
    text: 'text-emerald-400',
    border: 'border-emerald-500/30',
    dot: 'bg-emerald-500',
    icon: CheckCircle2,
  },
  GRIS: {
    label: 'Sin Tasa / Observación',
    bg: 'bg-slate-500/15',
    text: 'text-slate-400',
    border: 'border-slate-500/30',
    dot: 'bg-slate-500',
    icon: HelpCircle,
  },
};

export function AlertBadge({ nivel = 'GRIS', showIcon = true, size = 'sm' }) {
  const normNivel = String(nivel || 'GRIS').toUpperCase();
  const cfg = CONFIG[normNivel] || CONFIG.GRIS;
  const Icon = cfg.icon;

  const sizeClasses =
    size === 'xs'
      ? 'text-[10px] px-1.5 py-0.5 gap-1'
      : size === 'lg'
      ? 'text-sm px-3 py-1.5 gap-2 font-bold'
      : 'text-xs px-2.5 py-1 gap-1.5 font-semibold';

  return (
    <span
      className={`inline-flex items-center rounded-lg border ${cfg.bg} ${cfg.text} ${cfg.border} ${sizeClasses}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} animate-pulse`} />
      {showIcon && <Icon className={size === 'xs' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />}
      <span>{cfg.label}</span>
    </span>
  );
}

export default AlertBadge;

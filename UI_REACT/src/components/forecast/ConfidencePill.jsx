import React from 'react';
import { ShieldCheck, ShieldAlert, Shield, Sparkles } from 'lucide-react';

export function ConfidencePill({ confianza = 'BAJA', isProvisional = false, size = 'sm' }) {
  const norm = String(confianza || 'BAJA').toUpperCase();

  let colorClasses = 'bg-slate-800 text-slate-400 border-slate-700';
  let Icon = Shield;

  if (norm === 'ALTA') {
    colorClasses = 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    Icon = ShieldCheck;
  } else if (norm === 'MEDIA') {
    colorClasses = 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    Icon = Shield;
  } else if (norm === 'BAJA') {
    colorClasses = 'bg-rose-500/15 text-rose-400 border-rose-500/30';
    Icon = ShieldAlert;
  }

  const sizeClasses =
    size === 'xs'
      ? 'text-[10px] px-1.5 py-0.5 gap-1'
      : 'text-xs px-2.5 py-1 gap-1.5 font-semibold';

  return (
    <div className="inline-flex items-center gap-1.5">
      <span className={`inline-flex items-center rounded-lg border ${colorClasses} ${sizeClasses}`}>
        <Icon className={size === 'xs' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
        <span>{norm}</span>
      </span>
      {isProvisional && (
        <span
          title="Tasa estimada por semilla o inicial"
          className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30"
        >
          <Sparkles className="w-2.5 h-2.5" />
          SEMILLA
        </span>
      )}
    </div>
  );
}

export default ConfidencePill;

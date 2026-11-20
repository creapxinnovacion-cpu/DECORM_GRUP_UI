import React from 'react';
import { AlertTriangle, ArrowRight, Scale } from 'lucide-react';

export function ConciliationBanner({
  stockSistema,
  stockFisico,
  diferencia,
  onGoToConciliacion,
}) {
  const dif = diferencia !== undefined ? diferencia : (Number(stockFisico || 0) - Number(stockSistema || 0));
  const hasDesfase = Math.abs(dif) > 0.001;

  if (!hasDesfase) return null;

  return (
    <div className="bg-gradient-to-r from-amber-950/60 via-amber-900/40 to-slate-900 border border-amber-500/40 rounded-2xl p-4 sm:p-5 mb-6 shadow-xl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30 shrink-0 mt-0.5">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-amber-300 flex items-center gap-2">
              Desfase Detectado entre Físico y Sistema
              <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/30">
                Auditoría Activa
              </span>
            </h4>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
              El motor de abastecimiento está operando con el <strong className="text-white">Stock Físico Verificado</strong> ({stockFisico} unid.) calculado a partir de conteos y movimientos netos, mientras que el libro congelado refleja {stockSistema} unid.
            </p>
            <div className="flex items-center gap-4 mt-2 text-xs font-mono">
              <span className="text-slate-400">
                Físico: <strong className="text-emerald-400">{stockFisico}</strong>
              </span>
              <span className="text-slate-500">|</span>
              <span className="text-slate-400">
                Sistema: <strong className="text-slate-300">{stockSistema}</strong>
              </span>
              <span className="text-slate-500">|</span>
              <span className="text-slate-400">
                Diferencia:{' '}
                <strong className={dif < 0 ? 'text-rose-400' : 'text-amber-400'}>
                  {dif > 0 ? `+${dif}` : dif} unid.
                </strong>
              </span>
            </div>
          </div>
        </div>

        {onGoToConciliacion && (
          <button
            onClick={onGoToConciliacion}
            className="flex items-center gap-2 px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-bold transition shadow-md shadow-amber-500/20 shrink-0 cursor-pointer"
          >
            <Scale className="w-4 h-4" />
            <span>Ver Módulo Conciliación</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

export default ConciliationBanner;

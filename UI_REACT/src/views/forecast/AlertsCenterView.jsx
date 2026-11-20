import React, { useState, useEffect } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  AlertCircle,
  HelpCircle,
  CheckCircle2,
  RefreshCw,
  Search,
  ArrowRight,
  TrendingDown,
  ShoppingCart,
  Calendar,
  Layers,
  Sparkles,
} from 'lucide-react';
import { api } from '../../services/api';
import AlertBadge from '../../components/forecast/AlertBadge';
import ConfidencePill from '../../components/forecast/ConfidencePill';

export function AlertsCenterView({ onSelectSku, onNavigatePlan }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ resumen: {}, alertas: [] });
  const [incluirGris, setIncluirGris] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroSeveridad, setFiltroSeveridad] = useState('TODOS');

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const res = await api.getForecastAlerts({
        niveles: ['ROJO', 'NARANJA', 'AMARILLO'],
        incluirGris: incluirGris,
      });
      setData(res || { resumen: {}, alertas: [] });
    } catch (err) {
      console.error('Error al cargar alertas de abastecimiento:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, [incluirGris]);

  const resumen = data.resumen || {
    rojo: 0,
    naranja: 0,
    amarillo: 0,
    gris: 0,
    verde: 0,
    total_alertas: 0,
  };

  // Filter alerts by search term & severity
  const alertasFiltradas = (data.alertas || []).filter((item) => {
    const matchesSearch =
      !searchTerm ||
      (item.sku || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.descripcion || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchesSeveridad =
      filtroSeveridad === 'TODOS' ||
      String(item.alerta || '').toUpperCase() === filtroSeveridad;

    return matchesSearch && matchesSeveridad;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-100 flex items-center gap-2">
            <span className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <AlertOctagon className="w-6 h-6" />
            </span>
            Centro de Alertas de Abastecimiento
            <span className="text-xs font-bold bg-rose-500/20 text-rose-300 px-2.5 py-0.5 rounded-full border border-rose-500/30">
              Semáforo de Riesgo
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Monitoreo en tiempo real del riesgo de rotura de inventario y puntos de reorden (ROP).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigatePlan && onNavigatePlan()}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-bold transition shadow-lg shadow-amber-500/20 cursor-pointer"
          >
            <ShoppingCart className="w-4 h-4" />
            <span>Ver Plan Semanal</span>
          </button>
          <button
            onClick={fetchAlerts}
            disabled={loading}
            className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl border border-slate-800 transition"
            title="Actualizar alertas"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Severity Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {/* Rojo */}
        <div
          onClick={() => setFiltroSeveridad(filtroSeveridad === 'ROJO' ? 'TODOS' : 'ROJO')}
          className={`p-4 rounded-2xl border transition cursor-pointer ${
            filtroSeveridad === 'ROJO'
              ? 'bg-rose-950/50 border-rose-500 shadow-lg shadow-rose-500/20'
              : 'bg-slate-900/60 border-slate-800 hover:border-rose-500/50'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-400 uppercase tracking-wider">Agotado / Crítico</span>
            <AlertOctagon className="w-4 h-4 text-rose-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-rose-400 font-mono">
              {resumen.rojo || 0}
            </span>
            <span className="text-[11px] text-slate-500 font-medium">SKUs en riesgo 0d</span>
          </div>
        </div>

        {/* Naranja */}
        <div
          onClick={() => setFiltroSeveridad(filtroSeveridad === 'NARANJA' ? 'TODOS' : 'NARANJA')}
          className={`p-4 rounded-2xl border transition cursor-pointer ${
            filtroSeveridad === 'NARANJA'
              ? 'bg-amber-950/50 border-amber-500 shadow-lg shadow-amber-500/20'
              : 'bg-slate-900/60 border-slate-800 hover:border-amber-500/50'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">Reorden Inminente</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-amber-400 font-mono">
              {resumen.naranja || 0}
            </span>
            <span className="text-[11px] text-slate-500 font-medium">Bajo ROP</span>
          </div>
        </div>

        {/* Amarillo */}
        <div
          onClick={() => setFiltroSeveridad(filtroSeveridad === 'AMARILLO' ? 'TODOS' : 'AMARILLO')}
          className={`p-4 rounded-2xl border transition cursor-pointer ${
            filtroSeveridad === 'AMARILLO'
              ? 'bg-yellow-950/50 border-yellow-500 shadow-lg shadow-yellow-500/20'
              : 'bg-slate-900/60 border-slate-800 hover:border-yellow-500/50'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-yellow-400 uppercase tracking-wider">Preventiva</span>
            <AlertCircle className="w-4 h-4 text-yellow-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-yellow-400 font-mono">
              {resumen.amarillo || 0}
            </span>
            <span className="text-[11px] text-slate-500 font-medium">Próximos a reorden</span>
          </div>
        </div>

        {/* Gris / Sin Tasa */}
        <div
          onClick={() => setFiltroSeveridad(filtroSeveridad === 'GRIS' ? 'TODOS' : 'GRIS')}
          className={`p-4 rounded-2xl border transition cursor-pointer ${
            filtroSeveridad === 'GRIS'
              ? 'bg-slate-800 border-slate-500 shadow-lg'
              : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Sin Tasa / Observación</span>
            <HelpCircle className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-slate-300 font-mono">
              {resumen.gris || 0}
            </span>
            <span className="text-[11px] text-slate-500 font-medium">En catálogo</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Buscar por SKU o descripción de insumo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white select-none">
            <input
              type="checkbox"
              checked={incluirGris}
              onChange={(e) => setIncluirGris(e.target.checked)}
              className="rounded bg-slate-950 border-slate-700 text-amber-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
            />
            <span>Incluir materiales sin tasa (GRIS)</span>
          </label>

          {filtroSeveridad !== 'TODOS' && (
            <button
              onClick={() => setFiltroSeveridad('TODOS')}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold cursor-pointer"
            >
              Limpiar filtro ({filtroSeveridad})
            </button>
          )}
        </div>
      </div>

      {/* Alerts List */}
      {loading ? (
        <div className="h-64 flex flex-col items-center justify-center gap-3 bg-slate-900/40 rounded-2xl border border-slate-800 text-slate-400">
          <RefreshCw className="w-7 h-7 animate-spin text-amber-400" />
          <p className="text-xs">Evaluando inventario y pronóstico de agotamiento...</p>
        </div>
      ) : alertasFiltradas.length === 0 ? (
        <div className="p-12 text-center bg-slate-900/40 rounded-2xl border border-slate-800 text-slate-400 space-y-3">
          <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto opacity-70" />
          <h3 className="text-base font-bold text-slate-200">No hay alertas activas en esta vista</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Todos los insumos evaluados cuentan con stock seguro o están fuera de los umbrales de reorden seleccionados.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {alertasFiltradas.map((item) => {
            const isUrgente = item.urgente || item.alerta === 'ROJO';
            const hasConciliacionAlert = item.conciliacion?.alerta;

            return (
              <div
                key={item.sku}
                className={`relative flex flex-col justify-between p-5 rounded-2xl border transition-all shadow-lg ${
                  item.alerta === 'ROJO'
                    ? 'bg-rose-950/20 border-rose-500/30 hover:border-rose-500/60'
                    : item.alerta === 'NARANJA'
                    ? 'bg-amber-950/20 border-amber-500/30 hover:border-amber-500/60'
                    : item.alerta === 'AMARILLO'
                    ? 'bg-yellow-950/15 border-yellow-500/30 hover:border-yellow-500/60'
                    : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* Top Badges */}
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <AlertBadge nivel={item.alerta} size="xs" />
                    <div className="flex items-center gap-1.5">
                      {isUrgente && (
                        <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded bg-rose-500 text-white shadow-sm shadow-rose-500/30 animate-pulse">
                          URGENTE
                        </span>
                      )}
                      {hasConciliacionAlert && (
                        <span
                          title="Desfase conteo físico vs libro"
                          className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30"
                        >
                          CONCIL.
                        </span>
                      )}
                      <ConfidencePill confianza={item.confianza} isProvisional={item.fuente_tasa === 'SEED'} size="xs" />
                    </div>
                  </div>

                  {/* SKU & Description */}
                  <div className="mt-1">
                    <span className="font-mono text-xs font-black text-amber-400">{item.sku}</span>
                    <h3 className="text-sm font-bold text-slate-100 line-clamp-2 mt-0.5" title={item.descripcion}>
                      {item.descripcion}
                    </h3>
                    <span className="text-[11px] text-slate-400 font-medium">
                      Categoría: {item.categoria || 'Insumos'} · {item.unidad || 'unidad'}
                    </span>
                  </div>

                  {/* Core Metrics Grid */}
                  <div className="grid grid-cols-2 gap-2 mt-4 p-3 bg-slate-950/70 rounded-xl border border-slate-800/80 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-500 block uppercase font-semibold">Stock Físico</span>
                      <span
                        className={`text-sm font-black font-mono ${
                          item.stock_fisico <= 0 ? 'text-rose-400' : 'text-slate-200'
                        }`}
                      >
                        {item.stock_fisico ?? 0} {item.unidad}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-500 block uppercase font-semibold">Tasa Diaria</span>
                      <span className="text-sm font-black font-mono text-amber-300">
                        {item.tasa_diaria > 0 ? `${item.tasa_diaria} /día` : 'N/D'}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-500 block uppercase font-semibold">Cobertura</span>
                      <span
                        className={`text-sm font-black font-mono ${
                          item.dias_cobertura <= 0
                            ? 'text-rose-400'
                            : item.dias_cobertura <= (item.lead_time_dias || 3)
                            ? 'text-amber-400'
                            : 'text-emerald-400'
                        }`}
                      >
                        {item.dias_cobertura !== null && item.dias_cobertura !== undefined
                          ? `${item.dias_cobertura} días`
                          : 'Indeterminada'}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-500 block uppercase font-semibold">Fecha Agotamiento</span>
                      <span className="text-xs font-bold text-slate-300">
                        {item.fecha_agotamiento || 'N/D'}
                      </span>
                    </div>
                  </div>

                  {/* Action Recommendation */}
                  {item.accion && (
                    <div className="mt-3 p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-slate-300">
                      <strong className="text-amber-400 font-bold block mb-0.5">Acción Recomendada:</strong>
                      {item.accion}
                    </div>
                  )}
                </div>

                {/* Bottom Actions */}
                <div className="pt-4 mt-4 border-t border-slate-800/80 flex items-center justify-between gap-2">
                  <div className="text-xs">
                    <span className="text-[10px] text-slate-500 uppercase block">Compra Sugerida</span>
                    <strong className="text-sm font-mono text-emerald-400">
                      {item.cantidad_sugerida > 0 ? `${item.cantidad_sugerida} ${item.unidad}` : 'Sin sugerencia'}
                    </strong>
                  </div>

                  <button
                    onClick={() => onSelectSku && onSelectSku(item.sku)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition border border-slate-700 cursor-pointer"
                  >
                    <span>Ver Proyección</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default AlertsCenterView;

import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Search,
  Calendar,
  Layers,
  ArrowLeft,
  RefreshCw,
  PlusCircle,
  Clock,
  Truck,
  ShieldCheck,
  Scale,
  Sparkles,
  DollarSign,
  AlertOctagon,
} from 'lucide-react';
import { api } from '../../services/api';
import StockProjectionChart from '../../components/forecast/StockProjectionChart';
import ConciliationBanner from '../../components/forecast/ConciliationBanner';
import AlertBadge from '../../components/forecast/AlertBadge';
import ConfidencePill from '../../components/forecast/ConfidencePill';
import { Modal } from '../../components/Modal';

export function SkuProjectionView({
  sku: initialSku = '',
  onBack,
  onGoToConciliacion,
}) {
  const [sku, setSku] = useState(initialSku || 'ABR-001');
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState(null);
  const [catalogoList, setCatalogoList] = useState([]);

  // Observation Modal state
  const [showObsModal, setShowObsModal] = useState(false);
  const [obsType, setObsType] = useState('CONSUMO');
  const [obsQuantity, setObsQuantity] = useState(1);
  const [obsFechaIni, setObsFechaIni] = useState(new Date().toISOString().slice(0, 10));
  const [obsFechaFin, setObsFechaFin] = useState(new Date().toISOString().slice(0, 10));
  const [obsUbicacion, setObsUbicacion] = useState('Taller Central');
  const [obsNotas, setObsNotas] = useState('');
  const [aprenderAhora, setAprenderAhora] = useState(true);
  const [savingObs, setSavingObs] = useState(false);

  // Fetch quick SKU list for selector
  useEffect(() => {
    api.getCatalogo({ pageSize: 500 }).then((res) => {
      setCatalogoList(res.rows || []);
    }).catch((e) => console.warn(e));
  }, []);

  const fetchProjection = async (targetSku) => {
    if (!targetSku) return;
    setLoading(true);
    try {
      const res = await api.getProjection(targetSku);
      setDetail(res || null);
    } catch (err) {
      console.error('Error al cargar proyección de SKU:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (sku) fetchProjection(sku);
  }, [sku]);

  // Handle observation submit
  const handleCreateObservation = async (e) => {
    e.preventDefault();
    setSavingObs(true);
    try {
      await api.createConsumptionObservation({
        sku,
        tipo: obsType,
        cantidad: Number(obsQuantity),
        fecha_inicial: obsFechaIni,
        fecha_final: obsFechaFin,
        ubicacion: obsUbicacion,
        observaciones: obsNotas,
        aprenderAhora,
      });
      setShowObsModal(false);
      setObsNotas('');
      fetchProjection(sku);
      alert('Observación registrada exitosamente.');
    } catch (err) {
      alert('Error al registrar observación: ' + err.message);
    } finally {
      setSavingObs(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & SKU Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-100 flex items-center gap-2">
              <span className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <TrendingUp className="w-6 h-6" />
              </span>
              Detalle y Simulación Diaria de SKU
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Curva de inventario a 30+ días, posición de inventario y auditoría de stock.
            </p>
          </div>
        </div>

        {/* SKU Switcher */}
        <div className="flex items-center gap-3">
          <div className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 flex items-center gap-2">
            <Search className="w-4 h-4 text-amber-400 shrink-0" />
            <select
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              className="bg-transparent text-slate-100 text-xs font-mono font-bold focus:outline-none cursor-pointer max-w-[260px]"
            >
              {catalogoList.map((item) => (
                <option key={item.sku} value={item.sku} className="bg-slate-900 text-slate-200">
                  {item.sku} — {item.descripcion}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => setShowObsModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/20 transition cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Registrar Observación</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="h-64 flex flex-col items-center justify-center gap-3 bg-slate-900/40 rounded-2xl border border-slate-800 text-slate-400">
          <RefreshCw className="w-7 h-7 animate-spin text-amber-400" />
          <p className="text-xs">Calculando proyección dinámica y posición de inventario...</p>
        </div>
      ) : detail ? (
        <>
          {/* Conciliation Banner if mismatch */}
          {detail.conciliacion?.alerta && (
            <ConciliationBanner
              stockSistema={detail.stock_sistema}
              stockFisico={detail.stock_fisico}
              diferencia={detail.conciliacion?.diferencia}
              onGoToConciliacion={onGoToConciliacion}
            />
          )}

          {/* Main Item Summary Card */}
          <div className="p-6 bg-slate-900/70 border border-slate-800 rounded-2xl shadow-xl">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-5">
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="text-lg font-mono font-black text-amber-400">{detail.sku}</span>
                  <AlertBadge nivel={detail.alerta} size="sm" />
                  <ConfidencePill confianza={detail.confianza} isProvisional={detail.fuente_tasa === 'SEED'} />
                </div>
                <h2 className="text-lg font-bold text-slate-100 mt-1">{detail.descripcion}</h2>
                <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-slate-400">
                  <span>
                    Categoría: <strong className="text-slate-300">{detail.categoria}</strong>
                  </span>
                  <span>·</span>
                  <span>
                    Unidad: <strong className="text-slate-300">{detail.unidad}</strong>
                  </span>
                  <span>·</span>
                  <span>
                    Grupo: <strong className="text-slate-300">{detail.grupo_usuario || 'GENERAL'}</strong>
                  </span>
                  <span>·</span>
                  <span>
                    Proveedor: <strong className="text-slate-300">{detail.proveedor_pref || 'Por asignar'}</strong>
                  </span>
                </div>
              </div>

              {/* Quick Stock Numbers */}
              <div className="flex items-center gap-6 bg-slate-950/80 p-4 rounded-xl border border-slate-800 text-xs">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Stock Físico Real</span>
                  <span
                    className={`text-xl font-black font-mono ${
                      detail.stock_fisico <= 0 ? 'text-rose-400' : 'text-emerald-400'
                    }`}
                  >
                    {detail.stock_fisico} <span className="text-xs font-normal text-slate-400">{detail.unidad}</span>
                  </span>
                </div>

                <div className="h-8 w-px bg-slate-800" />

                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Tasa Diaria</span>
                  <span className="text-xl font-black font-mono text-amber-400">
                    {detail.tasa_diaria} <span className="text-xs font-normal text-slate-400">/día</span>
                  </span>
                </div>

                <div className="h-8 w-px bg-slate-800" />

                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Cobertura</span>
                  <span
                    className={`text-xl font-black font-mono ${
                      detail.dias_cobertura <= (detail.lead_time_dias || 3) ? 'text-rose-400' : 'text-slate-200'
                    }`}
                  >
                    {detail.dias_cobertura !== null ? `${detail.dias_cobertura}d` : '--'}
                  </span>
                </div>
              </div>
            </div>

            {/* Inventory Parameters Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mt-5 text-xs">
              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
                <span className="text-[10px] text-slate-500 uppercase font-bold block">Punto Reorden (ROP)</span>
                <span className="text-base font-black font-mono text-amber-400">{detail.punto_reorden || 0}</span>
                <span className="text-[10px] text-slate-500 block">Umbral de pedido</span>
              </div>

              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
                <span className="text-[10px] text-slate-500 uppercase font-bold block">Stock Seguridad</span>
                <span className="text-base font-black font-mono text-rose-400">{detail.stock_seguridad || 0}</span>
                <span className="text-[10px] text-slate-500 block">Colchón mínimo</span>
              </div>

              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
                <span className="text-[10px] text-slate-500 uppercase font-bold block">Lead Time</span>
                <span className="text-base font-black font-mono text-slate-200">{detail.lead_time_dias || 3} días</span>
                <span className="text-[10px] text-slate-500 block">Tiempo de entrega</span>
              </div>

              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
                <span className="text-[10px] text-slate-500 uppercase font-bold block">Horizonte Prot.</span>
                <span className="text-base font-black font-mono text-slate-200">{detail.horizonte_proteccion_dias || 10} días</span>
                <span className="text-[10px] text-slate-500 block">Días a cubrir</span>
              </div>

              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
                <span className="text-[10px] text-slate-500 uppercase font-bold block">Posición Inventario</span>
                <span className="text-base font-black font-mono text-sky-400">{detail.posicion_inventario ?? detail.stock_fisico}</span>
                <span className="text-[10px] text-slate-500 block">Físico + Pendientes</span>
              </div>

              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
                <span className="text-[10px] text-slate-500 uppercase font-bold block">Recep. Pendientes</span>
                <span className="text-base font-black font-mono text-slate-300">{detail.recepciones_pendientes || 0}</span>
                <span className="text-[10px] text-slate-500 block">Compras en camino</span>
              </div>

              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
                <span className="text-[10px] text-slate-500 uppercase font-bold block">Compra Sugerida</span>
                <span className="text-base font-black font-mono text-emerald-400">+{detail.cantidad_sugerida || 0}</span>
                <span className="text-[10px] text-slate-500 block">{detail.base_sugerencia || 'AUTO'}</span>
              </div>
            </div>
          </div>

          {/* Interactive Recharts Projection Chart */}
          <StockProjectionChart
            proyeccion={detail.proyeccion || []}
            puntoReorden={detail.punto_reorden || 0}
            stockSeguridad={detail.stock_seguridad || 0}
            leadTimeDias={detail.lead_time_dias || 3}
          />

          {/* Daily Projection Table */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <h3 className="text-sm font-bold text-slate-100 mb-3 flex items-center justify-between">
              <span>Tabla Diaria de Proyección (Día 1 a Día 30+)</span>
              <span className="text-xs text-slate-400 font-normal">
                Basado en tasa de {detail.tasa_diaria} {detail.unidad}/día
              </span>
            </h3>

            <div className="overflow-x-auto max-h-72 overflow-y-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="sticky top-0 bg-slate-950 text-slate-400 text-[11px] font-bold uppercase tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Día</th>
                    <th className="py-2.5 px-3">Fecha Calendario</th>
                    <th className="py-2.5 px-3 text-right">Recepción Esperada</th>
                    <th className="py-2.5 px-3 text-right">Consumo Proyectado</th>
                    <th className="py-2.5 px-3 text-right">Stock al Cierre</th>
                    <th className="py-2.5 px-3 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {(detail.proyeccion || []).map((row) => (
                    <tr
                      key={row.dia}
                      className={`hover:bg-slate-800/30 ${row.stock <= 0 ? 'bg-rose-950/10' : ''}`}
                    >
                      <td className="py-2 px-3 font-bold text-slate-400">Día {row.dia}</td>
                      <td className="py-2 px-3 text-slate-300">{row.fecha}</td>
                      <td className="py-2 px-3 text-right text-sky-400">
                        {row.recepcion > 0 ? `+${row.recepcion}` : '-'}
                      </td>
                      <td className="py-2 px-3 text-right text-amber-300">
                        {row.demanda > 0 ? `-${row.demanda}` : '-'}
                      </td>
                      <td
                        className={`py-2 px-3 text-right font-bold ${
                          row.stock <= 0 ? 'text-rose-400' : 'text-emerald-400'
                        }`}
                      >
                        {row.stock}
                      </td>
                      <td className="py-2 px-3 text-center">
                        {row.stock <= 0 ? (
                          <span className="text-[10px] font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded">
                            AGOTADO
                          </span>
                        ) : row.stock <= (detail.punto_reorden || 0) ? (
                          <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
                            BAJO ROP
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                            OK
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="p-12 text-center text-slate-500 bg-slate-900/40 rounded-2xl border border-slate-800">
          No se encontró información para el SKU seleccionado.
        </div>
      )}

      {/* Observation Modal */}
      <Modal
        isOpen={showObsModal}
        onClose={() => setShowObsModal(false)}
        title={`Registrar Observación — ${sku}`}
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleCreateObservation} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-400 font-semibold mb-1">Tipo de Evento</label>
            <select
              value={obsType}
              onChange={(e) => setObsType(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500 cursor-pointer"
            >
              <option value="CONSUMO">Consumo Real (Ajuste / Cierre de trabajo)</option>
              <option value="FALTANTE">Faltante Detectado (Pendiente de Conteo Físico)</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-400 font-semibold mb-1">Cantidad de Insumos</label>
            <input
              type="number"
              step="any"
              min="0.01"
              required
              value={obsQuantity}
              onChange={(e) => setObsQuantity(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 font-mono font-bold text-slate-100 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Fecha Inicio</label>
              <input
                type="date"
                required
                value={obsFechaIni}
                onChange={(e) => setObsFechaIni(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Fecha Fin</label>
              <input
                type="date"
                required
                value={obsFechaFin}
                onChange={(e) => setObsFechaFin(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-400 font-semibold mb-1">Ubicación / Taller</label>
            <input
              type="text"
              value={obsUbicacion}
              onChange={(e) => setObsUbicacion(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-slate-400 font-semibold mb-1">Observaciones / Motivo</label>
            <textarea
              rows="2"
              value={obsNotas}
              onChange={(e) => setObsNotas(e.target.value)}
              placeholder="Ej: Desgaste acelerado en lijado de marcos de cedro"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer text-slate-300 pt-2 select-none">
            <input
              type="checkbox"
              checked={aprenderAhora}
              onChange={(e) => setAprenderAhora(e.target.checked)}
              className="rounded bg-slate-950 border-slate-800 text-amber-500 focus:ring-0 cursor-pointer"
            />
            <span>Actualizar tasa EMA inmediatamente si no es anomalía</span>
          </label>

          <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowObsModal(false)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={savingObs}
              className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-bold shadow-lg shadow-amber-500/20 cursor-pointer"
            >
              {savingObs ? 'Guardando...' : 'Guardar Observación'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default SkuProjectionView;

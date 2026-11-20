import React, { useState, useEffect } from 'react';
import {
  FileText,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  PlusCircle,
  RefreshCw,
  Search,
  BrainCircuit,
  Clock,
  Sparkles,
  MapPin,
  Calendar,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { api } from '../../services/api';
import { Modal } from '../../components/Modal';

export function ObservationsView() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ observaciones: [], aprendizaje_actual: [], historial: [] });
  const [catalogoList, setCatalogoList] = useState([]);

  // Running manual learning
  const [runningLearning, setRunningLearning] = useState(false);

  // New Observation Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [obsSku, setObsSku] = useState('ABR-001');
  const [obsType, setObsType] = useState('CONSUMO');
  const [obsQty, setObsQty] = useState(1);
  const [obsIni, setObsIni] = useState(new Date().toISOString().slice(0, 10));
  const [obsFin, setObsFin] = useState(new Date().toISOString().slice(0, 10));
  const [obsUbicacion, setObsUbicacion] = useState('Taller Santa Ana');
  const [obsNotas, setObsNotas] = useState('');
  const [obsAprenderAhora, setObsAprenderAhora] = useState(true);
  const [savingObs, setSavingObs] = useState(false);

  // Approve / Reject Modal
  const [selectedObs, setSelectedObs] = useState(null);
  const [decision, setDecision] = useState('APROBAR');
  const [motivoDecision, setMotivoDecision] = useState('');
  const [savingDecision, setSavingDecision] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.getLearningHistory();
      setData(res || { observaciones: [], aprendizaje_actual: [], historial: [] });
    } catch (err) {
      console.error('Error al cargar observaciones:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    api.getCatalogo({ pageSize: 500 }).then((res) => {
      setCatalogoList(res.rows || []);
    }).catch((e) => console.warn(e));
  }, []);

  // Filter pending anomalies & faltantes
  const pendientes = (data.observaciones || []).filter(
    (o) =>
      o.validacion === 'ANOMALIA' ||
      o.validacion === 'PENDIENTE_CONTEO' ||
      o.estado === 'PENDIENTE'
  );

  const historico = (data.observaciones || []).filter(
    (o) =>
      o.validacion !== 'ANOMALIA' &&
      o.validacion !== 'PENDIENTE_CONTEO' &&
      o.estado !== 'PENDIENTE'
  );

  // Handle run learning manual
  const handleRunLearning = async () => {
    setRunningLearning(true);
    try {
      const res = await api.runLearning();
      alert(`Aprendizaje ejecutado: ${res.incorporadas || 0} ventanas incorporadas, ${res.anomalias || 0} anomalías detectadas.`);
      fetchData();
    } catch (err) {
      alert('Error al ejecutar aprendizaje: ' + err.message);
    } finally {
      setRunningLearning(false);
    }
  };

  // Create observation
  const handleCreateObs = async (e) => {
    e.preventDefault();
    setSavingObs(true);
    try {
      await api.createConsumptionObservation({
        sku: obsSku,
        tipo: obsType,
        cantidad: Number(obsQty),
        fecha_inicial: obsIni,
        fecha_final: obsFin,
        ubicacion: obsUbicacion,
        observaciones: obsNotas,
        aprenderAhora: obsAprenderAhora,
      });
      setShowCreateModal(false);
      setObsNotas('');
      fetchData();
      alert('Observación registrada con éxito.');
    } catch (err) {
      alert('Error al registrar: ' + err.message);
    } finally {
      setSavingObs(false);
    }
  };

  // Resolve observation
  const handleResolveDecision = async () => {
    if (!selectedObs) return;
    if (decision === 'APROBAR' && !motivoDecision.trim()) {
      alert('Debe justificar el motivo para aprobar una anomalía de consumo.');
      return;
    }
    setSavingDecision(true);
    try {
      await api.approveObservation(selectedObs.id, decision, motivoDecision);
      setSelectedObs(null);
      setMotivoDecision('');
      fetchData();
      alert(`Observación procesada como ${decision}.`);
    } catch (err) {
      alert('Error al procesar: ' + err.message);
    } finally {
      setSavingDecision(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-100 flex items-center gap-2">
            <span className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <FileText className="w-6 h-6" />
            </span>
            Observaciones de Consumo & Bandeja de Anomalías
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Registro manual de consumos, auditoría de consumos anómalos (&gt;2.5x tasa) y faltantes físicos.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRunLearning}
            disabled={runningLearning}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-amber-400 hover:text-amber-300 rounded-xl text-xs font-bold transition border border-slate-800 cursor-pointer"
            title="Procesa el Kardex y calcula nuevas tasas"
          >
            <BrainCircuit className={`w-4 h-4 ${runningLearning ? 'animate-spin' : ''}`} />
            <span>{runningLearning ? 'Aprendiendo...' : 'Ejecutar Aprendizaje'}</span>
          </button>

          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/20 transition cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Nueva Observación</span>
          </button>

          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl border border-slate-800 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Bandeja de Pendientes (Anomalías y Faltantes) */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <AlertTriangle className="w-4 h-4" />
            </span>
            <h3 className="text-sm font-bold text-slate-100">
              Bandeja de Casos Pendientes de Revisión ({pendientes.length})
            </h3>
          </div>
          <span className="text-[11px] text-slate-400">
            Requiere aprobación de Compras o confirmación de faltante físico.
          </span>
        </div>

        {pendientes.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-60" />
            ¡No hay anomalías de consumo ni faltantes pendientes de aprobación!
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pendientes.map((obs) => {
              const isAnomalia = obs.validacion === 'ANOMALIA';

              return (
                <div
                  key={obs.id}
                  className={`p-4 rounded-xl border flex flex-col justify-between ${
                    isAnomalia
                      ? 'bg-rose-950/20 border-rose-500/40'
                      : 'bg-amber-950/20 border-amber-500/40'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="font-mono font-bold text-amber-400 text-xs">{obs.sku}</span>
                      <span
                        className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                          isAnomalia
                            ? 'bg-rose-500 text-white'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}
                      >
                        {isAnomalia ? 'ANOMALÍA (>2.5x)' : 'FALTANTE PENDIENTE'}
                      </span>
                    </div>

                    <p className="text-sm font-bold text-slate-100">{obs.insumo || obs.sku}</p>
                    <p className="text-xs text-slate-300 mt-1">
                      Cantidad observada: <strong className="text-white font-mono">{obs.cantidad}</strong> (Período: {obs.fecha_inicial} a {obs.fecha_final})
                    </p>
                    {obs.observaciones && (
                      <p className="text-[11px] text-slate-400 mt-1 italic">
                        &quot;{obs.observaciones}&quot;
                      </p>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="pt-3 mt-3 border-t border-slate-800/80 flex items-center justify-end gap-2 text-xs">
                    {isAnomalia ? (
                      <>
                        <button
                          onClick={() => {
                            setSelectedObs(obs);
                            setDecision('RECHAZAR');
                          }}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-bold cursor-pointer"
                        >
                          Rechazar
                        </button>
                        <button
                          onClick={() => {
                            setSelectedObs(obs);
                            setDecision('APROBAR');
                          }}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold shadow-md shadow-emerald-600/20 cursor-pointer"
                        >
                          Aprobar con Justificación
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => {
                          setSelectedObs(obs);
                          setDecision('CONFIRMAR_FALTANTE');
                        }}
                        className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg font-bold shadow-md shadow-amber-500/20 cursor-pointer"
                      >
                        Confirmar Faltante en Sheets
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Histórico General de Observaciones */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-100">Bitácora de Observaciones Registradas</h3>
          <span className="text-xs text-slate-500">{historico.length} registros</span>
        </div>

        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 text-[10px] uppercase font-bold tracking-wider sticky top-0 border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-4">Fecha Reg.</th>
                <th className="py-2.5 px-4">SKU / Insumo</th>
                <th className="py-2.5 px-4">Tipo</th>
                <th className="py-2.5 px-4 text-center">Cantidad</th>
                <th className="py-2.5 px-4">Rango Fechas</th>
                <th className="py-2.5 px-4">Ubicación</th>
                <th className="py-2.5 px-4">Estado / Validación</th>
                <th className="py-2.5 px-4">Notas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan="8" className="py-8 text-center text-slate-500">
                    Cargando bitácora...
                  </td>
                </tr>
              ) : historico.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-8 text-center text-slate-500">
                    No hay observaciones históricas archivadas.
                  </td>
                </tr>
              ) : (
                historico.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-800/30">
                    <td className="py-2.5 px-4 font-mono text-slate-400">{row.fecha_registro || '--'}</td>
                    <td className="py-2.5 px-4">
                      <span className="font-mono font-bold text-amber-400">{row.sku}</span>
                      <p className="text-slate-300 font-medium truncate max-w-xs">{row.insumo}</p>
                    </td>
                    <td className="py-2.5 px-4 font-semibold text-slate-300">{row.tipo}</td>
                    <td className="py-2.5 px-4 text-center font-mono font-bold text-slate-100">
                      {row.cantidad}
                    </td>
                    <td className="py-2.5 px-4 text-slate-400 font-mono text-[11px]">
                      {row.fecha_inicial} → {row.fecha_final}
                    </td>
                    <td className="py-2.5 px-4 text-slate-400">{row.ubicacion || 'Bodega'}</td>
                    <td className="py-2.5 px-4">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          row.validacion === 'VALIDADO' || row.estado === 'APROBADO'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : row.estado === 'RECHAZADO'
                            ? 'bg-rose-500/20 text-rose-300'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {row.estado || row.validacion}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-slate-400 italic max-w-xs truncate" title={row.observaciones}>
                      {row.observaciones || '--'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Nueva Observacion */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Registrar Nueva Observación de Consumo"
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleCreateObs} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-400 font-semibold mb-1">SKU del Insumo</label>
            <select
              value={obsSku}
              onChange={(e) => setObsSku(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500 font-mono font-bold cursor-pointer"
            >
              {catalogoList.map((item) => (
                <option key={item.sku} value={item.sku} className="bg-slate-900">
                  {item.sku} — {item.descripcion}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-400 font-semibold mb-1">Tipo de Evento</label>
            <select
              value={obsType}
              onChange={(e) => setObsType(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500 cursor-pointer"
            >
              <option value="CONSUMO">Consumo Real Verificado</option>
              <option value="FALTANTE">Faltante Físico (Pendiente Conteo)</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-400 font-semibold mb-1">Cantidad Observada</label>
            <input
              type="number"
              step="any"
              min="0.01"
              required
              value={obsQty}
              onChange={(e) => setObsQty(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 font-mono font-bold text-slate-100 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Fecha Inicial</label>
              <input
                type="date"
                required
                value={obsIni}
                onChange={(e) => setObsIni(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Fecha Final</label>
              <input
                type="date"
                required
                value={obsFin}
                onChange={(e) => setObsFin(e.target.value)}
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
            <label className="block text-slate-400 font-semibold mb-1">Observaciones</label>
            <textarea
              rows="2"
              value={obsNotas}
              onChange={(e) => setObsNotas(e.target.value)}
              placeholder="Detalle o justificación..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer text-slate-300 pt-2 select-none">
            <input
              type="checkbox"
              checked={obsAprenderAhora}
              onChange={(e) => setObsAprenderAhora(e.target.checked)}
              className="rounded bg-slate-950 border-slate-800 text-amber-500 focus:ring-0 cursor-pointer"
            />
            <span>Actualizar tasa EMA si no supera el límite de anomalía</span>
          </label>

          <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
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

      {/* Decision Modal */}
      <Modal
        isOpen={Boolean(selectedObs)}
        onClose={() => setSelectedObs(null)}
        title={`Resolución de Caso — ${selectedObs?.sku}`}
        maxWidth="max-w-md"
      >
        <div className="space-y-4 text-xs">
          <p className="text-slate-300">
            ¿Está seguro de que desea <strong>{decision}</strong> la observación de{' '}
            <strong className="text-white">{selectedObs?.cantidad} unid.</strong> de{' '}
            <strong className="text-amber-400">{selectedObs?.sku}</strong>?
          </p>

          {decision === 'APROBAR' && (
            <div>
              <label className="block text-slate-400 font-semibold mb-1">
                Motivo / Justificación de la Aprobación (Obligatorio)
              </label>
              <textarea
                rows="3"
                required
                value={motivoDecision}
                onChange={(e) => setMotivoDecision(e.target.value)}
                placeholder="Ej: Aprobado por proyecto extraordinario de puertas dobles"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
              />
            </div>
          )}

          <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setSelectedObs(null)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={savingDecision}
              onClick={handleResolveDecision}
              className={`px-5 py-2 rounded-xl font-bold text-white shadow-lg cursor-pointer ${
                decision === 'RECHAZAR'
                  ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/20'
                  : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20'
              }`}
            >
              {savingDecision ? 'Procesando...' : `Confirmar ${decision}`}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default ObservationsView;

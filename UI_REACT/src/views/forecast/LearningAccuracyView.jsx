import React, { useState, useEffect } from 'react';
import {
  BrainCircuit,
  TrendingUp,
  Award,
  RefreshCw,
  PlusCircle,
  Clock,
  Sparkles,
  Layers,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';
import { api } from '../../services/api';
import { Modal } from '../../components/Modal';
import ConfidencePill from '../../components/forecast/ConfidencePill';

export function LearningAccuracyView() {
  const [loading, setLoading] = useState(true);
  const [learningData, setLearningData] = useState({
    aprendizaje_actual: [],
    historial: [],
    observaciones: [],
  });
  const [feedbackData, setFeedbackData] = useState({ wape_pct: 0, rows: [], total: 0 });

  // Feedback Modal
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [fbSku, setFbSku] = useState('');
  const [fbRunId, setFbRunId] = useState('');
  const [fbReal, setFbReal] = useState(0);
  const [fbNotas, setFbNotas] = useState('');
  const [savingFb, setSavingFb] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [learnRes, feedRes] = await Promise.all([
        api.getLearningHistory(),
        api.getForecastFeedback(),
      ]);
      setLearningData(learnRes || { aprendizaje_actual: [], historial: [] });
      setFeedbackData(feedRes || { wape_pct: 0, rows: [] });
    } catch (err) {
      console.error('Error al cargar datos de precisión:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateFeedback = async (e) => {
    e.preventDefault();
    setSavingFb(true);
    try {
      await api.createForecastFeedback({
        sku: fbSku,
        run_id: fbRunId || `RUN_${new Date().toISOString().slice(0, 10)}`,
        consumo_real: Number(fbReal),
        observaciones: fbNotas,
      });
      setShowFeedbackModal(false);
      setFbNotas('');
      fetchData();
      alert('Feedback registrado con éxito.');
    } catch (err) {
      alert('Error al registrar feedback: ' + err.message);
    } finally {
      setSavingFb(false);
    }
  };

  const wape = Number(feedbackData?.wape_pct || 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-100 flex items-center gap-2">
            <span className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <BrainCircuit className="w-6 h-6" />
            </span>
            Aprendizaje EMA y Precisión del Modelo
            <span className="text-xs font-bold bg-purple-500/20 text-purple-300 px-2.5 py-0.5 rounded-full border border-purple-500/30">
              WAPE Analytics
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Evolución de tasas de consumo adaptativas mediante media móvil exponencial (EMA) y retroalimentación.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowFeedbackModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-purple-600/20 transition cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Registrar Feedback Manual</span>
          </button>

          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl border border-slate-800 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-purple-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Model Quality / WAPE KPI Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 bg-slate-900/70 border border-slate-800 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-400 uppercase font-bold tracking-wider block">
              Precisión Global del Modelo (WAPE)
            </span>
            <div className="mt-2 flex items-baseline gap-2">
              <span
                className={`text-3xl sm:text-4xl font-black font-mono ${
                  wape <= 15 ? 'text-emerald-400' : wape <= 25 ? 'text-amber-400' : 'text-rose-400'
                }`}
              >
                {wape > 0 ? `${wape.toFixed(1)}%` : 'Calibrando'}
              </span>
              <span className="text-xs text-slate-500">
                {wape <= 15 && wape > 0 ? 'Excelente (<15%)' : wape <= 25 && wape > 0 ? 'Aceptable (15-25%)' : 'En optimización'}
              </span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              Weighted Absolute Percentage Error ponderado sobre consumo real.
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-400 flex items-center justify-center font-bold">
            <Award className="w-6 h-6" />
          </div>
        </div>

        <div className="p-5 bg-slate-900/70 border border-slate-800 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-400 uppercase font-bold tracking-wider block">
              SKUs con Aprendizaje Activo
            </span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-black text-slate-100 font-mono">
                {learningData.aprendizaje_actual?.length || 0}
              </span>
              <span className="text-xs text-slate-500">en catálogo</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              Tasas calibradas con observaciones de Kardex y conteos reales.
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        <div className="p-5 bg-slate-900/70 border border-slate-800 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-400 uppercase font-bold tracking-wider block">
              Ajustes Registrados en Bitácora
            </span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-black text-sky-400 font-mono">
                {learningData.historial?.length || 0}
              </span>
              <span className="text-xs text-slate-500">iteraciones EMA</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              Historial de variaciones de tasa con factor alfa adaptativo.
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-sky-500/10 text-sky-400 flex items-center justify-center font-bold">
            <Clock className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Consumption Learning Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <span>Estado Actual de Tasas Aprendidas (Consumption_Learning)</span>
          </h3>
          <span className="text-xs text-slate-400">
            {learningData.aprendizaje_actual?.length || 0} materiales calibrados
          </span>
        </div>

        <div className="overflow-x-auto max-h-80 overflow-y-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-950 text-slate-400 text-[10px] uppercase font-bold tracking-wider sticky top-0 border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-4 font-sans">SKU</th>
                <th className="py-2.5 px-4 text-right">Tasa Inicial / Semilla</th>
                <th className="py-2.5 px-4 text-right font-bold text-amber-400">Tasa Aprendida EMA</th>
                <th className="py-2.5 px-4 text-right">Desviación Abs.</th>
                <th className="py-2.5 px-4 text-center">Observaciones Válidas</th>
                <th className="py-2.5 px-4 text-center font-sans">Confianza</th>
                <th className="py-2.5 px-4 font-sans">Origen Tasa</th>
                <th className="py-2.5 px-4 text-center">Última Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan="8" className="py-8 text-center text-slate-500 font-sans">
                    Cargando tasas del motor de aprendizaje...
                  </td>
                </tr>
              ) : (learningData.aprendizaje_actual || []).length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-8 text-center text-slate-500 font-sans">
                    No se han registrado tasas aprendidas aún.
                  </td>
                </tr>
              ) : (
                learningData.aprendizaje_actual.map((row) => (
                  <tr key={row.sku} className="hover:bg-slate-800/30">
                    <td className="py-2.5 px-4 font-bold text-amber-400">{row.sku}</td>
                    <td className="py-2.5 px-4 text-right text-slate-400">{row.tasa_inicial ?? '--'}</td>
                    <td className="py-2.5 px-4 text-right font-bold text-emerald-400">
                      {row.tasa_aprendida}
                    </td>
                    <td className="py-2.5 px-4 text-right text-slate-300">{row.desviacion_abs ?? 0}</td>
                    <td className="py-2.5 px-4 text-center text-slate-200">
                      {row.observaciones_validas || 0}
                    </td>
                    <td className="py-2.5 px-4 text-center font-sans">
                      <ConfidencePill confianza={row.confianza} size="xs" />
                    </td>
                    <td className="py-2.5 px-4 font-sans text-slate-300">
                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                        {row.origen_tasa || 'SEED'}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-center text-slate-400">
                      {row.ultima_fecha_procesada || '--'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Learning History & Feedback Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Learning History Log */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
          <h3 className="text-sm font-bold text-slate-100 flex items-center justify-between border-b border-slate-800 pb-3">
            <span>Bitácora de Ajustes EMA (Learning_History)</span>
            <span className="text-xs text-slate-400 font-normal">
              {learningData.historial?.length || 0} eventos
            </span>
          </h3>

          <div className="overflow-y-auto max-h-72 divide-y divide-slate-800/60 text-xs">
            {(learningData.historial || []).length === 0 ? (
              <p className="py-6 text-center text-slate-500">Sin historial registrado.</p>
            ) : (
              learningData.historial.map((h, idx) => (
                <div key={idx} className="py-2.5 flex items-center justify-between gap-3">
                  <div>
                    <span className="font-mono font-bold text-amber-400">{h.sku}</span>
                    <p className="text-[11px] text-slate-400">{h.motivo || 'Actualización de tasa'}</p>
                    <span className="text-[10px] text-slate-500 font-mono">{h.fecha || h.timestamp}</span>
                  </div>
                  <div className="text-right font-mono">
                    <span className="text-slate-400 text-xs">{h.tasa_anterior}</span>
                    <span className="text-slate-500 mx-1.5">→</span>
                    <strong className="text-emerald-400 text-sm">{h.tasa_nueva}</strong>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Forecast Feedback Table */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
          <h3 className="text-sm font-bold text-slate-100 flex items-center justify-between border-b border-slate-800 pb-3">
            <span>Retroalimentación de Consumo Real (Forecast_Feedback)</span>
            <span className="text-xs text-slate-400 font-normal">
              {feedbackData.rows?.length || 0} muestras
            </span>
          </h3>

          <div className="overflow-y-auto max-h-72 divide-y divide-slate-800/60 text-xs">
            {(feedbackData.rows || []).length === 0 ? (
              <p className="py-6 text-center text-slate-500">Sin feedback registrado.</p>
            ) : (
              feedbackData.rows.map((f, idx) => (
                <div key={idx} className="py-2.5 flex items-center justify-between gap-3">
                  <div>
                    <span className="font-mono font-bold text-amber-400">{f.sku}</span>
                    <span className="text-[10px] text-slate-500 ml-2 font-mono">{f.run_id}</span>
                    <p className="text-[11px] text-slate-400 italic">{f.observaciones || 'Consumo verificado'}</p>
                  </div>
                  <div className="text-right font-mono">
                    <span className="text-[10px] text-slate-500 block uppercase">Real Registrado</span>
                    <strong className="text-emerald-400 text-sm">{f.consumo_real}</strong>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Modal Feedback Manual */}
      <Modal
        isOpen={showFeedbackModal}
        onClose={() => setShowFeedbackModal(false)}
        title="Registrar Retroalimentación de Pronóstico (Feedback)"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleCreateFeedback} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-400 font-semibold mb-1">SKU</label>
            <input
              type="text"
              required
              placeholder="Ej: ABR-001"
              value={fbSku}
              onChange={(e) => setFbSku(e.target.value.toUpperCase())}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 font-mono font-bold text-amber-400 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-slate-400 font-semibold mb-1">ID de Corrida (Opcional)</label>
            <input
              type="text"
              placeholder="Ej: RUN_20261119_01"
              value={fbRunId}
              onChange={(e) => setFbRunId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-slate-400 font-semibold mb-1">Consumo Real Medido</label>
            <input
              type="number"
              step="any"
              required
              value={fbReal}
              onChange={(e) => setFbReal(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 font-mono font-bold text-slate-100 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-slate-400 font-semibold mb-1">Observaciones</label>
            <textarea
              rows="2"
              value={fbNotas}
              onChange={(e) => setFbNotas(e.target.value)}
              placeholder="Detalle de verificación..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowFeedbackModal(false)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={savingFb}
              className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold shadow-lg shadow-purple-600/20 cursor-pointer"
            >
              {savingFb ? 'Guardando...' : 'Guardar Feedback'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default LearningAccuracyView;

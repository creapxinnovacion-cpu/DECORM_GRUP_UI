import React, { useState, useEffect } from 'react';
import {
  Settings,
  Sliders,
  Layers,
  DoorOpen,
  RefreshCw,
  Save,
  PlusCircle,
  Trash2,
  Edit2,
  Play,
  Database,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';
import { api } from '../../services/api';
import { Modal } from '../../components/Modal';

export function ForecastSettingsView() {
  const [activeTab, setActiveTab] = useState('params');
  const [loading, setLoading] = useState(true);

  // Maintenance actions state
  const [runningForecast, setRunningForecast] = useState(false);
  const [settingUp, setSettingUp] = useState(false);

  // Tab 1: Global Params
  const [paramsList, setParamsList] = useState({});
  const [savingParams, setSavingParams] = useState(false);

  // Tab 2: SKU Config
  const [configList, setConfigList] = useState([]);
  const [editingConfigSku, setEditingConfigSku] = useState(null);
  const [configFormData, setConfigFormData] = useState({});
  const [savingConfig, setSavingConfig] = useState(false);

  // Tab 3: BOM Puertas
  const [bomList, setBomList] = useState([]);
  const [showBomModal, setShowBomModal] = useState(false);
  const [bomForm, setBomForm] = useState({ modelo: '', sku: '', cantidad_por_puerta: 1, notas: '' });
  const [savingBom, setSavingBom] = useState(false);

  // Catalogo for SKU picker
  const [catalogoList, setCatalogoList] = useState([]);

  const fetchAllSettings = async () => {
    setLoading(true);
    try {
      const [paramsRes, configRes, bomRes, catRes] = await Promise.all([
        api.getForecastParams().catch(() => ({ params: {} })),
        api.getForecastConfig().catch(() => ({ rows: [] })),
        api.getForecastBom().catch(() => ({ rows: [] })),
        api.getCatalogo({ pageSize: 500 }).catch(() => ({ rows: [] })),
      ]);
      setParamsList(paramsRes.params || {});
      setConfigList(configRes.rows || []);
      setBomList(bomRes.rows || []);
      setCatalogoList(catRes.rows || []);
    } catch (err) {
      console.error('Error al cargar configuración de Forecast:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllSettings();
  }, []);

  // Save Global Params
  const handleSaveParams = async (e) => {
    e.preventDefault();
    setSavingParams(true);
    try {
      await api.updateForecastParams(paramsList);
      alert('Parámetros globales de Forecast actualizados en Sheets.');
      fetchAllSettings();
    } catch (err) {
      alert('Error al guardar parámetros: ' + err.message);
    } finally {
      setSavingParams(false);
    }
  };

  // Run Setup Forecast
  const handleSetupForecast = async () => {
    if (!confirm('¿Desea inicializar las tablas de Forecast_*, semillas y fórmulas en Google Sheets?')) return;
    setSettingUp(true);
    try {
      const res = await api.setupForecast();
      alert(`Setup completado exitosamente: ${res.semillas?.length || 0} semillas registradas.`);
      fetchAllSettings();
    } catch (err) {
      alert('Error en setup: ' + err.message);
    } finally {
      setSettingUp(false);
    }
  };

  // Run Daily Forecast Now
  const handleRunForecastNow = async () => {
    setRunningForecast(true);
    try {
      const res = await api.runDailyForecast();
      alert(`Corrida diaria completada con éxito (Run ID: ${res.run_id || 'OK'}). Alertas y correo evaluados.`);
      fetchAllSettings();
    } catch (err) {
      alert('Error al ejecutar corrida: ' + err.message);
    } finally {
      setRunningForecast(false);
    }
  };

  // Save SKU Config
  const handleSaveConfig = async (e) => {
    e.preventDefault();
    setSavingConfig(true);
    try {
      await api.updateForecastConfig(editingConfigSku, configFormData);
      setEditingConfigSku(null);
      fetchAllSettings();
      alert(`Configuración de ${editingConfigSku} guardada.`);
    } catch (err) {
      alert('Error al actualizar config: ' + err.message);
    } finally {
      setSavingConfig(false);
    }
  };

  // Save BOM Puerta
  const handleSaveBom = async (e) => {
    e.preventDefault();
    setSavingBom(true);
    try {
      await api.upsertForecastBom({
        modelo: bomForm.modelo.toUpperCase().trim(),
        sku: bomForm.sku.toUpperCase().trim(),
        cantidad_por_puerta: Number(bomForm.cantidad_por_puerta),
        notas: bomForm.notas,
      });
      setShowBomModal(false);
      setBomForm({ modelo: '', sku: '', cantidad_por_puerta: 1, notas: '' });
      fetchAllSettings();
      alert('Receta BOM guardada exitosamente.');
    } catch (err) {
      alert('Error al guardar BOM: ' + err.message);
    } finally {
      setSavingBom(false);
    }
  };

  // Delete BOM Puerta
  const handleDeleteBom = async (modelo, sku) => {
    if (!confirm(`¿Eliminar insumo ${sku} de la receta de ${modelo}?`)) return;
    try {
      await api.deleteForecastBom(modelo, sku);
      fetchAllSettings();
    } catch (err) {
      alert('Error al eliminar BOM: ' + err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-100 flex items-center gap-2">
            <span className="p-2 rounded-xl bg-slate-800 text-amber-400 border border-slate-700">
              <Settings className="w-6 h-6" />
            </span>
            Configuración del Motor, Parámetros y Recetas BOM
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Administración completa de parámetros globales, reglas por SKU y recetas de puertas desde React.
          </p>
        </div>

        {/* Maintenance Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleRunForecastNow}
            disabled={runningForecast}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/20 transition cursor-pointer"
            title="Ejecuta la corrida diaria del motor y emite alertas"
          >
            <Play className={`w-4 h-4 ${runningForecast ? 'animate-spin' : ''}`} />
            <span>{runningForecast ? 'Ejecutando...' : 'Ejecutar Pronóstico Ahora'}</span>
          </button>

          <button
            onClick={handleSetupForecast}
            disabled={settingUp}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold text-xs rounded-xl border border-slate-800 transition cursor-pointer"
            title="Crea las hojas y semillas si no existen"
          >
            <Database className={`w-4 h-4 ${settingUp ? 'animate-spin' : ''}`} />
            <span>{settingUp ? 'Inicializando...' : 'Setup Tablas / Semillas'}</span>
          </button>

          <button
            onClick={fetchAllSettings}
            disabled={loading}
            className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl border border-slate-800 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 text-xs">
        <button
          onClick={() => setActiveTab('params')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition cursor-pointer ${
            activeTab === 'params'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>1. Parámetros Globales (Forecast_Params)</span>
        </button>

        <button
          onClick={() => setActiveTab('config')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition cursor-pointer ${
            activeTab === 'config'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>2. Configuración por SKU (Forecast_Config)</span>
        </button>

        <button
          onClick={() => setActiveTab('bom')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition cursor-pointer ${
            activeTab === 'bom'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <DoorOpen className="w-4 h-4" />
          <span>3. Recetas por Puerta (BOM_Puertas)</span>
        </button>
      </div>

      {/* Tab 1: Global Parameters Form */}
      {activeTab === 'params' && (
        <form onSubmit={handleSaveParams} className="space-y-6">
          <div className="p-6 bg-slate-900/60 border border-slate-800 rounded-2xl shadow-xl space-y-5 text-xs">
            <h3 className="text-sm font-bold text-slate-100 border-b border-slate-800 pb-3">
              Variables Operativas del Modelo de Pronóstico
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* ALERTAS_EMAIL */}
              <div>
                <label className="block text-slate-400 font-semibold mb-1">
                  Correo de Alertas Diarias (ALERTAS_EMAIL)
                </label>
                <input
                  type="text"
                  value={paramsList.ALERTAS_EMAIL || ''}
                  onChange={(e) => setParamsList({ ...paramsList, ALERTAS_EMAIL: e.target.value })}
                  placeholder="ejemplo@grupodecorm.com"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>

              {/* DIAS_MODO */}
              <div>
                <label className="block text-slate-400 font-semibold mb-1">
                  Modo de Días (DIAS_MODO)
                </label>
                <select
                  value={paramsList.DIAS_MODO || 'OPERATIVO'}
                  onChange={(e) => setParamsList({ ...paramsList, DIAS_MODO: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500 cursor-pointer"
                >
                  <option value="OPERATIVO">OPERATIVO (Lunes a Sábado · 6 días/sem)</option>
                  <option value="CALENDARIO">CALENDARIO (7 días/sem)</option>
                </select>
              </div>

              {/* LEAD_TIME_DEFAULT */}
              <div>
                <label className="block text-slate-400 font-semibold mb-1">
                  Lead Time por Defecto (LEAD_TIME_DEFAULT)
                </label>
                <input
                  type="number"
                  min="1"
                  value={paramsList.LEAD_TIME_DEFAULT ?? 3}
                  onChange={(e) => setParamsList({ ...paramsList, LEAD_TIME_DEFAULT: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>

              {/* REVISION_DIAS */}
              <div>
                <label className="block text-slate-400 font-semibold mb-1">
                  Período de Revisión en Días (REVISION_DIAS)
                </label>
                <input
                  type="number"
                  min="1"
                  value={paramsList.REVISION_DIAS ?? 7}
                  onChange={(e) => setParamsList({ ...paramsList, REVISION_DIAS: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>

              {/* SEGURIDAD_DIAS */}
              <div>
                <label className="block text-slate-400 font-semibold mb-1">
                  Días de Stock de Seguridad (SEGURIDAD_DIAS)
                </label>
                <input
                  type="number"
                  min="1"
                  value={paramsList.SEGURIDAD_DIAS ?? 3}
                  onChange={(e) => setParamsList({ ...paramsList, SEGURIDAD_DIAS: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>

              {/* FACTOR_APRENDIZAJE */}
              <div>
                <label className="block text-slate-400 font-semibold mb-1">
                  Factor de Aprendizaje Alfa EMA (FACTOR_APRENDIZAJE)
                </label>
                <input
                  type="number"
                  step="0.05"
                  min="0.05"
                  max="0.9"
                  value={paramsList.FACTOR_APRENDIZAJE ?? 0.3}
                  onChange={(e) => setParamsList({ ...paramsList, FACTOR_APRENDIZAJE: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>

              {/* ANOMALIA_FACTOR */}
              <div>
                <label className="block text-slate-400 font-semibold mb-1">
                  Umbral de Anomalía Multiplicador (ANOMALIA_FACTOR)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="1.5"
                  value={paramsList.ANOMALIA_FACTOR ?? 2.5}
                  onChange={(e) => setParamsList({ ...paramsList, ANOMALIA_FACTOR: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>

              {/* ESCALAR_POR_PERSONAL */}
              <div>
                <label className="block text-slate-400 font-semibold mb-1">
                  Escalar por Plantilla Operativa (ESCALAR_POR_PERSONAL)
                </label>
                <select
                  value={paramsList.ESCALAR_POR_PERSONAL || 'NO'}
                  onChange={(e) => setParamsList({ ...paramsList, ESCALAR_POR_PERSONAL: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500 cursor-pointer"
                >
                  <option value="NO">NO (Tasa fija por insumo)</option>
                  <option value="SI">SI (Escalar según ratio Personal / Base)</option>
                </select>
              </div>
            </div>

            {/* Plantilla Operativa */}
            <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider pt-4 border-t border-slate-800">
              Plantilla de Personal por Grupo (Operarios Actuales / Base)
            </h4>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-slate-400 mb-1">Enmasillado (Actual)</label>
                <input
                  type="number"
                  value={paramsList.PERSONAL_ENMASILLADO ?? 1}
                  onChange={(e) => setParamsList({ ...paramsList, PERSONAL_ENMASILLADO: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Soldadura (Actual)</label>
                <input
                  type="number"
                  value={paramsList.PERSONAL_SOLDADURA ?? 2}
                  onChange={(e) => setParamsList({ ...paramsList, PERSONAL_SOLDADURA: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Instalación (Actual)</label>
                <input
                  type="number"
                  value={paramsList.PERSONAL_INSTALACION ?? 3}
                  onChange={(e) => setParamsList({ ...paramsList, PERSONAL_INSTALACION: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">General (Actual)</label>
                <input
                  type="number"
                  value={paramsList.PERSONAL_GENERAL ?? 4}
                  onChange={(e) => setParamsList({ ...paramsList, PERSONAL_GENERAL: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-mono"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 flex justify-end">
              <button
                type="submit"
                disabled={savingParams}
                className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl shadow-lg shadow-amber-500/20 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{savingParams ? 'Guardando en Sheets...' : 'Guardar Parámetros Globales'}</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Tab 2: SKU Config Table */}
      {activeTab === 'config' && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl space-y-4">
          <div className="p-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-100">
                Reglas y Parámetros Específicos por SKU (Forecast_Config)
              </h3>
              <p className="text-xs text-slate-400">
                Ajuste de lead time real, modos de consumo y restricciones de lote de empaque.
              </p>
            </div>
            <span className="text-xs text-slate-500 font-mono">{configList.length} registros</span>
          </div>

          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="sticky top-0 bg-slate-950 text-slate-400 text-[10px] uppercase font-bold tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-4 font-sans">SKU</th>
                  <th className="py-2.5 px-4 text-center">Lead Time</th>
                  <th className="py-2.5 px-4 text-center font-sans">Modo Consumo</th>
                  <th className="py-2.5 px-4 text-center font-sans">Modo Predicción</th>
                  <th className="py-2.5 px-4 text-center">Empaque Lote</th>
                  <th className="py-2.5 px-4 text-center">Mín. Compra</th>
                  <th className="py-2.5 px-4 text-center">Máx. Entrega</th>
                  <th className="py-2.5 px-4 font-sans">Grupo</th>
                  <th className="py-2.5 px-4 text-right font-sans">Editar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {configList.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="py-8 text-center text-slate-500 font-sans">
                      No hay configuraciones individuales. Utilice &quot;Setup Tablas / Semillas&quot; para precargar.
                    </td>
                  </tr>
                ) : (
                  configList.map((cfg) => (
                    <tr key={cfg.sku} className="hover:bg-slate-800/30">
                      <td className="py-2.5 px-4 font-bold text-amber-400">{cfg.sku}</td>
                      <td className="py-2.5 px-4 text-center text-slate-300">{cfg.lead_time ?? 3}d</td>
                      <td className="py-2.5 px-4 text-center font-sans">
                        <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                          {cfg.modo_consumo || 'AUTO'}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-center font-sans">
                        <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                          {cfg.modo_prediccion || 'AUTO'}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-center text-slate-300">{cfg.empaque || 1}</td>
                      <td className="py-2.5 px-4 text-center text-slate-300">{cfg.minimo_compra || 0}</td>
                      <td className="py-2.5 px-4 text-center text-slate-300">{cfg.maximo_entrega || 0}</td>
                      <td className="py-2.5 px-4 font-sans text-slate-300">{cfg.grupo_usuario || 'GENERAL'}</td>
                      <td className="py-2.5 px-4 text-right font-sans">
                        <button
                          onClick={() => {
                            setEditingConfigSku(cfg.sku);
                            setConfigFormData({ ...cfg });
                          }}
                          className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: BOM Puertas */}
      {activeTab === 'bom' && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl space-y-4">
          <div className="p-4 bg-slate-950/80 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <span>Lista de Materiales y Recetas de Puertas (BOM_Puertas)</span>
              </h3>
              <p className="text-xs text-slate-400">
                Insumos necesarios por modelo para cálculo de demanda dependiente de proyectos.
              </p>
            </div>

            <button
              onClick={() => {
                setBomForm({ modelo: '', sku: catalogoList[0]?.sku || '', cantidad_por_puerta: 1, notas: '' });
                setShowBomModal(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-amber-500/20 transition cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Añadir Insumo a Receta</span>
            </button>
          </div>

          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="sticky top-0 bg-slate-950 text-slate-400 text-[10px] uppercase font-bold tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-4 font-sans">Modelo de Puerta</th>
                  <th className="py-2.5 px-4">SKU del Insumo</th>
                  <th className="py-2.5 px-4 text-center">Cantidad Requerida / Puerta</th>
                  <th className="py-2.5 px-4 font-sans">Notas Técnicas</th>
                  <th className="py-2.5 px-4 text-right font-sans">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {bomList.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="py-8 text-center text-slate-500 font-sans">
                      No hay recetas configuradas en BOM_Puertas. Añada una nueva arriba.
                    </td>
                  </tr>
                ) : (
                  bomList.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/30">
                      <td className="py-2.5 px-4 font-bold text-slate-100 font-sans">{row.modelo}</td>
                      <td className="py-2.5 px-4 text-amber-400 font-bold">{row.sku}</td>
                      <td className="py-2.5 px-4 text-center font-bold text-emerald-400">
                        {row.cantidad_por_puerta} unid.
                      </td>
                      <td className="py-2.5 px-4 font-sans text-slate-400">{row.notas || '--'}</td>
                      <td className="py-2.5 px-4 text-right font-sans">
                        <button
                          onClick={() => handleDeleteBom(row.modelo, row.sku)}
                          className="p-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition cursor-pointer"
                          title="Eliminar de receta"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Edit Config SKU */}
      <Modal
        isOpen={Boolean(editingConfigSku)}
        onClose={() => setEditingConfigSku(null)}
        title={`Editar Parámetros de SKU — ${editingConfigSku}`}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleSaveConfig} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-400 font-semibold mb-1">Lead Time en Días</label>
            <input
              type="number"
              min="1"
              required
              value={configFormData.lead_time ?? 3}
              onChange={(e) => setConfigFormData({ ...configFormData, lead_time: Number(e.target.value) })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-mono"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Modo Consumo</label>
              <select
                value={configFormData.modo_consumo || 'AUTO'}
                onChange={(e) => setConfigFormData({ ...configFormData, modo_consumo: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 cursor-pointer"
              >
                <option value="AUTO">AUTO (Por grupo)</option>
                <option value="SALIDA">SALIDA (Forzar)</option>
                <option value="NINGUNO">NINGUNO (Ignorar)</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">Modo Predicción</label>
              <select
                value={configFormData.modo_prediccion || 'AUTO'}
                onChange={(e) => setConfigFormData({ ...configFormData, modo_prediccion: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 cursor-pointer"
              >
                <option value="AUTO">AUTO</option>
                <option value="VIGILANCIA">VIGILANCIA</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Empaque</label>
              <input
                type="number"
                min="1"
                value={configFormData.empaque ?? 1}
                onChange={(e) => setConfigFormData({ ...configFormData, empaque: Number(e.target.value) })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Mín. Compra</label>
              <input
                type="number"
                min="0"
                value={configFormData.minimo_compra ?? 0}
                onChange={(e) => setConfigFormData({ ...configFormData, minimo_compra: Number(e.target.value) })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Máx. Entrega</label>
              <input
                type="number"
                min="0"
                value={configFormData.maximo_entrega ?? 0}
                onChange={(e) => setConfigFormData({ ...configFormData, maximo_entrega: Number(e.target.value) })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-400 font-semibold mb-1">Grupo de Usuario</label>
            <select
              value={configFormData.grupo_usuario || 'GENERAL'}
              onChange={(e) => setConfigFormData({ ...configFormData, grupo_usuario: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 cursor-pointer"
            >
              <option value="ENMASILLADO">ENMASILLADO</option>
              <option value="SOLDADURA">SOLDADURA</option>
              <option value="INSTALACION">INSTALACION</option>
              <option value="GENERAL">GENERAL</option>
            </select>
          </div>

          <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setEditingConfigSku(null)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={savingConfig}
              className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-bold shadow-lg shadow-amber-500/20 cursor-pointer"
            >
              {savingConfig ? 'Guardando...' : 'Guardar SKU'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Add BOM Puerta */}
      <Modal
        isOpen={showBomModal}
        onClose={() => setShowBomModal(false)}
        title="Añadir Insumo a Receta de Puerta (BOM)"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleSaveBom} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-400 font-semibold mb-1">Modelo de Puerta</label>
            <input
              type="text"
              required
              placeholder="Ej: LYNUX, NIRYX, LORVAK, AURA"
              value={bomForm.modelo}
              onChange={(e) => setBomForm({ ...bomForm, modelo: e.target.value.toUpperCase() })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-bold focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-slate-400 font-semibold mb-1">SKU del Insumo</label>
            <select
              value={bomForm.sku}
              onChange={(e) => setBomForm({ ...bomForm, sku: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-mono font-bold cursor-pointer"
            >
              {catalogoList.map((item) => (
                <option key={item.sku} value={item.sku} className="bg-slate-900">
                  {item.sku} — {item.descripcion}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-400 font-semibold mb-1">Cantidad por Puerta</label>
            <input
              type="number"
              step="any"
              min="0.01"
              required
              value={bomForm.cantidad_por_puerta}
              onChange={(e) => setBomForm({ ...bomForm, cantidad_por_puerta: Number(e.target.value) })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-mono font-bold"
            />
          </div>

          <div>
            <label className="block text-slate-400 font-semibold mb-1">Notas Técnicas</label>
            <textarea
              rows="2"
              value={bomForm.notas}
              onChange={(e) => setBomForm({ ...bomForm, notas: e.target.value })}
              placeholder="Ej: Para ensamble de marco y bisagras"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
            />
          </div>

          <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowBomModal(false)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={savingBom}
              className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-bold shadow-lg shadow-amber-500/20 cursor-pointer"
            >
              {savingBom ? 'Guardando...' : 'Guardar en Receta'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default ForecastSettingsView;

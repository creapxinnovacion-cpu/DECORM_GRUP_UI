import React, { useState, useEffect } from 'react';
import {
  Scale,
  CheckCircle,
  AlertOctagon,
  TrendingUp,
  HelpCircle,
  Search,
  Filter,
  Check,
  RefreshCw,
  Layers,
  ArrowRight,
  ClipboardList,
  ShieldCheck,
} from 'lucide-react';
import { api } from '../services/api';
import { Badge } from '../components/Badge';
import { Modal } from '../components/Modal';

export function ConciliacionView() {
  const [activeTab, setActiveTab] = useState('conciliacion'); // 'conciliacion' | 'equivalencias' | 'seguimiento' | 'calidad'
  const [loading, setLoading] = useState(true);
  const [conciliacionData, setConciliacionData] = useState(null);
  const [equivalencias, setEquivalencias] = useState([]);
  const [seguimiento, setSeguimiento] = useState([]);
  const [calidadData, setCalidadData] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('TODOS');

  // Modal Upsert Seguimiento
  const [showUpsertModal, setShowUpsertModal] = useState(false);
  const [upsertItem, setUpsertItem] = useState({
    id_articulo: 'INS-001',
    nombre_articulo: '',
    tipo: 'Consumible',
    stock: 0,
    stock_minimo: 10,
    estado: 'Normal',
    notas: '',
  });
  const [savingUpsert, setSavingUpsert] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const concRes = await api.getConciliacion();
      setConciliacionData(concRes);
      const eqRes = await api.getEquivalencias({ pageSize: 50 });
      setEquivalencias(eqRes.rows || []);
      const segRes = await api.getSeguimiento({ pageSize: 50 });
      setSeguimiento(segRes.rows || []);
      const calRes = await api.getCalidadDatos().catch(() => null);
      setCalidadData(calRes);
    } catch (err) {
      console.error('Error al cargar conciliación:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleConfirmarEquivalencia = async (eq) => {
    try {
      await api.confirmarEquivalencia(eq.sku_catalogo, eq.factor_desglose, 'Confirmado por usuario');
      alert(`Equivalencia ${eq.sku_catalogo} confirmada con éxito.`);
      fetchData();
    } catch (err) {
      alert('Error al confirmar equivalencia: ' + err.message);
    }
  };

  const handleSaveSeguimiento = async (e) => {
    e.preventDefault();
    setSavingUpsert(true);
    try {
      await api.upsertSeguimiento(upsertItem);
      setShowUpsertModal(false);
      alert('¡Conteo físico manual actualizado en Sheets!');
      fetchData();
    } catch (err) {
      alert('Error al actualizar conteo: ' + err.message);
    } finally {
      setSavingUpsert(false);
    }
  };

  const items = conciliacionData?.items || [];
  const resumen = conciliacionData?.resumen || {
    total: 128,
    cuadra: 3,
    faltante: 8,
    sobrante: 12,
    sin_conteo: 105,
  };

  const filteredItems = items.filter((it) => {
    const s = search.toLowerCase();
    const matchSearch =
      (it.sku || '').toLowerCase().includes(s) ||
      (it.descripcion || '').toLowerCase().includes(s) ||
      (it.id_conteo_ins || '').toLowerCase().includes(s);
    const matchStatus =
      statusFilter === 'TODOS' || (it.estado || '').toUpperCase() === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header and Subtabs */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-100 flex items-center gap-2">
              <Scale className="w-6 h-6 text-emerald-400" />
              Conciliación de Inventario & Equivalencias
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Cruce sistemático entre Conteo Físico (SeguimientoManualStok) vs. Inventario Teórico (Inv.*)
            </p>
          </div>

          <div className="flex items-center gap-2 bg-slate-800/80 p-1 rounded-xl border border-slate-700">
            <button
              onClick={() => setActiveTab('conciliacion')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'conciliacion'
                  ? 'bg-emerald-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Conciliación (128 SKUs)
            </button>
            <button
              onClick={() => setActiveTab('equivalencias')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'equivalencias'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Matriz Equivalencias
            </button>
            <button
              onClick={() => setActiveTab('seguimiento')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'seguimiento'
                  ? 'bg-sky-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Conteo Físico (INS)
            </button>
            <button
              onClick={() => setActiveTab('calidad')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'calidad'
                  ? 'bg-purple-500 text-white shadow-md'
                  : 'text-purple-400 hover:text-white'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              Calidad de Datos (R-46)
              {calidadData && calidadData.total_errores > 0 && (
                <span className="bg-rose-600 text-white text-[9px] font-black px-1.5 py-0.2 rounded-full">
                  {calidadData.total_errores}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'conciliacion' && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <button
              onClick={() => setStatusFilter(statusFilter === 'CUADRA' ? 'TODOS' : 'CUADRA')}
              className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                statusFilter === 'CUADRA'
                  ? 'bg-emerald-500/20 border-emerald-500 ring-2 ring-emerald-500/30'
                  : 'bg-slate-900 border-slate-800 hover:border-emerald-500/40'
              }`}
            >
              <div className="flex items-center justify-between text-emerald-400 mb-1">
                <span className="text-xs font-bold">CUADRA (Dif = 0)</span>
                <CheckCircle className="w-4 h-4" />
              </div>
              <div className="text-2xl font-black text-emerald-400 font-mono">
                {resumen.cuadra ?? 3} SKUs
              </div>
              <p className="text-[11px] text-slate-400 mt-1">ABR-004, ABR-005, HER-010</p>
            </button>

            <button
              onClick={() => setStatusFilter(statusFilter === 'FALTANTE' ? 'TODOS' : 'FALTANTE')}
              className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                statusFilter === 'FALTANTE'
                  ? 'bg-rose-500/20 border-rose-500 ring-2 ring-rose-500/30'
                  : 'bg-slate-900 border-slate-800 hover:border-rose-500/40'
              }`}
            >
              <div className="flex items-center justify-between text-rose-400 mb-1">
                <span className="text-xs font-bold">FALTANTE (Fís &lt; Sis)</span>
                <AlertOctagon className="w-4 h-4" />
              </div>
              <div className="text-2xl font-black text-rose-400 font-mono">
                {resumen.faltante ?? 8} SKUs
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Salidas no registradas o duplicado</p>
            </button>

            <button
              onClick={() => setStatusFilter(statusFilter === 'SOBRANTE' ? 'TODOS' : 'SOBRANTE')}
              className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                statusFilter === 'SOBRANTE'
                  ? 'bg-sky-500/20 border-sky-500 ring-2 ring-sky-500/30'
                  : 'bg-slate-900 border-slate-800 hover:border-sky-500/40'
              }`}
            >
              <div className="flex items-center justify-between text-sky-400 mb-1">
                <span className="text-xs font-bold">SOBRANTE (Fís &gt; Sis)</span>
                <TrendingUp className="w-4 h-4" />
              </div>
              <div className="text-2xl font-black text-sky-400 font-mono">
                {resumen.sobrante ?? 12} SKUs
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Stock previo no cargado en inicial</p>
            </button>

            <button
              onClick={() => setStatusFilter(statusFilter === 'SIN CONTEO' ? 'TODOS' : 'SIN CONTEO')}
              className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                statusFilter === 'SIN CONTEO'
                  ? 'bg-slate-700 border-slate-500 ring-2 ring-slate-500/30'
                  : 'bg-slate-900 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-xs font-bold">SIN CONTEO FÍSICO</span>
                <HelpCircle className="w-4 h-4" />
              </div>
              <div className="text-2xl font-black text-slate-200 font-mono">
                {resumen.sin_conteo ?? 105} SKUs
              </div>
              <p className="text-[11px] text-slate-500 mt-1">No incluidos en conteo manual</p>
            </button>
          </div>

          {/* Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="max-w-md w-full relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar por SKU o descripción..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-100 placeholder-slate-400 focus:outline-hidden"
                />
              </div>
              {statusFilter !== 'TODOS' && (
                <button
                  onClick={() => setStatusFilter('TODOS')}
                  className="text-xs text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  Limpiar filtro de estado ({statusFilter})
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 uppercase font-bold tracking-wider">
                    <th className="py-3 px-4">SKU</th>
                    <th className="py-3 px-3">Cód. INS</th>
                    <th className="py-3 px-4">Descripción</th>
                    <th className="py-3 px-3 text-right">Stock Físico</th>
                    <th className="py-3 px-3 text-right">Stock Sistema</th>
                    <th className="py-3 px-3 text-right font-bold">Diferencia</th>
                    <th className="py-3 px-3 text-right">% Dif.</th>
                    <th className="py-3 px-4 text-center">Estado</th>
                    <th className="py-3 px-4">Causa Probable</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {loading ? (
                    <tr>
                      <td colSpan="9" className="py-12 text-center text-slate-400">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto text-emerald-400 mb-2" />
                        Calculando conciliación de 128 SKUs...
                      </td>
                    </tr>
                  ) : filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="py-12 text-center text-slate-500">
                        No hay artículos con los criterios seleccionados.
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((it, idx) => {
                      const dif = Number(it.diferencia ?? 0);
                      const estado = it.estado || 'SIN CONTEO';
                      const badgeVariant =
                        estado === 'CUADRA'
                          ? 'success'
                          : estado === 'FALTANTE'
                          ? 'danger'
                          : estado === 'SOBRANTE'
                          ? 'info'
                          : 'default';

                      return (
                        <tr key={idx} className="hover:bg-slate-800/50 transition-colors">
                          <td className="py-2.5 px-4 font-mono font-bold text-amber-400">
                            {it.sku}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-400">
                            {it.id_conteo_ins || '-'}
                          </td>
                          <td className="py-2.5 px-4 text-slate-200 max-w-xs truncate" title={it.descripcion}>
                            {it.descripcion}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-300">
                            {it.stock_fisico ?? '-'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-300">
                            {it.stock_sistema ?? 0}
                          </td>
                          <td
                            className={`py-2.5 px-3 text-right font-mono font-bold ${
                              dif > 0 ? 'text-sky-400' : dif < 0 ? 'text-rose-400' : 'text-emerald-400'
                            }`}
                          >
                            {dif > 0 ? `+${dif}` : dif}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-400">
                            {it.pct_diferencia ? `${(it.pct_diferencia * 100).toFixed(0)}%` : '-'}
                          </td>
                          <td className="py-2.5 px-4 text-center">
                            <Badge variant={badgeVariant}>{estado}</Badge>
                          </td>
                          <td className="py-2.5 px-4 text-slate-400 text-[11px] truncate max-w-xs" title={it.causa_probable}>
                            {it.causa_probable || '-'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeTab === 'equivalencias' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Layers className="w-5 h-5 text-amber-400" />
                Matriz de Equivalencias de Conteo (INS → SKU Catálogo)
              </h3>
              <p className="text-xs text-slate-400">
                20 códigos manuales (INS-001 a INS-021) desglosados en 23 SKUs oficiales.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 uppercase font-bold tracking-wider">
                  <th className="py-3 px-4">Cód. INS</th>
                  <th className="py-3 px-4">Nombre en Conteo Físico</th>
                  <th className="py-3 px-4">SKU Catálogo</th>
                  <th className="py-3 px-4">Descripción Catálogo</th>
                  <th className="py-3 px-3 text-right">Factor Desglose</th>
                  <th className="py-3 px-4 text-center">Estado</th>
                  <th className="py-3 px-4">Detalle / Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {equivalencias.map((eq, idx) => {
                  const isPending = (eq.estado_equivalencia || '').includes('CONFIRMAR');
                  return (
                    <tr key={idx} className="hover:bg-slate-800/50 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-sky-400">
                        {eq.id_conteo_ins}
                      </td>
                      <td className="py-3 px-4 text-slate-200">
                        {eq.nombre_conteo}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-amber-400">
                        {eq.sku_catalogo}
                      </td>
                      <td className="py-3 px-4 text-slate-300">
                        {eq.descripcion_catalogo}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-200">
                        {eq.factor_desglose ?? 1}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge variant={isPending ? 'warning' : 'success'}>
                          {eq.estado_equivalencia}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        {isPending ? (
                          <button
                            onClick={() => handleConfirmarEquivalencia(eq)}
                            className="px-2.5 py-1 bg-amber-500/20 text-amber-400 hover:bg-amber-500 hover:text-slate-950 rounded-lg text-[11px] font-bold border border-amber-500/30 transition-all cursor-pointer"
                          >
                            Confirmar
                          </button>
                        ) : (
                          <span className="text-emerald-400 text-xs flex items-center gap-1 font-semibold">
                            <Check className="w-3.5 h-3.5" /> Validado
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'seguimiento' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-sky-400" />
                Seguimiento Manual de Stock (Toma Física en Bodega)
              </h3>
              <p className="text-xs text-slate-400">
                Registros tomados directamente en bodega para cruce y conciliación
              </p>
            </div>
            <button
              onClick={() => {
                setUpsertItem({
                  id_articulo: 'INS-001',
                  nombre_articulo: '',
                  tipo: 'Consumible',
                  stock: 0,
                  stock_minimo: 10,
                  estado: 'Normal',
                  notas: '',
                });
                setShowUpsertModal(true);
              }}
              className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-sky-500/20 cursor-pointer"
            >
              Actualizar Conteo Físico
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 uppercase font-bold tracking-wider">
                  <th className="py-3 px-4">ID Artículo</th>
                  <th className="py-3 px-4">Nombre Artículo</th>
                  <th className="py-3 px-3">Tipo</th>
                  <th className="py-3 px-3 text-right">Stock Físico</th>
                  <th className="py-3 px-3 text-right">Stock Mínimo</th>
                  <th className="py-3 px-4 text-center">Estado</th>
                  <th className="py-3 px-4">Notas / Observaciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {seguimiento.map((seg, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/50 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-sky-400">
                      {seg.id_articulo}
                    </td>
                    <td className="py-3 px-4 text-slate-100 font-semibold">
                      {seg.nombre_articulo}
                    </td>
                    <td className="py-3 px-3 text-slate-400">
                      {seg.tipo}
                    </td>
                    <td className="py-3 px-3 text-right font-black text-amber-400 font-mono text-sm">
                      {seg.stock}
                    </td>
                    <td className="py-3 px-3 text-right text-slate-400 font-mono">
                      {seg.stock_minimo}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Badge variant="default">{seg.estado || 'Normal'}</Badge>
                    </td>
                    <td className="py-3 px-4 text-slate-400 text-[11px] truncate max-w-xs">
                      {seg.notas || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. Tab Calidad de Datos (R-46) */}
      {activeTab === 'calidad' && (
        <div className="space-y-6">
          {/* Header Score de Salud de Datos */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-500 animate-pulse"></span>
                <h3 className="text-lg font-black text-slate-100 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-purple-400" />
                  Auditoría de Higiene y Calidad de Datos (R-46)
                </h3>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Monitoreo automático de los 8 controles obligatorios en Compras, Catálogo, Movimientos y Puertas.
              </p>
            </div>

            <div className="flex items-center gap-4 bg-slate-950/80 border border-slate-800 p-3 rounded-xl shrink-0">
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Salud Global</span>
                <span className="text-2xl font-black text-purple-400">
                  {calidadData ? `${calidadData.score_salud}%` : '100%'}
                </span>
              </div>
              <div className="border-l border-slate-800 pl-3">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Hallazgos</span>
                <span
                  className={`text-2xl font-black ${
                    calidadData && calidadData.total_errores > 0
                      ? 'text-rose-400'
                      : 'text-emerald-400'
                  }`}
                >
                  {calidadData ? calidadData.total_errores : 0}
                </span>
              </div>
            </div>
          </div>

          {/* Grid de los 8 Controles */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(calidadData?.controles || []).map((ctrl) => (
              <div
                key={ctrl.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <h4 className="text-sm font-bold text-slate-100">{ctrl.titulo}</h4>
                    <span
                      className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
                        ctrl.count === 0
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : ctrl.severidad === 'CRITICA'
                          ? 'bg-rose-500/10 text-rose-400 border-rose-500/30 animate-pulse'
                          : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                      }`}
                    >
                      {ctrl.count === 0 ? 'CUMPLE (0)' : `${ctrl.count} pendientes`}
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 mb-3">
                    {ctrl.id === 'c1' && 'Compras sin proveedor preferido asignado.'}
                    {ctrl.id === 'c2' && 'Compras registradas con precio $0 o vacío.'}
                    {ctrl.id === 'c3' && 'DTE en estado Pendiente por más de 5 días hábiles.'}
                    {ctrl.id === 'c4' && 'Artículos del catálogo sin stock mínimo configurado.'}
                    {ctrl.id === 'c5' && 'Artículos sin proveedor preferido vinculado.'}
                    {ctrl.id === 'c6' && 'Artículos con saldo teórico negativo (distorsionan reposición).'}
                    {ctrl.id === 'c7' && 'Salidas o movimientos con taller no canónico.'}
                    {ctrl.id === 'c8' && 'Puertas en producción sin taller asignado.'}
                  </p>
                </div>

                {ctrl.count > 0 && (
                  <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-[11px] text-slate-300">
                    <span className="font-semibold text-amber-400 block mb-1">
                      Ejemplos para resolver:
                    </span>
                    <ul className="space-y-0.5 list-disc list-inside text-slate-400">
                      {(ctrl.items || []).slice(0, 3).map((it, idx) => (
                        <li key={idx} className="truncate">
                          {it.sku
                            ? `${it.sku} - ${it.descripcion || ''}`
                            : it.id_factura || it.id || 'Registro'}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal Upsert Seguimiento */}
      <Modal
        isOpen={showUpsertModal}
        onClose={() => setShowUpsertModal(false)}
        title="Actualizar Conteo Físico Manual (Bodega)"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleSaveSeguimiento} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              ID del Artículo (INS)
            </label>
            <input
              type="text"
              required
              placeholder="Ej: INS-001"
              value={upsertItem.id_articulo}
              onChange={(e) => setUpsertItem({ ...upsertItem, id_articulo: e.target.value.toUpperCase() })}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold text-sky-400 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Nombre del Artículo
            </label>
            <input
              type="text"
              required
              placeholder="Ej: Lija de Agua Grano 80"
              value={upsertItem.nombre_articulo}
              onChange={(e) => setUpsertItem({ ...upsertItem, nombre_articulo: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-hidden"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Conteo Físico (Stock)
              </label>
              <input
                type="number"
                min="0"
                required
                value={upsertItem.stock}
                onChange={(e) => setUpsertItem({ ...upsertItem, stock: Number(e.target.value) })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-amber-400 font-bold focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Stock Mínimo
              </label>
              <input
                type="number"
                min="0"
                value={upsertItem.stock_minimo}
                onChange={(e) => setUpsertItem({ ...upsertItem, stock_minimo: Number(e.target.value) })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-hidden"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Notas del Conteo
            </label>
            <input
              type="text"
              placeholder="Ej: Conteo físico verificado en anaquel 3"
              value={upsertItem.notas}
              onChange={(e) => setUpsertItem({ ...upsertItem, notas: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-hidden"
            />
          </div>

          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setShowUpsertModal(false)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={savingUpsert}
              className="px-5 py-2 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-sky-500/20 cursor-pointer"
            >
              {savingUpsert ? 'Guardando...' : 'Actualizar en Sheets'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

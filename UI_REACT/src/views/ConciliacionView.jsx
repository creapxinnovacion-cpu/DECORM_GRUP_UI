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
  const [catalogoList, setCatalogoList] = useState([]);
  const [calidadData, setCalidadData] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('TODOS');

  // Modal Conteo Físico Inteligente (Búsqueda por SKU o Nombre)
  const [showUpsertModal, setShowUpsertModal] = useState(false);
  const [searchModalSku, setSearchModalSku] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [conteoFisicoVal, setConteoFisicoVal] = useState('');
  const [conteoFecha, setConteoFecha] = useState(new Date().toISOString().split('T')[0]);
  const [conteoAjusteKardex, setConteoAjusteKardex] = useState(true);
  const [conteoNotas, setConteoNotas] = useState('');
  const [savingUpsert, setSavingUpsert] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const concRes = await api.getConciliacion();
      setConciliacionData(concRes);
      const eqRes = await api.getEquivalencias({ pageSize: 100 });
      setEquivalencias(eqRes.rows || []);
      const catRes = await api.getCatalogo({ pageSize: 500 });
      setCatalogoList(catRes.rows || []);
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

  const handleOpenConteoModal = (preselectedItem = null) => {
    setSelectedItem(preselectedItem);
    setSearchModalSku(preselectedItem ? preselectedItem.sku : '');
    setConteoFisicoVal(preselectedItem ? (preselectedItem.ultimo_conteo ?? preselectedItem.stock_fisico ?? '') : '');
    setConteoFecha(new Date().toISOString().split('T')[0]);
    setConteoAjusteKardex(true);
    setConteoNotas('');
    setShowUpsertModal(true);
  };

  const handleSaveConteoFisico = async (e) => {
    e.preventDefault();
    if (!selectedItem || !selectedItem.sku) {
      alert('Por favor selecciona un artículo del catálogo.');
      return;
    }
    const conteoNum = Number(conteoFisicoVal);
    if (isNaN(conteoNum) || conteoNum < 0) {
      alert('Por favor ingresa un conteo físico válido (número >= 0).');
      return;
    }

    setSavingUpsert(true);
    try {
      // 1. Actualizar el último conteo físico en la hoja Catálogo (que recalcula Conciliación)
      await api.updateArticulo(selectedItem.sku, {
        ultimo_conteo: conteoNum,
        fecha_conteo: conteoFecha,
      });

      // 2. Si se solicitó ajuste en Kardex y hay diferencia con el saldo teórico
      const stockTeorico = Number(selectedItem.stock_actual ?? selectedItem.stock_sistema ?? 0);
      const diff = conteoNum - stockTeorico;
      if (conteoAjusteKardex && diff !== 0) {
        try {
          await api.createMovimiento({
            fecha: conteoFecha,
            tipo: diff > 0 ? 'Ajuste (+)' : 'Ajuste (-)',
            sku: selectedItem.sku,
            cantidad: Math.abs(diff),
            taller_destino: 'Bodega Central',
            entregado_a: 'Auditoría Física de Bodega',
            observaciones: conteoNotas || `Conteo físico a mano: ${conteoNum} unid. (Ajuste: ${diff > 0 ? '+' : ''}${diff})`,
          });
        } catch (mErr) {
          console.warn('Nota de ajuste de kardex:', mErr);
        }
      }

      setShowUpsertModal(false);
      alert(`¡Conteo físico de ${selectedItem.sku} actualizado exitosamente!`);
      await fetchData();
    } catch (err) {
      alert('Error al registrar conteo físico: ' + err.message);
    } finally {
      setSavingUpsert(false);
    }
  };

  const items = conciliacionData?.rows || conciliacionData?.items || [];
  const rawSum = conciliacionData?.summary || conciliacionData?.resumen || {};
  const resumen = {
    total: rawSum.total ?? items.length,
    cuadra: rawSum.cuadra ?? 0,
    faltante: rawSum.faltante ?? 0,
    sobrante: rawSum.sobrante ?? 0,
    sin_conteo: rawSum.sin_conteo ?? 0,
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

  // Resultados de búsqueda en modal para selección de SKU o nombre
  const modalCatalogResults = catalogoList.filter((it) => {
    if (!searchModalSku.trim()) return false;
    const q = searchModalSku.toLowerCase();
    return (
      (it.sku || '').toLowerCase().includes(q) ||
      (it.descripcion || '').toLowerCase().includes(q) ||
      (it.categoria || '').toLowerCase().includes(q)
    );
  }).slice(0, 8);

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
                Conteo Físico Real en Bodega (Inventario a Mano)
              </h3>
              <p className="text-xs text-slate-400">
                Auditoría y toma de stock físico en taller. Conectado al Catálogo Maestro y al motor de Conciliación.
              </p>
            </div>
            <button
              onClick={() => handleOpenConteoModal()}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-400 hover:to-sky-500 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-sky-500/20 cursor-pointer"
            >
              <ClipboardList className="w-4 h-4" />
              Tomar Conteo Físico
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 uppercase font-bold tracking-wider">
                  <th className="py-3 px-4">SKU</th>
                  <th className="py-3 px-4">Descripción del Insumo</th>
                  <th className="py-3 px-3">Categoría</th>
                  <th className="py-3 px-3 text-right">Stock Sistema</th>
                  <th className="py-3 px-3 text-right">Último Conteo Físico</th>
                  <th className="py-3 px-3 text-center">Fecha Conteo</th>
                  <th className="py-3 px-4 text-center">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {catalogoList.map((item, idx) => {
                  const hasConteo = item.ultimo_conteo !== undefined && item.ultimo_conteo !== '' && item.ultimo_conteo !== null;
                  const stockSis = Number(item.stock_actual ?? 0);
                  const stockFis = Number(item.ultimo_conteo ?? 0);

                  return (
                    <tr key={idx} className="hover:bg-slate-800/50 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-sky-400">
                        {item.sku}
                      </td>
                      <td className="py-3 px-4 text-slate-100 font-semibold">
                        {item.descripcion}
                      </td>
                      <td className="py-3 px-3 text-slate-400">
                        {item.categoria || '-'}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-300">
                        {stockSis} {item.unidad}
                      </td>
                      <td className="py-3 px-3 text-right font-black text-amber-400 font-mono text-sm">
                        {hasConteo ? `${stockFis} ${item.unidad}` : <span className="text-slate-600 font-normal">Sin conteo</span>}
                      </td>
                      <td className="py-3 px-3 text-center text-slate-400 text-[11px]">
                        {item.fecha_conteo ? String(item.fecha_conteo).slice(0, 10) : '-'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handleOpenConteoModal(item)}
                          className="px-2.5 py-1 bg-sky-500/10 text-sky-400 hover:bg-sky-500 hover:text-slate-950 rounded-lg text-[11px] font-bold border border-sky-500/30 transition-all cursor-pointer"
                        >
                          Actualizar Conteo
                        </button>
                      </td>
                    </tr>
                  );
                })}
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

      {/* Modal Inteligente: Actualizar Conteo Físico Manual (Búsqueda por SKU o Nombre) */}
      <Modal
        isOpen={showUpsertModal}
        onClose={() => setShowUpsertModal(false)}
        title="Actualizar Conteo Físico a Mano (Bodega)"
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleSaveConteoFisico} className="space-y-4">
          {/* Buscador de SKU o Nombre */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Buscar Insumo por SKU o Nombre (en vivo)
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Escribe SKU o palabra clave (ej: lija, thinner, disco, ABR-001)..."
                value={searchModalSku}
                onChange={(e) => {
                  setSearchModalSku(e.target.value);
                  if (selectedItem && !e.target.value.includes(selectedItem.sku)) {
                    setSelectedItem(null);
                  }
                }}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-sky-500"
              />
            </div>

            {/* Lista desplegable de coincidencias */}
            {!selectedItem && modalCatalogResults.length > 0 && (
              <div className="mt-1 max-h-48 overflow-y-auto bg-slate-950 border border-slate-800 rounded-xl divide-y divide-slate-800/80 shadow-2xl z-20">
                {modalCatalogResults.map((it) => (
                  <div
                    key={it.sku}
                    onClick={() => {
                      setSelectedItem(it);
                      setSearchModalSku(`${it.sku} - ${it.descripcion}`);
                      setConteoFisicoVal(it.ultimo_conteo ?? it.stock_actual ?? '');
                    }}
                    className="p-2.5 hover:bg-slate-800/80 cursor-pointer transition flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-mono font-bold text-sky-400 mr-2">{it.sku}</span>
                      <span className="text-slate-200">{it.descripcion}</span>
                      <span className="text-[11px] text-slate-500 block">
                        Categoría: {it.categoria} · {it.unidad}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block">Stock Sistema:</span>
                      <span className="font-mono font-bold text-slate-100">
                        {it.stock_actual ?? 0} {it.unidad}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Ficha del artículo seleccionado */}
          {selectedItem && (
            <div className="p-3 bg-sky-950/30 border border-sky-500/30 rounded-xl space-y-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-sky-400 text-sm">{selectedItem.sku}</span>
                <span className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 font-semibold text-[11px]">
                  {selectedItem.categoria}
                </span>
              </div>
              <p className="text-slate-200 font-semibold">{selectedItem.descripcion}</p>
              <div className="flex items-center justify-between pt-1 text-slate-400 text-[11px]">
                <span>Unidad: <strong className="text-slate-200">{selectedItem.unidad}</strong></span>
                <span>Stock Sistema: <strong className="text-emerald-400 font-mono">{selectedItem.stock_actual ?? 0}</strong></span>
                <span>Último conteo previo: <strong className="text-amber-400 font-mono">{selectedItem.ultimo_conteo ?? 'N/D'}</strong></span>
              </div>
            </div>
          )}

          {/* Inputs de Conteo Físico y Fecha */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-amber-300 mb-1">
                Nuevo Conteo Físico Real (a mano) *
              </label>
              <input
                type="number"
                min="0"
                step="any"
                required
                placeholder="Cantidad contada"
                value={conteoFisicoVal}
                onChange={(e) => setConteoFisicoVal(e.target.value)}
                className="w-full bg-slate-800 border border-amber-500/50 rounded-xl px-3 py-2 text-sm text-amber-400 font-bold font-mono focus:outline-hidden focus:border-amber-400"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Fecha de Toma Física
              </label>
              <input
                type="date"
                required
                value={conteoFecha}
                onChange={(e) => setConteoFecha(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Banner de Diferencia en tiempo real */}
          {selectedItem && conteoFisicoVal !== '' && !isNaN(Number(conteoFisicoVal)) && (
            (() => {
              const conteo = Number(conteoFisicoVal);
              const teorico = Number(selectedItem.stock_actual ?? 0);
              const diff = conteo - teorico;
              return (
                <div
                  className={`p-3 rounded-xl border flex items-center justify-between text-xs font-semibold ${
                    diff === 0
                      ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-400'
                      : diff < 0
                      ? 'bg-rose-950/30 border-rose-500/40 text-rose-400'
                      : 'bg-sky-950/30 border-sky-500/40 text-sky-400'
                  }`}
                >
                  <span>
                    {diff === 0
                      ? '✔ Cuadra exactamente con el saldo teórico'
                      : diff < 0
                      ? `⚠ Faltante físico de ${Math.abs(diff)} ${selectedItem.unidad}`
                      : `↗ Sobrante físico de +${diff} ${selectedItem.unidad}`}
                  </span>
                  <span className="font-mono text-sm">
                    Dif: {diff > 0 ? `+${diff}` : diff} {selectedItem.unidad}
                  </span>
                </div>
              );
            })()
          )}

          {/* Checkbox Ajuste Kardex */}
          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="ajusteKardex"
              checked={conteoAjusteKardex}
              onChange={(e) => setConteoAjusteKardex(e.target.checked)}
              className="w-4 h-4 text-sky-500 rounded border-slate-700 focus:ring-0 cursor-pointer"
            />
            <label htmlFor="ajusteKardex" className="text-xs text-slate-300 select-none cursor-pointer">
              Registrar movimiento automático de Ajuste en Kardex si existe diferencia
            </label>
          </div>

          {/* Observaciones */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Observaciones / Auditoría (opcional)
            </label>
            <input
              type="text"
              placeholder="Ej: Verificado por Cristian Cajul en anaquel de lija"
              value={conteoNotas}
              onChange={(e) => setConteoNotas(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-hidden"
            />
          </div>

          {/* Botones de acción */}
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
              disabled={savingUpsert || !selectedItem}
              className="px-5 py-2 bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-400 hover:to-sky-500 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-sky-500/20 cursor-pointer disabled:opacity-50"
            >
              {savingUpsert ? 'Guardando en Sheets...' : 'Guardar Conteo en Sheets y Recalcular'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

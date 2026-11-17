import React, { useState, useEffect } from 'react';
import {
  Boxes,
  Search,
  Plus,
  History,
  Edit2,
  AlertTriangle,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  RefreshCw,
  Sparkles,
  Check,
} from 'lucide-react';
import { api } from '../services/api';
import { Badge } from '../components/Badge';
import { Modal } from '../components/Modal';

export function CatalogoView() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('Todas');
  const [total, setTotal] = useState(0);

  // Kardex modal
  const [kardexSku, setKardexSku] = useState(null);
  const [kardexData, setKardexData] = useState(null);
  const [loadingKardex, setLoadingKardex] = useState(false);

  // New Article modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [prefijo, setPrefijo] = useState('CON');
  const [newSku, setNewSku] = useState('');
  const [generatingSku, setGeneratingSku] = useState(false);
  const [formValues, setFormValues] = useState({
    descripcion: '',
    categoria: 'Consumibles',
    unidad: 'Unidad',
    origen: 'Local',
    proveedor_pref: '',
    stock_inicial: 0,
    stock_minimo: 10,
  });
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const fetchCatalogo = async () => {
    setLoading(true);
    try {
      const res = await api.getCatalogo({ pageSize: 150 });
      setItems(res.rows || []);
      setTotal(res.total || 0);
    } catch (err) {
      console.error('Error al cargar catálogo:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCatalogo();
  }, []);

  const openKardex = async (sku) => {
    setKardexSku(sku);
    setLoadingKardex(true);
    try {
      const data = await api.getKardex(sku);
      setKardexData(data);
    } catch (err) {
      console.error('Error al cargar kardex:', err);
    } finally {
      setLoadingKardex(false);
    }
  };

  const handleNextSku = async () => {
    setGeneratingSku(true);
    try {
      const res = await api.getNextSku(prefijo);
      setNewSku(res.formatted);
    } catch (err) {
      console.error('Error al generar correlativo:', err);
      // Fallback
      setNewSku(`${prefijo}-${Math.floor(100 + Math.random() * 900)}`);
    } finally {
      setGeneratingSku(false);
    }
  };

  const handleCreateArticle = async (e) => {
    e.preventDefault();
    if (!newSku) {
      alert('Por favor genera o escribe un SKU.');
      return;
    }
    setSaving(true);
    try {
      await api.createArticulo({
        sku: newSku,
        ...formValues,
      });
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        setShowCreateModal(false);
        setNewSku('');
        fetchCatalogo();
      }, 1200);
    } catch (err) {
      alert('Error al crear artículo: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const categories = [
    'Todas',
    'Herrajes',
    'Pinturas',
    'Lijas',
    'Selladores y Silicones',
    'Consumibles',
    'Equipos',
  ];

  const filteredItems = items.filter((item) => {
    const matchSearch =
      (item.sku || '').toLowerCase().includes(search.toLowerCase()) ||
      (item.descripcion || '').toLowerCase().includes(search.toLowerCase()) ||
      (item.proveedor_pref || '').toLowerCase().includes(search.toLowerCase());
    const matchCat =
      categoryFilter === 'Todas' ||
      (item.categoria || '').toLowerCase().includes(categoryFilter.toLowerCase());
    return matchSearch && matchCat;
  });

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-100 flex items-center gap-2">
              <Boxes className="w-6 h-6 text-amber-500" />
              Catálogo Maestro Unificado
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              {total > 0 ? total : 128} SKUs gobernados por fórmulas · Kardex cronológico y cálculo automático de stock
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setShowCreateModal(true);
                handleNextSku();
              }}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Nuevo Artículo
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="mt-6 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por SKU, descripción o proveedor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-800/80 border border-slate-700 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-100 placeholder-slate-400 focus:outline-hidden focus:border-amber-500 transition-colors"
            />
          </div>

          {/* Category Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  categoryFilter === cat
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/10'
                    : 'bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 uppercase font-bold tracking-wider">
                <th className="py-3.5 px-4">SKU</th>
                <th className="py-3.5 px-4">Descripción</th>
                <th className="py-3.5 px-3">Categoría</th>
                <th className="py-3.5 px-3 text-right">Stock Inicial</th>
                <th className="py-3.5 px-3 text-right">Entradas</th>
                <th className="py-3.5 px-3 text-right">Salidas</th>
                <th className="py-3.5 px-3 text-right font-black text-amber-400">STOCK ACTUAL</th>
                <th className="py-3.5 px-3 text-right">PMP / Ref $</th>
                <th className="py-3.5 px-3 text-right">Valor $</th>
                <th className="py-3.5 px-3 text-center">Estado</th>
                <th className="py-3.5 px-4 text-center">Kardex</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {loading ? (
                <tr>
                  <td colSpan="11" className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-amber-500 mb-2" />
                    Cargando catálogo maestro...
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan="11" className="py-12 text-center text-slate-500">
                    No se encontraron artículos con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const stockActual = Number(item.stock_actual ?? 0);
                  const stockMinimo = Number(item.stock_minimo ?? 0);
                  const isLow = stockActual <= stockMinimo;
                  const isOut = stockActual <= 0;

                  return (
                    <tr
                      key={item.sku}
                      className="hover:bg-slate-800/50 transition-colors group"
                    >
                      <td className="py-3 px-4 font-mono font-bold text-amber-400 whitespace-nowrap">
                        {item.sku}
                      </td>
                      <td className="py-3 px-4 text-slate-100 max-w-xs truncate" title={item.descripcion}>
                        {item.descripcion}
                      </td>
                      <td className="py-3 px-3 text-slate-400 whitespace-nowrap">
                        <Badge variant="default">{item.categoria}</Badge>
                      </td>
                      <td className="py-3 px-3 text-right text-slate-400 font-mono">
                        {item.stock_inicial ?? 0}
                      </td>
                      <td className="py-3 px-3 text-right text-sky-400 font-mono">
                        +{item.entradas_compras ?? 0}
                      </td>
                      <td className="py-3 px-3 text-right text-rose-400 font-mono">
                        -{item.salidas ?? 0}
                      </td>
                      <td className="py-3 px-3 text-right font-black text-sm font-mono">
                        <span
                          className={
                            isOut
                              ? 'text-rose-400'
                              : isLow
                              ? 'text-amber-400'
                              : 'text-emerald-400'
                          }
                        >
                          {stockActual}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right text-slate-300 font-mono">
                        ${Number(item.pmp || item.precio_ref_neto || 0).toFixed(2)}
                      </td>
                      <td className="py-3 px-3 text-right text-emerald-400 font-mono font-bold">
                        ${Number(item.valor_inventario || 0).toFixed(2)}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {isOut ? (
                          <Badge variant="danger">AGOTADO</Badge>
                        ) : isLow ? (
                          <Badge variant="warning">REORDEN</Badge>
                        ) : (
                          <Badge variant="success">NORMAL</Badge>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => openKardex(item.sku)}
                          className="p-1.5 text-slate-400 hover:text-amber-400 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                          title="Ver historial de Kardex"
                        >
                          <History className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Kardex */}
      <Modal
        isOpen={Boolean(kardexSku)}
        onClose={() => setKardexSku(null)}
        title={`Kardex Cronológico — ${kardexSku}`}
        maxWidth="max-w-3xl"
      >
        {loadingKardex ? (
          <div className="py-12 text-center text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-amber-500 mb-2" />
            Reconstruyendo transacciones desde Google Sheets...
          </div>
        ) : kardexData ? (
          <div className="space-y-4">
            <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400">Artículo:</p>
                <p className="text-sm font-bold text-slate-100">{kardexData.descripcion || kardexSku}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-400">Saldo Actual Calculado:</p>
                <p className="text-lg font-black text-amber-400">{kardexData.saldo_final ?? 0} unid.</p>
              </div>
            </div>

            <div className="overflow-x-auto max-h-72">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase font-semibold">
                    <th className="py-2.5 px-3">Fecha</th>
                    <th className="py-2.5 px-3">Tipo / Doc</th>
                    <th className="py-2.5 px-3">Detalle / Destino</th>
                    <th className="py-2.5 px-3 text-right">Entrada</th>
                    <th className="py-2.5 px-3 text-right">Salida</th>
                    <th className="py-2.5 px-3 text-right font-bold text-amber-400">Saldo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  <tr className="bg-slate-800/30 font-semibold">
                    <td className="py-2 px-3 text-slate-400">-</td>
                    <td className="py-2 px-3 text-amber-400">STOCK INICIAL</td>
                    <td className="py-2 px-3 text-slate-400">Apertura en Catálogo</td>
                    <td className="py-2 px-3 text-right text-sky-400">+{kardexData.stock_inicial ?? 0}</td>
                    <td className="py-2 px-3 text-right text-slate-500">-</td>
                    <td className="py-2 px-3 text-right text-amber-400">{kardexData.stock_inicial ?? 0}</td>
                  </tr>
                  {(kardexData.movimientos || []).map((m, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/20">
                      <td className="py-2 px-3 text-slate-300 font-mono">{m.fecha}</td>
                      <td className="py-2 px-3 font-semibold text-slate-200">{m.tipo}</td>
                      <td className="py-2 px-3 text-slate-400 truncate max-w-xs">{m.origen_destino || m.detalle}</td>
                      <td className="py-2 px-3 text-right text-sky-400 font-mono">
                        {m.entrada ? `+${m.entrada}` : '-'}
                      </td>
                      <td className="py-2 px-3 text-right text-rose-400 font-mono">
                        {m.salida ? `-${m.salida}` : '-'}
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-amber-400 font-mono">
                        {m.saldo}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <p className="text-slate-400 text-sm">No se encontraron movimientos registrados para este SKU.</p>
        )}
      </Modal>

      {/* Modal Nuevo Artículo */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Crear Nuevo Artículo en Catálogo Maestro"
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleCreateArticle} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Prefijo de Familia
              </label>
              <select
                value={prefijo}
                onChange={(e) => {
                  setPrefijo(e.target.value);
                  const catMap = {
                    CON: 'Consumibles',
                    HER: 'Herrajes',
                    PIN: 'Pinturas',
                    ABR: 'Lijas',
                    SEL: 'Selladores y Silicones',
                    EQU: 'Equipos',
                  };
                  setFormValues({ ...formValues, categoria: catMap[e.target.value] || 'Consumibles' });
                }}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-hidden focus:border-amber-500"
              >
                <option value="CON">CON — Consumibles</option>
                <option value="HER">HER — Herrajes</option>
                <option value="PIN">PIN — Pinturas</option>
                <option value="ABR">ABR — Lijas y Abrasivos</option>
                <option value="SEL">SEL — Selladores y Silicones</option>
                <option value="EQU">EQU — Equipos y Herramientas</option>
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-300">
                  SKU Generado
                </label>
                <button
                  type="button"
                  onClick={handleNextSku}
                  disabled={generatingSku}
                  className="text-[11px] text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${generatingSku ? 'animate-spin' : ''}`} /> Siguiente
                </button>
              </div>
              <input
                type="text"
                required
                value={newSku}
                onChange={(e) => setNewSku(e.target.value.toUpperCase())}
                placeholder="Ej: CON-021"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold text-amber-400 focus:outline-hidden focus:border-amber-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Descripción Completa
            </label>
            <input
              type="text"
              required
              value={formValues.descripcion}
              onChange={(e) => setFormValues({ ...formValues, descripcion: e.target.value })}
              placeholder="Ej: Tornillo hexagonal 1/4 x 2 pulgadas"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-hidden focus:border-amber-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Unidad de Medida
              </label>
              <select
                value={formValues.unidad}
                onChange={(e) => setFormValues({ ...formValues, unidad: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-hidden focus:border-amber-500"
              >
                <option value="Unidad">Unidad</option>
                <option value="Pliego">Pliego</option>
                <option value="Galón">Galón</option>
                <option value="Tubo">Tubo</option>
                <option value="Par">Par</option>
                <option value="Rollo">Rollo</option>
                <option value="Caja">Caja</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Proveedor Preferido
              </label>
              <input
                type="text"
                value={formValues.proveedor_pref}
                onChange={(e) => setFormValues({ ...formValues, proveedor_pref: e.target.value })}
                placeholder="Ej: FREUND / EPA"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-hidden focus:border-amber-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Stock Inicial
              </label>
              <input
                type="number"
                min="0"
                value={formValues.stock_inicial}
                onChange={(e) => setFormValues({ ...formValues, stock_inicial: Number(e.target.value) })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-hidden focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Stock Mínimo de Alerta
              </label>
              <input
                type="number"
                min="0"
                value={formValues.stock_minimo}
                onChange={(e) => setFormValues({ ...formValues, stock_minimo: Number(e.target.value) })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-hidden focus:border-amber-500"
              />
            </div>
          </div>

          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-amber-500/20 cursor-pointer"
            >
              {saving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> Guardando...
                </>
              ) : saveSuccess ? (
                <>
                  <Check className="w-4 h-4 text-emerald-950" /> ¡Guardado!
                </>
              ) : (
                'Guardar en Hoja de Cálculo'
              )}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

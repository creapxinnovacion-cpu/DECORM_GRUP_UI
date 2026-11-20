import React, { useState, useEffect } from 'react';
import {
  Truck,
  Plus,
  Layers,
  Search,
  CheckSquare,
  Square,
  Edit2,
  Trash2,
  RefreshCw,
  User,
  Package,
  CheckCircle2,
} from 'lucide-react';
import { api, generateRequestId } from '../services/api';
import { Modal } from '../components/Modal';
import SearchableSkuSelect from '../components/SearchableSkuSelect';
import { OPERADORES } from '../config/constants';

export function InstaladoresView() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [catalogoItems, setCatalogoItems] = useState([]);

  // Create Single Modal
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    codigo: '',
    insumo: '',
    check: false,
    cantidad: 1,
    encargado_instalacion: '',
    encargado_bodega: 'Bodega Central',
  });

  // Batch Modal
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchCabecera, setBatchCabecera] = useState({
    encargado_instalacion: '',
    encargado_bodega: 'Bodega Central',
  });
  const [batchLineas, setBatchLineas] = useState([
    { codigo: '', insumo: '', check: false, cantidad: 1 },
  ]);
  const [savingBatch, setSavingBatch] = useState(false);

  // Edit Modal
  const [editingItem, setEditingItem] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [savingEdit, setSavingEdit] = useState(false);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await api.getInsumosInstaladores({ pageSize: 300 });
      setItems(res.rows || []);
    } catch (err) {
      console.error('Error al cargar insumos instaladores:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
    api.getCatalogo({ pageSize: 500 }).then((res) => {
      setCatalogoItems(res.rows || []);
    }).catch((e) => console.warn(e));
  }, []);

  // Quick toggle Check
  const handleToggleCheck = async (item) => {
    const newCheck = !item.check;
    // Optimistic update
    setItems((prev) =>
      prev.map((it) => (it._rowNumber === item._rowNumber ? { ...it, check: newCheck } : it))
    );
    try {
      await api.updateInsumoInstalador(item._rowNumber, { check: newCheck });
    } catch (err) {
      console.error('Error al actualizar check:', err);
      // Revert
      setItems((prev) =>
        prev.map((it) => (it._rowNumber === item._rowNumber ? { ...it, check: !newCheck } : it))
      );
    }
  };

  // Create Single Submit
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const cat = catalogoItems.find((c) => c.sku === formData.codigo);
      const payload = {
        ...formData,
        insumo: formData.insumo || cat?.descripcion || formData.codigo,
      };
      await api.createInsumoInstalador(payload);
      setShowModal(false);
      setFormData({
        codigo: '',
        insumo: '',
        check: false,
        cantidad: 1,
        encargado_instalacion: '',
        encargado_bodega: 'Bodega Central',
      });
      fetchItems();
      alert('Registro de insumo para instalador creado con éxito.');
    } catch (err) {
      alert('Error al registrar: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Batch Submit
  const handleBatchSubmit = async (e) => {
    e.preventDefault();
    if (!batchLineas.length) return;
    setSavingBatch(true);
    try {
      const processedLineas = batchLineas.map((l) => {
        const cat = catalogoItems.find((c) => c.sku === l.codigo);
        return {
          ...l,
          insumo: l.insumo || cat?.descripcion || l.codigo,
        };
      });
      await api.createInsumosInstaladoresBatch(batchCabecera, processedLineas);
      setShowBatchModal(false);
      setBatchLineas([{ codigo: '', insumo: '', check: false, cantidad: 1 }]);
      fetchItems();
      alert(`Lote de ${processedLineas.length} insumos entregados a instalador registrado.`);
    } catch (err) {
      alert('Error en lote: ' + err.message);
    } finally {
      setSavingBatch(false);
    }
  };

  // Edit Submit
  const handleUpdateSubmit = async (e) => {
    e.preventDefault();
    if (!editingItem) return;
    setSavingEdit(true);
    try {
      await api.updateInsumoInstalador(editingItem._rowNumber, editFormData);
      setEditingItem(null);
      fetchItems();
      alert('Registro actualizado.');
    } catch (err) {
      alert('Error al actualizar: ' + err.message);
    } finally {
      setSavingEdit(false);
    }
  };

  // Clear / Delete
  const handleClear = async (rowNumber) => {
    if (!confirm(`¿Desea limpiar/eliminar el registro de la fila ${rowNumber}?`)) return;
    try {
      await api.clearInsumoInstalador(rowNumber);
      fetchItems();
    } catch (err) {
      alert('Error al eliminar fila: ' + err.message);
    }
  };

  // Filter items
  const filtered = items.filter((it) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (it.codigo || '').toLowerCase().includes(q) ||
      (it.insumo || '').toLowerCase().includes(q) ||
      (it.encargado_instalacion || '').toLowerCase().includes(q) ||
      (it.encargado_bodega || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-100 flex items-center gap-2">
            <span className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Truck className="w-6 h-6" />
            </span>
            Control de Insumos para Instaladores
            <span className="text-xs font-bold bg-amber-500/20 text-amber-300 px-2.5 py-0.5 rounded-full border border-amber-500/30">
              Hoja InsumosInstaladores
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Registro ágil de insumos entregados y devueltos por instaladores con verificación (Check).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowBatchModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold text-xs rounded-xl border border-slate-800 transition cursor-pointer"
          >
            <Layers className="w-4 h-4" />
            <span>Despacho por Lote</span>
          </button>

          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-amber-500/20 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Registrar Entrega</span>
          </button>

          <button
            onClick={fetchItems}
            disabled={loading}
            className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl border border-slate-800 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-2xl flex items-center gap-3 text-xs">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
          <input
            type="text"
            placeholder="Buscar por código, material o encargado de instalación..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
          />
        </div>
        <span className="text-slate-500 font-mono text-[11px] pr-2">
          {filtered.length} {filtered.length === 1 ? 'registro' : 'registros'}
        </span>
      </div>

      {/* Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 text-[10px] uppercase font-bold tracking-wider sticky top-0 border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-4 w-12 text-center">Fila</th>
                <th className="py-2.5 px-4 w-16 text-center">Check</th>
                <th className="py-2.5 px-4">Código (SKU)</th>
                <th className="py-2.5 px-4">Insumo / Material</th>
                <th className="py-2.5 px-4 text-center">Cantidad</th>
                <th className="py-2.5 px-4">Encargado de Instalación</th>
                <th className="py-2.5 px-4">Encargado de Bodega</th>
                <th className="py-2.5 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-amber-500 mb-2" />
                    Cargando insumos de instaladores...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-slate-500">
                    No se encontraron registros de insumos para instaladores.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr
                    key={item._rowNumber}
                    className={`hover:bg-slate-800/30 transition ${
                      item.check ? 'bg-emerald-950/[0.04]' : ''
                    }`}
                  >
                    <td className="py-3 px-4 text-center font-mono text-slate-500 text-[11px]">
                      R{item._rowNumber}
                    </td>

                    {/* Check Toggle */}
                    <td className="py-3 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleCheck(item)}
                        className="text-amber-400 hover:text-amber-300 transition cursor-pointer"
                        title="Marcar o desmarcar entrega/reingreso"
                      >
                        {item.check ? (
                          <CheckSquare className="w-5 h-5 text-emerald-400" />
                        ) : (
                          <Square className="w-5 h-5 text-slate-600 hover:text-slate-400" />
                        )}
                      </button>
                    </td>

                    {/* Codigo */}
                    <td className="py-3 px-4 font-mono font-bold text-amber-400">
                      {item.codigo}
                    </td>

                    {/* Insumo */}
                    <td className="py-3 px-4 font-semibold text-slate-100">
                      {item.insumo}
                    </td>

                    {/* Cantidad */}
                    <td className="py-3 px-4 text-center font-mono font-bold text-slate-200">
                      {item.cantidad}
                    </td>

                    {/* Encargado Instalacion */}
                    <td className="py-3 px-4 text-slate-300">
                      <span className="inline-flex items-center gap-1.5 font-medium">
                        <User className="w-3.5 h-3.5 text-amber-400" />
                        {item.encargado_instalacion || 'Sin asignar'}
                      </span>
                    </td>

                    {/* Encargado Bodega */}
                    <td className="py-3 px-4 text-slate-400">
                      {item.encargado_bodega || 'Bodega Central'}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => {
                            setEditingItem(item);
                            setEditFormData({ ...item });
                          }}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
                          title="Editar fila"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleClear(item._rowNumber)}
                          className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition cursor-pointer"
                          title="Limpiar fila"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Single Create */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Registrar Entrega de Insumo a Instalador"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-400 font-semibold mb-1">Código / SKU del Insumo</label>
            <SearchableSkuSelect
              items={catalogoItems}
              value={formData.codigo}
              onChange={(sku) => {
                const found = catalogoItems.find((c) => c.sku === sku);
                setFormData({
                  ...formData,
                  codigo: sku,
                  insumo: found ? found.descripcion : formData.insumo,
                });
              }}
              required
            />
          </div>

          <div>
            <label className="block text-slate-400 font-semibold mb-1">Nombre del Insumo / Material</label>
            <input
              type="text"
              required
              value={formData.insumo}
              onChange={(e) => setFormData({ ...formData, insumo: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Cantidad</label>
              <input
                type="number"
                min="0.1"
                step="any"
                required
                value={formData.cantidad}
                onChange={(e) => setFormData({ ...formData, cantidad: Number(e.target.value) })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 font-mono font-bold text-slate-100"
              />
            </div>
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Estado Check</label>
              <select
                value={formData.check ? 'SI' : 'NO'}
                onChange={(e) => setFormData({ ...formData, check: e.target.value === 'SI' })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 cursor-pointer"
              >
                <option value="NO">Pendiente (FALSE)</option>
                <option value="SI">Verificado / Entregado (TRUE)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-slate-400 font-semibold mb-1">Encargado de Instalación</label>
            <input
              type="text"
              required
              placeholder="Nombre del instalador"
              value={formData.encargado_instalacion}
              onChange={(e) => setFormData({ ...formData, encargado_instalacion: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-slate-400 font-semibold mb-1">Encargado de Bodega</label>
            <input
              type="text"
              required
              value={formData.encargado_bodega}
              onChange={(e) => setFormData({ ...formData, encargado_bodega: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-bold shadow-lg shadow-amber-500/20 cursor-pointer"
            >
              {saving ? 'Guardando...' : 'Guardar en Sheets'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Batch / Lote Create */}
      <Modal
        isOpen={showBatchModal}
        onClose={() => setShowBatchModal(false)}
        title="Despacho por Lote a Instalador"
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleBatchSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3 p-3 bg-slate-950 rounded-xl border border-slate-800">
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Encargado de Instalación</label>
              <input
                type="text"
                required
                placeholder="Nombre del instalador responsable"
                value={batchCabecera.encargado_instalacion}
                onChange={(e) => setBatchCabecera({ ...batchCabecera, encargado_instalacion: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100"
              />
            </div>
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Encargado de Bodega</label>
              <input
                type="text"
                required
                value={batchCabecera.encargado_bodega}
                onChange={(e) => setBatchCabecera({ ...batchCabecera, encargado_bodega: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100"
              />
            </div>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            <div className="flex items-center justify-between text-slate-400 font-bold uppercase text-[10px] px-1">
              <span>Líneas de Insumos</span>
              <button
                type="button"
                onClick={() =>
                  setBatchLineas([...batchLineas, { codigo: '', insumo: '', check: false, cantidad: 1 }])
                }
                className="text-amber-400 hover:text-amber-300 font-bold"
              >
                + Añadir Otra Línea
              </button>
            </div>

            {batchLineas.map((linea, index) => (
              <div
                key={index}
                className="grid grid-cols-12 gap-2 items-center p-2 rounded-xl bg-slate-950 border border-slate-800"
              >
                <div className="col-span-4">
                  <select
                    value={linea.codigo}
                    onChange={(e) => {
                      const sku = e.target.value;
                      const cat = catalogoItems.find((c) => c.sku === sku);
                      const copy = [...batchLineas];
                      copy[index] = {
                        ...copy[index],
                        codigo: sku,
                        insumo: cat ? cat.descripcion : copy[index].insumo,
                      };
                      setBatchLineas(copy);
                    }}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-amber-400 font-mono text-xs"
                    required
                  >
                    <option value="">-- SKU --</option>
                    {catalogoItems.map((c) => (
                      <option key={c.sku} value={c.sku}>
                        {c.sku} — {c.descripcion}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-span-5">
                  <input
                    type="text"
                    placeholder="Material..."
                    value={linea.insumo}
                    onChange={(e) => {
                      const copy = [...batchLineas];
                      copy[index].insumo = e.target.value;
                      setBatchLineas(copy);
                    }}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-100 text-xs"
                    required
                  />
                </div>

                <div className="col-span-2">
                  <input
                    type="number"
                    min="0.1"
                    step="any"
                    placeholder="Cant"
                    value={linea.cantidad}
                    onChange={(e) => {
                      const copy = [...batchLineas];
                      copy[index].cantidad = Number(e.target.value);
                      setBatchLineas(copy);
                    }}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-center font-mono font-bold text-slate-100 text-xs"
                    required
                  />
                </div>

                <div className="col-span-1 text-center">
                  {batchLineas.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setBatchLineas(batchLineas.filter((_, i) => i !== index))}
                      className="text-rose-400 hover:text-rose-300 font-bold"
                    >
                      &times;
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowBatchModal(false)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={savingBatch}
              className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-bold shadow-lg shadow-amber-500/20 cursor-pointer"
            >
              {savingBatch ? 'Registrando Lote...' : `Registrar Lote (${batchLineas.length} líneas)`}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Edit Single */}
      <Modal
        isOpen={Boolean(editingItem)}
        onClose={() => setEditingItem(null)}
        title={`Editar Fila ${editingItem?._rowNumber} (${editingItem?.codigo})`}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleUpdateSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-400 font-semibold mb-1">Código</label>
            <input
              type="text"
              required
              value={editFormData.codigo || ''}
              onChange={(e) => setEditFormData({ ...editFormData, codigo: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-amber-400 font-mono font-bold"
            />
          </div>

          <div>
            <label className="block text-slate-400 font-semibold mb-1">Insumo</label>
            <input
              type="text"
              required
              value={editFormData.insumo || ''}
              onChange={(e) => setEditFormData({ ...editFormData, insumo: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Cantidad</label>
              <input
                type="number"
                step="any"
                required
                value={editFormData.cantidad ?? 1}
                onChange={(e) => setEditFormData({ ...editFormData, cantidad: Number(e.target.value) })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-mono font-bold"
              />
            </div>
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Check</label>
              <select
                value={editFormData.check ? 'SI' : 'NO'}
                onChange={(e) => setEditFormData({ ...editFormData, check: e.target.value === 'SI' })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 cursor-pointer"
              >
                <option value="NO">Pendiente (FALSE)</option>
                <option value="SI">Verificado (TRUE)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-slate-400 font-semibold mb-1">Encargado de Instalación</label>
            <input
              type="text"
              required
              value={editFormData.encargado_instalacion || ''}
              onChange={(e) => setEditFormData({ ...editFormData, encargado_instalacion: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
            />
          </div>

          <div>
            <label className="block text-slate-400 font-semibold mb-1">Encargado de Bodega</label>
            <input
              type="text"
              required
              value={editFormData.encargado_bodega || ''}
              onChange={(e) => setEditFormData({ ...editFormData, encargado_bodega: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
            />
          </div>

          <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setEditingItem(null)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={savingEdit}
              className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-bold shadow-lg shadow-amber-500/20 cursor-pointer"
            >
              {savingEdit ? 'Actualizando...' : 'Actualizar Fila'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default InstaladoresView;

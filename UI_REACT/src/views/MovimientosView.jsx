import React, { useState, useEffect } from 'react';
import {
  ArrowLeftRight,
  Plus,
  DoorOpen,
  Search,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  User,
  Calendar,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { api } from '../services/api';
import { Badge } from '../components/Badge';
import { Modal } from '../components/Modal';

export function MovimientosView() {
  const [loading, setLoading] = useState(true);
  const [movimientos, setMovimientos] = useState([]);
  const [search, setSearch] = useState('');
  const [catalogoItems, setCatalogoItems] = useState([]);
  const [puertas, setPuertas] = useState([]);

  // Modal Normal Movement
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    fecha: new Date().toISOString().split('T')[0],
    tipo: 'Salida',
    sku: '',
    cantidad: 1,
    taller_destino: 'Taller 1',
    entregado_a: '',
    observaciones: '',
  });

  // Modal Entregar a Puerta
  const [showPuertaModal, setShowPuertaModal] = useState(false);
  const [savingPuerta, setSavingPuerta] = useState(false);
  const [puertaFormData, setPuertaFormData] = useState({
    sku_puerta: '',
    sku: '',
    cantidad: 1,
    entregado_a: '',
    observaciones: '',
  });

  const fetchMovimientos = async () => {
    setLoading(true);
    try {
      const res = await api.getMovimientos({ pageSize: 120 });
      setMovimientos(res.rows || []);
      const catRes = await api.getCatalogo({ pageSize: 150 });
      setCatalogoItems(catRes.rows || []);
      const pRes = await api.getPuertas({ pageSize: 50 });
      setPuertas(pRes.rows || []);
    } catch (err) {
      console.error('Error al cargar movimientos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMovimientos();
  }, []);

  const handleCreateMovimiento = async (e) => {
    e.preventDefault();
    if (!formData.sku) {
      alert('Seleccione un SKU válido.');
      return;
    }
    setSaving(true);
    try {
      await api.createMovimiento(formData);
      setShowModal(false);
      setFormData({
        fecha: new Date().toISOString().split('T')[0],
        tipo: 'Salida',
        sku: '',
        cantidad: 1,
        taller_destino: 'Taller 1',
        entregado_a: '',
        observaciones: '',
      });
      fetchMovimientos();
    } catch (err) {
      alert('Error al registrar movimiento: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEntregarPuerta = async (e) => {
    e.preventDefault();
    if (!puertaFormData.sku_puerta || !puertaFormData.sku) {
      alert('Seleccione tanto la puerta como el SKU.');
      return;
    }
    setSavingPuerta(true);
    try {
      await api.entregarAPuerta(puertaFormData);
      alert('¡Insumo entregado y descontado para la puerta de producción!');
      setShowPuertaModal(false);
      setPuertaFormData({
        sku_puerta: '',
        sku: '',
        cantidad: 1,
        entregado_a: '',
        observaciones: '',
      });
      fetchMovimientos();
    } catch (err) {
      alert('Error al entregar insumo a puerta: ' + err.message);
    } finally {
      setSavingPuerta(false);
    }
  };

  const filteredMovs = movimientos.filter((m) => {
    const s = search.toLowerCase();
    return (
      (m.id || '').toLowerCase().includes(s) ||
      (m.sku || '').toLowerCase().includes(s) ||
      (m.descripcion || '').toLowerCase().includes(s) ||
      (m.entregado_a || '').toLowerCase().includes(s) ||
      (m.taller_destino || '').toLowerCase().includes(s)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-100 flex items-center gap-2">
              <ArrowLeftRight className="w-6 h-6 text-amber-500" />
              Movimientos Operativos de Insumos
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Salidas a talleres, devoluciones y asignación directa a puertas en producción
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowPuertaModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold text-xs rounded-xl border border-amber-500/30 shadow-md transition-all cursor-pointer"
            >
              <DoorOpen className="w-4 h-4" />
              Entregar a Puerta
            </button>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Registrar Movimiento
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="mt-6 max-w-md relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por ID, SKU, insumo o persona..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-800/80 border border-slate-700 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-100 placeholder-slate-400 focus:outline-hidden focus:border-amber-500"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 uppercase font-bold tracking-wider">
                <th className="py-3.5 px-4">ID</th>
                <th className="py-3.5 px-4">Fecha</th>
                <th className="py-3.5 px-3">Tipo</th>
                <th className="py-3.5 px-3">SKU</th>
                <th className="py-3.5 px-4">Descripción</th>
                <th className="py-3.5 px-3 text-right">Cantidad</th>
                <th className="py-3.5 px-4">Taller / Destino</th>
                <th className="py-3.5 px-4">Entregado a</th>
                <th className="py-3.5 px-3 text-right">Costo Est. $</th>
                <th className="py-3.5 px-4">Observaciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {loading ? (
                <tr>
                  <td colSpan="10" className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-amber-500 mb-2" />
                    Cargando movimientos...
                  </td>
                </tr>
              ) : filteredMovs.length === 0 ? (
                <tr>
                  <td colSpan="10" className="py-12 text-center text-slate-500">
                    No se encontraron movimientos registrados.
                  </td>
                </tr>
              ) : (
                filteredMovs.map((m, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/50 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-300">
                      {m.id || `MOV-${String(idx + 1).padStart(4, '0')}`}
                    </td>
                    <td className="py-3 px-4 text-slate-300 font-mono whitespace-nowrap">
                      {m.fecha}
                    </td>
                    <td className="py-3 px-3">
                      <Badge
                        variant={
                          m.tipo === 'Salida'
                            ? 'warning'
                            : m.tipo === 'Devolución'
                            ? 'success'
                            : 'info'
                        }
                      >
                        {m.tipo}
                      </Badge>
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-amber-400">
                      {m.sku}
                    </td>
                    <td className="py-3 px-4 text-slate-200 max-w-xs truncate" title={m.descripcion}>
                      {m.descripcion || '-'}
                    </td>
                    <td className="py-3 px-3 text-right font-black text-slate-100 font-mono">
                      {m.tipo === 'Salida' ? `-${m.cantidad}` : `+${m.cantidad}`}
                    </td>
                    <td className="py-3 px-4 text-slate-300">
                      {m.taller_destino}
                    </td>
                    <td className="py-3 px-4 text-slate-300 font-semibold">
                      {m.entregado_a || '-'}
                    </td>
                    <td className="py-3 px-3 text-right text-slate-400 font-mono">
                      ${Number(m.costo_estimado || 0).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-slate-400 truncate max-w-xs" title={m.observaciones}>
                      {m.observaciones || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Registrar Movimiento */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Registrar Movimiento de Insumo"
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleCreateMovimiento} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Fecha
              </label>
              <input
                type="date"
                required
                value={formData.fecha}
                onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-hidden focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Tipo de Movimiento
              </label>
              <select
                value={formData.tipo}
                onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-hidden focus:border-amber-500"
              >
                <option value="Salida">Salida (Entrega a Taller)</option>
                <option value="Devolución">Devolución (Reingreso a Bodega)</option>
                <option value="Ajuste (+)">Ajuste (+) Sobrante</option>
                <option value="Ajuste (-)">Ajuste (-) Merma/Pérdida</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              SKU del Insumo
            </label>
            <select
              required
              value={formData.sku}
              onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-hidden focus:border-amber-500 font-mono"
            >
              <option value="">-- Seleccionar Insumo --</option>
              {catalogoItems.map((item) => (
                <option key={item.sku} value={item.sku}>
                  {item.sku} — {item.descripcion} (Stock: {item.stock_actual ?? 0})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Cantidad
              </label>
              <input
                type="number"
                min="0.1"
                step="any"
                required
                value={formData.cantidad}
                onChange={(e) => setFormData({ ...formData, cantidad: Number(e.target.value) })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-hidden focus:border-amber-500 font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Taller / Destino
              </label>
              <select
                value={formData.taller_destino}
                onChange={(e) => setFormData({ ...formData, taller_destino: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-hidden focus:border-amber-500"
              >
                <option value="Taller 1">Taller 1</option>
                <option value="Taller 2">Taller 2</option>
                <option value="Taller 3">Taller 3</option>
                <option value="Pintura">Área de Pintura</option>
                <option value="Armado">Área de Armado</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Entregado a (Persona Responsable)
            </label>
            <input
              type="text"
              required
              placeholder="Nombre del operario o encargado"
              value={formData.entregado_a}
              onChange={(e) => setFormData({ ...formData, entregado_a: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-hidden focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Observaciones
            </label>
            <input
              type="text"
              placeholder="Opcional: detalles del uso"
              value={formData.observaciones}
              onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-hidden focus:border-amber-500"
            />
          </div>

          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-amber-500/20 cursor-pointer"
            >
              {saving ? 'Guardando...' : 'Guardar Salida'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Entregar a Puerta */}
      <Modal
        isOpen={showPuertaModal}
        onClose={() => setShowPuertaModal(false)}
        title="Entregar Insumo Vinculado a Puerta de Producción"
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleEntregarPuerta} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Seleccionar Puerta de Agenda
            </label>
            <select
              required
              value={puertaFormData.sku_puerta}
              onChange={(e) => setPuertaFormData({ ...puertaFormData, sku_puerta: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-hidden focus:border-amber-500 font-mono"
            >
              <option value="">-- Seleccionar Puerta --</option>
              {puertas.map((p) => (
                <option key={p.sku_puerta} value={p.sku_puerta}>
                  {p.sku_puerta} — {p.cliente} ({p.modelo} · {p.taller})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              SKU del Insumo a Entregar
            </label>
            <select
              required
              value={puertaFormData.sku}
              onChange={(e) => setPuertaFormData({ ...puertaFormData, sku: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-hidden focus:border-amber-500 font-mono"
            >
              <option value="">-- Seleccionar Insumo --</option>
              {catalogoItems.map((item) => (
                <option key={item.sku} value={item.sku}>
                  {item.sku} — {item.descripcion} (Stock: {item.stock_actual ?? 0})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Cantidad a Despachar
              </label>
              <input
                type="number"
                min="0.1"
                step="any"
                required
                value={puertaFormData.cantidad}
                onChange={(e) => setPuertaFormData({ ...puertaFormData, cantidad: Number(e.target.value) })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-hidden focus:border-amber-500 font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Entregado a (Carpintero / Armador)
              </label>
              <input
                type="text"
                required
                placeholder="Nombre del operario"
                value={puertaFormData.entregado_a}
                onChange={(e) => setPuertaFormData({ ...puertaFormData, entregado_a: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-hidden focus:border-amber-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Observaciones Técnicas
            </label>
            <input
              type="text"
              placeholder="Ej: Para ensamble de marco o chambrana"
              value={puertaFormData.observaciones}
              onChange={(e) => setPuertaFormData({ ...puertaFormData, observaciones: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-hidden focus:border-amber-500"
            />
          </div>

          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setShowPuertaModal(false)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={savingPuerta}
              className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-amber-500/20 cursor-pointer"
            >
              {savingPuerta ? 'Despachando...' : 'Confirmar Entrega a Puerta'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

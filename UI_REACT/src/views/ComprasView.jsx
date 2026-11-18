import React, { useState, useEffect } from 'react';
import {
  ShoppingCart,
  Plus,
  FileCode,
  Search,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Building,
  Calendar,
  DollarSign,
  Upload,
  ArrowRight,
  Edit2,
  Trash2,
} from 'lucide-react';
import { api } from '../services/api';
import { Badge } from '../components/Badge';
import { Modal } from '../components/Modal';
import SearchableSkuSelect from '../components/SearchableSkuSelect';
import { TALLERES, PROVEEDORES } from '../config/constants';

export function ComprasView() {
  const [loading, setLoading] = useState(true);
  const [compras, setCompras] = useState([]);
  const [search, setSearch] = useState('');
  const [catalogoItems, setCatalogoItems] = useState([]);

  // Modal Nueva Compra
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    fecha: new Date().toISOString().split('T')[0],
    proveedor: '',
    sku: '',
    cant_pedida: 1,
    cant_recibida: 1,
    precio_unit_pagado: 0,
    taller_destino: 'Santa Ana',
    tipo_dte: 'CCF',
    n_dte: '',
    observaciones: '',
  });

  // Modal Editar Compra
  const [editingCompra, setEditingCompra] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [savingEdit, setSavingEdit] = useState(false);

  // Modal DTE Import
  const [showDteModal, setShowDteModal] = useState(false);
  const [dteJsonText, setDteJsonText] = useState('');
  const [dteParsed, setDteParsed] = useState(null);
  const [dteError, setDteError] = useState(null);
  const [importingDte, setImportingDte] = useState(false);
  const [selectedSkuForDte, setSelectedSkuForDte] = useState('');
  const [dteTaller, setDteTaller] = useState('Santa Ana');

  const fetchCompras = async () => {
    setLoading(true);
    try {
      const res = await api.getCompras({ pageSize: 100 });
      setCompras(res.rows || []);
      const catRes = await api.getCatalogo({ pageSize: 150 });
      setCatalogoItems(catRes.rows || []);
    } catch (err) {
      console.error('Error al cargar compras:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompras();
  }, []);

  const handleCreateCompra = async (e) => {
    e.preventDefault();
    if (!formData.sku) {
      alert('Seleccione un SKU válido.');
      return;
    }
    setSaving(true);
    try {
      await api.createCompra(formData);
      setShowModal(false);
      setFormData({
        fecha: new Date().toISOString().split('T')[0],
        proveedor: '',
        sku: '',
        cant_pedida: 1,
        cant_recibida: 1,
        precio_unit_pagado: 0,
        taller_destino: 'Santa Ana',
        tipo_dte: 'CCF',
        n_dte: '',
        observaciones: '',
      });
      fetchCompras();
    } catch (err) {
      alert('Error al registrar compra: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const openEditModal = (compra) => {
    setEditingCompra(compra);
    setEditFormData({
      fecha: compra.fecha || new Date().toISOString().split('T')[0],
      proveedor: compra.proveedor || '',
      sku: compra.sku || '',
      cant_recibida: compra.cant_recibida ?? 1,
      precio_unit_pagado: compra.precio_unit_pagado ?? 0,
      taller_destino: compra.taller_destino || 'Taller 1',
      tipo_dte: compra.tipo_dte || 'CCF',
      n_dte: compra.n_dte || '',
      observaciones: compra.observaciones || '',
    });
  };

  const handleUpdateCompra = async (e) => {
    e.preventDefault();
    if (!editingCompra?._rowNumber) return;
    setSavingEdit(true);
    try {
      await api.updateCompra(editingCompra._rowNumber, editFormData);
      setEditingCompra(null);
      fetchCompras();
    } catch (err) {
      alert('Error al actualizar compra: ' + err.message);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteCompra = async (compra) => {
    if (!compra._rowNumber) return;
    if (
      !window.confirm(
        `¿Está seguro de eliminar/anular la compra de ${compra.proveedor} (${compra.sku}) en la fila ${compra._rowNumber}?`
      )
    ) {
      return;
    }
    try {
      await api.clearCompra(compra._rowNumber);
      alert('Fila de compra limpiada en Sheets.');
      fetchCompras();
    } catch (err) {
      alert('Error al eliminar compra: ' + err.message);
    }
  };

  const handleParseDte = () => {
    setDteError(null);
    try {
      const parsed = JSON.parse(dteJsonText.trim());
      setDteParsed(parsed);
    } catch (e) {
      setDteError('El texto pegado no es un JSON válido de DTE.');
      setDteParsed(null);
    }
  };

  const handleImportDte = async () => {
    if (!dteParsed) return;
    setImportingDte(true);
    try {
      await api.importDte(dteParsed, selectedSkuForDte, dteTaller);
      alert('¡DTE importado con éxito en hoja Compras!');
      setShowDteModal(false);
      setDteJsonText('');
      setDteParsed(null);
      fetchCompras();
    } catch (err) {
      alert('Error al importar DTE: ' + err.message);
    } finally {
      setImportingDte(false);
    }
  };

  const filteredCompras = compras.filter((c) => {
    const s = search.toLowerCase();
    return (
      (c.sku || '').toLowerCase().includes(s) ||
      (c.proveedor || '').toLowerCase().includes(s) ||
      (c.n_dte || '').toLowerCase().includes(s) ||
      (c.descripcion || '').toLowerCase().includes(s)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-100 flex items-center gap-2">
              <ShoppingCart className="w-6 h-6 text-sky-400" />
              Gestión de Compras & DTE El Salvador
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              CRUD Completo: Crear, Editar, Anular/Eliminar · Cálculo de IVA Crédito Fiscal 13% en CCF
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowDteModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-sky-400 font-bold text-xs rounded-xl border border-sky-500/30 shadow-md transition-all cursor-pointer"
            >
              <FileCode className="w-4 h-4" />
              Importar DTE JSON
            </button>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-400 hover:to-sky-500 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-sky-500/20 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Nueva Compra
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="mt-6 max-w-md relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por SKU, proveedor o N.° DTE..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-800/80 border border-slate-700 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-100 placeholder-slate-400 focus:outline-hidden focus:border-sky-500"
          />
        </div>
      </div>

      {/* Table with Actions */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 uppercase font-bold tracking-wider">
                <th className="py-3.5 px-3">Fila</th>
                <th className="py-3.5 px-4">Fecha</th>
                <th className="py-3.5 px-4">Proveedor</th>
                <th className="py-3.5 px-3">SKU</th>
                <th className="py-3.5 px-4">Descripción</th>
                <th className="py-3.5 px-3 text-right">Cant. Recibida</th>
                <th className="py-3.5 px-3 text-right">P. Unit $</th>
                <th className="py-3.5 px-3 text-right">Total $</th>
                <th className="py-3.5 px-3 text-right text-emerald-400">IVA Crédito $</th>
                <th className="py-3.5 px-3 text-center">Tipo DTE</th>
                <th className="py-3.5 px-3">N.° DTE / Factura</th>
                <th className="py-3.5 px-3 text-center">Taller</th>
                <th className="py-3.5 px-4 text-center">Acciones CRUD</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {loading ? (
                <tr>
                  <td colSpan="13" className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-sky-400 mb-2" />
                    Cargando compras desde Google Sheets...
                  </td>
                </tr>
              ) : filteredCompras.length === 0 ? (
                <tr>
                  <td colSpan="13" className="py-12 text-center text-slate-500">
                    No hay compras registradas en este período.
                  </td>
                </tr>
              ) : (
                filteredCompras.map((compra, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/50 transition-colors">
                    <td className="py-3 px-3 font-mono text-slate-500">
                      R{compra._rowNumber || idx + 2}
                    </td>
                    <td className="py-3 px-4 text-slate-300 font-mono whitespace-nowrap">
                      {compra.fecha}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-200">
                      {compra.proveedor}
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-amber-400">
                      {compra.sku}
                    </td>
                    <td className="py-3 px-4 text-slate-300 max-w-xs truncate" title={compra.descripcion}>
                      {compra.descripcion || '-'}
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-slate-100 font-mono">
                      {compra.cant_recibida}
                    </td>
                    <td className="py-3 px-3 text-right text-slate-300 font-mono">
                      ${Number(compra.precio_unit_pagado || 0).toFixed(2)}
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-slate-100 font-mono">
                      ${Number(compra.total_pagado || (compra.cant_recibida * compra.precio_unit_pagado) || 0).toFixed(2)}
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-emerald-400 font-mono">
                      ${Number(compra.iva_credito || (compra.tipo_dte === 'CCF' ? compra.total_pagado * (0.13 / 1.13) : 0)).toFixed(2)}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <Badge variant={compra.tipo_dte === 'CCF' ? 'success' : 'default'}>
                        {compra.tipo_dte || 'CCF'}
                      </Badge>
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-400">
                      {compra.n_dte || '-'}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <Badge variant="info">{compra.taller_destino || 'Taller 1'}</Badge>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {/* Edit button */}
                        <button
                          onClick={() => openEditModal(compra)}
                          className="p-1.5 text-sky-400 hover:text-sky-300 bg-sky-500/10 hover:bg-sky-500/20 rounded-lg transition-colors cursor-pointer border border-sky-500/20"
                          title="Editar compra"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {/* Delete button */}
                        <button
                          onClick={() => handleDeleteCompra(compra)}
                          className="p-1.5 text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 rounded-lg transition-colors cursor-pointer border border-rose-500/20"
                          title="Eliminar / Limpiar fila"
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

      {/* Modal Nueva Compra */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Registrar Compra en Hoja Compras"
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleCreateCompra} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Fecha de Recepción
              </label>
              <input
                type="date"
                required
                value={formData.fecha}
                onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-hidden focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Proveedor
              </label>
              <input
                type="text"
                required
                list="proveedores_list"
                placeholder="Seleccionar o escribir proveedor"
                value={formData.proveedor}
                onChange={(e) => setFormData({ ...formData, proveedor: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-hidden focus:border-sky-500"
              />
              <datalist id="proveedores_list">
                {PROVEEDORES.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                SKU del Catálogo (Búsqueda en tiempo real)
              </label>
              <SearchableSkuSelect
                items={catalogoItems}
                value={formData.sku}
                onChange={(sku) => setFormData({ ...formData, sku })}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Taller Destino
              </label>
              <select
                value={formData.taller_destino}
                onChange={(e) => setFormData({ ...formData, taller_destino: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-hidden focus:border-sky-500"
              >
                {TALLERES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Cant. Pedida
              </label>
              <input
                type="number"
                min="1"
                value={formData.cant_pedida}
                onChange={(e) => setFormData({ ...formData, cant_pedida: Number(e.target.value) })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-hidden focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Cant. Recibida
              </label>
              <input
                type="number"
                min="1"
                required
                value={formData.cant_recibida}
                onChange={(e) => setFormData({ ...formData, cant_recibida: Number(e.target.value) })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-hidden focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Precio Unit. Pagado $
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={formData.precio_unit_pagado}
                onChange={(e) => setFormData({ ...formData, precio_unit_pagado: Number(e.target.value) })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-hidden focus:border-sky-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Tipo de DTE
              </label>
              <select
                value={formData.tipo_dte}
                onChange={(e) => setFormData({ ...formData, tipo_dte: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-hidden focus:border-sky-500"
              >
                <option value="CCF">CCF — Crédito Fiscal (13% IVA deducible)</option>
                <option value="Factura">Factura (Consumidor Final)</option>
                <option value="Sujeto Excluido">Sujeto Excluido</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                N.° DTE / Factura / Resolución
              </label>
              <input
                type="text"
                placeholder="Ej: DTE-03-M001P001-0000000123"
                value={formData.n_dte}
                onChange={(e) => setFormData({ ...formData, n_dte: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-hidden focus:border-sky-500"
              />
            </div>
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
              className="px-5 py-2 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-sky-500/20 cursor-pointer"
            >
              {saving ? 'Guardando en Sheets...' : 'Guardar Compra'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Editar Compra (Update) */}
      <Modal
        isOpen={Boolean(editingCompra)}
        onClose={() => setEditingCompra(null)}
        title={`Editar Compra — Fila ${editingCompra?._rowNumber} (${editingCompra?.sku})`}
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleUpdateCompra} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Fecha
              </label>
              <input
                type="date"
                required
                value={editFormData.fecha || ''}
                onChange={(e) => setEditFormData({ ...editFormData, fecha: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-hidden focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Proveedor
              </label>
              <input
                type="text"
                required
                value={editFormData.proveedor || ''}
                onChange={(e) => setEditFormData({ ...editFormData, proveedor: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-hidden focus:border-sky-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                SKU (Buscador rápido)
              </label>
              <SearchableSkuSelect
                items={catalogoItems}
                value={editFormData.sku}
                onChange={(sku) => setEditFormData({ ...editFormData, sku })}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Taller Destino
              </label>
              <select
                value={editFormData.taller_destino || 'Santa Ana'}
                onChange={(e) => setEditFormData({ ...editFormData, taller_destino: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-hidden focus:border-sky-500"
              >
                {TALLERES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Cant. Recibida
              </label>
              <input
                type="number"
                min="1"
                required
                value={editFormData.cant_recibida ?? 1}
                onChange={(e) => setEditFormData({ ...editFormData, cant_recibida: Number(e.target.value) })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-hidden focus:border-sky-500 font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Precio Unit. Pagado $
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={editFormData.precio_unit_pagado ?? 0}
                onChange={(e) => setEditFormData({ ...editFormData, precio_unit_pagado: Number(e.target.value) })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-hidden focus:border-sky-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Tipo DTE
              </label>
              <select
                value={editFormData.tipo_dte || 'CCF'}
                onChange={(e) => setEditFormData({ ...editFormData, tipo_dte: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-hidden focus:border-sky-500"
              >
                <option value="CCF">CCF — Crédito Fiscal (13% IVA)</option>
                <option value="Factura">Factura</option>
                <option value="Sujeto Excluido">Sujeto Excluido</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                N.° DTE / Factura
              </label>
              <input
                type="text"
                value={editFormData.n_dte || ''}
                onChange={(e) => setEditFormData({ ...editFormData, n_dte: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-hidden focus:border-sky-500"
              />
            </div>
          </div>

          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setEditingCompra(null)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={savingEdit}
              className="px-5 py-2 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-sky-500/20 cursor-pointer"
            >
              {savingEdit ? 'Actualizando...' : 'Actualizar Compra en Sheets'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Importar DTE JSON */}
      <Modal
        isOpen={showDteModal}
        onClose={() => setShowDteModal(false)}
        title="Importador Inteligente de Factura Electrónica (DTE El Salvador)"
        maxWidth="max-w-3xl"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-400">
            Pega el JSON oficial emitido por el Ministerio de Hacienda (tipo 03 CCF, 01 Factura, 14 Sujeto Excluido). El sistema extraerá automáticamente el emisor, los ítems y los precios para insertarlos en Compras.
          </p>

          <div>
            <textarea
              rows="6"
              placeholder='Pega aquí el contenido JSON del DTE... Ej: { "identificacion": { "tipoDte": "03", "codigoGeneracion": "..." }, "emisor": { ... }, "cuerpoDocumento": [ ... ] }'
              value={dteJsonText}
              onChange={(e) => setDteJsonText(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-hidden focus:border-sky-500"
            />
          </div>

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={handleParseDte}
              className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-sky-400 text-xs font-bold rounded-lg border border-sky-500/30 cursor-pointer"
            >
              Procesar y Verificar JSON
            </button>
            {dteError && (
              <span className="text-xs text-rose-400 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> {dteError}
              </span>
            )}
          </div>

          {dteParsed && (
            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div>
                  <span className="text-slate-500 block">Tipo DTE:</span>
                  <span className="font-bold text-amber-400">
                    {dteParsed.identificacion?.tipoDte === '03'
                      ? '03 (CCF)'
                      : dteParsed.identificacion?.tipoDte === '01'
                      ? '01 (Factura)'
                      : dteParsed.identificacion?.tipoDte || 'DTE'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Emisor / Proveedor:</span>
                  <span className="font-bold text-slate-200 truncate block">
                    {dteParsed.emisor?.nombre || 'Proveedor DTE'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Fecha Emisión:</span>
                  <span className="font-bold text-slate-200 font-mono">
                    {dteParsed.identificacion?.fecEmi || 'Hoy'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Ítems encontrados:</span>
                  <span className="font-bold text-emerald-400">
                    {dteParsed.cuerpoDocumento?.length || 0} artículo(s)
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-800/80">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Asignar SKU de Catálogo por Defecto (Opcional):
                  </label>
                  <SearchableSkuSelect
                    items={catalogoItems}
                    value={selectedSkuForDte}
                    onChange={(sku) => setSelectedSkuForDte(sku)}
                    placeholder="Mapear automáticamente o buscar SKU..."
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Taller de Destino:
                  </label>
                  <select
                    value={dteTaller}
                    onChange={(e) => setDteTaller(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100"
                  >
                    {TALLERES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-3 flex justify-end">
                <button
                  type="button"
                  onClick={handleImportDte}
                  disabled={importingDte}
                  className="flex items-center gap-2 px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/20 cursor-pointer"
                >
                  {importingDte ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" /> Guardando en Compras...
                    </>
                  ) : (
                    'Confirmar e Importar al Sistema'
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

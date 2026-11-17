import React, { useState, useEffect } from 'react';
import {
  DoorOpen,
  Plus,
  Search,
  CheckCircle,
  Clock,
  Calendar,
  Building,
  RefreshCw,
  Edit2,
} from 'lucide-react';
import { api } from '../services/api';
import { Badge } from '../components/Badge';
import { Modal } from '../components/Modal';

export function PuertasView() {
  const [loading, setLoading] = useState(true);
  const [puertas, setPuertas] = useState([]);
  const [search, setSearch] = useState('');

  // Modal Nueva Puerta (Create)
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    sku_puerta: '',
    dia_entrega: new Date().toISOString().split('T')[0],
    cliente: '',
    modelo: 'Puerta Principal Enchapada',
    posicion: 'Izquierda',
    unidades: 1,
    estado: 'En Proceso',
    medidas: '0.90 x 2.10 m',
    color: 'Nogal',
    vidrio: 'No',
    cerradura: 'Pomo',
    haladera: 'Acero Inox',
    chambrana: 'Simple',
    notas_tecnicas: '',
    taller: 'Taller 1',
  });

  // Modal Editar Puerta (Update)
  const [editingPuerta, setEditingPuerta] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [savingEdit, setSavingEdit] = useState(false);

  const fetchPuertas = async () => {
    setLoading(true);
    try {
      const res = await api.getPuertas({ pageSize: 50 });
      setPuertas(res.rows || []);
    } catch (err) {
      console.error('Error al cargar puertas:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPuertas();
  }, []);

  const handleCreatePuerta = async (e) => {
    e.preventDefault();
    if (!formData.sku_puerta) {
      alert('Debe ingresar un código SKU para la puerta.');
      return;
    }
    setSaving(true);
    try {
      await api.createPuerta(formData);
      setShowModal(false);
      fetchPuertas();
    } catch (err) {
      alert('Error al registrar puerta: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const openEditModal = (p) => {
    setEditingPuerta(p);
    setEditFormData({
      cliente: p.cliente || '',
      modelo: p.modelo || '',
      taller: p.taller || 'Taller 1',
      estado: p.estado || 'En Proceso',
      medidas: p.medidas || '',
      color: p.color || '',
      unidades: p.unidades ?? 1,
      dia_entrega: p.dia_entrega || new Date().toISOString().split('T')[0],
      notas_tecnicas: p.notas_tecnicas || '',
    });
  };

  const handleUpdatePuerta = async (e) => {
    e.preventDefault();
    if (!editingPuerta?.sku_puerta) return;
    setSavingEdit(true);
    try {
      await api.updatePuerta(editingPuerta.sku_puerta, editFormData);
      setEditingPuerta(null);
      fetchPuertas();
    } catch (err) {
      alert('Error al actualizar puerta: ' + err.message);
    } finally {
      setSavingEdit(false);
    }
  };

  const filteredPuertas = puertas.filter((p) => {
    const s = search.toLowerCase();
    return (
      (p.sku_puerta || '').toLowerCase().includes(s) ||
      (p.cliente || '').toLowerCase().includes(s) ||
      (p.modelo || '').toLowerCase().includes(s) ||
      (p.taller || '').toLowerCase().includes(s)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-100 flex items-center gap-2">
              <DoorOpen className="w-6 h-6 text-amber-500" />
              Agenda de Puertas en Producción
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              CRUD Completo: Crear, Editar Estado y Especificaciones de Fabricación por Taller
            </p>
          </div>

          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Nueva Puerta
          </button>
        </div>

        {/* Search */}
        <div className="mt-6 max-w-md relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por código de puerta, cliente o modelo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-800/80 border border-slate-700 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-100 placeholder-slate-400 focus:outline-hidden focus:border-amber-500"
          />
        </div>
      </div>

      {/* Grid of Doors */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-12 text-center text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-amber-500 mb-2" />
            Cargando agenda de puertas...
          </div>
        ) : filteredPuertas.length === 0 ? (
          <div className="col-span-full py-12 text-center text-slate-500">
            No se encontraron puertas en producción con los filtros indicados.
          </div>
        ) : (
          filteredPuertas.map((p, idx) => {
            const isDone = (p.estado || '').toLowerCase().includes('terminad');
            return (
              <div
                key={idx}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl hover:border-slate-700 transition-all flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-mono font-bold text-base text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg">
                      {p.sku_puerta}
                    </span>
                    <div className="flex items-center gap-2">
                      <Badge variant={isDone ? 'success' : 'warning'}>
                        {p.estado || 'En Proceso'}
                      </Badge>
                      <button
                        onClick={() => openEditModal(p)}
                        className="p-1 text-slate-400 hover:text-amber-400 bg-slate-800 hover:bg-slate-700 rounded-md transition-colors cursor-pointer border border-slate-700"
                        title="Editar puerta"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <h3 className="text-sm font-bold text-slate-100 truncate" title={p.cliente}>
                    {p.cliente || 'Cliente sin nombre'}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">{p.modelo}</p>

                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-slate-300">
                    <div className="p-2 bg-slate-800/50 rounded-lg">
                      <span className="text-[10px] text-slate-500 block">Medidas</span>
                      <span className="font-semibold">{p.medidas || 'Estándar'}</span>
                    </div>
                    <div className="p-2 bg-slate-800/50 rounded-lg">
                      <span className="text-[10px] text-slate-500 block">Taller</span>
                      <span className="font-semibold text-sky-400">{p.taller || 'Taller 1'}</span>
                    </div>
                    <div className="p-2 bg-slate-800/50 rounded-lg">
                      <span className="text-[10px] text-slate-500 block">Color / Acabado</span>
                      <span className="font-semibold">{p.color || '-'}</span>
                    </div>
                    <div className="p-2 bg-slate-800/50 rounded-lg">
                      <span className="text-[10px] text-slate-500 block">Entrega</span>
                      <span className="font-semibold font-mono">{p.dia_entrega || '-'}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                  <span>Cant: <strong className="text-slate-100">{p.unidades || 1}</strong> unid.</span>
                  <span className="text-amber-400/90 font-mono text-[11px] truncate max-w-[150px]">
                    {p.notas_tecnicas || 'Sin notas'}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal Nueva Puerta (Create) */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Crear Nueva Puerta en Agenda de Producción"
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleCreatePuerta} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                SKU Puerta
              </label>
              <input
                type="text"
                required
                placeholder="Ej: PTA-005"
                value={formData.sku_puerta}
                onChange={(e) => setFormData({ ...formData, sku_puerta: e.target.value.toUpperCase() })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold text-amber-400 focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Cliente
              </label>
              <input
                type="text"
                required
                placeholder="Nombre del cliente o proyecto"
                value={formData.cliente}
                onChange={(e) => setFormData({ ...formData, cliente: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-hidden"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Modelo
              </label>
              <input
                type="text"
                value={formData.modelo}
                onChange={(e) => setFormData({ ...formData, modelo: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Taller Asignado
              </label>
              <select
                value={formData.taller}
                onChange={(e) => setFormData({ ...formData, taller: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-hidden"
              >
                <option value="Taller 1">Taller 1</option>
                <option value="Taller 2">Taller 2</option>
                <option value="Taller 3">Taller 3</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Medidas
              </label>
              <input
                type="text"
                value={formData.medidas}
                onChange={(e) => setFormData({ ...formData, medidas: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Color
              </label>
              <input
                type="text"
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Día Entrega
              </label>
              <input
                type="date"
                value={formData.dia_entrega}
                onChange={(e) => setFormData({ ...formData, dia_entrega: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-hidden"
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
              className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-amber-500/20 cursor-pointer"
            >
              {saving ? 'Guardando...' : 'Guardar Puerta'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Editar Puerta (Update) */}
      <Modal
        isOpen={Boolean(editingPuerta)}
        onClose={() => setEditingPuerta(null)}
        title={`Editar Puerta — ${editingPuerta?.sku_puerta}`}
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleUpdatePuerta} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Cliente
              </label>
              <input
                type="text"
                required
                value={editFormData.cliente || ''}
                onChange={(e) => setEditFormData({ ...editFormData, cliente: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-hidden focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Estado
              </label>
              <select
                value={editFormData.estado || 'En Proceso'}
                onChange={(e) => setEditFormData({ ...editFormData, estado: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-hidden focus:border-amber-500"
              >
                <option value="Pendiente">Pendiente</option>
                <option value="En Proceso">En Proceso</option>
                <option value="Terminada">Terminada</option>
                <option value="Entregada">Entregada</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Modelo
              </label>
              <input
                type="text"
                value={editFormData.modelo || ''}
                onChange={(e) => setEditFormData({ ...editFormData, modelo: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-hidden focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Taller
              </label>
              <select
                value={editFormData.taller || 'Taller 1'}
                onChange={(e) => setEditFormData({ ...editFormData, taller: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-hidden focus:border-amber-500"
              >
                <option value="Taller 1">Taller 1</option>
                <option value="Taller 2">Taller 2</option>
                <option value="Taller 3">Taller 3</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Medidas
              </label>
              <input
                type="text"
                value={editFormData.medidas || ''}
                onChange={(e) => setEditFormData({ ...editFormData, medidas: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-hidden focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Color
              </label>
              <input
                type="text"
                value={editFormData.color || ''}
                onChange={(e) => setEditFormData({ ...editFormData, color: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-hidden focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Unidades
              </label>
              <input
                type="number"
                min="1"
                value={editFormData.unidades ?? 1}
                onChange={(e) => setEditFormData({ ...editFormData, unidades: Number(e.target.value) })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-hidden focus:border-amber-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Notas Técnicas
            </label>
            <input
              type="text"
              value={editFormData.notas_tecnicas || ''}
              onChange={(e) => setEditFormData({ ...editFormData, notas_tecnicas: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-hidden focus:border-amber-500"
            />
          </div>

          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setEditingPuerta(null)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={savingEdit}
              className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-amber-500/20 cursor-pointer"
            >
              {savingEdit ? 'Actualizando...' : 'Actualizar Puerta en Sheets'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

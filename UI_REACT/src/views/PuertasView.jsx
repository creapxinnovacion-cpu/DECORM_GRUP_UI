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
  ChevronDown,
  ChevronUp,
  Sliders,
  Paintbrush,
  Hammer,
  Truck,
  FileText,
  User,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { api } from '../services/api';
import { Badge } from '../components/Badge';
import { Modal } from '../components/Modal';
import { TALLERES } from '../config/constants';

const ESTADOS_PUERTA = [
  'Por fabricar',
  'En proceso',
  'En armado',
  'En pintura',
  'Listo para entrega',
  'Entregada',
];

export function PuertasView() {
  const [loading, setLoading] = useState(true);
  const [puertas, setPuertas] = useState([]);
  const [search, setSearch] = useState('');
  const [filterEstado, setFilterEstado] = useState('Todos');
  const [filterTaller, setFilterTaller] = useState('Todos');

  // Tarjetas expandidas (acordeón dropdown)
  const [expandedCards, setExpandedCards] = useState({});

  // Modal Nueva Puerta (Create)
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    sku_puerta: '',
    dia_entrega: 'Martes',
    cliente: '',
    modelo: 'LYNUX',
    posicion: 'Principal',
    unidades: 1,
    estado: 'En proceso',
    medidas: '2.15 x 1.50 m',
    color: 'Negro mate',
    vidrio: 'Nevado',
    cerradura: 'WADFOW manillón',
    haladera: 'Cuadrada cromada plata',
    chambrana: 'No',
    notas_tecnicas: '',
    taller: 'Santa Ana',
  });

  // Modal Editar Puerta (Update)
  const [editingPuerta, setEditingPuerta] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [savingEdit, setSavingEdit] = useState(false);

  // Actualización rápida de estado en tarjeta
  const [updatingSku, setUpdatingSku] = useState(null);

  const fetchPuertas = async () => {
    setLoading(true);
    try {
      const res = await api.getPuertas({ pageSize: 150 });
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

  const toggleExpand = (sku) => {
    setExpandedCards((prev) => ({
      ...prev,
      [sku]: !prev[sku],
    }));
  };

  // Cambio directo de estado desde el dropdown de la tarjeta
  const handleQuickStatusChange = async (sku_puerta, nuevoEstado) => {
    setUpdatingSku(sku_puerta);
    // Optimistic update
    setPuertas((prev) =>
      prev.map((p) => (p.sku_puerta === sku_puerta ? { ...p, estado: nuevoEstado } : p))
    );

    try {
      await api.updatePuerta(sku_puerta, { estado: nuevoEstado });
    } catch (err) {
      console.error('Error al actualizar estado:', err);
      alert('No se pudo guardar el estado en Sheets: ' + err.message);
      fetchPuertas(); // Revert
    } finally {
      setUpdatingSku(null);
    }
  };

  const handleCreatePuerta = async (e) => {
    e.preventDefault();
    if (!formData.sku_puerta) {
      alert('Debe ingresar un código SKU para la puerta (ej: DEC-26-015).');
      return;
    }
    setSaving(true);
    try {
      await api.createPuerta(formData);
      setShowModal(false);
      fetchPuertas();
      alert(`Puerta ${formData.sku_puerta} registrada exitosamente.`);
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
      taller: p.taller || 'Santa Ana',
      estado: p.estado || 'En proceso',
      posicion: p.posicion || 'Principal',
      unidades: p.unidades ?? 1,
      dia_entrega: p.dia_entrega || 'Martes',
      medidas: p.medidas || '',
      color: p.color || '',
      vidrio: p.vidrio || 'No',
      cerradura: p.cerradura || '',
      haladera: p.haladera || '',
      chambrana: p.chambrana || 'No',
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
      alert('Especificaciones de la puerta actualizadas con éxito.');
    } catch (err) {
      alert('Error al actualizar puerta: ' + err.message);
    } finally {
      setSavingEdit(false);
    }
  };

  const getStatusColor = (estado) => {
    const est = (estado || '').toLowerCase();
    if (est.includes('entregad')) {
      return {
        badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        select: 'text-emerald-400 border-emerald-500/30 bg-emerald-950/40',
        icon: CheckCircle,
      };
    }
    if (est.includes('listo')) {
      return {
        badge: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
        select: 'text-cyan-400 border-cyan-500/30 bg-cyan-950/40',
        icon: Truck,
      };
    }
    if (est.includes('pintura')) {
      return {
        badge: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
        select: 'text-purple-400 border-purple-500/30 bg-purple-950/40',
        icon: Paintbrush,
      };
    }
    if (est.includes('armado')) {
      return {
        badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
        select: 'text-amber-400 border-amber-500/30 bg-amber-950/40',
        icon: Hammer,
      };
    }
    if (est.includes('proceso')) {
      return {
        badge: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
        select: 'text-orange-400 border-orange-500/30 bg-orange-950/40',
        icon: Clock,
      };
    }
    return {
      badge: 'bg-slate-700/20 text-slate-400 border-slate-700/30',
      select: 'text-slate-300 border-slate-700 bg-slate-900',
      icon: Clock,
    };
  };

  const filteredPuertas = puertas.filter((p) => {
    const s = search.toLowerCase();
    const matchSearch =
      (p.sku_puerta || '').toLowerCase().includes(s) ||
      (p.cliente || '').toLowerCase().includes(s) ||
      (p.modelo || '').toLowerCase().includes(s) ||
      (p.taller || '').toLowerCase().includes(s) ||
      (p.color || '').toLowerCase().includes(s);

    const matchEstado =
      filterEstado === 'Todos' ||
      (p.estado || '').toLowerCase().includes(filterEstado.toLowerCase());

    const matchTaller =
      filterTaller === 'Todos' ||
      (p.taller || '').toLowerCase().includes(filterTaller.toLowerCase());

    return matchSearch && matchEstado && matchTaller;
  });

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-100 flex items-center gap-2">
              <span className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <DoorOpen className="w-6 h-6" />
              </span>
              Agenda de Puertas en Producción
              <span className="text-xs font-bold bg-amber-500/20 text-amber-300 px-2.5 py-0.5 rounded-full border border-amber-500/30">
                Hoja AgendaDePuertas
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Control de fabricación, medidas, acabados, talleres y cambio rápido de estado por tarjeta.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-amber-500/20 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Nueva Puerta</span>
            </button>
            <button
              onClick={fetchPuertas}
              disabled={loading}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl border border-slate-700 transition cursor-pointer"
              title="Refrescar agenda"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="mt-6 flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por código (DEC-26-...), cliente, modelo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-800/80 border border-slate-700 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-100 placeholder-slate-400 focus:outline-none focus:border-amber-500 transition-colors"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Filtro Taller */}
            <div className="flex items-center gap-1.5 bg-slate-800/60 border border-slate-700 rounded-xl px-2.5 py-1">
              <Building className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={filterTaller}
                onChange={(e) => setFilterTaller(e.target.value)}
                className="bg-transparent text-slate-200 text-xs font-semibold focus:outline-none cursor-pointer"
              >
                <option value="Todos" className="bg-slate-900">Todos los Talleres</option>
                <option value="Santa Ana" className="bg-slate-900">Santa Ana</option>
                <option value="Sonsonate" className="bg-slate-900">Sonsonate</option>
                <option value="Taller Central" className="bg-slate-900">Taller Central</option>
              </select>
            </div>

            {/* Filtro Estado */}
            <div className="flex items-center gap-1.5 bg-slate-800/60 border border-slate-700 rounded-xl px-2.5 py-1">
              <Sliders className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={filterEstado}
                onChange={(e) => setFilterEstado(e.target.value)}
                className="bg-transparent text-slate-200 text-xs font-semibold focus:outline-none cursor-pointer"
              >
                <option value="Todos" className="bg-slate-900">Todos los Estados</option>
                {ESTADOS_PUERTA.map((st) => (
                  <option key={st} value={st} className="bg-slate-900">
                    {st}
                  </option>
                ))}
              </select>
            </div>

            <span className="text-[11px] text-slate-400 font-mono ml-2">
              {filteredPuertas.length} {filteredPuertas.length === 1 ? 'puerta' : 'puertas'}
            </span>
          </div>
        </div>
      </div>

      {/* Grid de Tarjetas con Dropdown y Acordeón */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {loading ? (
          <div className="col-span-full py-16 text-center text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-amber-500 mb-3" />
            Cargando agenda de puertas desde Google Sheets...
          </div>
        ) : filteredPuertas.length === 0 ? (
          <div className="col-span-full py-16 text-center text-slate-500 bg-slate-900/40 border border-slate-800 rounded-2xl p-8">
            <DoorOpen className="w-10 h-10 mx-auto text-slate-600 mb-2 opacity-50" />
            <p className="text-sm font-semibold">No se encontraron puertas con los filtros seleccionados.</p>
            <p className="text-xs text-slate-500 mt-1">Prueba cambiando el taller o término de búsqueda.</p>
          </div>
        ) : (
          filteredPuertas.map((p) => {
            const isExpanded = Boolean(expandedCards[p.sku_puerta]);
            const isUpdatingThis = updatingSku === p.sku_puerta;
            const currentStatus = p.estado || 'Por fabricar';
            const statusConfig = getStatusColor(currentStatus);
            const StatusIcon = statusConfig.icon;

            return (
              <div
                key={p.sku_puerta}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl hover:border-slate-700/80 transition-all flex flex-col justify-between group relative overflow-hidden"
              >
                {/* Indicador de taller en barra lateral izquierda */}
                <div
                  className={`absolute left-0 top-0 bottom-0 w-1 ${
                    (p.taller || '').toLowerCase().includes('sonsonate')
                      ? 'bg-sky-500'
                      : (p.taller || '').toLowerCase().includes('santa ana')
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                  }`}
                />

                <div>
                  {/* Encabezado: SKU + Dropdown de Estado directo */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="font-mono font-black text-sm text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg">
                      {p.sku_puerta}
                    </span>

                    {/* DROPDOWN SELECTOR DE ESTADO DIRECTO */}
                    <div className="relative flex items-center">
                      <select
                        value={currentStatus}
                        disabled={isUpdatingThis}
                        onChange={(e) => handleQuickStatusChange(p.sku_puerta, e.target.value)}
                        className={`text-[11px] font-bold rounded-lg px-2.5 py-1 border transition-colors cursor-pointer focus:outline-none appearance-none pr-6 ${statusConfig.select}`}
                        title="Cambiar estado en Google Sheets"
                      >
                        {ESTADOS_PUERTA.map((st) => (
                          <option key={st} value={st} className="bg-slate-900 text-slate-100">
                            {st}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="w-3.5 h-3.5 absolute right-1.5 pointer-events-none opacity-70" />
                      {isUpdatingThis && (
                        <RefreshCw className="w-3 h-3 animate-spin text-amber-400 absolute -left-4" />
                      )}
                    </div>
                  </div>

                  {/* Cliente y Modelo */}
                  <h3 className="text-sm font-bold text-slate-100 truncate" title={p.cliente}>
                    {p.cliente || 'Cliente no especificado'}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs font-semibold text-slate-300">
                      {p.modelo || 'Modelo estándar'}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                      {p.posicion || 'Principal'}
                    </span>
                  </div>

                  {/* Datos Clave Resumidos */}
                  <div className="mt-3.5 grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 bg-slate-950/60 rounded-xl border border-slate-800/80">
                      <span className="text-[10px] text-slate-500 block uppercase font-bold">Medidas</span>
                      <span className="font-semibold text-slate-200 truncate block">
                        {p.medidas || 'Estándar'}
                      </span>
                    </div>

                    <div className="p-2 bg-slate-950/60 rounded-xl border border-slate-800/80">
                      <span className="text-[10px] text-slate-500 block uppercase font-bold">Taller</span>
                      <span className="font-semibold text-sky-400 truncate block">
                        {p.taller || 'Santa Ana'}
                      </span>
                    </div>

                    <div className="p-2 bg-slate-950/60 rounded-xl border border-slate-800/80">
                      <span className="text-[10px] text-slate-500 block uppercase font-bold">Color / Acabado</span>
                      <span className="font-semibold text-slate-200 truncate block">
                        {p.color || '-'}
                      </span>
                    </div>

                    <div className="p-2 bg-slate-950/60 rounded-xl border border-slate-800/80">
                      <span className="text-[10px] text-slate-500 block uppercase font-bold">Entrega</span>
                      <span className="font-semibold text-amber-300 font-mono truncate block">
                        {p.dia_entrega || '-'}
                      </span>
                    </div>
                  </div>

                  {/* DROPDOWN / ACORDEÓN EXPANDIBLE DE DETALLES */}
                  {isExpanded && (
                    <div className="mt-3 p-3 bg-slate-950 rounded-xl border border-slate-800/90 space-y-2 text-xs animate-in fade-in duration-200">
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div>
                          <span className="text-slate-500 block">Vidrio:</span>
                          <span className="font-semibold text-slate-200">{p.vidrio || 'No'}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Chambrana:</span>
                          <span className="font-semibold text-slate-200">{p.chambrana || 'No'}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Cerradura:</span>
                          <span className="font-semibold text-slate-200">{p.cerradura || 'Sin detalle'}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Haladera:</span>
                          <span className="font-semibold text-slate-200">{p.haladera || 'Sin detalle'}</span>
                        </div>
                      </div>

                      {p.notas_tecnicas && (
                        <div className="pt-2 border-t border-slate-800 text-[11px]">
                          <span className="text-amber-400 font-semibold block mb-0.5">Notas Técnicas:</span>
                          <p className="text-slate-300 bg-slate-900/80 p-2 rounded-lg font-mono text-[10px] leading-relaxed">
                            {p.notas_tecnicas}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Footer de Tarjeta: Toggle detalles + Botón editar */}
                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  {/* Botón Acordeón Dropdown */}
                  <button
                    type="button"
                    onClick={() => toggleExpand(p.sku_puerta)}
                    className="flex items-center gap-1 text-[11px] font-semibold text-amber-400/90 hover:text-amber-300 transition cursor-pointer"
                  >
                    {isExpanded ? (
                      <>
                        <ChevronUp className="w-3.5 h-3.5" /> Ocultar detalles
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-3.5 h-3.5" /> Especificaciones técnicas
                      </>
                    )}
                  </button>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-500 font-mono">
                      Cant: <strong className="text-slate-200">{p.unidades || 1}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => openEditModal(p)}
                      className="p-1.5 text-slate-400 hover:text-amber-400 bg-slate-800 hover:bg-slate-700 rounded-lg transition cursor-pointer border border-slate-700"
                      title="Editar especificaciones completas"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
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
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleCreatePuerta} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">
                SKU Puerta (Código)
              </label>
              <input
                type="text"
                required
                placeholder="Ej: DEC-26-015"
                value={formData.sku_puerta}
                onChange={(e) => setFormData({ ...formData, sku_puerta: e.target.value.toUpperCase() })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 font-mono font-bold text-amber-400 focus:outline-none focus:border-amber-500"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-300 mb-1">
                Nombre del Cliente / Proyecto
              </label>
              <input
                type="text"
                required
                placeholder="Nombre completo del cliente"
                value={formData.cliente}
                onChange={(e) => setFormData({ ...formData, cliente: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">
                Modelo
              </label>
              <input
                type="text"
                placeholder="Ej: LYNUX, NIRYX, ANDRÓMEDA"
                value={formData.modelo}
                onChange={(e) => setFormData({ ...formData, modelo: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">
                Posición
              </label>
              <input
                type="text"
                placeholder="Ej: Principal, Interior"
                value={formData.posicion}
                onChange={(e) => setFormData({ ...formData, posicion: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">
                Taller Asignado
              </label>
              <select
                value={formData.taller}
                onChange={(e) => setFormData({ ...formData, taller: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none cursor-pointer"
              >
                <option value="Santa Ana">Santa Ana</option>
                <option value="Sonsonate">Sonsonate</option>
                <option value="Taller Central">Taller Central</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">
                Estado Inicial
              </label>
              <select
                value={formData.estado}
                onChange={(e) => setFormData({ ...formData, estado: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-amber-400 font-bold focus:outline-none cursor-pointer"
              >
                {ESTADOS_PUERTA.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">
                Medidas
              </label>
              <input
                type="text"
                placeholder="Ej: 2.15 x 1.50 m"
                value={formData.medidas}
                onChange={(e) => setFormData({ ...formData, medidas: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">
                Día / Fecha de Entrega
              </label>
              <input
                type="text"
                placeholder="Ej: Martes o 2026-11-25"
                value={formData.dia_entrega}
                onChange={(e) => setFormData({ ...formData, dia_entrega: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none"
              />
            </div>
          </div>

          {/* Especificaciones de herrajes y acabados */}
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
            <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wide block">
              Especificaciones de Herrería, Vidrio y Cerrajería
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Color / Acabado</label>
                <input
                  type="text"
                  placeholder="Ej: Negro mate"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Vidrio</label>
                <input
                  type="text"
                  placeholder="Ej: Nevado, Oscuro"
                  value={formData.vidrio}
                  onChange={(e) => setFormData({ ...formData, vidrio: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Cerradura</label>
                <input
                  type="text"
                  placeholder="Ej: WADFOW manillón"
                  value={formData.cerradura}
                  onChange={(e) => setFormData({ ...formData, cerradura: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Haladera</label>
                <input
                  type="text"
                  placeholder="Ej: Tubular plata"
                  value={formData.haladera}
                  onChange={(e) => setFormData({ ...formData, haladera: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Chambrana</label>
                <input
                  type="text"
                  placeholder="Ej: 17 cm, No"
                  value={formData.chambrana}
                  onChange={(e) => setFormData({ ...formData, chambrana: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Unidades</label>
                <input
                  type="number"
                  min="1"
                  value={formData.unidades}
                  onChange={(e) => setFormData({ ...formData, unidades: Number(e.target.value) })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 text-xs font-mono font-bold"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Notas Técnicas de Fabricación</label>
              <textarea
                rows={2}
                placeholder="Instrucciones especiales para el maestro de taller..."
                value={formData.notas_tecnicas}
                onChange={(e) => setFormData({ ...formData, notas_tecnicas: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 text-xs focus:outline-none"
              />
            </div>
          </div>

          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-800">
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
              className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-bold shadow-lg shadow-amber-500/20 cursor-pointer flex items-center gap-1.5"
            >
              {saving ? 'Guardando en Sheets...' : 'Crear Puerta en Agenda'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Editar Puerta (Update) */}
      <Modal
        isOpen={Boolean(editingPuerta)}
        onClose={() => setEditingPuerta(null)}
        title={`Editar Especificaciones — ${editingPuerta?.sku_puerta}`}
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleUpdatePuerta} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-300 mb-1">Cliente</label>
              <input
                type="text"
                required
                value={editFormData.cliente || ''}
                onChange={(e) => setEditFormData({ ...editFormData, cliente: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">Estado</label>
              <select
                value={editFormData.estado || 'En proceso'}
                onChange={(e) => setEditFormData({ ...editFormData, estado: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-amber-400 font-bold focus:outline-none cursor-pointer"
              >
                {ESTADOS_PUERTA.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Modelo</label>
              <input
                type="text"
                value={editFormData.modelo || ''}
                onChange={(e) => setEditFormData({ ...editFormData, modelo: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">Taller</label>
              <select
                value={editFormData.taller || 'Santa Ana'}
                onChange={(e) => setEditFormData({ ...editFormData, taller: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 cursor-pointer"
              >
                <option value="Santa Ana">Santa Ana</option>
                <option value="Sonsonate">Sonsonate</option>
                <option value="Taller Central">Taller Central</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">Día de Entrega</label>
              <input
                type="text"
                value={editFormData.dia_entrega || ''}
                onChange={(e) => setEditFormData({ ...editFormData, dia_entrega: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100"
              />
            </div>
          </div>

          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
            <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wide block">
              Especificaciones de Fabricación
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Medidas</label>
                <input
                  type="text"
                  value={editFormData.medidas || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, medidas: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Color / Acabado</label>
                <input
                  type="text"
                  value={editFormData.color || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, color: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Vidrio</label>
                <input
                  type="text"
                  value={editFormData.vidrio || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, vidrio: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Chambrana</label>
                <input
                  type="text"
                  value={editFormData.chambrana || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, chambrana: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Cerradura</label>
                <input
                  type="text"
                  value={editFormData.cerradura || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, cerradura: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Haladera</label>
                <input
                  type="text"
                  value={editFormData.haladera || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, haladera: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Notas Técnicas</label>
              <textarea
                rows={2}
                value={editFormData.notas_tecnicas || ''}
                onChange={(e) => setEditFormData({ ...editFormData, notas_tecnicas: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 text-xs"
              />
            </div>
          </div>

          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setEditingPuerta(null)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={savingEdit}
              className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-bold shadow-lg shadow-amber-500/20 cursor-pointer"
            >
              {savingEdit ? 'Actualizando...' : 'Guardar Cambios en Sheets'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default PuertasView;
import React, { useState, useEffect } from 'react';
import {
  Wrench,
  Plus,
  RotateCcw,
  Search,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  User,
  Calendar,
  Layers,
} from 'lucide-react';
import { api } from '../services/api';
import { Badge } from '../components/Badge';
import { Modal } from '../components/Modal';

export function PrestamosView() {
  const [loading, setLoading] = useState(true);
  const [prestamos, setPrestamos] = useState([]);
  const [search, setSearch] = useState('');
  const [equipos, setEquipos] = useState([]);

  // Modal Nuevo Préstamo
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    fecha_salida: new Date().toISOString().split('T')[0],
    persona: '',
    sku_equipo: '',
    cant_prestada: 1,
    cant_devuelta: 0,
    taller_proyecto: 'Taller 1',
    observaciones: '',
  });

  // Modal Devolución
  const [showDevolverModal, setShowDevolverModal] = useState(false);
  const [selectedPrestamo, setSelectedPrestamo] = useState(null);
  const [cantDevolver, setCantDevolver] = useState(1);
  const [personaDevuelve, setPersonaDevuelve] = useState('');
  const [obsDevolucion, setObsDevolucion] = useState('');
  const [savingDevolucion, setSavingDevolucion] = useState(false);

  const fetchPrestamos = async () => {
    setLoading(true);
    try {
      const res = await api.getPrestamos({ pageSize: 50 });
      setPrestamos(res.rows || []);
      const catRes = await api.getCatalogo({ pageSize: 150 });
      // Only equipment SKUs (EQU-*)
      const eqItems = (catRes.rows || []).filter(
        (it) => (it.sku || '').startsWith('EQU-') || (it.categoria || '').toLowerCase().includes('equipo')
      );
      setEquipos(eqItems);
    } catch (err) {
      console.error('Error al cargar préstamos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrestamos();
  }, []);

  const handleCreatePrestamo = async (e) => {
    e.preventDefault();
    if (!formData.sku_equipo) {
      alert('Seleccione un equipo válido (EQU-*).');
      return;
    }
    setSaving(true);
    try {
      await api.createPrestamo(formData);
      setShowModal(false);
      setFormData({
        fecha_salida: new Date().toISOString().split('T')[0],
        persona: '',
        sku_equipo: '',
        cant_prestada: 1,
        cant_devuelta: 0,
        taller_proyecto: 'Taller 1',
        observaciones: '',
      });
      fetchPrestamos();
    } catch (err) {
      alert('Error al registrar préstamo: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDevolverSubmit = async (e) => {
    e.preventDefault();
    if (!selectedPrestamo) return;
    setSavingDevolucion(true);
    try {
      await api.devolverPrestamo(
        selectedPrestamo._rowNumber,
        Number(cantDevolver),
        personaDevuelve || selectedPrestamo.persona,
        obsDevolucion
      );
      alert('¡Devolución registrada en Sheets!');
      setShowDevolverModal(false);
      setSelectedPrestamo(null);
      fetchPrestamos();
    } catch (err) {
      alert('Error al devolver equipo: ' + err.message);
    } finally {
      setSavingDevolucion(false);
    }
  };

  const filteredPrestamos = prestamos.filter((p) => {
    const s = search.toLowerCase();
    return (
      (p.id_prestamo || '').toLowerCase().includes(s) ||
      (p.persona || '').toLowerCase().includes(s) ||
      (p.sku_equipo || '').toLowerCase().includes(s) ||
      (p.descripcion_equipo || '').toLowerCase().includes(s) ||
      (p.taller_proyecto || '').toLowerCase().includes(s)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-100 flex items-center gap-2">
              <Wrench className="w-6 h-6 text-amber-500" />
              Control de Préstamos de Equipos y Herramientas
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Hoja dedicada PrestamosEquipos · Exclusivo para SKUs EQU-* con control de devoluciones
            </p>
          </div>

          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Prestar Equipo
          </button>
        </div>

        {/* Search */}
        <div className="mt-6 max-w-md relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por ID, persona o equipo..."
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
                <th className="py-3.5 px-4">ID Préstamo</th>
                <th className="py-3.5 px-4">Fecha Salida</th>
                <th className="py-3.5 px-4">Persona Responsable</th>
                <th className="py-3.5 px-3">SKU Equipo</th>
                <th className="py-3.5 px-4">Descripción Equipo</th>
                <th className="py-3.5 px-3 text-right">Cant. Prestada</th>
                <th className="py-3.5 px-3 text-right">Cant. Devuelta</th>
                <th className="py-3.5 px-4">Taller / Proyecto</th>
                <th className="py-3.5 px-4 text-center">Estado</th>
                <th className="py-3.5 px-4 text-center">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {loading ? (
                <tr>
                  <td colSpan="10" className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-amber-500 mb-2" />
                    Cargando préstamos de equipos...
                  </td>
                </tr>
              ) : filteredPrestamos.length === 0 ? (
                <tr>
                  <td colSpan="10" className="py-12 text-center text-slate-500">
                    No hay préstamos activos registrados.
                  </td>
                </tr>
              ) : (
                filteredPrestamos.map((p, idx) => {
                  const prestada = Number(p.cant_prestada || 0);
                  const devuelta = Number(p.cant_devuelta || 0);
                  const isDevuelto = devuelta >= prestada;
                  const isParcial = devuelta > 0 && devuelta < prestada;

                  return (
                    <tr key={idx} className="hover:bg-slate-800/50 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-300">
                        {p.id_prestamo || `PREST-${String(idx + 1).padStart(4, '0')}`}
                      </td>
                      <td className="py-3 px-4 text-slate-300 font-mono whitespace-nowrap">
                        {p.fecha_salida}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-100">
                        {p.persona}
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-amber-400">
                        {p.sku_equipo}
                      </td>
                      <td className="py-3 px-4 text-slate-300 max-w-xs truncate">
                        {p.descripcion_equipo || '-'}
                      </td>
                      <td className="py-3 px-3 text-right font-black text-slate-100 font-mono">
                        {prestada}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-emerald-400 font-mono">
                        {devuelta}
                      </td>
                      <td className="py-3 px-4 text-slate-300">
                        {p.taller_proyecto}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge variant={isDevuelto ? 'success' : isParcial ? 'warning' : 'danger'}>
                          {isDevuelto ? 'DEVUELTO' : isParcial ? 'PARCIAL' : 'PENDIENTE'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {!isDevuelto && (
                          <button
                            onClick={() => {
                              setSelectedPrestamo(p);
                              setCantDevolver(prestada - devuelta);
                              setPersonaDevuelve(p.persona);
                              setShowDevolverModal(true);
                            }}
                            className="px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500 hover:text-slate-950 text-emerald-400 font-bold text-[11px] rounded-lg border border-emerald-500/20 transition-all cursor-pointer flex items-center gap-1 mx-auto"
                          >
                            <RotateCcw className="w-3.5 h-3.5" /> Devolver
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Prestar Equipo */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Registrar Préstamo de Equipo o Herramienta"
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleCreatePrestamo} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Fecha Salida
              </label>
              <input
                type="date"
                required
                value={formData.fecha_salida}
                onChange={(e) => setFormData({ ...formData, fecha_salida: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-hidden focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Persona Responsable
              </label>
              <input
                type="text"
                required
                placeholder="Nombre del operario"
                value={formData.persona}
                onChange={(e) => setFormData({ ...formData, persona: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-hidden focus:border-amber-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Equipo / Herramienta (EQU-*)
            </label>
            <select
              required
              value={formData.sku_equipo}
              onChange={(e) => setFormData({ ...formData, sku_equipo: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-hidden focus:border-amber-500 font-mono"
            >
              <option value="">-- Seleccionar Equipo --</option>
              {equipos.map((item) => (
                <option key={item.sku} value={item.sku}>
                  {item.sku} — {item.descripcion}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Cant. Prestada
              </label>
              <input
                type="number"
                min="1"
                required
                value={formData.cant_prestada}
                onChange={(e) => setFormData({ ...formData, cant_prestada: Number(e.target.value) })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-hidden focus:border-amber-500 font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Taller / Proyecto
              </label>
              <input
                type="text"
                required
                placeholder="Ej: Taller 1 / Proyecto Residencial"
                value={formData.taller_proyecto}
                onChange={(e) => setFormData({ ...formData, taller_proyecto: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-hidden focus:border-amber-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Observaciones (Estado físico, accesorios entregados)
            </label>
            <input
              type="text"
              placeholder="Ej: Incluye cable, llave y estuche"
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
              {saving ? 'Guardando...' : 'Registrar Préstamo'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Devolver Equipo */}
      <Modal
        isOpen={showDevolverModal}
        onClose={() => setShowDevolverModal(false)}
        title="Registrar Devolución de Equipo"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleDevolverSubmit} className="space-y-4">
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs">
            <p className="text-slate-400">Equipo a devolver:</p>
            <p className="font-bold text-amber-400 text-sm mt-0.5">
              {selectedPrestamo?.sku_equipo} — {selectedPrestamo?.descripcion_equipo}
            </p>
            <p className="text-slate-400 mt-1">
              Responsable de salida: <span className="text-slate-200 font-semibold">{selectedPrestamo?.persona}</span>
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Cantidad que Devuelve
            </label>
            <input
              type="number"
              min="1"
              required
              value={cantDevolver}
              onChange={(e) => setCantDevolver(Number(e.target.value))}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-emerald-400 font-bold focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Persona que Entrega en Bodega
            </label>
            <input
              type="text"
              required
              value={personaDevuelve}
              onChange={(e) => setPersonaDevuelve(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Estado de la Herramienta al Retornar
            </label>
            <input
              type="text"
              placeholder="Ej: En buen estado, limpio y probado"
              value={obsDevolucion}
              onChange={(e) => setObsDevolucion(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-hidden"
            />
          </div>

          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setShowDevolverModal(false)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={savingDevolucion}
              className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/20 cursor-pointer"
            >
              {savingDevolucion ? 'Procesando...' : 'Confirmar Devolución'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

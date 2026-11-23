import React, { useState, useEffect, useMemo } from 'react';
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
  Users,
  FileText,
  Download,
  Package,
  CheckCircle2,
  Sparkles,
  X,
  AlertCircle,
} from 'lucide-react';
import { api, generateRequestId, generateOperationId } from '../services/api';
import { Modal } from '../components/Modal';
import SearchableSkuSelect from '../components/SearchableSkuSelect';
import ConsolidadoOperadorModal from '../components/ConsolidadoOperadorModal';
import { OPERADORES } from '../config/constants';

// Insumos frecuentes para selección en 1 solo clic
const INSUMOS_RAPIDOS = [
  { label: 'Thinner', query: 'thinner', defaultCant: 1 },
  { label: 'Disco Esmeril', query: 'esmeril', defaultCant: 1 },
  { label: 'Discos Corte 4½"', query: 'corte metal', defaultCant: 5 },
  { label: 'Lija P80', query: 'p80', defaultCant: 5 },
  { label: 'Lija P320', query: 'p320', defaultCant: 5 },
  { label: 'Discos Lija Seco 127mm', query: 'disco de lija', defaultCant: 5 },
  { label: 'Bases', query: 'base', defaultCant: 1 },
  { label: 'Cerraduras', query: 'cerradura', defaultCant: 1 },
  { label: 'Haladeras', query: 'haladera', defaultCant: 1 },
  { label: 'Tirro', query: 'tirro', defaultCant: 2 },
  { label: 'Papel Manila', query: 'papel', defaultCant: 2 },
];

export function InstaladoresView() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [catalogoItems, setCatalogoItems] = useState([]);

  // Multi-Insumo Modal de Entrega
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [encargadoInstalacion, setEncargadoInstalacion] = useState(OPERADORES[0] || 'Ayala');
  const [encargadoBodega, setEncargadoBodega] = useState('Bodega Central');
  const [fechaEntrega, setFechaEntrega] = useState(new Date().toISOString().split('T')[0]);
  const [lineasEntrega, setLineasEntrega] = useState([
    { codigo: '', insumo: '', cantidad: 1, check: false },
  ]);

  // Edit Modal
  const [editingItem, setEditingItem] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [savingEdit, setSavingEdit] = useState(false);

  // Estados de Reportes y Filtro por Operador
  const [showReporteModal, setShowReporteModal] = useState(false);
  const [reporteOperadorInicial, setReporteOperadorInicial] = useState('TODOS');
  const [filtroOperador, setFiltroOperador] = useState('TODOS');

  // Carga inicial
  const fetchItems = async () => {
    setLoading(true);
    try {
      // Leer caché local primero si existe
      const localCached = JSON.parse(localStorage.getItem('decorm_instaladores_local') || '[]');
      
      try {
        const res = await api.getInsumosInstaladores({ pageSize: 300 });
        const remoteRows = res.rows || [];
        // Combinar datos remotos con locales asegurando unicidad por rowNumber / id
        const merged = [...remoteRows];
        localCached.forEach((loc) => {
          if (!merged.some((m) => m._rowNumber === loc._rowNumber || (m.codigo === loc.codigo && m.encargado_instalacion === loc.encargado_instalacion && m.fecha === loc.fecha))) {
            merged.unshift(loc);
          }
        });
        setItems(merged);
      } catch (remoteErr) {
        console.warn('Backend remoto sin soporte instaladores.list, usando caché y movimientos:', remoteErr);
        if (localCached.length > 0) {
          setItems(localCached);
        } else {
          // Intentar obtener desde movimientos con taller_destino Instaladores
          try {
            const movs = await api.getMovimientos({ pageSize: 150 });
            const instMovs = (movs.rows || [])
              .filter((m) => (m.taller_destino || '').toLowerCase().includes('instalador') || (m.tipo || '').toLowerCase().includes('salida'))
              .slice(0, 30)
              .map((m, idx) => ({
                _rowNumber: idx + 1,
                codigo: m.sku || 'S/SKU',
                insumo: m.descripcion || m.observaciones || 'Insumo de taller',
                cantidad: Math.abs(Number(m.cantidad || 1)),
                check: true,
                encargado_instalacion: m.entregado_a || 'Instalador',
                encargado_bodega: 'Bodega Central',
                fecha: m.fecha || new Date().toISOString().split('T')[0],
              }));
            setItems(instMovs);
          } catch (e) {
            setItems([]);
          }
        }
      }
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

  // Agregar insumo rápido mediante chip
  const handleAddQuickInsumo = (chip) => {
    // Buscar en catálogo el item que coincida con la consulta
    const found = catalogoItems.find(
      (c) =>
        (c.descripcion || '').toLowerCase().includes(chip.query.toLowerCase()) ||
        (c.sku || '').toLowerCase().includes(chip.query.toLowerCase())
    );

    const sku = found ? found.sku : '';
    const desc = found ? found.descripcion : chip.label;

    // Verificar si ya está en la lista de líneas
    const existingIndex = lineasEntrega.findIndex(
      (l) => l.codigo === sku || (sku === '' && l.insumo === desc)
    );

    if (existingIndex >= 0) {
      // Incrementar cantidad
      const copy = [...lineasEntrega];
      copy[existingIndex].cantidad = Number((copy[existingIndex].cantidad + chip.defaultCant).toFixed(2));
      setLineasEntrega(copy);
    } else {
      // Si la primera fila está vacía, reemplazarla
      if (lineasEntrega.length === 1 && !lineasEntrega[0].codigo && !lineasEntrega[0].insumo) {
        setLineasEntrega([
          { codigo: sku, insumo: desc, cantidad: chip.defaultCant, check: false },
        ]);
      } else {
        setLineasEntrega([
          ...lineasEntrega,
          { codigo: sku, insumo: desc, cantidad: chip.defaultCant, check: false },
        ]);
      }
    }
  };

  // Toggle Check
  const handleToggleCheck = async (item) => {
    const newCheck = !item.check;
    // Optimistic update
    setItems((prev) =>
      prev.map((it) => (it._rowNumber === item._rowNumber ? { ...it, check: newCheck } : it))
    );
    try {
      await api.updateInsumoInstalador(item._rowNumber, { check: newCheck });
    } catch (err) {
      console.warn('Update check remoto no disponible, persistiendo localmente:', err);
      // Persistir en local
      const local = JSON.parse(localStorage.getItem('decorm_instaladores_local') || '[]');
      const updated = local.map((l) => (l._rowNumber === item._rowNumber ? { ...l, check: newCheck } : l));
      localStorage.setItem('decorm_instaladores_local', JSON.stringify(updated));
    }
  };

  // Enviar Entrega Multi-Insumo
  const handleMultiSubmit = async (e) => {
    e.preventDefault();
    if (!lineasEntrega.length || !lineasEntrega.some((l) => l.codigo || l.insumo)) {
      alert('Por favor agregue al menos un insumo para entregar.');
      return;
    }
    setSaving(true);

    const processedLineas = lineasEntrega
      .filter((l) => l.codigo || l.insumo)
      .map((l) => {
        const cat = catalogoItems.find((c) => c.sku === l.codigo);
        return {
          codigo: l.codigo || 'S/SKU',
          insumo: l.insumo || cat?.descripcion || l.codigo,
          cantidad: Number(l.cantidad) || 1,
          check: Boolean(l.check),
        };
      });

    try {
      // 1. Registro transaccional e idempotente vía instaladores.createBatch (v4.2 SDD-011)
      const opId = generateOperationId('INS');
      try {
        await api.createInsumosInstaladoresBatch(
          {
            encargado_instalacion: encargadoInstalacion,
            encargado_bodega: encargadoBodega,
          },
          processedLineas.map((l) => ({
            sku: l.codigo,
            codigo: l.codigo,
            insumo: l.insumo,
            cantidad: l.cantidad,
            check: l.check,
          })),
          {
            operation_id: opId,
            offline_override: false,
          }
        );
      } catch (batchErr) {
        console.warn('Error en createBatch instaladores:', batchErr);
        throw batchErr;
      }

      // 3. Guardar en caché local para visualización garantizada inmediata
      const currentLocal = JSON.parse(localStorage.getItem('decorm_instaladores_local') || '[]');
      const newLocalItems = processedLineas.map((l, i) => ({
        _rowNumber: Date.now() + i,
        codigo: l.codigo,
        insumo: l.insumo,
        cantidad: l.cantidad,
        check: l.check,
        encargado_instalacion: encargadoInstalacion,
        encargado_bodega: encargadoBodega,
        fecha: fechaEntrega,
      }));
      const updatedLocal = [...newLocalItems, ...currentLocal].slice(0, 200);
      localStorage.setItem('decorm_instaladores_local', JSON.stringify(updatedLocal));

      // 4. Limpiar y cerrar
      setShowModal(false);
      setLineasEntrega([{ codigo: '', insumo: '', cantidad: 1, check: false }]);
      await fetchItems();
      alert(`¡Entrega de ${processedLineas.length} insumos registrada exitosamente para ${encargadoInstalacion}! Las salidas han sido asentadas en inventario.`);
    } catch (err) {
      alert('Error al registrar entrega: ' + err.message);
    } finally {
      setSaving(false);
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
      // Persistir cambio local si el backend es 2.0.0
      const local = JSON.parse(localStorage.getItem('decorm_instaladores_local') || '[]');
      const updated = local.map((l) => (l._rowNumber === editingItem._rowNumber ? { ...l, ...editFormData } : l));
      localStorage.setItem('decorm_instaladores_local', JSON.stringify(updated));
      setEditingItem(null);
      fetchItems();
      alert('Registro actualizado localmente.');
    } finally {
      setSavingEdit(false);
    }
  };

  // Clear / Delete
  const handleClear = async (rowNumber) => {
    if (!confirm(`¿Desea limpiar/eliminar el registro de la fila ${rowNumber}?`)) return;
    try {
      await api.clearInsumoInstalador(rowNumber);
    } catch (err) {
      console.warn(err);
    }
    const local = JSON.parse(localStorage.getItem('decorm_instaladores_local') || '[]');
    const updated = local.filter((l) => l._rowNumber !== rowNumber);
    localStorage.setItem('decorm_instaladores_local', JSON.stringify(updated));
    setItems((prev) => prev.filter((it) => it._rowNumber !== rowNumber));
  };

  // Adaptador de ítems a movimientos para el generador de reportes
  const itemsAsMovimientos = useMemo(() => {
    return items.map((it, idx) => ({
      id: it._rowNumber || idx,
      fecha: it.fecha || new Date().toISOString().split('T')[0],
      tipo: 'Salida',
      sku: it.codigo || it.sku || 'S/SKU',
      descripcion: it.insumo || it.descripcion || '',
      cantidad: Number(it.cantidad || 0),
      entregado_a: it.encargado_instalacion || 'Instalador',
      taller_destino: it.taller || 'Instaladores',
      observaciones: `Lote: ${it.lote_id || '-'} | Bodega: ${it.encargado_bodega || '-'}`,
    }));
  }, [items]);

  // Manejadores para abrir los dos tipos de reportes
  const handleAbrirReporteGeneral = () => {
    setReporteOperadorInicial('TODOS');
    setShowReporteModal(true);
  };

  const handleAbrirReporteEspecifico = () => {
    const op =
      filtroOperador !== 'TODOS'
        ? filtroOperador
        : items[0]?.encargado_instalacion || OPERADORES[0] || 'Ayala';
    setReporteOperadorInicial(op);
    setShowReporteModal(true);
  };

  // Filter items
  const filtered = useMemo(() => {
    return items.filter((it) => {
      if (filtroOperador !== 'TODOS') {
        const opName = String(it.encargado_instalacion || '').toLowerCase();
        if (!opName.includes(filtroOperador.toLowerCase())) return false;
      }
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        (it.codigo || '').toLowerCase().includes(q) ||
        (it.insumo || '').toLowerCase().includes(q) ||
        (it.encargado_instalacion || '').toLowerCase().includes(q) ||
        (it.encargado_bodega || '').toLowerCase().includes(q)
      );
    });
  }, [items, filtroOperador, search]);

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
              Multi-Insumo Ágil
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Entrega múltiple de insumos a instaladores (thinner, discos, lijas, bases, cerraduras, etc.) con trazabilidad directa.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Botón 1: Reporte General */}
          <button
            type="button"
            onClick={handleAbrirReporteGeneral}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-emerald-400 border border-emerald-500/30 hover:border-emerald-500/50 font-bold text-xs rounded-xl shadow-sm transition cursor-pointer min-h-[40px]"
            title="Exportar Consolidado General de Todos los Instaladores"
          >
            <Users className="w-4 h-4 text-emerald-400" />
            <span>Reporte General</span>
          </button>

          {/* Botón 2: Reporte Específico */}
          <button
            type="button"
            onClick={handleAbrirReporteEspecifico}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-sky-400 border border-sky-500/30 hover:border-sky-500/50 font-bold text-xs rounded-xl shadow-sm transition cursor-pointer min-h-[40px]"
            title="Exportar Comprobante / Reporte Específico del Instalador"
          >
            <FileText className="w-4 h-4 text-sky-400" />
            <span>Reporte Específico</span>
          </button>

          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-amber-500/20 transition cursor-pointer min-h-[40px]"
          >
            <Plus className="w-4 h-4" />
            <span>Registrar Entrega</span>
          </button>

          <button
            onClick={fetchItems}
            disabled={loading}
            className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl border border-slate-800 transition cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center"
            title="Refrescar lista"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Search Bar & Filtros */}
      <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-2xl flex flex-col sm:flex-row items-stretch sm:items-center gap-3 text-xs">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
          <input
            type="text"
            placeholder="Buscar por código, material o encargado de instalación..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500 min-h-[38px]"
          />
        </div>

        {/* Selector de Instalador */}
        <select
          value={filtroOperador}
          onChange={(e) => setFiltroOperador(e.target.value)}
          className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500 min-h-[38px]"
        >
          <option value="TODOS">Todos los Instaladores</option>
          {OPERADORES.map((op) => (
            <option key={op} value={op}>
              {op}
            </option>
          ))}
        </select>

        <span className="text-slate-500 font-mono text-[11px] px-1 shrink-0">
          {filtered.length} {filtered.length === 1 ? 'registro' : 'registros'}
        </span>
      </div>

      {/* Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 text-[10px] uppercase font-bold tracking-wider sticky top-0 border-b border-slate-800 z-10">
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
                filtered.map((item, idx) => (
                  <tr
                    key={item._rowNumber || idx}
                    className={`hover:bg-slate-800/30 transition ${
                      item.check ? 'bg-emerald-950/[0.04]' : ''
                    }`}
                  >
                    <td className="py-3 px-4 text-center font-mono text-slate-500 text-[11px]">
                      R{item._rowNumber || idx + 1}
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
                      {item.codigo || '-'}
                    </td>

                    {/* Insumo */}
                    <td className="py-3 px-4 text-slate-100 font-medium">
                      {item.insumo}
                    </td>

                    {/* Cantidad */}
                    <td className="py-3 px-4 text-center font-mono font-bold text-slate-200">
                      {item.cantidad}
                    </td>

                    {/* Encargado Instalacion */}
                    <td className="py-3 px-4 text-slate-300">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-800 text-slate-200">
                        <User className="w-3 h-3 text-amber-400" />
                        {item.encargado_instalacion || '-'}
                      </span>
                    </td>

                    {/* Encargado Bodega */}
                    <td className="py-3 px-4 text-slate-400">
                      {item.encargado_bodega || 'Bodega Central'}
                    </td>

                    {/* Acciones */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingItem(item);
                            setEditFormData({
                              codigo: item.codigo || '',
                              insumo: item.insumo || '',
                              cantidad: item.cantidad ?? 1,
                              check: Boolean(item.check),
                              encargado_instalacion: item.encargado_instalacion || '',
                              encargado_bodega: item.encargado_bodega || 'Bodega Central',
                            });
                          }}
                          className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded-lg transition cursor-pointer"
                          title="Editar"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleClear(item._rowNumber)}
                          className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition cursor-pointer"
                          title="Eliminar registro"
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

      {/* MODAL PRINCIPAL: Registrar Entrega Multi-Insumo */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Registrar Entrega de Insumos a Instalador"
        maxWidth="max-w-3xl"
      >
        <form onSubmit={handleMultiSubmit} className="space-y-4 text-xs">
          {/* Cabecera del despacho */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-slate-950/80 rounded-2xl border border-slate-800">
            <div>
              <label className="block text-slate-400 font-semibold mb-1">
                Encargado de Instalación
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  list="operadores-list"
                  placeholder="Ej: Ayala, Jairo, Josué..."
                  value={encargadoInstalacion}
                  onChange={(e) => setEncargadoInstalacion(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 font-bold focus:outline-none focus:border-amber-500"
                />
                <datalist id="operadores-list">
                  {OPERADORES.map((op) => (
                    <option key={op} value={op} />
                  ))}
                </datalist>
              </div>
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">
                Encargado de Bodega
              </label>
              <input
                type="text"
                required
                value={encargadoBodega}
                onChange={(e) => setEncargadoBodega(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">
                Fecha de Entrega
              </label>
              <input
                type="date"
                required
                value={fechaEntrega}
                onChange={(e) => setFechaEntrega(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Chips de Selección Rápida */}
          <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-2xl">
            <div className="flex items-center gap-1.5 mb-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[11px] font-bold text-amber-300 uppercase tracking-wide">
                Insumos Habituales (1 Clic para Agregar)
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {INSUMOS_RAPIDOS.map((chip, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleAddQuickInsumo(chip)}
                  className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-amber-500/20 text-slate-200 hover:text-amber-300 border border-slate-800 hover:border-amber-500/40 text-[11px] font-semibold transition cursor-pointer flex items-center gap-1"
                >
                  <Plus className="w-3 h-3 text-amber-400" />
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          {/* Líneas dinámicas de insumos */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-slate-400 font-bold uppercase text-[10px] px-1">
              <span>Insumos a Despachar ({lineasEntrega.length})</span>
              <button
                type="button"
                onClick={() =>
                  setLineasEntrega([
                    ...lineasEntrega,
                    { codigo: '', insumo: '', cantidad: 1, check: false },
                  ])
                }
                className="text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Agregar otra fila
              </button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {lineasEntrega.map((linea, index) => (
                <div
                  key={index}
                  className="grid grid-cols-12 gap-2 items-center p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition"
                >
                  {/* Selector SKU */}
                  <div className="col-span-4">
                    <select
                      value={linea.codigo}
                      onChange={(e) => {
                        const sku = e.target.value;
                        const cat = catalogoItems.find((c) => c.sku === sku);
                        const copy = [...lineasEntrega];
                        copy[index] = {
                          ...copy[index],
                          codigo: sku,
                          insumo: cat ? cat.descripcion : copy[index].insumo,
                        };
                        setLineasEntrega(copy);
                      }}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-amber-400 font-mono text-xs focus:outline-none focus:border-amber-500"
                    >
                      <option value="">-- Seleccionar SKU --</option>
                      {catalogoItems.map((c) => (
                        <option key={c.sku} value={c.sku}>
                          {c.sku} — {c.descripcion.slice(0, 32)}...
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Descripción / Material */}
                  <div className="col-span-5">
                    <input
                      type="text"
                      required
                      placeholder="Descripción del insumo..."
                      value={linea.insumo}
                      onChange={(e) => {
                        const copy = [...lineasEntrega];
                        copy[index].insumo = e.target.value;
                        setLineasEntrega(copy);
                      }}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 text-xs focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  {/* Cantidad */}
                  <div className="col-span-2">
                    <input
                      type="number"
                      min="0.1"
                      step="any"
                      required
                      placeholder="Cant"
                      value={linea.cantidad}
                      onChange={(e) => {
                        const copy = [...lineasEntrega];
                        copy[index].cantidad = Number(e.target.value);
                        setLineasEntrega(copy);
                      }}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-center font-mono font-bold text-amber-300 text-xs focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  {/* Eliminar Fila */}
                  <div className="col-span-1 text-center">
                    {lineasEntrega.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setLineasEntrega(lineasEntrega.filter((_, i) => i !== index))
                        }
                        className="p-1 text-slate-500 hover:text-rose-400 transition cursor-pointer"
                        title="Quitar de la lista"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
            <span className="text-[11px] text-slate-400">
              Total insumos: <strong className="text-slate-100">{lineasEntrega.length}</strong>
            </span>
            <div className="flex items-center gap-2">
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
                className="px-5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 rounded-xl font-bold shadow-lg shadow-amber-500/20 cursor-pointer flex items-center gap-1.5"
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Registrando...
                  </>
                ) : (
                  `Registrar Entrega (${lineasEntrega.length} Insumos)`
                )}
              </button>
            </div>
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

      {/* Modal de Exportación: Reporte General y Específico */}
      <ConsolidadoOperadorModal
        isOpen={showReporteModal}
        onClose={() => setShowReporteModal(false)}
        movimientos={itemsAsMovimientos}
        catalogoItems={catalogoItems}
        initialOperador={reporteOperadorInicial}
      />
    </div>
  );
}

export default InstaladoresView;
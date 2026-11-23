import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  FileText,
  Plus,
  Search,
  Filter,
  CheckCircle,
  Clock,
  Send,
  CheckCircle2,
  XCircle,
  Download,
  Share2,
  FileSpreadsheet,
  Layers,
  Sparkles,
  DollarSign,
  Building2,
  Truck,
  Package,
  Wrench,
  Trash2,
  ArrowUpDown,
  RefreshCw,
  Eye,
  Edit3,
  X,
  AlertTriangle,
  Minus,
  Check,
  ShoppingCart,
  Users,
} from 'lucide-react';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { api } from '../services/api';
import {
  TALLERES,
  PROVEEDORES,
  PROVEEDORES_CONFIG,
  ESTADOS_COTIZACION,
  TIPOS_ITEM_COTIZACION,
  FACTOR_PEDIDO_DEFAULT,
  TASA_IVA_DEFAULT,
} from '../config/constants';
import { Badge } from '../components/Badge';
import { Modal } from '../components/Modal';

export function CotizacionesView({ onNavigateCompras }) {
  const [loading, setLoading] = useState(true);
  const [cotizaciones, setCotizaciones] = useState([]);
  const [preciosProveedor, setPreciosProveedor] = useState([]);
  const [catalogo, setCatalogo] = useState([]);
  const [filtroEstado, setFiltroEstado] = useState('TODOS');
  const [filtroProveedor, setFiltroProveedor] = useState('TODOS');
  const [searchTerm, setSearchTerm] = useState('');

  // Modales
  const [showEditorModal, setShowEditorModal] = useState(false);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [showItemLibreModal, setShowItemLibreModal] = useState(false);
  const [showPdfFinanzasModal, setShowPdfFinanzasModal] = useState(false);
  const [showPdfProveedorModal, setShowPdfProveedorModal] = useState(false);
  const [activeCotizacion, setActiveCotizacion] = useState(null);
  const [isExporting, setIsExporting] = useState(false);

  // Form State en Editor
  const [formCabecera, setFormCabecera] = useState({
    cotizacion_id: '',
    proveedor: 'Freund',
    taller_destino: 'Sonsonate',
    fecha: new Date().toISOString().split('T')[0],
    precios_incluyen_iva: false,
    estado: 'BORRADOR',
    notas: '',
  });
  const [formLineas, setFormLineas] = useState([]);
  const [filterTipoItem, setFilterTipoItem] = useState('TODOS'); // 'TODOS' | 'MATERIAL' | 'INSUMO' | 'EQUIPO'
  const [busquedaLinea, setBusquedaLinea] = useState('');
  const [busquedaCatalogoModal, setBusquedaCatalogoModal] = useState('');
  const [categoriaModal, setCategoriaModal] = useState('TODAS');
  const [loadingCatalogo, setLoadingCatalogo] = useState(false);

  // Estado para ítem libre / fuera de catálogo
  const [formItemLibre, setFormItemLibre] = useState({
    tipo_item: 'MATERIAL',
    sku: '',
    codigo_proveedor: '',
    descripcion: '',
    unidad: 'unidad',
    cantidad: 1,
    precio_unitario: 0,
    taller_linea: 'Sonsonate',
  });

  // Refs para exportar PDF
  const pdfFinanzasRef = useRef(null);
  const pdfProveedorRef = useRef(null);

  // Carga inicial de datos
  const fetchData = async () => {
    setLoading(true);
    try {
      const [cotRes, preRes, catRes] = await Promise.all([
        api.getCotizaciones(),
        api.getPreciosProveedor(),
        api.getCatalogo({ pageSize: 500 }).catch(() => ({ rows: [] })),
      ]);
      setCotizaciones(cotRes.rows || []);
      setPreciosProveedor(preRes.rows || []);
      setCatalogo(catRes.rows || []);
    } catch (err) {
      console.error('Error al cargar cotizaciones:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Sincronizar switch fiscal al cambiar de proveedor en el formulario
  const handleProveedorChange = (nuevoProv) => {
    const configProv = PROVEEDORES_CONFIG.find((p) => p.nombre.toLowerCase() === nuevoProv.toLowerCase());
    const incluyeIva = configProv ? configProv.incluyeIva : false;
    setFormCabecera((prev) => ({
      ...prev,
      proveedor: nuevoProv,
      precios_incluyen_iva: incluyeIva,
    }));
  };

  // Abrir modal para nueva cotización desde cero
  const handleNuevaCotizacion = () => {
    const provDefault = 'Freund';
    const configProv = PROVEEDORES_CONFIG.find((p) => p.nombre === provDefault);
    setFormCabecera({
      cotizacion_id: '',
      proveedor: provDefault,
      taller_destino: 'Sonsonate',
      fecha: new Date().toISOString().split('T')[0],
      precios_incluyen_iva: configProv ? configProv.incluyeIva : false,
      estado: 'BORRADOR',
      notas: '',
    });
    setFormLineas([]);
    setActiveCotizacion(null);
    setShowEditorModal(true);
  };

  // Abrir cotización sugerida desde Alertas Críticas (SDD R-41, R-42)
  const handleCotizarDesdeAlertas = async () => {
    setLoading(true);
    try {
      const res = await api.getCotizacionesFromAlerts({ proveedor: 'Freund' });
      const provDefault = res.proveedor || 'Freund';
      const configProv = PROVEEDORES_CONFIG.find((p) => p.nombre === provDefault);
      setFormCabecera({
        cotizacion_id: '',
        proveedor: provDefault,
        taller_destino: 'Sonsonate',
        fecha: new Date().toISOString().split('T')[0],
        precios_incluyen_iva: configProv ? configProv.incluyeIva : false,
        estado: 'BORRADOR',
        notas: 'Generada automáticamente desde semáforo de alertas críticas (Factor 1.9x)',
      });
      setFormLineas(res.lineas || []);
      setActiveCotizacion(null);
      setShowEditorModal(true);
    } catch (err) {
      alert('Error al generar sugerencia desde alertas: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Abrir cotización existente para ver/editar
  const handleEditarCotizacion = (cot) => {
    setActiveCotizacion(cot);
    setFormCabecera({
      cotizacion_id: cot.cotizacion_id,
      proveedor: cot.proveedor || 'Freund',
      taller_destino: cot.taller_destino || 'Sonsonate',
      fecha: cot.fecha || new Date().toISOString().split('T')[0],
      precios_incluyen_iva: Boolean(cot.precios_incluyen_iva),
      estado: cot.estado || 'BORRADOR',
      notas: cot.notas || '',
      uid: cot.uid,
    });
    setFormLineas(cot.lineas ? [...cot.lineas] : []);
    setShowEditorModal(true);
  };

  // Cambiar estado rápido
  const handleCambiarEstado = async (cot_id, nuevoEstado) => {
    try {
      await api.setEstadoCotizacion(cot_id, nuevoEstado);
      fetchData();
    } catch (err) {
      alert('Error al actualizar estado: ' + err.message);
    }
  };

  // Crear Hoja en Sheets (R-44)
  const handleCrearHojaEnSheets = async (cot_id) => {
    try {
      const res = await api.createCotizacionSheet(cot_id);
      alert(res.message || `Hoja ${cot_id} creada exitosamente en Google Sheets.`);
    } catch (err) {
      alert('Error al crear hoja en Sheets: ' + err.message);
    }
  };

  // Cálculos dinámicos de las líneas del formulario
  const calculosFormulario = useMemo(() => {
    const incluyeIva = Boolean(formCabecera.precios_incluyen_iva);
    let subtotalNeto = 0;
    let totalIva = 0;
    let totalGeneral = 0;
    let itemsMarcados = 0;

    formLineas.forEach((l) => {
      const cant = Number(l.cantidad) || 0;
      const precio = Number(l.precio_unitario) || 0;
      if (l.incluir && cant > 0) {
        itemsMarcados += 1;
        if (precio > 0) {
          if (incluyeIva) {
            const tot = cant * precio;
            const neto = tot / 1.13;
            const iva = tot - neto;
            subtotalNeto += neto;
            totalIva += iva;
            totalGeneral += tot;
          } else {
            const neto = cant * precio;
            const iva = neto * 0.13;
            const tot = neto + iva;
            subtotalNeto += neto;
            totalIva += iva;
            totalGeneral += tot;
          }
        }
      }
    });

    return {
      itemsMarcados,
      totalLineas: formLineas.length,
      subtotalNeto: Number(subtotalNeto.toFixed(2)),
      totalIva: Number(totalIva.toFixed(2)),
      totalGeneral: Number(totalGeneral.toFixed(2)),
    };
  }, [formLineas, formCabecera.precios_incluyen_iva]);

  // Manejador para actualizar una línea en el editor
  const handleUpdateLinea = (index, campo, valor) => {
    setFormLineas((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [campo]: valor };
      return copy;
    });
  };

  // Toggle marcar todos / desmarcar todos
  const handleToggleMarcarTodos = (marcar) => {
    setFormLineas((prev) =>
      prev.map((l) => ({
        ...l,
        incluir: marcar,
      }))
    );
  };

  // Remover línea del formulario
  const handleRemoverLinea = (index) => {
    setFormLineas((prev) => prev.filter((_, i) => i !== index));
  };

  // Agregar ítem del catálogo al formulario
  const handleAgregarItemCatalogo = (catItem) => {
    // Buscar si ya tiene precio histórico para este proveedor
    const matchPrecio = preciosProveedor.find(
      (p) => p.sku === catItem.sku && p.proveedor === formCabecera.proveedor
    ) || preciosProveedor.find((p) => p.sku === catItem.sku);

    let tipo = 'INSUMO';
    const gg = String(catItem.grupo_gasto || '').toLowerCase();
    const cat = String(catItem.categoria || '').toLowerCase();
    const sku = String(catItem.sku || '').toUpperCase();

    if (
      gg.includes('materia') ||
      gg.includes('material') ||
      cat.includes('metal') ||
      cat.includes('vidrio') ||
      cat.includes('liviana') ||
      sku.startsWith('MET') ||
      sku.startsWith('VID') ||
      sku.startsWith('LIV')
    ) {
      tipo = 'MATERIAL';
    } else if (
      gg.includes('equipo') ||
      cat.includes('equipo') ||
      cat.includes('herramienta') ||
      sku.startsWith('EQU')
    ) {
      tipo = 'EQUIPO';
    } else {
      tipo = 'INSUMO';
    }

    const nuevaLinea = {
      incluir: true,
      tipo_item: tipo,
      sku: catItem.sku,
      codigo_proveedor: matchPrecio?.codigo_proveedor || '',
      descripcion: catItem.descripcion,
      unidad: catItem.unidad || 'unidad',
      cantidad: Math.max(1, Math.ceil((Number(catItem.stock_minimo) || 5) * FACTOR_PEDIDO_DEFAULT - (Number(catItem.stock_actual) || 0))),
      precio_unitario: matchPrecio?.ultimo_precio || Number(catItem.precio_referencial_neto) || Number(catItem.precio_ref_neto) || 0,
      incluye_iva: formCabecera.precios_incluyen_iva,
      taller_linea: formCabecera.taller_destino,
    };

    setFormLineas((prev) => [...prev, nuevaLinea]);
    setShowAddItemModal(false);
  };

  // Agregar ítem libre / fuera de catálogo
  const handleAgregarItemLibre = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!formItemLibre.descripcion.trim()) {
      alert('La descripción del artículo o material es obligatoria.');
      return;
    }
    const cant = Number(formItemLibre.cantidad) || 1;
    if (cant <= 0) {
      alert('La cantidad a cotizar debe ser mayor a 0.');
      return;
    }

    const customSku = formItemLibre.sku.trim()
      ? formItemLibre.sku.trim().toUpperCase()
      : `EXT-${Date.now().toString().slice(-4)}`;

    const nuevaLinea = {
      incluir: true,
      tipo_item: formItemLibre.tipo_item || 'MATERIAL',
      sku: customSku,
      codigo_proveedor: formItemLibre.codigo_proveedor.trim(),
      descripcion: formItemLibre.descripcion.trim(),
      unidad: formItemLibre.unidad.trim() || 'unidad',
      cantidad: cant,
      precio_unitario: Number(formItemLibre.precio_unitario) || 0,
      incluye_iva: formCabecera.precios_incluyen_iva,
      taller_linea: formItemLibre.taller_linea || formCabecera.taller_destino,
      es_fuera_catalogo: true,
    };

    setFormLineas((prev) => [...prev, nuevaLinea]);
    setShowItemLibreModal(false);
  };

  // Guardar cotización (Crear o Actualizar)
  const handleGuardarCotizacion = async (nuevoEstado = null) => {
    if (formLineas.length === 0) {
      alert('Debes agregar al menos un ítem a la cotización antes de guardar.');
      return;
    }
    const estadoFinal = nuevoEstado || formCabecera.estado || 'BORRADOR';

    if (estadoFinal === 'APROBADA' && calculosFormulario.itemsMarcados === 0) {
      alert('Para aprobar la cotización para Finanzas, debes marcar al menos un ítem con el checkbox.');
      return;
    }

    const cabeceraFinal = {
      ...formCabecera,
      estado: estadoFinal,
      items_marcados: calculosFormulario.itemsMarcados,
      subtotal_neto: calculosFormulario.subtotalNeto,
      iva_13: calculosFormulario.totalIva,
      total: calculosFormulario.totalGeneral,
    };

    try {
      setLoading(true);
      if (formCabecera.cotizacion_id) {
        await api.updateCotizacion(formCabecera.cotizacion_id, {
          ...cabeceraFinal,
          lineas: formLineas,
        });
      } else {
        await api.createCotizacion(cabeceraFinal, formLineas);
      }
      setShowEditorModal(false);
      await fetchData();
    } catch (err) {
      alert('Error al guardar cotización: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Exportar PDF Finanzas (con IVA, precios y firmas)
  const handleExportPdfFinanzas = async () => {
    if (!pdfFinanzasRef.current) return;
    setIsExporting(true);
    try {
      const element = pdfFinanzasRef.current;
      const dataUrl = await toPng(element, {
        quality: 0.98,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
      });

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      pdf.addImage(dataUrl, 'PNG', 0, 0, 210, 297, undefined, 'FAST');
      const filename = `Cotizacion_${formCabecera.cotizacion_id || 'NUEVA'}_Finanzas_${formCabecera.proveedor}.pdf`;
      pdf.save(filename);
    } catch (err) {
      console.error('Error generando PDF Finanzas:', err);
      alert('Error al generar PDF: ' + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  // Exportar PDF Proveedor WhatsApp (sin precios, con código proveedor)
  const handleExportPdfProveedor = async () => {
    if (!pdfProveedorRef.current) return;
    setIsExporting(true);
    try {
      const element = pdfProveedorRef.current;
      const dataUrl = await toPng(element, {
        quality: 0.98,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
      });

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      pdf.addImage(dataUrl, 'PNG', 0, 0, 210, 297, undefined, 'FAST');
      const filename = `Pedido_${formCabecera.cotizacion_id || 'NUEVO'}_${formCabecera.proveedor}_WhatsApp.pdf`;
      pdf.save(filename);
    } catch (err) {
      console.error('Error generando PDF Proveedor:', err);
      alert('Error al generar PDF: ' + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  // Filtrado de la lista principal de cotizaciones
  const cotizacionesFiltradas = useMemo(() => {
    return cotizaciones.filter((c) => {
      const matchEstado = filtroEstado === 'TODOS' || c.estado === filtroEstado;
      const matchProv =
        filtroProveedor === 'TODOS' ||
        String(c.proveedor || '').toLowerCase().includes(filtroProveedor.toLowerCase());
      const s = searchTerm.toLowerCase();
      const matchSearch =
        !s ||
        (c.cotizacion_id || '').toLowerCase().includes(s) ||
        (c.proveedor || '').toLowerCase().includes(s) ||
        (c.taller_destino || '').toLowerCase().includes(s) ||
        (c.notas || '').toLowerCase().includes(s);

      return matchEstado && matchProv && matchSearch;
    });
  }, [cotizaciones, filtroEstado, filtroProveedor, searchTerm]);

  // Resumen de KPIs
  const kpis = useMemo(() => {
    let borrador = 0;
    let aprobada = 0;
    let enviada = 0;
    let totalMonto = 0;

    cotizaciones.forEach((c) => {
      if (c.estado === 'BORRADOR') borrador += 1;
      if (c.estado === 'APROBADA') aprobada += 1;
      if (c.estado === 'ENVIADA') enviada += 1;
      if (c.estado !== 'CANCELADA') {
        totalMonto += Number(c.total || 0);
      }
    });

    return {
      total: cotizaciones.length,
      borrador,
      aprobada,
      enviada,
      totalMonto: totalMonto.toFixed(2),
    };
  }, [cotizaciones]);

  // Líneas del formulario filtradas por tipo y búsqueda
  const formLineasFiltradas = useMemo(() => {
    return formLineas.filter((l) => {
      const matchTipo = filterTipoItem === 'TODOS' || l.tipo_item === filterTipoItem;
      const s = busquedaLinea.toLowerCase();
      const matchSearch =
        !s ||
        (l.sku || '').toLowerCase().includes(s) ||
        (l.descripcion || '').toLowerCase().includes(s) ||
        (l.codigo_proveedor || '').toLowerCase().includes(s);
      return matchTipo && matchSearch;
    });
  }, [formLineas, filterTipoItem, busquedaLinea]);

  const handleExportGeneral = () => {
    const headers = ['Cotización ID', 'Fecha', 'Proveedor', 'Destino', 'Estado', 'Fiscal', 'Ítems', 'Subtotal', 'IVA', 'Total', 'Notas'];
    const rows = cotizaciones.map((c) => [
      `"${c.cotizacion_id || ''}"`,
      `"${c.fecha || ''}"`,
      `"${c.proveedor || ''}"`,
      `"${c.taller_destino || ''}"`,
      `"${c.estado || ''}"`,
      `"${c.precios_incluyen_iva ? 'IVA Incluido' : '+13% IVA'}"`,
      c.items_marcados || (c.lineas ? c.lineas.filter((l) => l.incluir).length : 0),
      Number(c.subtotal_neto || 0).toFixed(2),
      Number(c.iva_13 || 0).toFixed(2),
      Number(c.total || 0).toFixed(2),
      `"${(c.notas || '').replace(/"/g, '""')}"`,
    ]);
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Reporte_General_Cotizaciones_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportEspecifico = () => {
    const headers = ['Cotización ID', 'Fecha', 'Proveedor', 'Destino', 'Estado', 'Fiscal', 'Ítems', 'Subtotal', 'IVA', 'Total', 'Notas'];
    const rows = cotizacionesFiltradas.map((c) => [
      `"${c.cotizacion_id || ''}"`,
      `"${c.fecha || ''}"`,
      `"${c.proveedor || ''}"`,
      `"${c.taller_destino || ''}"`,
      `"${c.estado || ''}"`,
      `"${c.precios_incluyen_iva ? 'IVA Incluido' : '+13% IVA'}"`,
      c.items_marcados || (c.lineas ? c.lineas.filter((l) => l.incluir).length : 0),
      Number(c.subtotal_neto || 0).toFixed(2),
      Number(c.iva_13 || 0).toFixed(2),
      Number(c.total || 0).toFixed(2),
      `"${(c.notas || '').replace(/"/g, '""')}"`,
    ]);
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Reporte_Especifico_Cotizaciones_${filterEstado}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & KPIs de Cotizaciones */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
              <h2 className="text-xl sm:text-2xl font-black text-slate-100 tracking-tight flex items-center gap-2">
                <FileText className="w-6 h-6 text-amber-500" />
                Módulo Maestro de Cotizaciones
                <span className="text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2.5 py-0.5 rounded-full">
                  v4.2 Clean Code
                </span>
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Cotizaciones multi-proveedor con cálculo transparente (R=6, SS, BOM), control fiscal de IVA y exportación para Finanzas / WhatsApp.
            </p>
          </div>

          {/* Botones de Acción Principal */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleExportGeneral}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30 text-xs font-bold rounded-xl transition cursor-pointer min-h-[44px]"
              title="Exportar Reporte General de Cotizaciones en CSV"
            >
              <Users className="w-4 h-4 text-emerald-400" />
              <span>Reporte General</span>
            </button>
            <button
              type="button"
              onClick={handleExportEspecifico}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-sky-400 border border-sky-500/30 text-xs font-bold rounded-xl transition cursor-pointer min-h-[44px]"
              title="Exportar Reporte Específico Filtrado en CSV"
            >
              <FileText className="w-4 h-4 text-sky-400" />
              <span>Reporte Específico</span>
            </button>
            <button
              onClick={handleCotizarDesdeAlertas}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-bold text-xs shadow-lg shadow-rose-950/40 cursor-pointer min-h-[44px] transition-all transform active:scale-95"
            >
              <Sparkles className="w-4 h-4" />
              Cotizar Sugerencias Abastecimiento
            </button>
            <button
              onClick={handleNuevaCotizacion}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 cursor-pointer min-h-[44px] transition-all transform active:scale-95"
            >
              <Plus className="w-4 h-4" />
              Nueva Cotización
            </button>
          </div>
        </div>

        {/* Tarjetas KPI */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 sm:p-4">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Cotizaciones
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl sm:text-2xl font-black text-slate-100">{kpis.total}</span>
              <span className="text-xs text-slate-500 font-medium">totales</span>
            </div>
          </div>

          <div className="bg-slate-950/60 border border-amber-500/20 rounded-xl p-3 sm:p-4">
            <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block">
              Borradores
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl sm:text-2xl font-black text-amber-400">{kpis.borrador}</span>
              <span className="text-xs text-amber-500/80 font-medium">en preparación</span>
            </div>
          </div>

          <div className="bg-slate-950/60 border border-sky-500/20 rounded-xl p-3 sm:p-4">
            <span className="text-[11px] font-bold text-sky-400 uppercase tracking-wider block">
              Aprobadas / Enviadas
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl sm:text-2xl font-black text-sky-400">
                {kpis.aprobada + kpis.enviada}
              </span>
              <span className="text-xs text-sky-500/80 font-medium">en tránsito</span>
            </div>
          </div>

          <div className="bg-slate-950/60 border border-emerald-500/20 rounded-xl p-3 sm:p-4">
            <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block">
              Total Presupuestado
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl sm:text-2xl font-black text-emerald-400">
                ${kpis.totalMonto}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Barra de Filtros y Búsqueda */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/60 border border-slate-800 p-3 rounded-xl">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por ID, proveedor, taller o notas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 min-h-[44px]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Filtro Estado */}
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500 min-h-[44px]"
          >
            <option value="TODOS">Todos los Estados</option>
            {ESTADOS_COTIZACION.map((est) => (
              <option key={est} value={est}>
                {est}
              </option>
            ))}
          </select>

          {/* Filtro Proveedor */}
          <select
            value={filtroProveedor}
            onChange={(e) => setFiltroProveedor(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500 min-h-[44px]"
          >
            <option value="TODOS">Todos los Proveedores</option>
            {PROVEEDORES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>

          <button
            onClick={fetchData}
            title="Refrescar lista"
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 3. Listado de Cotizaciones */}
      <div className="space-y-3">
        {loading ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-amber-500 mb-2" />
            <p className="text-sm">Cargando cotizaciones...</p>
          </div>
        ) : cotizacionesFiltradas.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
            <FileText className="w-10 h-10 mx-auto text-slate-600 mb-2" />
            <p className="text-base font-bold text-slate-300">No se encontraron cotizaciones</p>
            <p className="text-xs text-slate-500 mt-1">
              Crea una nueva cotización o genera una automática desde Alertas Críticas.
            </p>
          </div>
        ) : (
          cotizacionesFiltradas.map((cot) => {
            const isFreund = cot.proveedor?.toLowerCase().includes('freund');
            const isLemus = cot.proveedor?.toLowerCase().includes('lemus');
            const isDidelco = cot.proveedor?.toLowerCase().includes('didelco');

            return (
              <div
                key={cot.cotizacion_id}
                className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 sm:p-5 transition-all shadow-md flex flex-col lg:flex-row lg:items-center justify-between gap-4"
              >
                {/* Datos Principales */}
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-black text-amber-400 text-base">
                      {typeof cot.cotizacion_id === 'object'
                        ? (cot.cotizacion_id?.formatted || cot.uid || 'COT-???')
                        : (String(cot.cotizacion_id).includes('object Object')
                          ? (cot.uid || 'COT-???')
                          : (cot.cotizacion_id || cot.uid || 'COT-???'))}
                    </span>

                    {/* Badge de Estado */}
                    <span
                      className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border ${
                        cot.estado === 'APROBADA'
                          ? 'bg-sky-500/10 text-sky-400 border-sky-500/30'
                          : cot.estado === 'ENVIADA'
                          ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30'
                          : cot.estado === 'RECIBIDA'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : cot.estado === 'CANCELADA'
                          ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                          : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                      }`}
                    >
                      {cot.estado}
                    </span>

                    <span className="text-xs text-slate-400">· {cot.fecha}</span>

                    {/* Badge fiscal */}
                    <span className="text-[10px] font-semibold bg-slate-800 text-slate-300 px-2 py-0.5 rounded-md">
                      {cot.precios_incluyen_iva ? 'IVA Incluido' : '+13% IVA'}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
                    <span className="flex items-center gap-1 font-bold text-slate-100">
                      <Building2 className="w-3.5 h-3.5 text-amber-500" />
                      {cot.proveedor}
                    </span>
                    <span className="text-slate-500">|</span>
                    <span className="flex items-center gap-1 text-slate-400">
                      <Truck className="w-3.5 h-3.5 text-slate-500" />
                      Destino: <strong className="text-slate-200">{cot.taller_destino}</strong>
                    </span>
                    <span className="text-slate-500">|</span>
                    <span className="text-slate-400">
                      Ítems:{' '}
                      <strong className="text-amber-400">
                        {cot.items_marcados || (cot.lineas ? cot.lineas.filter((l) => l.incluir).length : 0)}
                      </strong>
                    </span>
                  </div>

                  {cot.notas && (
                    <p className="text-xs text-slate-400 italic truncate max-w-xl">
                      "{cot.notas}"
                    </p>
                  )}
                </div>

                {/* Importes Financieros */}
                <div className="flex items-center gap-6 border-t lg:border-t-0 lg:border-l border-slate-800 pt-3 lg:pt-0 lg:pl-6 shrink-0">
                  <div className="text-left lg:text-right">
                    <div className="text-[11px] text-slate-400 font-medium">Total Cotización</div>
                    <div className="text-xl sm:text-2xl font-black text-emerald-400">
                      ${Number(cot.total || 0).toFixed(2)}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      Sub: ${Number(cot.subtotal_neto || 0).toFixed(2)} + IVA: ${Number(cot.iva_13 || 0).toFixed(2)}
                    </div>
                  </div>

                  {/* Acciones Rápidas */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      onClick={() => handleEditarCotizacion(cot)}
                      className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 min-h-[44px] cursor-pointer transition-all"
                    >
                      <Edit3 className="w-4 h-4 text-amber-400" />
                      Editar
                    </button>

                    <button
                      onClick={() => {
                        setActiveCotizacion(cot);
                        setFormCabecera({
                          cotizacion_id: cot.cotizacion_id,
                          proveedor: cot.proveedor || 'Freund',
                          taller_destino: cot.taller_destino || 'Sonsonate',
                          fecha: cot.fecha || new Date().toISOString().split('T')[0],
                          precios_incluyen_iva: Boolean(cot.precios_incluyen_iva),
                          estado: cot.estado || 'BORRADOR',
                          notas: cot.notas || '',
                          uid: cot.uid,
                        });
                        setFormLineas(cot.lineas ? [...cot.lineas] : []);
                        setShowPdfFinanzasModal(true);
                      }}
                      title="Generar PDF Formal para Finanzas (con IVA y firmas)"
                      className="p-2.5 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/30 min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer transition-all"
                    >
                      <FileText className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => {
                        setActiveCotizacion(cot);
                        setFormCabecera({
                          cotizacion_id: cot.cotizacion_id,
                          proveedor: cot.proveedor || 'Freund',
                          taller_destino: cot.taller_destino || 'Sonsonate',
                          fecha: cot.fecha || new Date().toISOString().split('T')[0],
                          precios_incluyen_iva: Boolean(cot.precios_incluyen_iva),
                          estado: cot.estado || 'BORRADOR',
                          notas: cot.notas || '',
                          uid: cot.uid,
                        });
                        setFormLineas(cot.lineas ? [...cot.lineas] : []);
                        setShowPdfProveedorModal(true);
                      }}
                      title="Generar PDF / Imagen para WhatsApp Proveedor (sin precios)"
                      className="p-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer transition-all"
                    >
                      <Share2 className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleCrearHojaEnSheets(cot.cotizacion_id)}
                      title="Crear Hoja Individual en Google Sheets (R-44)"
                      className="p-2.5 rounded-xl bg-violet-500/10 hover:bg-violet-500/20 text-violet-400 border border-violet-500/30 min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer transition-all"
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                    </button>

                    {/* Generar Orden de Compra (Cruce de 3 Vías v4.2 - SDD-012) */}
                    {(cot.estado === 'APROBADA' || cot.estado === 'RECIBIDA') && (
                      <button
                        onClick={async () => {
                          if (window.confirm(`¿Generar Orden de Compra formal para ${cot.cotizacion_id}?`)) {
                            try {
                              const res = await api.createOrdenFromCotizacion(cot.cotizacion_id);
                              alert(`Orden de Compra ${res.oc_id || ''} generada exitosamente.`);
                              await fetchData();
                            } catch (e) {
                              alert('Error al generar Orden de Compra: ' + e.message);
                            }
                          }
                        }}
                        title="Generar Orden de Compra formal (Cruce de 3 Vías v4.2)"
                        className="px-2.5 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold flex items-center gap-1.5 min-h-[44px] cursor-pointer transition-all"
                      >
                        <ShoppingCart className="w-3.5 h-3.5" />
                        <span>Generar OC</span>
                      </button>
                    )}

                    {/* Selector de Estado */}
                    <select
                      value={cot.estado}
                      onChange={(e) => handleCambiarEstado(cot.cotizacion_id, e.target.value)}
                      className="bg-slate-950 border border-slate-700 rounded-xl px-2 py-2 text-xs text-slate-300 focus:outline-none min-h-[44px]"
                    >
                      {ESTADOS_COTIZACION.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ======================================================== */}
      {/* 4. MODAL GENERADOR Y EDITOR DE COTIZACIONES              */}
      {/* ======================================================== */}
      {showEditorModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="h-16 px-4 sm:px-6 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-900/90">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-100 flex items-center gap-2">
                    {formCabecera.cotizacion_id
                      ? `Editar Cotización ${formCabecera.cotizacion_id}`
                      : 'Nueva Solicitud de Cotización'}
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                      R-43 & R-44
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Selecciona ítems con checkbox, ajusta cantidades con factor 1.9x y edita precios del proveedor.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowEditorModal(false)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: Configuración Cabecera */}
            <div className="overflow-y-auto p-4 sm:p-6 space-y-5 flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                {/* Proveedor */}
                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Proveedor
                  </label>
                  <select
                    value={formCabecera.proveedor}
                    onChange={(e) => handleProveedorChange(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500 min-h-[44px]"
                  >
                    {PROVEEDORES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Taller Destino */}
                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Taller / Destino
                  </label>
                  <select
                    value={formCabecera.taller_destino}
                    onChange={(e) =>
                      setFormCabecera((prev) => ({ ...prev, taller_destino: e.target.value }))
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500 min-h-[44px]"
                  >
                    {TALLERES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                    <option value="Consolidado Multi-Taller">Consolidado Multi-Taller (Sonsonate + Santa Ana)</option>
                  </select>
                </div>

                {/* Fecha */}
                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Fecha de Cotización
                  </label>
                  <input
                    type="date"
                    value={formCabecera.fecha}
                    onChange={(e) =>
                      setFormCabecera((prev) => ({ ...prev, fecha: e.target.value }))
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500 min-h-[44px]"
                  />
                </div>

                {/* Switch Fiscal IVA */}
                <div className="flex flex-col justify-center">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Condición Fiscal
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setFormCabecera((prev) => ({
                        ...prev,
                        precios_incluyen_iva: !prev.precios_incluyen_iva,
                      }))
                    }
                    className={`flex items-center justify-between px-3 py-2 rounded-xl border text-xs font-bold cursor-pointer min-h-[44px] transition-all ${
                      formCabecera.precios_incluyen_iva
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                        : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                    }`}
                  >
                    <span>
                      {formCabecera.precios_incluyen_iva
                        ? 'Precios INCLUYEN IVA'
                        : 'Precios SIN IVA (+13% al pie)'}
                    </span>
                    <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded">
                      Cambiar
                    </span>
                  </button>
                </div>
              </div>

              {/* Barra de Filtros de Líneas & Acciones en Lote */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                {/* Tabs de tipo de ítem */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  {[
                    { id: 'TODOS', label: 'Todos' },
                    { id: 'MATERIAL', label: 'Materiales' },
                    { id: 'INSUMO', label: 'Insumos' },
                    { id: 'EQUIPO', label: 'Equipos' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setFilterTipoItem(tab.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                        filterTipoItem === tab.id
                          ? 'bg-amber-500 text-slate-950 shadow-sm'
                          : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Acciones de Selección y Agregar */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleMarcarTodos(true)}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer"
                  >
                    Marcar Todos
                  </button>
                  <button
                    onClick={() => handleToggleMarcarTodos(false)}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer"
                  >
                    Desmarcar
                  </button>
                  <button
                    onClick={() => {
                      setBusquedaCatalogoModal('');
                      setCategoriaModal('TODAS');
                      setShowAddItemModal(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-xs font-bold cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Agregar del Catálogo
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFormItemLibre({
                        tipo_item: 'MATERIAL',
                        sku: '',
                        codigo_proveedor: '',
                        descripcion: '',
                        unidad: 'unidad',
                        cantidad: 1,
                        precio_unitario: 0,
                        taller_linea: formCabecera.taller_destino || 'Sonsonate',
                      });
                      setShowItemLibreModal(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/30 text-xs font-bold cursor-pointer transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    + Ítem Fuera de Catálogo
                  </button>
                </div>
              </div>

              {/* Tabla Interactiva de Líneas */}
              <div className="border border-slate-800 rounded-xl overflow-x-auto bg-slate-950/40">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 uppercase font-semibold bg-slate-900/80">
                      <th className="py-2.5 px-3 text-center w-12">Incluir</th>
                      <th className="py-2.5 px-3 w-24">Tipo</th>
                      <th className="py-2.5 px-3 w-28">SKU</th>
                      <th className="py-2.5 px-3 w-32">Cód. Prov.</th>
                      <th className="py-2.5 px-3">Descripción</th>
                      <th className="py-2.5 px-3 w-20">Unidad</th>
                      <th className="py-2.5 px-3 w-32 text-center">Cantidad</th>
                      <th className="py-2.5 px-3 w-32 text-right">Precio Unit. $</th>
                      <th className="py-2.5 px-3 w-28 text-right">Total $</th>
                      <th className="py-2.5 px-3 w-10 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {formLineasFiltradas.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-8 text-center text-slate-500">
                          No hay ítems en esta categoría. Agrega ítems usando el botón superior.
                        </td>
                      </tr>
                    ) : (
                      formLineasFiltradas.map((linea, idx) => {
                        const originalIndex = formLineas.indexOf(linea);
                        const cant = Number(linea.cantidad || 0);
                        const precio = Number(linea.precio_unitario || 0);
                        let subtotalLinea = 0;

                        if (formCabecera.precios_incluyen_iva) {
                          subtotalLinea = cant * precio;
                        } else {
                          subtotalLinea = cant * precio * 1.13;
                        }

                        return (
                          <tr
                            key={linea.sku + idx}
                            className={`hover:bg-slate-800/40 transition-colors ${
                              linea.incluir ? 'bg-amber-500/[0.02]' : 'opacity-60 bg-slate-950/40'
                            }`}
                          >
                            {/* Checkbox Incluir */}
                            <td className="py-2 px-3 text-center">
                              <input
                                type="checkbox"
                                checked={Boolean(linea.incluir)}
                                onChange={(e) =>
                                  handleUpdateLinea(originalIndex, 'incluir', e.target.checked)
                                }
                                className="w-5 h-5 rounded accent-amber-500 cursor-pointer min-h-[24px]"
                              />
                            </td>

                            {/* Tipo Ítem */}
                            <td className="py-2 px-3">
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                  linea.tipo_item === 'MATERIAL'
                                    ? 'bg-blue-500/10 text-blue-400'
                                    : linea.tipo_item === 'EQUIPO'
                                    ? 'bg-purple-500/10 text-purple-400'
                                    : 'bg-emerald-500/10 text-emerald-400'
                                }`}
                              >
                                {linea.tipo_item}
                              </span>
                            </td>

                            {/* SKU */}
                            <td className="py-2 px-3 font-mono font-bold text-amber-400">
                              <div className="flex items-center gap-1.5">
                                <span>{linea.sku}</span>
                                {linea.es_fuera_catalogo && (
                                  <span className="text-[9px] font-sans font-bold px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30">
                                    Extra
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Código Proveedor */}
                            <td className="py-2 px-3">
                              <input
                                type="text"
                                placeholder="Cód..."
                                value={linea.codigo_proveedor || ''}
                                onChange={(e) =>
                                  handleUpdateLinea(
                                    originalIndex,
                                    'codigo_proveedor',
                                    e.target.value
                                  )
                                }
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                              />
                            </td>

                            {/* Descripción */}
                            <td className="py-2 px-3 text-slate-200 font-medium max-w-xs">
                              {linea.es_fuera_catalogo ? (
                                <input
                                  type="text"
                                  value={linea.descripcion || ''}
                                  onChange={(e) =>
                                    handleUpdateLinea(originalIndex, 'descripcion', e.target.value)
                                  }
                                  placeholder="Descripción del ítem..."
                                  className="w-full bg-slate-950 border border-sky-500/40 rounded-lg px-2 py-1 text-xs text-slate-100 focus:outline-none focus:border-sky-400"
                                />
                              ) : (
                                <span className="truncate block" title={linea.descripcion}>
                                  {linea.descripcion}
                                </span>
                              )}
                              {linea.desglose_calculo && (
                                <span className="text-[10px] text-amber-400/90 font-mono block mt-0.5" title="Desglose de Abastecimiento Periódico (SDD-010)">
                                  IP:{linea.desglose_calculo.ip} · Demanda:{linea.desglose_calculo.demanda_periodo} + BOM:{linea.desglose_calculo.demanda_bom} · SS:{linea.desglose_calculo.stock_seguridad} · S:{linea.desglose_calculo.objetivo_s} ({linea.desglose_calculo.modo_calculo})
                                </span>
                              )}
                            </td>

                            {/* Unidad */}
                            <td className="py-2 px-3 text-slate-400">{linea.unidad}</td>

                            {/* Cantidad con Steppers */}
                            <td className="py-2 px-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleUpdateLinea(
                                      originalIndex,
                                      'cantidad',
                                      Math.max(1, cant - 1)
                                    )
                                  }
                                  className="w-7 h-7 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center cursor-pointer"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <input
                                  type="number"
                                  min="1"
                                  value={linea.cantidad || ''}
                                  onChange={(e) =>
                                    handleUpdateLinea(
                                      originalIndex,
                                      'cantidad',
                                      Math.max(0, Number(e.target.value))
                                    )
                                  }
                                  className="w-16 bg-slate-950 border border-slate-700 rounded-lg px-1.5 py-1 text-center font-bold text-slate-100 focus:outline-none focus:border-amber-500"
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleUpdateLinea(originalIndex, 'cantidad', cant + 1)
                                  }
                                  className="w-7 h-7 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center cursor-pointer"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>
                            </td>

                            {/* Precio Unitario */}
                            <td className="py-2 px-3 text-right">
                              <div className="relative">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs">
                                  $
                                </span>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={linea.precio_unitario || ''}
                                  onChange={(e) =>
                                    handleUpdateLinea(
                                      originalIndex,
                                      'precio_unitario',
                                      Math.max(0, Number(e.target.value))
                                    )
                                  }
                                  className="w-24 bg-slate-950 border border-slate-700 rounded-lg pl-5 pr-2 py-1 text-right font-bold text-slate-100 focus:outline-none focus:border-amber-500"
                                />
                              </div>
                            </td>

                            {/* Total Línea */}
                            <td className="py-2 px-3 text-right font-black text-emerald-400">
                              {linea.incluir ? `$${subtotalLinea.toFixed(2)}` : '$0.00'}
                            </td>

                            {/* Eliminar Línea */}
                            <td className="py-2 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoverLinea(originalIndex)}
                                className="text-slate-500 hover:text-rose-400 p-1 cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Notas de la cotización */}
              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Notas / Observaciones de la Cotización
                </label>
                <textarea
                  rows={2}
                  placeholder="Ej: Materiales para obra en Sonsonate, entrega requerida antes del viernes..."
                  value={formCabecera.notas}
                  onChange={(e) =>
                    setFormCabecera((prev) => ({ ...prev, notas: e.target.value }))
                  }
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {/* Modal Footer: Sticky Summary Bar */}
            <div className="h-20 px-4 sm:px-6 border-t border-slate-800 bg-slate-950/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
              {/* Desglose Financiero */}
              <div className="flex items-center gap-4 text-xs">
                <div>
                  <span className="text-slate-500 block text-[10px]">Ítems Marcados:</span>
                  <span className="font-bold text-slate-200">
                    {calculosFormulario.itemsMarcados} de {calculosFormulario.totalLineas}
                  </span>
                </div>
                <div className="border-l border-slate-800 pl-3">
                  <span className="text-slate-500 block text-[10px]">Subtotal Neto:</span>
                  <span className="font-bold text-slate-300">
                    ${calculosFormulario.subtotalNeto}
                  </span>
                </div>
                <div className="border-l border-slate-800 pl-3">
                  <span className="text-slate-500 block text-[10px]">IVA (13%):</span>
                  <span className="font-bold text-amber-400">
                    ${calculosFormulario.totalIva}
                  </span>
                </div>
                <div className="border-l border-slate-800 pl-3">
                  <span className="text-slate-500 block text-[10px]">Total Cotización:</span>
                  <span className="font-black text-emerald-400 text-base">
                    ${calculosFormulario.totalGeneral}
                  </span>
                </div>
              </div>

              {/* Botones de Acción */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowEditorModal(false)}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold min-h-[44px] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => handleGuardarCotizacion('BORRADOR')}
                  className="px-3.5 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-bold min-h-[44px] cursor-pointer"
                >
                  Guardar Borrador
                </button>
                <button
                  type="button"
                  onClick={() => handleGuardarCotizacion('APROBADA')}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs shadow-md shadow-emerald-950/40 min-h-[44px] cursor-pointer"
                >
                  Aprobar para Finanzas
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 5. MODAL DE ADICIÓN DE ÍTEM DESDE CATÁLOGO MAESTRO      */}
      {/* ======================================================== */}
      {showAddItemModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-60 flex items-center justify-center p-3 sm:p-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Package className="w-4 h-4 text-amber-500" />
                Agregar Ítem del Catálogo Maestro
              </h4>
              <button
                onClick={() => setShowAddItemModal(false)}
                className="p-1 rounded text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 border-b border-slate-800 bg-slate-950 space-y-2">
              <div className="relative">
                <input
                  type="text"
                  autoFocus
                  placeholder="Buscar por SKU, descripción o palabra clave (ej. lija, thinner, tubo)..."
                  value={busquedaCatalogoModal}
                  onChange={(e) => setBusquedaCatalogoModal(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-8 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
                <Package className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                {busquedaCatalogoModal && (
                  <button
                    onClick={() => setBusquedaCatalogoModal('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Chips Rápidos de Categoría */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-[11px]">
                {[
                  'TODAS',
                  'Abrasivos',
                  'Consumibles y EPP',
                  'Selladores y adhesivos',
                  'Metal y estructura',
                  'Vidrio',
                  'Herrajes y accesorios',
                  'Equipos y herramientas',
                  'Pintura y recubrimientos',
                  'Construcción liviana',
                ].map((catName) => {
                  const isSel = categoriaModal === catName;
                  return (
                    <button
                      key={catName}
                      type="button"
                      onClick={() => setCategoriaModal(catName)}
                      className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition cursor-pointer ${
                        isSel
                          ? 'bg-amber-500 text-slate-950 font-bold'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {catName}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="overflow-y-auto p-3 space-y-2 flex-1 min-h-[300px]">
              {catalogo.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-3">
                  <Package className="w-8 h-8 text-amber-500/50 animate-pulse" />
                  <p>El catálogo maestro no tiene artículos cargados aún o está sincronizando.</p>
                  <button
                    type="button"
                    disabled={loadingCatalogo}
                    onClick={async () => {
                      setLoadingCatalogo(true);
                      try {
                        const res = await api.getCatalogo({ pageSize: 500 });
                        setCatalogo(res.rows || []);
                      } catch (err) {
                        console.error('Error cargando catalogo:', err);
                      } finally {
                        setLoadingCatalogo(false);
                      }
                    }}
                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg transition"
                  >
                    {loadingCatalogo ? 'Cargando Catálogo...' : 'Recargar Catálogo Maestro'}
                  </button>
                </div>
              ) : (() => {
                const s = busquedaCatalogoModal.trim().toLowerCase();
                const filtrados = catalogo
                  .filter((c) => {
                    const matchCat =
                      categoriaModal === 'TODAS' ||
                      String(c.categoria || '').toLowerCase() === categoriaModal.toLowerCase();
                    const matchText =
                      !s ||
                      (c.sku || '').toLowerCase().includes(s) ||
                      (c.descripcion || '').toLowerCase().includes(s) ||
                      (c.categoria || '').toLowerCase().includes(s) ||
                      (c.sku_anterior || '').toLowerCase().includes(s);
                    return matchCat && matchText;
                  })
                  .slice(0, 60);

                if (filtrados.length === 0) {
                  return (
                    <div className="p-8 text-center text-slate-500 text-xs">
                      No se encontraron artículos con el filtro actual &quot;{busquedaCatalogoModal}&quot;.
                    </div>
                  );
                }

                return filtrados.map((item) => {
                  const sku = String(item.sku || '').toUpperCase();
                  const cat = String(item.categoria || '').toLowerCase();
                  let tipoBadge = 'INSUMO';
                  let tipoColor = 'text-amber-400 bg-amber-500/10 border-amber-500/20';

                  if (
                    cat.includes('metal') ||
                    cat.includes('vidrio') ||
                    cat.includes('liviana') ||
                    sku.startsWith('MET') ||
                    sku.startsWith('VID') ||
                    sku.startsWith('LIV')
                  ) {
                    tipoBadge = 'MATERIAL';
                    tipoColor = 'text-sky-400 bg-sky-500/10 border-sky-500/20';
                  } else if (
                    cat.includes('equipo') ||
                    cat.includes('herramienta') ||
                    sku.startsWith('EQU')
                  ) {
                    tipoBadge = 'EQUIPO';
                    tipoColor = 'text-purple-400 bg-purple-500/10 border-purple-500/20';
                  }

                  return (
                    <div
                      key={item.sku}
                      className="p-2.5 rounded-xl bg-slate-950/50 hover:bg-slate-800/80 border border-slate-800 flex items-center justify-between gap-3 transition-colors cursor-pointer group"
                      onClick={() => handleAgregarItemCatalogo(item)}
                    >
                      <div className="overflow-hidden">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-amber-400 text-xs">
                            {item.sku}
                          </span>
                          <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-400">
                            {item.categoria}
                          </span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${tipoColor}`}>
                            {tipoBadge}
                          </span>
                        </div>
                        <p className="text-xs text-slate-200 mt-0.5 truncate group-hover:text-white">
                          {item.descripcion}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-[11px] text-slate-400">
                          Stock: <strong>{item.stock_actual ?? 0}</strong> {item.unidad || 'und'}
                        </div>
                        <button
                          type="button"
                          className="text-xs font-bold text-amber-400 hover:text-amber-300 mt-1"
                        >
                          + Seleccionar
                        </button>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 5.1 MODAL DE ÍTEM LIBRE / FUERA DE CATÁLOGO              */}
      {/* ======================================================== */}
      {showItemLibreModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-60 flex items-center justify-center p-3 sm:p-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-500/30 flex items-center justify-center text-sky-400">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-100">
                    Agregar Ítem Fuera de Catálogo
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Materiales especiales o insumos no registrados en el catálogo
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowItemLibreModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAgregarItemLibre} className="p-4 space-y-3.5 text-xs">
              {/* Tipo de Ítem */}
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Tipo de Ítem
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'MATERIAL', label: 'Material' },
                    { id: 'INSUMO', label: 'Insumo' },
                    { id: 'EQUIPO', label: 'Equipo' },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setFormItemLibre({ ...formItemLibre, tipo_item: t.id })}
                      className={`py-2 px-3 rounded-xl font-bold text-xs border cursor-pointer transition ${
                        formItemLibre.tipo_item === t.id
                          ? 'bg-sky-500/20 border-sky-500/50 text-sky-300'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Descripción */}
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Descripción del Artículo o Material <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="Ej: Vidrio templado 10mm canto pulido 2.10x0.90m..."
                  value={formItemLibre.descripcion}
                  onChange={(e) => setFormItemLibre({ ...formItemLibre, descripcion: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-400 min-h-[40px]"
                />
              </div>

              {/* SKU Provisorio & Código Proveedor */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    SKU Provisorio <span className="text-slate-500 font-normal">(Opcional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: EXT-VIDRIO o vacío (auto)"
                    value={formItemLibre.sku}
                    onChange={(e) => setFormItemLibre({ ...formItemLibre, sku: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-amber-400 font-mono placeholder-slate-600 focus:outline-none focus:border-sky-400 min-h-[40px]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Cód. Proveedor <span className="text-slate-500 font-normal">(Opcional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: REF-99482"
                    value={formItemLibre.codigo_proveedor}
                    onChange={(e) => setFormItemLibre({ ...formItemLibre, codigo_proveedor: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-sky-400 min-h-[40px]"
                  />
                </div>
              </div>

              {/* Unidad, Cantidad & Precio Unitario */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Unidad
                  </label>
                  <select
                    value={formItemLibre.unidad}
                    onChange={(e) => setFormItemLibre({ ...formItemLibre, unidad: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-sky-400 min-h-[40px]"
                  >
                    <option value="unidad">unidad</option>
                    <option value="pliego">pliego</option>
                    <option value="metro">metro</option>
                    <option value="m2">m2</option>
                    <option value="tubo">tubo</option>
                    <option value="lámina">lámina</option>
                    <option value="galón">galón</option>
                    <option value="libra">libra</option>
                    <option value="rollo">rollo</option>
                    <option value="caja">caja</option>
                    <option value="juego">juego</option>
                    <option value="par">par</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Cantidad <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    value={formItemLibre.cantidad}
                    onChange={(e) => setFormItemLibre({ ...formItemLibre, cantidad: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 font-bold focus:outline-none focus:border-sky-400 min-h-[40px]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Precio Unit. $
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formItemLibre.precio_unitario}
                    onChange={(e) => setFormItemLibre({ ...formItemLibre, precio_unitario: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-emerald-400 font-bold focus:outline-none focus:border-sky-400 min-h-[40px]"
                  />
                </div>
              </div>

              {/* Botones de Acción */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowItemLibreModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs min-h-[40px] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white font-bold text-xs shadow-md shadow-sky-950/40 min-h-[40px] cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  Agregar a la Cotización
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 6. MODAL VISOR Y EXPORTADOR PDF FINANZAS                */}
      {/* ======================================================== */}
      {showPdfFinanzasModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[95vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Header del Visor */}
            <div className="h-14 px-4 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-900">
              <span className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <FileText className="w-4 h-4 text-sky-400" />
                Vista Previa — Solicitud Formal para Finanzas (Con IVA y Firmas)
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportPdfFinanzas}
                  disabled={isExporting}
                  className="px-3.5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer min-h-[40px]"
                >
                  <Download className="w-4 h-4" />
                  {isExporting ? 'Generando...' : 'Descargar PDF'}
                </button>
                <button
                  onClick={() => setShowPdfFinanzasModal(false)}
                  className="p-2 rounded text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Hoja A4 en Alta Resolución con Estilos Hex Directos */}
            <div className="overflow-y-auto p-4 sm:p-8 bg-slate-950 flex justify-center">
              <div
                ref={pdfFinanzasRef}
                style={{
                  width: '210mm',
                  minHeight: '297mm',
                  backgroundColor: '#ffffff',
                  color: '#0f172a',
                  padding: '16mm 18mm',
                  boxSizing: 'border-box',
                  fontFamily: 'Arial, sans-serif',
                }}
                className="shadow-2xl rounded-sm"
              >
                {/* Cabecera Corporativa */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #ea580c', paddingBottom: '12px' }}>
                  <div>
                    <h1 style={{ fontSize: '20px', fontWeight: '900', color: '#0f172a', margin: '0' }}>
                      GRUPO DECORM
                    </h1>
                    <p style={{ fontSize: '10px', fontWeight: '700', color: '#ea580c', textTransform: 'uppercase', margin: '2px 0 0 0', letterSpacing: '1px' }}>
                      Sistema Maestro de Abastecimiento & Compras
                    </p>
                    <p style={{ fontSize: '12px', fontWeight: '800', color: '#334155', margin: '6px 0 0 0' }}>
                      SOLICITUD DE COTIZACIÓN Y COMPRA
                    </p>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-block', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '6px 12px' }}>
                      <span style={{ fontSize: '10px', color: '#64748b', display: 'block', textTransform: 'uppercase', fontWeight: '700' }}>
                        N.º Cotización
                      </span>
                      <span style={{ fontSize: '16px', fontWeight: '900', color: '#ea580c', fontFamily: 'monospace' }}>
                        {formCabecera.cotizacion_id || 'COT-26-001'}
                      </span>
                    </div>
                    <div style={{ fontSize: '10px', color: '#64748b', marginTop: '4px' }}>
                      Emisión: {formCabecera.fecha}
                    </div>
                  </div>
                </div>

                {/* Datos del Proveedor y Taller */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', margin: '14px 0', backgroundColor: '#f8fafc', padding: '10px 14px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '11px' }}>
                  <div>
                    <div style={{ color: '#64748b', fontWeight: '700' }}>PROVEEDOR:</div>
                    <div style={{ fontWeight: '800', fontSize: '12px', color: '#0f172a' }}>{formCabecera.proveedor}</div>
                    <div style={{ color: '#475569', fontSize: '10px' }}>
                      Condición fiscal: {formCabecera.precios_incluyen_iva ? 'Precios con IVA Incluido' : 'Precios SIN IVA (+13% al pie)'}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: '#64748b', fontWeight: '700' }}>DESTINO / TALLER:</div>
                    <div style={{ fontWeight: '800', fontSize: '12px', color: '#0f172a' }}>{formCabecera.taller_destino}</div>
                    <div style={{ color: '#475569', fontSize: '10px' }}>
                      Estado actual: <strong>{formCabecera.estado}</strong>
                    </div>
                  </div>
                </div>

                {/* Tabla de Artículos Marcados */}
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px', margin: '12px 0' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#0f172a', color: '#ffffff', textAlign: 'left' }}>
                      <th style={{ padding: '6px 8px', width: '30px' }}>#</th>
                      <th style={{ padding: '6px 8px', width: '70px' }}>SKU</th>
                      <th style={{ padding: '6px 8px', width: '70px' }}>Cód. Prov.</th>
                      <th style={{ padding: '6px 8px' }}>Descripción del Material / Insumo</th>
                      <th style={{ padding: '6px 8px', width: '50px', textAlign: 'center' }}>Unid.</th>
                      <th style={{ padding: '6px 8px', width: '50px', textAlign: 'center' }}>Cant.</th>
                      <th style={{ padding: '6px 8px', width: '75px', textAlign: 'right' }}>Precio Unit. $</th>
                      <th style={{ padding: '6px 8px', width: '80px', textAlign: 'right' }}>Subtotal $</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formLineas
                      .filter((l) => l.incluir)
                      .map((l, i) => {
                        const cant = Number(l.cantidad || 0);
                        const precio = Number(l.precio_unitario || 0);
                        const totalLinea = formCabecera.precios_incluyen_iva ? cant * precio : cant * precio;

                        return (
                          <tr key={l.sku + i} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: i % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                            <td style={{ padding: '6px 8px', color: '#64748b' }}>{i + 1}</td>
                            <td style={{ padding: '6px 8px', fontWeight: '800', fontFamily: 'monospace' }}>{l.sku}</td>
                            <td style={{ padding: '6px 8px', color: '#475569' }}>{l.codigo_proveedor || '-'}</td>
                            <td style={{ padding: '6px 8px', color: '#0f172a' }}>{l.descripcion}</td>
                            <td style={{ padding: '6px 8px', textAlign: 'center', color: '#475569' }}>{l.unidad}</td>
                            <td style={{ padding: '6px 8px', textAlign: 'center', fontWeight: '800' }}>{cant}</td>
                            <td style={{ padding: '6px 8px', textAlign: 'right', color: '#334155' }}>${precio.toFixed(2)}</td>
                            <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: '800', color: '#0f172a' }}>
                              ${totalLinea.toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>

                {/* Resumen de Totales e Impuestos */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '14px 0' }}>
                  <div style={{ width: '240px', backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '10px 14px', fontSize: '11px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', color: '#475569' }}>
                      <span>Subtotal Neto:</span>
                      <strong style={{ color: '#0f172a' }}>${calculosFormulario.subtotalNeto}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', color: '#475569' }}>
                      <span>IVA (13% Crédito Fiscal):</span>
                      <strong style={{ color: '#ea580c' }}>${calculosFormulario.totalIva}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0 2px 0', borderTop: '1px solid #cbd5e1', marginTop: '4px', fontSize: '13px' }}>
                      <span style={{ fontWeight: '800', color: '#0f172a' }}>Total Cotización:</span>
                      <strong style={{ fontWeight: '900', color: '#0f172a' }}>${calculosFormulario.totalGeneral}</strong>
                    </div>
                  </div>
                </div>

                {/* Firmas de Autorización */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', marginTop: '40px', paddingTop: '20px', fontSize: '10px', textAlign: 'center' }}>
                  <div>
                    <div style={{ borderTop: '1px solid #94a3b8', width: '80%', margin: '0 auto 6px auto' }}></div>
                    <strong style={{ display: 'block', color: '#0f172a' }}>Elaborado por</strong>
                    <span style={{ color: '#64748b' }}>Bodega / Encargado de Compras</span>
                  </div>
                  <div>
                    <div style={{ borderTop: '1px solid #94a3b8', width: '80%', margin: '0 auto 6px auto' }}></div>
                    <strong style={{ display: 'block', color: '#0f172a' }}>Aprobado por</strong>
                    <span style={{ color: '#64748b' }}>Finanzas / Gerencia General</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 7. MODAL VISOR Y EXPORTADOR PDF PROVEEDOR (WHATSAPP)    */}
      {/* ======================================================== */}
      {showPdfProveedorModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[95vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Header del Visor */}
            <div className="h-14 px-4 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-900">
              <span className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Share2 className="w-4 h-4 text-emerald-400" />
                Vista Previa — Solicitud para Proveedor (WhatsApp / Pedido sin precios)
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportPdfProveedor}
                  disabled={isExporting}
                  className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer min-h-[40px]"
                >
                  <Download className="w-4 h-4" />
                  {isExporting ? 'Generando...' : 'Descargar Pedido WhatsApp'}
                </button>
                <button
                  onClick={() => setShowPdfProveedorModal(false)}
                  className="p-2 rounded text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Hoja A4 en Alta Resolución con Estilos Hex Directos */}
            <div className="overflow-y-auto p-4 sm:p-8 bg-slate-950 flex justify-center">
              <div
                ref={pdfProveedorRef}
                style={{
                  width: '210mm',
                  minHeight: '297mm',
                  backgroundColor: '#ffffff',
                  color: '#0f172a',
                  padding: '16mm 18mm',
                  boxSizing: 'border-box',
                  fontFamily: 'Arial, sans-serif',
                }}
                className="shadow-2xl rounded-sm"
              >
                {/* Cabecera */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #10b981', paddingBottom: '12px' }}>
                  <div>
                    <h1 style={{ fontSize: '20px', fontWeight: '900', color: '#0f172a', margin: '0' }}>
                      GRUPO DECORM
                    </h1>
                    <p style={{ fontSize: '10px', fontWeight: '700', color: '#10b981', textTransform: 'uppercase', margin: '2px 0 0 0', letterSpacing: '1px' }}>
                      Solicitud de Pedido de Materiales & Despacho
                    </p>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-block', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '6px 12px' }}>
                      <span style={{ fontSize: '10px', color: '#64748b', display: 'block', textTransform: 'uppercase', fontWeight: '700' }}>
                        Referencia
                      </span>
                      <span style={{ fontSize: '15px', fontWeight: '900', color: '#0f172a', fontFamily: 'monospace' }}>
                        {formCabecera.cotizacion_id || 'PED-26-001'}
                      </span>
                    </div>
                    <div style={{ fontSize: '10px', color: '#64748b', marginTop: '4px' }}>
                      Fecha: {formCabecera.fecha}
                    </div>
                  </div>
                </div>

                {/* Proveedor y Taller Entrega */}
                <div style={{ margin: '14px 0', backgroundColor: '#f0fdf4', padding: '10px 14px', borderRadius: '6px', border: '1px solid #bbf7d0', fontSize: '11px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div>
                      <span style={{ color: '#166534', fontWeight: '700' }}>Estimados señores de: </span>
                      <strong style={{ fontSize: '13px', color: '#0f172a' }}>{formCabecera.proveedor}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#166534', fontWeight: '700' }}>Taller / Punto de Entrega: </span>
                      <strong style={{ fontSize: '13px', color: '#0f172a' }}>{formCabecera.taller_destino}</strong>
                    </div>
                  </div>
                  <p style={{ fontSize: '10px', color: '#15803d', margin: '6px 0 0 0' }}>
                    Agradecemos confirmar disponibilidad inmediata, número de cotización y tiempo de entrega de los siguientes ítems:
                  </p>
                </div>

                {/* Tabla de Artículos SIN PRECIOS */}
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px', margin: '12px 0' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#0f172a', color: '#ffffff', textAlign: 'left' }}>
                      <th style={{ padding: '6px 8px', width: '30px' }}>#</th>
                      <th style={{ padding: '6px 8px', width: '90px' }}>Cód. Proveedor</th>
                      <th style={{ padding: '6px 8px', width: '80px' }}>SKU Interno</th>
                      <th style={{ padding: '6px 8px' }}>Descripción del Material / Insumo</th>
                      <th style={{ padding: '6px 8px', width: '70px', textAlign: 'center' }}>Unidad</th>
                      <th style={{ padding: '6px 8px', width: '70px', textAlign: 'center' }}>Cantidad Solicitada</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formLineas
                      .filter((l) => l.incluir)
                      .map((l, i) => (
                        <tr key={l.sku + i} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: i % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                          <td style={{ padding: '8px', color: '#64748b' }}>{i + 1}</td>
                          <td style={{ padding: '8px', fontWeight: '800', color: '#0f172a' }}>{l.codigo_proveedor || 'N/D'}</td>
                          <td style={{ padding: '8px', fontFamily: 'monospace', color: '#64748b' }}>{l.sku}</td>
                          <td style={{ padding: '8px', fontWeight: '600', color: '#0f172a' }}>{l.descripcion}</td>
                          <td style={{ padding: '8px', textAlign: 'center', color: '#475569' }}>{l.unidad}</td>
                          <td style={{ padding: '8px', textAlign: 'center', fontWeight: '900', fontSize: '12px', color: '#0f172a' }}>
                            {l.cantidad}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>

                {/* Notas de Despacho */}
                <div style={{ marginTop: '20px', padding: '10px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '10px', color: '#475569' }}>
                  <strong>Indicaciones de Despacho:</strong> Favor emitir comprobante de crédito fiscal a nombre de <strong>GRUPO DECORM</strong> con entrega en <strong>{formCabecera.taller_destino}</strong>.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default CotizacionesView;

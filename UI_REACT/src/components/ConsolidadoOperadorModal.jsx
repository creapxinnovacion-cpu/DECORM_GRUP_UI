import React, { useState, useRef, useMemo } from 'react';
import {
  FileText,
  Download,
  Printer,
  Image as ImageIcon,
  X,
  User,
  Users,
  Calendar,
  Layers,
  Package,
  CheckCircle2,
  Clock,
  Building2,
  AlertCircle,
  Hash,
} from 'lucide-react';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { OPERADORES } from '../config/constants';

export default function ConsolidadoOperadorModal({
  isOpen,
  onClose,
  movimientos = [],
  catalogoItems = [],
  initialOperador = '',
}) {
  const [selectedOperador, setSelectedOperador] = useState(initialOperador || 'TODOS');
  const [periodoFiltro, setPeriodoFiltro] = useState('TODO');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingImg, setIsExportingImg] = useState(false);
  const [exportProgress, setExportProgress] = useState('');

  const documentRef = useRef(null);

  // Lista de operadores presentes en los movimientos + lista fija
  const listaOperadores = useMemo(() => {
    const set = new Set();
    movimientos.forEach((m) => {
      if (m.entregado_a && String(m.entregado_a).trim()) {
        set.add(String(m.entregado_a).trim());
      }
    });
    OPERADORES.forEach((op) => set.add(op));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [movimientos]);

  React.useEffect(() => {
    if (!selectedOperador) {
      setSelectedOperador(initialOperador || 'TODOS');
    }
  }, [initialOperador, selectedOperador]);

  // Filtrar movimientos por período
  const movimientosFiltradosPorPeriodo = useMemo(() => {
    return movimientos.filter((m) => {
      const isSalida =
        !m.tipo ||
        String(m.tipo).toLowerCase().includes('salida') ||
        String(m.tipo).toLowerCase().includes('entrega');
      if (!isSalida) return false;

      if (periodoFiltro === 'TODO') return true;
      if (!m.fecha) return true;

      const f = m.fecha;
      if (periodoFiltro === 'HOY') {
        const today = new Date().toISOString().split('T')[0];
        return f === today;
      }
      if (periodoFiltro === 'MES') {
        const currentMonthPrefix = new Date().toISOString().slice(0, 7);
        return String(f).startsWith(currentMonthPrefix);
      }
      if (periodoFiltro === 'CUSTOM') {
        if (fechaInicio && f < fechaInicio) return false;
        if (fechaFin && f > fechaFin) return false;
        return true;
      }
      return true;
    });
  }, [movimientos, periodoFiltro, fechaInicio, fechaFin]);

  // Movimientos para operador individual
  const movimientosOperador = useMemo(() => {
    if (selectedOperador === 'TODOS') {
      return movimientosFiltradosPorPeriodo;
    }

    return movimientosFiltradosPorPeriodo.filter((m) => {
      return (
        String(m.entregado_a || '')
          .trim()
          .toLowerCase() === selectedOperador.trim().toLowerCase()
      );
    });
  }, [movimientosFiltradosPorPeriodo, selectedOperador]);

  // Consolidado por SKU para operador individual
  const consolidadoPorSku = useMemo(() => {
    const map = {};

    movimientosOperador.forEach((m) => {
      const sku = (m.sku || 'SIN-SKU').trim().toUpperCase();
      const cant = Math.abs(Number(m.cantidad || 0));

      if (!map[sku]) {
        const catItem = catalogoItems.find(
          (c) => (c.sku || '').toUpperCase() === sku
        );

        map[sku] = {
          sku: sku,
          descripcion:
            m.descripcion ||
            catItem?.descripcion ||
            'Insumo de taller sin descripción',
          categoria: catItem?.categoria || m.categoria || 'Insumos',
          unidad: catItem?.unidad || m.unidad || 'unidad',
          cantidadTotal: 0,
          totalEventos: 0,
          talleres: new Set(),
        };
      }

      map[sku].cantidadTotal += cant;
      map[sku].totalEventos += 1;
      if (m.taller_destino) map[sku].talleres.add(m.taller_destino);
    });

    return Object.values(map).sort((a, b) => b.cantidadTotal - a.cantidadTotal);
  }, [movimientosOperador, catalogoItems]);

  // Agrupación de TODOS los operadores
  const consolidadoGeneralTodosOperadores = useMemo(() => {
    if (selectedOperador !== 'TODOS') return [];

    const operadoresMap = {};

    movimientosFiltradosPorPeriodo.forEach((m) => {
      const opName = (m.entregado_a && String(m.entregado_a).trim()) || 'Sin Asignar';
      if (!operadoresMap[opName]) {
        operadoresMap[opName] = {
          operador: opName,
          totalUnidades: 0,
          skusMap: {},
          talleres: new Set(),
        };
      }

      const sku = (m.sku || 'SIN-SKU').trim().toUpperCase();
      const cant = Math.abs(Number(m.cantidad || 0));
      operadoresMap[opName].totalUnidades += cant;
      if (m.taller_destino) operadoresMap[opName].talleres.add(m.taller_destino);

      if (!operadoresMap[opName].skusMap[sku]) {
        const catItem = catalogoItems.find(
          (c) => (c.sku || '').toUpperCase() === sku
        );
        operadoresMap[opName].skusMap[sku] = {
          sku: sku,
          descripcion: m.descripcion || catItem?.descripcion || 'Insumo sin descripción',
          categoria: catItem?.categoria || m.categoria || 'Insumos',
          unidad: catItem?.unidad || m.unidad || 'unidad',
          cantidad: 0,
        };
      }
      operadoresMap[opName].skusMap[sku].cantidad += cant;
    });

    return Object.values(operadoresMap)
      .map((op) => ({
        ...op,
        items: Object.values(op.skusMap).sort((a, b) => b.cantidad - a.cantidad),
      }))
      .filter((op) => op.totalUnidades > 0)
      .sort((a, b) => b.totalUnidades - a.totalUnidades);
  }, [movimientosFiltradosPorPeriodo, selectedOperador, catalogoItems]);

  // PAGINACIÓN INTELIGENTE A4: Evita que cualquier tabla de operador se corte a la mitad
  const paginasConsolidado = useMemo(() => {
    if (selectedOperador !== 'TODOS') return [];

    const pages = [];
    let currentPage = [];
    let currentWeight = 0;

    // En la página 1 hay encabezado grande + metadata + aviso (peso reservado: ~12)
    // Máxima capacidad estimada en líneas para no desbordar 297mm (A4)
    const MAX_PAGE_1 = 12;
    const MAX_OTHER_PAGES = 18;

    consolidadoGeneralTodosOperadores.forEach((op) => {
      // Peso = cabecera del operador (2) + cantidad de filas de artículos
      const opWeight = 2 + op.items.length;
      const limit = pages.length === 0 ? MAX_PAGE_1 : MAX_OTHER_PAGES;

      if (currentWeight + opWeight > limit && currentPage.length > 0) {
        pages.push(currentPage);
        currentPage = [op];
        currentWeight = opWeight;
      } else {
        currentPage.push(op);
        currentWeight += opWeight;
      }
    });

    if (currentPage.length > 0) {
      pages.push(currentPage);
    }

    return pages;
  }, [consolidadoGeneralTodosOperadores, selectedOperador]);

  const totalUnidades = useMemo(() => {
    if (selectedOperador === 'TODOS') {
      return consolidadoGeneralTodosOperadores.reduce((acc, curr) => acc + curr.totalUnidades, 0);
    }
    return consolidadoPorSku.reduce((acc, curr) => acc + curr.cantidadTotal, 0);
  }, [selectedOperador, consolidadoGeneralTodosOperadores, consolidadoPorSku]);

  // ========================================================
  // EXPORTACIÓN A PDF MULTIPÁGINA SIN CORTES (PÁGINA POR PÁGINA)
  // ========================================================
  const handleExportPdf = async () => {
    if (!documentRef.current) return;
    setIsExportingPdf(true);
    setExportProgress('Iniciando PDF...');

    try {
      // Buscar todas las páginas .pdf-page definidas
      const pageElements = documentRef.current.querySelectorAll('.pdf-page');

      if (!pageElements || pageElements.length === 0) {
        throw new Error('No se encontraron páginas para exportar.');
      }

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      for (let i = 0; i < pageElements.length; i++) {
        setExportProgress(`Procesando hoja ${i + 1} de ${pageElements.length}...`);
        if (i > 0) {
          pdf.addPage();
        }

        const pageEl = pageElements[i];

        // Capturar la hoja exacta A4 en alta resolución
        const dataUrl = await toPng(pageEl, {
          quality: 0.98,
          pixelRatio: 2,
          backgroundColor: '#ffffff',
          cacheBust: true,
          style: {
            margin: '0',
            boxShadow: 'none',
          },
        });

        // 210mm x 297mm es el tamaño A4 estándar
        pdf.addImage(dataUrl, 'PNG', 0, 0, 210, 297, undefined, 'FAST');
      }

      const cleanName =
        selectedOperador === 'TODOS'
          ? 'TODOS_LOS_OPERADORES'
          : selectedOperador.replace(/[^a-zA-Z0-9]/g, '_');
      const dateStr = new Date().toISOString().split('T')[0];
      pdf.save(`Consolidado_Insumos_${cleanName}_${dateStr}.pdf`);
    } catch (err) {
      console.error('Error generando PDF:', err);
      alert('Error al generar PDF: ' + err.message);
    } finally {
      setIsExportingPdf(false);
      setExportProgress('');
    }
  };

  // ========================================================
  // EXPORTACIÓN A IMAGEN
  // ========================================================
  const handleExportImage = async () => {
    if (!documentRef.current) return;
    setIsExportingImg(true);
    try {
      const pageElements = documentRef.current.querySelectorAll('.pdf-page');
      const targetEl = pageElements[0] || documentRef.current;

      const dataUrl = await toPng(targetEl, {
        quality: 0.98,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        cacheBust: true,
        style: {
          margin: '0',
          boxShadow: 'none',
        },
      });

      const cleanName =
        selectedOperador === 'TODOS'
          ? 'TODOS_LOS_OPERADORES'
          : selectedOperador.replace(/[^a-zA-Z0-9]/g, '_');
      const dateStr = new Date().toISOString().split('T')[0];
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `Consolidado_Insumos_${cleanName}_${dateStr}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Error generando Imagen:', err);
      alert('Error al generar Imagen: ' + err.message);
    } finally {
      setIsExportingImg(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (!isOpen) return null;

  const fechaEmision = new Date().toLocaleDateString('es-SV', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const isGeneral = selectedOperador === 'TODOS';
  const totalPaginas = isGeneral ? Math.max(paginasConsolidado.length, 1) : 1;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4">
      <div className="relative w-full max-w-5xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl flex flex-col max-h-[96vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Top Action Bar */}
        <div className="print:hidden p-4 sm:p-5 bg-slate-950/80 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400">
              {isGeneral ? <Users className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-100 flex items-center gap-2">
                {isGeneral
                  ? 'Consolidado General de Insumos (Todos los Operadores)'
                  : `Consolidado de Insumos — ${selectedOperador}`}
                <span className="text-xs bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/30">
                  {totalPaginas > 1 ? `${totalPaginas} Hojas A4` : '1 Hoja A4'}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Paginación A4 industrial sin cortes de tablas ni desbordes de texto.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportPdf}
              disabled={isExportingPdf || totalUnidades === 0}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-rose-600/20 disabled:opacity-50 cursor-pointer"
              title="Descargar en formato PDF A4 paginado"
            >
              <Download className="w-4 h-4" />
              {isExportingPdf ? exportProgress || 'Generando...' : 'Descargar PDF'}
            </button>

            <button
              onClick={handleExportImage}
              disabled={isExportingImg || totalUnidades === 0}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-emerald-600/20 disabled:opacity-50 cursor-pointer"
              title="Descargar como Imagen PNG"
            >
              <ImageIcon className="w-4 h-4" />
              {isExportingImg ? 'Generando PNG...' : 'Descargar Imagen'}
            </button>

            <button
              onClick={handlePrint}
              disabled={totalUnidades === 0}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition border border-slate-700 cursor-pointer"
              title="Imprimir reporte oficial"
            >
              <Printer className="w-4 h-4" />
              Imprimir
            </button>

            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="print:hidden p-4 bg-slate-900 border-b border-slate-800/80 flex flex-wrap items-center gap-4 text-xs">
          {/* Operator Select */}
          <div className="flex items-center gap-2 bg-slate-800/90 px-3 py-1.5 rounded-xl border border-slate-700 min-w-[280px]">
            {isGeneral ? (
              <Users className="w-4 h-4 text-amber-400 shrink-0" />
            ) : (
              <User className="w-4 h-4 text-amber-400 shrink-0" />
            )}
            <label className="font-semibold text-slate-300">Operador:</label>
            <select
              value={selectedOperador}
              onChange={(e) => setSelectedOperador(e.target.value)}
              className="bg-transparent text-slate-100 font-bold focus:outline-none w-full cursor-pointer"
            >
              <option value="TODOS" className="bg-slate-900 text-amber-400 font-bold">
                ★ TODOS LOS OPERADORES (Consolidado General)
              </option>
              {listaOperadores.map((op) => (
                <option key={op} value={op} className="bg-slate-900 text-slate-100">
                  Operador: {op}
                </option>
              ))}
            </select>
          </div>

          {/* Period Select */}
          <div className="flex items-center gap-2 bg-slate-800/90 px-3 py-1.5 rounded-xl border border-slate-700">
            <Calendar className="w-4 h-4 text-sky-400 shrink-0" />
            <label className="font-semibold text-slate-300">Período:</label>
            <select
              value={periodoFiltro}
              onChange={(e) => setPeriodoFiltro(e.target.value)}
              className="bg-transparent text-slate-100 font-bold focus:outline-none cursor-pointer"
            >
              <option value="TODO" className="bg-slate-900">Todo el Historial</option>
              <option value="MES" className="bg-slate-900">Mes Actual</option>
              <option value="HOY" className="bg-slate-900">Solo Hoy</option>
              <option value="CUSTOM" className="bg-slate-900">Rango de Fechas...</option>
            </select>
          </div>

          {periodoFiltro === 'CUSTOM' && (
            <div className="flex items-center gap-2 bg-slate-800/90 px-3 py-1 rounded-xl border border-slate-700">
              <span className="text-slate-400 text-[11px]">Desde:</span>
              <input
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                className="bg-slate-900 text-slate-100 px-2 py-0.5 rounded text-xs border border-slate-700 focus:outline-none"
              />
              <span className="text-slate-400 text-[11px]">Hasta:</span>
              <input
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                className="bg-slate-900 text-slate-100 px-2 py-0.5 rounded text-xs border border-slate-700 focus:outline-none"
              />
            </div>
          )}

          {/* Counts */}
          <div className="ml-auto flex items-center gap-3">
            <span className="text-slate-400 text-xs">
              {isGeneral ? (
                <>
                  Operarios: <strong className="text-slate-100 font-mono">{consolidadoGeneralTodosOperadores.length}</strong>
                </>
              ) : (
                <>
                  Registros: <strong className="text-slate-100 font-mono">{movimientosOperador.length}</strong>
                </>
              )}
            </span>
            <span className="text-slate-400 text-xs">
              Total Unidades: <strong className="text-emerald-400 font-mono font-bold">{totalUnidades}</strong>
            </span>
          </div>
        </div>

        {/* Document Container: Renderiza Hojas A4 Independientes */}
        <div
          ref={documentRef}
          className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-950 flex flex-col items-center gap-8 print:p-0 print:gap-0 print:bg-white"
        >
          {/* ======================================================== */}
          {/* CASO A: CONSOLIDADO GENERAL DE TODOS LOS OPERADORES       */}
          {/* ======================================================== */}
          {isGeneral ? (
            paginasConsolidado.length === 0 ? (
              <div className="w-full max-w-[800px] bg-white text-slate-900 p-12 text-center rounded-sm">
                <p className="text-sm text-slate-500 italic">
                  No se registraron entregas de insumos para ningún operador en el período seleccionado.
                </p>
              </div>
            ) : (
              paginasConsolidado.map((pageOperadores, pageIdx) => {
                const isFirstPage = pageIdx === 0;
                const isLastPage = pageIdx === paginasConsolidado.length - 1;
                const pageNumber = pageIdx + 1;

                return (
                  <div
                    key={`page-${pageNumber}`}
                    className="pdf-page w-full max-w-[800px] min-h-[1130px] bg-white text-slate-900 p-8 sm:p-10 shadow-2xl rounded-sm border border-slate-200 print:border-none print:shadow-none print:p-8 print:m-0 font-sans flex flex-col justify-between"
                    style={{
                      boxSizing: 'border-box',
                      breakAfter: 'page',
                      pageBreakAfter: 'always',
                    }}
                  >
                    <div>
                      {/* Cabecera de Página */}
                      {isFirstPage ? (
                        /* Encabezado Completo en Página 1 */
                        <div className="border-b-2 border-amber-600 pb-4 mb-5 flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center font-black text-slate-950 text-base shadow">
                                GD
                              </div>
                              <div>
                                <h1 className="text-xl font-black tracking-tight text-slate-950 uppercase leading-none">
                                  GRUPO DECORM
                                </h1>
                                <span className="text-[10px] uppercase font-bold text-amber-700 tracking-wider">
                                  Sistema Maestro de Inventario & Producción
                                </span>
                              </div>
                            </div>
                            <div className="mt-2.5">
                              <h2 className="text-sm sm:text-base font-extrabold text-slate-900 uppercase">
                                Consolidado General de Insumos por Operador
                              </h2>
                              <p className="text-[11px] text-slate-500">
                                Auditoría integral de insumos entregados al personal de taller y montaje.
                              </p>
                            </div>
                          </div>

                          <div className="text-right text-xs space-y-1">
                            <div className="inline-block bg-slate-100 border border-slate-300 px-2 py-0.5 rounded font-mono font-bold text-slate-800 text-[11px]">
                              VALE-TODOS-{new Date().toISOString().slice(2, 10).replace(/-/g, '')}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              Emisión: <span className="font-semibold text-slate-700">{fechaEmision}</span>
                            </div>
                            <div className="text-[11px] text-slate-500">
                              Estado: <span className="font-bold text-emerald-700">AUDITADO</span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        /* Encabezado Compacto en Páginas Siguientes */
                        <div className="border-b border-slate-300 pb-2.5 mb-5 flex items-center justify-between text-xs text-slate-600">
                          <div className="flex items-center gap-2">
                            <span className="font-black text-slate-900">GRUPO DECORM</span>
                            <span className="text-slate-400">·</span>
                            <span className="font-bold text-amber-700 uppercase">Consolidado General de Insumos</span>
                          </div>
                          <span className="font-mono text-[11px] text-slate-500 font-bold">
                            Hoja {pageNumber} de {totalPaginas}
                          </span>
                        </div>
                      )}

                      {/* Metadata Box en Página 1 */}
                      {isFirstPage && (
                        <>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-slate-50 border border-slate-200 p-3 rounded-lg mb-4 text-xs">
                            <div>
                              <span className="text-[9px] uppercase font-bold text-slate-500 block">Alcance:</span>
                              <span className="text-xs font-black text-slate-900 block truncate">Todos los Operadores</span>
                            </div>
                            <div>
                              <span className="text-[9px] uppercase font-bold text-slate-500 block">Período:</span>
                              <span className="text-xs font-bold text-slate-800 block">
                                {periodoFiltro === 'TODO'
                                  ? 'Todo el Historial'
                                  : periodoFiltro === 'MES'
                                  ? 'Mes en Curso'
                                  : periodoFiltro === 'HOY'
                                  ? 'Día de Hoy'
                                  : `${fechaInicio || 'Inicio'} al ${fechaFin || 'Hoy'}`}
                              </span>
                            </div>
                            <div>
                              <span className="text-[9px] uppercase font-bold text-slate-500 block">Personal Auditado:</span>
                              <span className="text-xs font-black text-amber-700 font-mono block">
                                {consolidadoGeneralTodosOperadores.length} operarios
                              </span>
                            </div>
                            <div>
                              <span className="text-[9px] uppercase font-bold text-slate-500 block">Total Unidades:</span>
                              <span className="text-xs font-black text-emerald-700 font-mono block">
                                {totalUnidades} unid.
                              </span>
                            </div>
                          </div>

                          <div className="bg-amber-50/80 border-l-4 border-amber-500 p-2 rounded-r text-[10px] text-amber-900 mb-4 flex items-start gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                            <span>
                              <strong>Control de Custodia:</strong> Resumen oficial de artículos retirados de bodega central.
                            </span>
                          </div>
                        </>
                      )}

                      {/* Lista de Operadores Asignados a Esta Página */}
                      <div className="space-y-4">
                        {pageOperadores.map((opGroup) => (
                          <div
                            key={opGroup.operador}
                            className="border border-slate-300 rounded-lg overflow-hidden break-inside-avoid"
                          >
                            {/* Cabecera del Operador */}
                            <div className="bg-slate-100 px-3.5 py-1.5 border-b border-slate-300 flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2">
                                <span className="font-black text-slate-900 uppercase">
                                  {opGroup.operador}
                                </span>
                                <span className="text-[10px] text-slate-500 px-1.5 py-0.2 bg-white rounded border border-slate-200">
                                  {Array.from(opGroup.talleres).join(', ') || 'Taller Central'}
                                </span>
                              </div>
                              <span className="font-mono font-bold text-[11px] text-emerald-800">
                                Subtotal: {opGroup.totalUnidades} unid. ({opGroup.items.length} artículos)
                              </span>
                            </div>

                            {/* Tabla de Artículos */}
                            <table className="w-full text-left text-xs border-collapse">
                              <thead>
                                <tr className="bg-slate-50 text-slate-600 uppercase text-[9px] font-bold border-b border-slate-200">
                                  <th className="py-1 px-3 w-10 text-center">#</th>
                                  <th className="py-1 px-3 w-24">SKU</th>
                                  <th className="py-1 px-3">Descripción del Artículo</th>
                                  <th className="py-1 px-3 w-28">Categoría</th>
                                  <th className="py-1 px-3 text-right w-24 font-bold">Cantidad</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {opGroup.items.map((it, idx) => (
                                  <tr key={it.sku} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}>
                                    <td className="py-1 px-3 text-center text-slate-400 font-mono text-[10px]">{idx + 1}</td>
                                    <td className="py-1 px-3 font-mono font-bold text-amber-800 text-[10px]">{it.sku}</td>
                                    <td className="py-1 px-3 font-medium text-slate-900 text-[11px]">{it.descripcion}</td>
                                    <td className="py-1 px-3 text-slate-500 text-[10px]">{it.categoria}</td>
                                    <td className="py-1 px-3 text-right font-black text-slate-950 font-mono text-xs">
                                      {it.cantidad} {it.unidad}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ))}
                      </div>

                      {/* Gran Resumen Total en la Última Página */}
                      {isLastPage && (
                        <div className="mt-5 p-3.5 bg-slate-100 border-2 border-slate-300 rounded-lg flex items-center justify-between text-xs">
                          <span className="font-black uppercase text-slate-900 tracking-wider">
                            GRAN TOTAL CONSOLIDADO EMPRESARIAL:
                          </span>
                          <span className="font-black font-mono text-base text-emerald-800">
                            {totalUnidades} UNIDADES ENTREGADAS
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Pie de Página con Firmas y Número de Hoja */}
                    <div className="pt-6 mt-6 border-t border-slate-300 break-inside-avoid">
                      {isLastPage && (
                        <div className="grid grid-cols-3 gap-6 text-center text-xs mb-4">
                          <div>
                            <div className="border-b border-slate-400 pb-1 mb-1.5">
                              <span className="font-bold text-slate-800 block text-[11px]">BODEGA CENTRAL / ALMACÉN</span>
                            </div>
                            <span className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold">
                              Firma y Sello de Entrega
                            </span>
                          </div>

                          <div>
                            <div className="border-b border-slate-400 pb-1 mb-1.5">
                              <span className="font-bold text-slate-900 block text-[11px]">REPRESENTANTE DE OPERACIONES</span>
                            </div>
                            <span className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold">
                              Firma de Conformidad
                            </span>
                          </div>

                          <div>
                            <div className="border-b border-slate-400 pb-1 mb-1.5">
                              <span className="font-bold text-slate-800 block text-[11px]">SUPERVISIÓN DE TALLER</span>
                            </div>
                            <span className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold">
                              Vo.Bo. Administración
                            </span>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                        <span>GRUPO DECORM · Control Interno de Insumos</span>
                        <span>Hoja {pageNumber} de {totalPaginas}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )
          ) : (
            /* ======================================================== */
            /* CASO B: CONSOLIDADO INDIVIDUAL POR OPERADOR ESPECÍFICO     */
            /* ======================================================== */
            <div
              className="pdf-page w-full max-w-[800px] min-h-[1130px] bg-white text-slate-900 p-8 sm:p-10 shadow-2xl rounded-sm border border-slate-200 print:border-none print:shadow-none print:p-8 print:m-0 font-sans flex flex-col justify-between"
              style={{
                boxSizing: 'border-box',
                breakAfter: 'page',
                pageBreakAfter: 'always',
              }}
            >
              <div>
                {/* Header */}
                <div className="border-b-2 border-amber-600 pb-4 mb-5 flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center font-black text-slate-950 text-base shadow">
                        GD
                      </div>
                      <div>
                        <h1 className="text-xl font-black tracking-tight text-slate-950 uppercase leading-none">
                          GRUPO DECORM
                        </h1>
                        <span className="text-[10px] uppercase font-bold text-amber-700 tracking-wider">
                          Sistema Maestro de Inventario & Producción
                        </span>
                      </div>
                    </div>
                    <div className="mt-2.5">
                      <h2 className="text-base font-extrabold text-slate-900 uppercase">
                        Hoja de Control Interno y Consolidado de Insumos
                      </h2>
                      <p className="text-xs text-slate-500">
                        Registro oficial de insumos entregados al operario para ejecución de trabajos.
                      </p>
                    </div>
                  </div>

                  <div className="text-right text-xs space-y-1">
                    <div className="inline-block bg-slate-100 border border-slate-300 px-2.5 py-0.5 rounded font-mono font-bold text-slate-800 text-[11px]">
                      VALE-{selectedOperador.toUpperCase().slice(0, 3)}-{new Date().toISOString().slice(2, 10).replace(/-/g, '')}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Emisión: <span className="font-semibold text-slate-700">{fechaEmision}</span>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Estado: <span className="font-bold text-emerald-700">AUDITADO</span>
                    </div>
                  </div>
                </div>

                {/* Metadata */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 border border-slate-200 p-3 rounded-lg mb-4 text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Operador:</span>
                    <span className="text-xs font-black text-slate-900 block truncate">{selectedOperador}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Período:</span>
                    <span className="text-xs font-bold text-slate-800 block">
                      {periodoFiltro === 'TODO'
                        ? 'Todo el Historial'
                        : periodoFiltro === 'MES'
                        ? 'Mes en Curso'
                        : periodoFiltro === 'HOY'
                        ? 'Día de Hoy'
                        : `${fechaInicio || 'Inicio'} al ${fechaFin || 'Hoy'}`}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">SKUs Diferentes:</span>
                    <span className="text-xs font-black text-amber-700 font-mono block">
                      {consolidadoPorSku.length} artículos
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Unidades:</span>
                    <span className="text-xs font-black text-emerald-700 font-mono block">
                      {totalUnidades} unidades
                    </span>
                  </div>
                </div>

                {/* Warning */}
                <div className="bg-amber-50/80 border-l-4 border-amber-500 p-2.5 rounded-r text-[10px] text-amber-900 mb-5 flex items-start gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Control Interno de Custodia:</strong> El personal receptor asume la responsabilidad del uso correcto y resguardo de los insumos detallados.
                  </span>
                </div>

                {/* Tabla de Insumos */}
                <div className="border border-slate-300 rounded overflow-hidden mb-6">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 uppercase text-[10px] font-bold border-b border-slate-300">
                        <th className="py-2 px-3 w-12 text-center">#</th>
                        <th className="py-2 px-3 w-24">SKU</th>
                        <th className="py-2 px-3">Descripción del Insumo</th>
                        <th className="py-2 px-3 w-28">Categoría</th>
                        <th className="py-2 px-3 text-right w-24 font-bold">Total Despachado</th>
                        <th className="py-2 px-3 w-28">Taller / Destino</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {consolidadoPorSku.length === 0 ? (
                        <tr>
                          <td colSpan="6" className="py-6 text-center text-slate-400 italic">
                            No se encontraron entregas de insumos para este operador.
                          </td>
                        </tr>
                      ) : (
                        consolidadoPorSku.map((item, idx) => (
                          <tr key={item.sku} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'}>
                            <td className="py-2 px-3 text-center text-slate-400 font-mono text-[10px]">{idx + 1}</td>
                            <td className="py-2 px-3 font-mono font-bold text-amber-800 text-[11px]">{item.sku}</td>
                            <td className="py-2 px-3 font-semibold text-slate-900">{item.descripcion}</td>
                            <td className="py-2 px-3 text-slate-600 text-[10px]">{item.categoria}</td>
                            <td className="py-2 px-3 text-right font-black text-slate-950 font-mono text-xs">
                              {item.cantidadTotal} {item.unidad}
                            </td>
                            <td className="py-2 px-3 text-slate-600 text-[10px] truncate max-w-[120px]">
                              {Array.from(item.talleres).join(', ') || 'Taller Central'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    {consolidadoPorSku.length > 0 && (
                      <tfoot>
                        <tr className="bg-slate-100 border-t-2 border-slate-300 font-bold text-xs text-slate-900">
                          <td colSpan="4" className="py-2 px-3 text-right uppercase tracking-wider text-[10px]">
                            Total Consolidado General:
                          </td>
                          <td className="py-2 px-3 text-right font-black text-emerald-800 font-mono text-sm">
                            {totalUnidades} unid.
                          </td>
                          <td></td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>

              {/* Firmas */}
              <div className="pt-8 mt-6 border-t border-slate-300 break-inside-avoid">
                <div className="grid grid-cols-3 gap-6 text-center text-xs">
                  <div>
                    <div className="border-b border-slate-400 pb-1 mb-1.5">
                      <span className="font-bold text-slate-800 block text-xs">BODEGA CENTRAL / ALMACÉN</span>
                      <span className="text-[9px] text-slate-400 block">Responsable de Despacho</span>
                    </div>
                    <span className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold">
                      Firma y Sello de Entrega
                    </span>
                  </div>

                  <div>
                    <div className="border-b border-slate-400 pb-1 mb-1.5">
                      <span className="font-bold text-slate-900 block text-xs">{selectedOperador.toUpperCase()}</span>
                      <span className="text-[9px] text-slate-400 block">Operario Receptor</span>
                    </div>
                    <span className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold">
                      Firma de Conformidad
                    </span>
                  </div>

                  <div>
                    <div className="border-b border-slate-400 pb-1 mb-1.5">
                      <span className="font-bold text-slate-800 block text-xs">SUPERVISIÓN DE TALLER</span>
                      <span className="text-[9px] text-slate-400 block">Control de Calidad</span>
                    </div>
                    <span className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold">
                      Vo.Bo. Administración
                    </span>
                  </div>
                </div>

                <div className="mt-6 text-center text-[9px] text-slate-400 font-mono">
                  GRUPO DECORM · Sistema Integrado de Inventario Operativo · Hoja 1 de 1
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import React, { useState, useRef, useMemo } from 'react';
import {
  FileText,
  Download,
  Printer,
  Image as ImageIcon,
  X,
  User,
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
  const [selectedOperador, setSelectedOperador] = useState(initialOperador || '');
  const [periodoFiltro, setPeriodoFiltro] = useState('TODO');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingImg, setIsExportingImg] = useState(false);

  const documentRef = useRef(null);

  // Extract all distinct operators found in actual movements, merged with standard list
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

  // Set default operator if none selected yet
  React.useEffect(() => {
    if (!selectedOperador && (initialOperador || listaOperadores.length > 0)) {
      setSelectedOperador(initialOperador || listaOperadores[0]);
    }
  }, [initialOperador, listaOperadores, selectedOperador]);

  // Filter movements for the selected operator and period
  const movimientosOperador = useMemo(() => {
    if (!selectedOperador) return [];

    return movimientos.filter((m) => {
      const matchOp =
        String(m.entregado_a || '')
          .trim()
          .toLowerCase() === selectedOperador.trim().toLowerCase();
      if (!matchOp) return false;

      // Period filter
      if (periodoFiltro === 'TODO') return true;
      if (!m.fecha) return true;

      const f = m.fecha;
      if (periodoFiltro === 'HOY') {
        const today = new Date().toISOString().split('T')[0];
        return f === today;
      }
      if (periodoFiltro === 'MES') {
        const currentMonthPrefix = new Date().toISOString().slice(0, 7); // YYYY-MM
        return String(f).startsWith(currentMonthPrefix);
      }
      if (periodoFiltro === 'CUSTOM') {
        if (fechaInicio && f < fechaInicio) return false;
        if (fechaFin && f > fechaFin) return false;
        return true;
      }
      return true;
    });
  }, [movimientos, selectedOperador, periodoFiltro, fechaInicio, fechaFin]);

  // Aggregate items by SKU
  const consolidadoPorSku = useMemo(() => {
    const map = {};

    movimientosOperador.forEach((m) => {
      const sku = (m.sku || 'SIN-SKU').trim().toUpperCase();
      const cant = Math.abs(Number(m.cantidad || 0));

      if (!map[sku]) {
        // Cross reference with catalog to obtain full description, category, and unit
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
          fechas: [],
          movimientoIds: [],
        };
      }

      map[sku].cantidadTotal += cant;
      map[sku].totalEventos += 1;
      if (m.taller_destino) map[sku].talleres.add(m.taller_destino);
      if (m.fecha) map[sku].fechas.push(m.fecha);
      if (m.id) map[sku].movimientoIds.push(m.id);
    });

    return Object.values(map).sort(
      (a, b) => b.cantidadTotal - a.cantidadTotal
    );
  }, [movimientosOperador, catalogoItems]);

  const totalUnidades = useMemo(() => {
    return consolidadoPorSku.reduce((acc, curr) => acc + curr.cantidadTotal, 0);
  }, [consolidadoPorSku]);

  // Download as PDF
  const handleExportPdf = async () => {
    if (!documentRef.current) return;
    setIsExportingPdf(true);
    try {
      const element = documentRef.current;
      const dataUrl = await toPng(element, {
        quality: 0.98,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        cacheBust: true,
      });

      const img = new window.Image();
      img.src = dataUrl;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (img.naturalHeight * pdfWidth) / img.naturalWidth;
      const pageHeight = pdf.internal.pageSize.getHeight();

      if (pdfHeight > pageHeight) {
        let heightLeft = pdfHeight;
        let position = 0;

        pdf.addImage(dataUrl, 'PNG', 0, position, pdfWidth, pdfHeight);
        heightLeft -= pageHeight;

        while (heightLeft > 0) {
          position = position - pageHeight;
          pdf.addPage();
          pdf.addImage(dataUrl, 'PNG', 0, position, pdfWidth, pdfHeight);
          heightLeft -= pageHeight;
        }
      } else {
        pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight);
      }

      const cleanName = (selectedOperador || 'Operador').replace(
        /[^a-zA-Z0-9]/g,
        '_'
      );
      const dateStr = new Date().toISOString().split('T')[0];
      pdf.save(`Consolidado_Insumos_${cleanName}_${dateStr}.pdf`);
    } catch (err) {
      console.error('Error generando PDF:', err);
      alert('Error al generar PDF: ' + err.message);
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Download as PNG Image
  const handleExportImage = async () => {
    if (!documentRef.current) return;
    setIsExportingImg(true);
    try {
      const element = documentRef.current;
      const dataUrl = await toPng(element, {
        quality: 0.98,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        cacheBust: true,
      });

      const cleanName = (selectedOperador || 'Operador').replace(
        /[^a-zA-Z0-9]/g,
        '_'
      );
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

  // Print using native browser print
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto bg-slate-950/80 backdrop-blur-md">
      {/* Container modal */}
      <div className="bg-slate-900 border border-slate-700 w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
        {/* Top bar controls (Do not print) */}
        <div className="print:hidden p-4 sm:p-5 border-b border-slate-800 bg-slate-950/70 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-100 flex items-center gap-2">
                Consolidado de Insumos por Operador
                <span className="text-xs bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/30">
                  Control Interno
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Genera vales de control, auditoría interna y resúmenes de entregas en PDF o Imagen.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportPdf}
              disabled={isExportingPdf || consolidadoPorSku.length === 0}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-rose-600/20 disabled:opacity-50 cursor-pointer"
              title="Descargar en formato PDF"
            >
              <Download className="w-4 h-4" />
              {isExportingPdf ? 'Generando PDF...' : 'Descargar PDF'}
            </button>

            <button
              onClick={handleExportImage}
              disabled={isExportingImg || consolidadoPorSku.length === 0}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-emerald-600/20 disabled:opacity-50 cursor-pointer"
              title="Descargar como Imagen PNG"
            >
              <ImageIcon className="w-4 h-4" />
              {isExportingImg ? 'Generando PNG...' : 'Descargar Imagen'}
            </button>

            <button
              onClick={handlePrint}
              disabled={consolidadoPorSku.length === 0}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition border border-slate-700 cursor-pointer"
              title="Imprimir vale de entrega"
            >
              <Printer className="w-4 h-4" />
              Imprimir
            </button>

            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter Toolbar (Do not print) */}
        <div className="print:hidden p-4 bg-slate-900 border-b border-slate-800/80 flex flex-wrap items-center gap-4 text-xs">
          {/* Operator Select */}
          <div className="flex items-center gap-2 bg-slate-800/90 px-3 py-1.5 rounded-xl border border-slate-700 min-w-[260px]">
            <User className="w-4 h-4 text-amber-400 shrink-0" />
            <label className="font-semibold text-slate-300">Operador:</label>
            <select
              value={selectedOperador}
              onChange={(e) => setSelectedOperador(e.target.value)}
              className="bg-transparent text-slate-100 font-bold focus:outline-none w-full cursor-pointer"
            >
              {listaOperadores.map((op) => (
                <option key={op} value={op} className="bg-slate-900 text-slate-100">
                  {op}
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

          {/* Custom Date Range */}
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

          {/* Summary counts badge */}
          <div className="ml-auto flex items-center gap-3">
            <span className="text-slate-400 text-xs">
              Registros: <strong className="text-slate-100 font-mono">{movimientosOperador.length}</strong>
            </span>
            <span className="text-slate-400 text-xs">
              SKUs: <strong className="text-amber-400 font-mono">{consolidadoPorSku.length}</strong>
            </span>
            <span className="text-slate-400 text-xs">
              Total Unidades: <strong className="text-emerald-400 font-mono font-bold">{totalUnidades}</strong>
            </span>
          </div>
        </div>

        {/* Scrollable Document Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-950 flex justify-center">
          {/* Printable White Paper Document */}
          <div
            ref={documentRef}
            className="w-full max-w-[800px] bg-white text-slate-900 p-8 sm:p-10 shadow-2xl rounded-sm border border-slate-200 print:border-none print:shadow-none print:p-0 print:m-0 font-sans"
            style={{ minHeight: '1050px' }}
          >
            {/* Document Header */}
            <div className="border-b-2 border-amber-600 pb-5 mb-6 flex items-start justify-between">
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
                <div className="mt-3">
                  <h2 className="text-base font-extrabold text-slate-900 uppercase">
                    Hoja de Control Interno y Consolidado de Insumos
                  </h2>
                  <p className="text-xs text-slate-500">
                    Registro oficial de insumos entregados al operario para ejecución de trabajos.
                  </p>
                </div>
              </div>

              {/* Document Code / Timestamp */}
              <div className="text-right text-xs space-y-1">
                <div className="inline-block bg-slate-100 border border-slate-300 px-2.5 py-1 rounded font-mono font-bold text-slate-800 text-[11px]">
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

            {/* Operator and Scope Metadata Box */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 border border-slate-200 p-4 rounded-lg mb-6 text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">
                  Operador Responsable:
                </span>
                <span className="text-sm font-black text-slate-900 block truncate">
                  {selectedOperador}
                </span>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">
                  Período Comprendido:
                </span>
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
                <span className="text-[10px] uppercase font-bold text-slate-500 block">
                  SKUs Diferentes:
                </span>
                <span className="text-sm font-black text-amber-700 font-mono block">
                  {consolidadoPorSku.length} artículos
                </span>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">
                  Total Unidades Retiradas:
                </span>
                <span className="text-sm font-black text-emerald-700 font-mono block">
                  {totalUnidades} unidades
                </span>
              </div>
            </div>

            {/* Warning / Notice */}
            <div className="bg-amber-50/80 border-l-4 border-amber-500 p-2.5 rounded-r text-[11px] text-amber-900 mb-6 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                <strong>Control Interno de Custodia:</strong> El personal receptor asume la responsabilidad del uso correcto y resguardo de los insumos detallados. Los saldos no utilizados deben retornar a bodega central con vale de devolución.
              </span>
            </div>

            {/* TABLE 1: Consolidated Summary by SKU */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-black uppercase text-slate-900 tracking-wide flex items-center gap-1.5">
                  <Package className="w-4 h-4 text-amber-600" />
                  1. Resumen Consolidado de Insumos Entregados
                </h3>
                <span className="text-[11px] text-slate-500">
                  Agrupado por Código de Insumo
                </span>
              </div>

              <div className="border border-slate-300 rounded overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 uppercase text-[10px] font-bold border-b border-slate-300">
                      <th className="py-2 px-3 w-16">#</th>
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
                          No se encontraron entregas de insumos para este operador en el período seleccionado.
                        </td>
                      </tr>
                    ) : (
                      consolidadoPorSku.map((item, idx) => (
                        <tr key={item.sku} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'}>
                          <td className="py-2 px-3 text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                          <td className="py-2 px-3 font-mono font-bold text-amber-800 text-[11px]">
                            {item.sku}
                          </td>
                          <td className="py-2 px-3 font-semibold text-slate-900">
                            {item.descripcion}
                          </td>
                          <td className="py-2 px-3 text-slate-600 text-[11px]">
                            {item.categoria}
                          </td>
                          <td className="py-2 px-3 text-right font-black text-slate-950 font-mono text-xs">
                            {item.cantidadTotal} {item.unidad}
                          </td>
                          <td className="py-2 px-3 text-slate-600 text-[11px] truncate max-w-[120px]">
                            {Array.from(item.talleres).join(', ') || 'Taller Central'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {consolidadoPorSku.length > 0 && (
                    <tfoot>
                      <tr className="bg-slate-100 border-t-2 border-slate-300 font-bold text-xs text-slate-900">
                        <td colSpan="4" className="py-2.5 px-3 text-right uppercase tracking-wider text-[11px]">
                          Total Consolidado General:
                        </td>
                        <td className="py-2.5 px-3 text-right font-black text-emerald-800 font-mono text-sm">
                          {totalUnidades} unid.
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>

            {/* TABLE 2: Chronological Details of Movements */}
            {movimientosOperador.length > 0 && (
              <div className="mb-8">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-black uppercase text-slate-900 tracking-wide flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-sky-600" />
                    2. Detalle Cronológico de Entregas Realizadas
                  </h3>
                  <span className="text-[11px] text-slate-500">
                    Historial de vales individuales
                  </span>
                </div>

                <div className="border border-slate-300 rounded overflow-hidden">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 uppercase text-[10px] font-bold border-b border-slate-300">
                        <th className="py-1.5 px-3 w-20">ID Mov.</th>
                        <th className="py-1.5 px-3 w-24">Fecha</th>
                        <th className="py-1.5 px-3 w-20">SKU</th>
                        <th className="py-1.5 px-3">Descripción</th>
                        <th className="py-1.5 px-3 text-right w-20">Cant.</th>
                        <th className="py-1.5 px-3 w-24">Taller</th>
                        <th className="py-1.5 px-3">Observaciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {movimientosOperador.slice(0, 25).map((m, idx) => (
                        <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                          <td className="py-1.5 px-3 font-mono font-bold text-slate-700 text-[11px]">
                            {m.id || `R${m._rowNumber}`}
                          </td>
                          <td className="py-1.5 px-3 text-slate-600 font-mono text-[11px]">
                            {m.fecha}
                          </td>
                          <td className="py-1.5 px-3 font-mono font-bold text-amber-800 text-[11px]">
                            {m.sku}
                          </td>
                          <td className="py-1.5 px-3 text-slate-800 truncate max-w-[180px]">
                            {m.descripcion || '-'}
                          </td>
                          <td className="py-1.5 px-3 text-right font-bold text-rose-700 font-mono">
                            -{Math.abs(Number(m.cantidad || 0))}
                          </td>
                          <td className="py-1.5 px-3 text-slate-600 text-[11px]">
                            {m.taller_destino || '-'}
                          </td>
                          <td className="py-1.5 px-3 text-slate-500 italic text-[11px] truncate max-w-[140px]">
                            {m.observaciones || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {movimientosOperador.length > 25 && (
                  <p className="text-[10px] text-slate-400 mt-1 italic text-right">
                    * Mostrando las primeras 25 transacciones de un total de {movimientosOperador.length}.
                  </p>
                )}
              </div>
            )}

            {/* Official Signatures Section */}
            <div className="pt-10 mt-8 border-t border-slate-300 break-inside-avoid">
              <div className="grid grid-cols-3 gap-6 text-center text-xs">
                {/* Entrega */}
                <div>
                  <div className="border-b border-slate-400 pb-1 mb-2">
                    <span className="font-bold text-slate-800 block text-xs">
                      BODEGA CENTRAL / ALMACÉN
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                      Responsable de Despacho
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                    Firma y Sello de Entrega
                  </span>
                </div>

                {/* Recibe */}
                <div>
                  <div className="border-b border-slate-400 pb-1 mb-2">
                    <span className="font-bold text-slate-900 block text-xs">
                      {selectedOperador.toUpperCase()}
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                      Operario Receptor
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                    Firma de Conformidad
                  </span>
                </div>

                {/* Supervisión */}
                <div>
                  <div className="border-b border-slate-400 pb-1 mb-2">
                    <span className="font-bold text-slate-800 block text-xs">
                      SUPERVISIÓN DE TALLER
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                      Control de Calidad y Producción
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                    Vo.Bo. Administración
                  </span>
                </div>
              </div>

              <div className="mt-8 text-center text-[10px] text-slate-400">
                GRUPO DECORM · Sistema Integrado de Inventario Operativo · Documento de Control Interno No Negociable
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

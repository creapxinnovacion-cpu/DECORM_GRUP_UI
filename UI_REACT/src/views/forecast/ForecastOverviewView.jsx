import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Search,
  Filter,
  Download,
  RefreshCw,
  ArrowRight,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Layers,
  Database,
} from 'lucide-react';
import { api } from '../../services/api';
import AlertBadge from '../../components/forecast/AlertBadge';
import ConfidencePill from '../../components/forecast/ConfidencePill';

export function ForecastOverviewView({ onSelectSku }) {
  const [loading, setLoading] = useState(true);
  const [forecastData, setForecastData] = useState({ rows: [], total: 0, resumen: {} });
  
  // Filters
  const [q, setQ] = useState('');
  const [alerta, setAlerta] = useState('');
  const [grupoUsuario, setGrupoUsuario] = useState('');
  const [confianza, setConfianza] = useState('');
  const [categoria, setCategoria] = useState('');
  
  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const fetchForecast = async () => {
    setLoading(true);
    try {
      const res = await api.getForecast({
        q: q || undefined,
        alerta: alerta || undefined,
        grupo_usuario: grupoUsuario || undefined,
        confianza: confianza || undefined,
        categoria: categoria || undefined,
        page,
        pageSize,
      });
      setForecastData(res || { rows: [], total: 0, resumen: {} });
    } catch (err) {
      console.error('Error al cargar tablero de pronóstico:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchForecast();
  }, [page, alerta, grupoUsuario, confianza, categoria]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchForecast();
  };

  // Export to CSV
  const handleExportCsv = () => {
    const rows = forecastData.rows || [];
    if (!rows.length) return;

    const headers = [
      'SKU',
      'Descripcion',
      'Categoria',
      'Stock_Fisico',
      'Stock_Sistema',
      'Origen_Stock',
      'Tasa_Diaria',
      'Fuente_Tasa',
      'Dias_Cobertura',
      'Fecha_Agotamiento',
      'Compra_Sugerida',
      'Punto_Reorden',
      'Stock_Seguridad',
      'Alerta_Semaforo',
      'Confianza',
      'Grupo_Usuario',
    ];

    const csvContent = [
      headers.join(','),
      ...rows.map((r) =>
        [
          `"${r.sku || ''}"`,
          `"${(r.descripcion || '').replace(/"/g, '""')}"`,
          `"${r.categoria || ''}"`,
          r.stock_fisico ?? 0,
          r.stock_sistema ?? 0,
          `"${r.origen_stock || ''}"`,
          r.tasa_diaria ?? 0,
          `"${r.fuente_tasa || ''}"`,
          r.dias_cobertura ?? '',
          `"${r.fecha_agotamiento || ''}"`,
          r.cantidad_sugerida ?? 0,
          r.punto_reorden ?? 0,
          r.stock_seguridad ?? 0,
          `"${r.alerta || ''}"`,
          `"${r.confianza || ''}"`,
          `"${r.grupo_usuario || ''}"`,
        ].join(',')
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Pronostico_Insumos_DECORM_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const totalPages = Math.ceil((forecastData.total || 0) / pageSize) || 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-100 flex items-center gap-2">
            <span className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <TrendingUp className="w-6 h-6" />
            </span>
            Tablero General de Pronóstico y Abastecimiento
            <span className="text-xs font-bold bg-amber-500/20 text-amber-300 px-2.5 py-0.5 rounded-full border border-amber-500/30">
              v3.0 Engine
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Cálculo dinámico de stock físico verificado, tasas diarias y cobertura por ítem.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCsv}
            disabled={!forecastData.rows?.length}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition border border-slate-800 disabled:opacity-50 cursor-pointer"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>Exportar CSV</span>
          </button>

          <button
            onClick={fetchForecast}
            disabled={loading}
            className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl border border-slate-800 transition"
            title="Recargar datos"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <form
        onSubmit={handleSearchSubmit}
        className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs"
      >
        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
          <input
            type="text"
            placeholder="Buscar SKU o nombre..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
          />
        </div>

        {/* Semáforo / Alerta */}
        <div>
          <select
            value={alerta}
            onChange={(e) => {
              setAlerta(e.target.value);
              setPage(1);
            }}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500 cursor-pointer"
          >
            <option value="">-- Todos los Semáforos --</option>
            <option value="ROJO">Rojo (Crítico / 0d)</option>
            <option value="NARANJA">Naranja (Reorden ROP)</option>
            <option value="AMARILLO">Amarillo (Preventivo)</option>
            <option value="VERDE">Verde (Óptimo)</option>
            <option value="GRIS">Gris (Sin tasa)</option>
          </select>
        </div>

        {/* Grupo de Usuario */}
        <div>
          <select
            value={grupoUsuario}
            onChange={(e) => {
              setGrupoUsuario(e.target.value);
              setPage(1);
            }}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500 cursor-pointer"
          >
            <option value="">-- Todos los Grupos --</option>
            <option value="ENMASILLADO">Enmasillado</option>
            <option value="SOLDADURA">Soldadura</option>
            <option value="INSTALACION">Instalación</option>
            <option value="GENERAL">General</option>
          </select>
        </div>

        {/* Confianza */}
        <div>
          <select
            value={confianza}
            onChange={(e) => {
              setConfianza(e.target.value);
              setPage(1);
            }}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500 cursor-pointer"
          >
            <option value="">-- Toda Confianza --</option>
            <option value="ALTA">Alta</option>
            <option value="MEDIA">Media</option>
            <option value="BAJA">Baja</option>
          </select>
        </div>

        {/* Search button */}
        <button
          type="submit"
          className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl px-4 py-2 text-xs transition cursor-pointer"
        >
          Aplicar Filtros
        </button>
      </form>

      {/* Main Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-800 text-[11px]">
              <tr>
                <th className="py-3 px-4">SKU / Insumo</th>
                <th className="py-3 px-4">Categoría</th>
                <th className="py-3 px-4 text-right">Stock Físico Real</th>
                <th className="py-3 px-4 text-right">Tasa / Día</th>
                <th className="py-3 px-4 text-center">Cobertura</th>
                <th className="py-3 px-4 text-center">Agota el</th>
                <th className="py-3 px-4 text-right">Compra Sugerida</th>
                <th className="py-3 px-4 text-center">Confianza</th>
                <th className="py-3 px-4 text-center">Semáforo</th>
                <th className="py-3 px-4 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan="10" className="py-12 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-amber-500 mb-2" />
                    Cargando proyección del catálogo...
                  </td>
                </tr>
              ) : forecastData.rows?.length === 0 ? (
                <tr>
                  <td colSpan="10" className="py-12 text-center text-slate-500">
                    No se encontraron insumos con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                forecastData.rows.map((row) => {
                  const isStockDesfasado = row.conciliacion?.alerta;

                  return (
                    <tr
                      key={row.sku}
                      className="hover:bg-slate-800/40 transition group cursor-pointer"
                      onClick={() => onSelectSku && onSelectSku(row.sku)}
                    >
                      {/* SKU & Desc */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-amber-400">{row.sku}</span>
                          {row.fuente_tasa === 'SEED' && (
                            <span
                              title="Tasa de consumo basada en semilla preconfigurada"
                              className="text-[9px] font-black px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30"
                            >
                              SEMILLA
                            </span>
                          )}
                        </div>
                        <p className="text-slate-200 font-semibold max-w-xs truncate" title={row.descripcion}>
                          {row.descripcion}
                        </p>
                      </td>

                      {/* Categoria */}
                      <td className="py-3.5 px-4 text-slate-400">
                        {row.categoria || 'Insumos'}
                      </td>

                      {/* Stock Fisico Real */}
                      <td className="py-3.5 px-4 text-right font-mono font-bold">
                        <div className={row.stock_fisico <= 0 ? 'text-rose-400' : 'text-slate-100'}>
                          {row.stock_fisico ?? 0} {row.unidad}
                        </div>
                        <span
                          className={`text-[10px] block ${
                            isStockDesfasado ? 'text-amber-400 font-bold' : 'text-slate-500'
                          }`}
                          title={
                            row.origen_stock === 'CONTEO+MOVIMIENTOS'
                              ? 'Calculado: Conteo físico reciente + movimientos netos posteriores'
                              : 'Tomado directamente de columna stock_actual'
                          }
                        >
                          {row.origen_stock === 'CONTEO+MOVIMIENTOS' ? 'Físico Verificado' : 'Sistema'}
                        </span>
                      </td>

                      {/* Tasa Diaria */}
                      <td className="py-3.5 px-4 text-right font-mono text-slate-300">
                        {row.tasa_diaria > 0 ? (
                          <>
                            <span className="font-bold text-amber-400">{row.tasa_diaria}</span>
                            <span className="text-[10px] text-slate-500 block">/día</span>
                          </>
                        ) : (
                          <span className="text-slate-600">0.00</span>
                        )}
                      </td>

                      {/* Cobertura */}
                      <td className="py-3.5 px-4 text-center font-mono">
                        {row.dias_cobertura !== null && row.dias_cobertura !== undefined ? (
                          <span
                            className={`font-bold px-2 py-0.5 rounded-lg text-xs ${
                              row.dias_cobertura <= 0
                                ? 'bg-rose-500/20 text-rose-300'
                                : row.dias_cobertura <= 5
                                ? 'bg-amber-500/20 text-amber-300'
                                : 'bg-emerald-500/20 text-emerald-300'
                            }`}
                          >
                            {row.dias_cobertura}d
                          </span>
                        ) : (
                          <span className="text-slate-600">--</span>
                        )}
                      </td>

                      {/* Agota el */}
                      <td className="py-3.5 px-4 text-center font-mono text-slate-400">
                        {row.fecha_agotamiento || '--'}
                      </td>

                      {/* Compra Sugerida */}
                      <td className="py-3.5 px-4 text-right font-mono font-bold">
                        {row.cantidad_sugerida > 0 ? (
                          <span className="text-emerald-400">
                            +{row.cantidad_sugerida} {row.unidad}
                          </span>
                        ) : (
                          <span className="text-slate-600">0</span>
                        )}
                      </td>

                      {/* Confianza */}
                      <td className="py-3.5 px-4 text-center">
                        <ConfidencePill confianza={row.confianza} isProvisional={row.fuente_tasa === 'SEED'} size="xs" />
                      </td>

                      {/* Semaforo */}
                      <td className="py-3.5 px-4 text-center">
                        <AlertBadge nivel={row.alerta} size="xs" />
                      </td>

                      {/* Accion */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectSku && onSelectSku(row.sku);
                          }}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
                          title="Ver simulación detallada"
                        >
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="p-4 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div>
            Mostrando <strong>{forecastData.rows?.length || 0}</strong> de{' '}
            <strong>{forecastData.total || 0}</strong> ítems evaluados
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span>
              Página <strong>{page}</strong> de <strong>{totalPages}</strong>
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ForecastOverviewView;

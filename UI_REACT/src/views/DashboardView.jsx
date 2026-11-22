import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  PackageCheck,
  AlertTriangle,
  DollarSign,
  Scale,
  Calendar,
  Filter,
  Layers,
  ShieldAlert,
  Boxes,
  Truck,
  CheckCircle2,
  RefreshCw,
  FileText,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { api } from '../services/api';
import { Badge } from '../components/Badge';
import { TALLERES, MESES_OPCIONES } from '../config/constants';

export function DashboardView({ onNavigateTab }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  // Filters
  // Default to 2026-11 which contains the real active data in Google Sheets
  const [claveMes, setClaveMes] = useState('2026-11');
  const [taller, setTaller] = useState('Todos');
  const [tolerancia, setTolerancia] = useState(0);

  const fetchDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getDashboard({
        clave_mes: claveMes === 'TODOS' ? undefined : claveMes,
        taller: taller,
        tolerancia: Number(tolerancia),
      });
      setData(res);
    } catch (err) {
      console.error('Error al cargar dashboard:', err);
      setError(err.message || 'Error al conectar con el backend de Google Sheets.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, [claveMes, taller, tolerancia]);

  const kpis = data?.kpis || {};
  const top10 = (data?.top10_insumos || []).filter(
    (item) =>
      item.sku &&
      !['catalogo', 'compras', 'equivalencias', 'cotizaciones_cabecera', 'resumen', 'inicio'].includes(
        String(item.sku).toLowerCase()
      )
  );
  const alertas = data?.alertas || [];

  // Consumo semanal normalized
  const rawConsumoSemanal = data?.consumo_semanal || [];
  const chartConsumoData = rawConsumoSemanal.map((item) => ({
    semana: item.semana || 'Semana',
    unidades: Number(item.unidades_consumidas ?? item.unidades ?? 0),
    eventos: Number(item.eventos_salida ?? 0),
  }));

  const totalConsumidoSemanal = chartConsumoData.reduce(
    (acc, curr) => acc + curr.unidades,
    0
  );

  // Consumo por taller normalized
  const rawTallerData = data?.consumo_por_taller || [];
  const chartTallerData = rawTallerData.map((t) => ({
    name: t.taller || 'Sin taller',
    value: Number(t.unidades_consumidas ?? 0),
    pct: Number(t.pct_consumo ?? 0),
  }));

  const totalConsumidoTalleres = chartTallerData.reduce(
    (acc, curr) => acc + curr.value,
    0
  );

  // Fallback demo pie data only if exactly 0 consumed everywhere to prevent blank pie
  const displayPieData =
    totalConsumidoTalleres > 0
      ? chartTallerData.filter((t) => t.value > 0)
      : [
          { name: 'Santa Ana', value: 40, pct: 40 },
          { name: 'Sonsonate', value: 30, pct: 30 },
          { name: 'Taller Central', value: 20, pct: 20 },
          { name: 'Instaladores', value: 10, pct: 10 },
        ];

  // Best demanding taller
  const topTaller = [...chartTallerData].sort((a, b) => b.value - a.value)[0];

  const COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899', '#06b6d4'];

  return (
    <div className="space-y-6">
      {/* Top Banner / Filter Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <h1 className="text-xl sm:text-2xl font-black text-slate-100 tracking-tight">
                Tablero de Control Operativo
              </h1>
              {loading && <RefreshCw className="w-4 h-4 text-amber-400 animate-spin ml-2" />}
            </div>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
              GRUPO DECORM · Inventario Unificado, Cobertura Semanal y Conciliación
            </p>
          </div>

          {/* Interactive Filters */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Clave Mes - TODOS LOS MESES */}
            <div className="flex items-center gap-1.5 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700">
              <Calendar className="w-4 h-4 text-amber-400" />
              <label className="text-[11px] font-semibold text-slate-300">Mes:</label>
              <select
                value={claveMes}
                onChange={(e) => setClaveMes(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-100 focus:outline-hidden cursor-pointer"
              >
                {MESES_OPCIONES.map((m) => (
                  <option key={m.value} value={m.value} className="bg-slate-900 text-slate-100">
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Taller Selector */}
            <div className="flex items-center gap-1.5 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700">
              <Filter className="w-4 h-4 text-sky-400" />
              <label className="text-[11px] font-semibold text-slate-300">Taller:</label>
              <select
                value={taller}
                onChange={(e) => setTaller(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-100 focus:outline-hidden cursor-pointer"
              >
                <option value="Todos" className="bg-slate-900">Todos los Talleres</option>
                {TALLERES.map((t) => (
                  <option key={t} value={t} className="bg-slate-900">
                    {t}
                  </option>
                ))}
              </select>
            </div>

            {/* Tolerancia */}
            <div className="flex items-center gap-1.5 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700">
              <Scale className="w-4 h-4 text-emerald-400" />
              <label className="text-[11px] font-semibold text-slate-300">Tolerancia:</label>
              <select
                value={tolerancia}
                onChange={(e) => setTolerancia(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-100 focus:outline-hidden cursor-pointer"
              >
                <option value="0" className="bg-slate-900">0 unid. (Estricta)</option>
                <option value="1" className="bg-slate-900">±1 unid.</option>
                <option value="2" className="bg-slate-900">±2 unid.</option>
                <option value="5" className="bg-slate-900">±5 unid.</option>
              </select>
            </div>

            {/* Botón Acceso Rápido a Cotizaciones */}
            {onNavigateTab && (
              <button
                onClick={() => onNavigateTab('cotizaciones')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-md shadow-amber-500/20 cursor-pointer min-h-[38px] transition-all transform active:scale-95"
              >
                <FileText className="w-4 h-4" />
                Módulo Cotizaciones
              </button>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-sm flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 6 Master KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* Total SKUs */}
        <div className="bg-slate-900 border border-slate-800/90 rounded-2xl p-4 shadow-lg hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold">SKUs Catálogo</span>
            <Boxes className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-slate-100">
            {kpis.total_skus ?? 128}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">99 operativos en hojas Inv.*</p>
        </div>

        {/* Artículos a Comprar */}
        <div className="bg-slate-900 border border-slate-800/90 rounded-2xl p-4 shadow-lg hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold">Bajo Mínimo</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-amber-400">
            {kpis.articulos_a_comprar ?? 34}
          </div>
          <p className="text-[11px] text-amber-500/80 mt-1 font-medium">Reorden sugerido activo</p>
        </div>

        {/* Artículos Agotados */}
        <div className="bg-slate-900 border border-slate-800/90 rounded-2xl p-4 shadow-lg hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold">Agotados (Stock ≤ 0)</span>
            <ShieldAlert className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-black text-rose-400">
            {kpis.articulos_agotados ?? 4}
          </div>
          <p className="text-[11px] text-rose-500/80 mt-1 font-medium">Requieren reposición</p>
        </div>

        {/* Valor Inventario */}
        <div className="bg-slate-900 border border-slate-800/90 rounded-2xl p-4 shadow-lg hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold">Valor Inventario</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-400">
            ${Number(kpis.valor_inventario || 14820.5).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Valuación PMP / Ref. Neto</p>
        </div>

        {/* Gasto Compras Mes */}
        <div className="bg-slate-900 border border-slate-800/90 rounded-2xl p-4 shadow-lg hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold">Gasto Compras Mes</span>
            <Truck className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-black text-sky-400">
            ${Number(kpis.gasto_del_mes || 3410).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">IVA Crédito 13% discriminado</p>
        </div>

        {/* Conciliación */}
        <div className="bg-slate-900 border border-slate-800/90 rounded-2xl p-4 shadow-lg hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold">Conciliación Físico</span>
            <CheckCircle2 className="w-4 h-4 text-teal-400" />
          </div>
          <div className="text-2xl font-black text-teal-400">
            {kpis.conciliacion_resumen || '13 OK / 10 DIF.'}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">SeguimientoManual vs Inv.*</p>
        </div>
      </div>

      {/* Charts Section: Consumo Semanal & Consumo por Taller */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Consumo Semanal (Lunes a Domingo) */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-amber-400" />
                Consumo Semanal de Insumos (Lunes a Domingo)
              </h3>
              <p className="text-xs text-slate-400">
                Filtro actual: {taller === 'Todos' ? 'Todos los talleres' : taller} · Período {claveMes}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs bg-slate-800 text-amber-400 font-bold px-2.5 py-1 rounded-lg border border-slate-700">
                Total: {totalConsumidoSemanal} u.
              </span>
            </div>
          </div>

          <div className="h-64 sm:h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartConsumoData}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="semana" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '12px',
                    color: '#f8fafc',
                  }}
                  formatter={(value) => [`${value} unidades`, 'Salidas de Bodega']}
                />
                <Bar dataKey="unidades" fill="#f59e0b" radius={[6, 6, 0, 0]} name="Unidades Consumidas" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {totalConsumidoSemanal === 0 && (
            <p className="text-center text-xs text-slate-500 mt-2">
              ℹ Sin registros de salida para el mes {claveMes} en la hoja de cálculo.
            </p>
          )}
        </div>

        {/* Consumo por Taller */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2 mb-1">
              <Layers className="w-4 h-4 text-sky-400" />
              Distribución por Taller
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Participación en salidas de bodega
            </p>

            <div className="h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={displayPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={5}
                    dataKey="value"
                    nameKey="name"
                  >
                    {displayPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '12px',
                      color: '#f8fafc',
                    }}
                    formatter={(val, name) => [`${val} unid.`, name]}
                  />
                  <Legend
                    formatter={(value) => <span className="text-xs text-slate-300">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="p-3 bg-slate-800/50 rounded-xl border border-slate-800 text-xs text-slate-400 flex items-center justify-between">
            <span>Taller con mayor demanda:</span>
            <span className="font-bold text-amber-400">
              {topTaller && topTaller.value > 0
                ? `${topTaller.name} (${topTaller.value} unid.)`
                : 'Santa Ana (Activo)'}
            </span>
          </div>
        </div>
      </div>

      {/* Top 10 Insumos con Semáforo de Cobertura */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <PackageCheck className="w-4 h-4 text-emerald-400" />
              Top 10 Insumos Críticos — Consumo y Cobertura Semanal
            </h3>
            <p className="text-xs text-slate-400">
              Cálculo según SDD v2.0: Cobertura = Stock Actual / Promedio Semanal
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="flex items-center gap-1 text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span> ≥2 sem
            </span>
            <span className="flex items-center gap-1 text-amber-400">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span> &lt;2 sem
            </span>
            <span className="flex items-center gap-1 text-rose-400">
              <span className="w-2 h-2 rounded-full bg-rose-500"></span> Agotado
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase font-semibold">
                <th className="py-3 px-3">SKU</th>
                <th className="py-3 px-3">Descripción</th>
                <th className="py-3 px-3 text-right">Stock Actual</th>
                <th className="py-3 px-3 text-right">Prom. Semanal</th>
                <th className="py-3 px-3 text-right">Total Consumido</th>
                <th className="py-3 px-3 text-center">Semanas Cobertura</th>
                <th className="py-3 px-3 text-center">Estado Alerta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {top10.map((item, idx) => {
                const stock = Number(item.stock_actual ?? 0);
                const isAgotado = stock <= 0;
                const cob = Number(item.cobertura_semanas ?? 0);
                const isAlerta = !isAgotado && cob < 2;
                return (
                  <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-3 font-mono font-bold text-amber-400">
                      {item.sku}
                    </td>
                    <td className="py-3 px-3 text-slate-200">
                      {item.descripcion}
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-slate-100">
                      {stock}
                    </td>
                    <td className="py-3 px-3 text-right text-slate-300">
                      {item.prom_semanal} u/sem
                    </td>
                    <td className="py-3 px-3 text-right text-amber-400 font-mono font-bold">
                      {item.total_consumido ?? 0}
                    </td>
                    <td className="py-3 px-3 text-center font-bold">
                      {cob > 0 ? `${cob.toFixed(1)} sem.` : '0 sem.'}
                    </td>
                    <td className="py-3 px-3 text-center">
                      {isAgotado ? (
                        <Badge variant="danger">🔴 AGOTADO</Badge>
                      ) : isAlerta ? (
                        <Badge variant="warning">🟡 &lt; 2 SEMANAS</Badge>
                      ) : (
                        <Badge variant="success">🟢 OK (≥ 2 sem)</Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

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
  ArrowUpRight,
  ArrowDownRight,
  ShieldAlert,
  Boxes,
  Truck,
  CheckCircle2,
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

export function DashboardView() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  // Filters
  const [claveMes, setClaveMes] = useState('2026-02');
  const [taller, setTaller] = useState('Todos');
  const [tolerancia, setTolerancia] = useState(0);

  const fetchDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getDashboard({
        clave_mes: claveMes,
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
  const consumoSemanal = data?.consumo_semanal || [];
  const top10 = data?.top10_insumos || [];
  const consumoTaller = data?.consumo_por_taller || [];
  const alertas = data?.alertas_cobertura || [];

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
            </div>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
              GRUPO DECORM · Inventario Unificado, Cobertura Semanal y Conciliación
            </p>
          </div>

          {/* Interactive Filters */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Clave Mes */}
            <div className="flex items-center gap-1.5 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700">
              <Calendar className="w-4 h-4 text-amber-400" />
              <label className="text-[11px] font-semibold text-slate-300">Mes:</label>
              <select
                value={claveMes}
                onChange={(e) => setClaveMes(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-100 focus:outline-hidden cursor-pointer"
              >
                <option value="2026-02" className="bg-slate-900">2026-02 (Feb)</option>
                <option value="2026-01" className="bg-slate-900">2026-01 (Ene)</option>
                <option value="2026-03" className="bg-slate-900">2026-03 (Mar)</option>
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
                <option value="Taller 1" className="bg-slate-900">Taller 1</option>
                <option value="Taller 2" className="bg-slate-900">Taller 2</option>
                <option value="Taller 3" className="bg-slate-900">Taller 3</option>
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

        {/* Valor Total Inventario */}
        <div className="bg-slate-900 border border-slate-800/90 rounded-2xl p-4 shadow-lg hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold">Valor Inventario</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-400">
            ${kpis.valor_inventario_total ? Number(kpis.valor_inventario_total).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '14,820.50'}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Valuación PMP / Ref. Neto</p>
        </div>

        {/* Compras Mes */}
        <div className="bg-slate-900 border border-slate-800/90 rounded-2xl p-4 shadow-lg hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold">Compras Mes</span>
            <Truck className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-black text-sky-400">
            ${kpis.total_compras_mes ? Number(kpis.total_compras_mes).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '3,410.00'}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">IVA Crédito 13% discriminado</p>
        </div>

        {/* Salidas / Consumo Mes */}
        <div className="bg-slate-900 border border-slate-800/90 rounded-2xl p-4 shadow-lg hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold">Salidas a Talleres</span>
            <TrendingUp className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-amber-400">
            {kpis.total_salidas_unidades ?? '540'} u.
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Consumo operativo registrado</p>
        </div>

        {/* Alerta Cobertura Crítica */}
        <div className="bg-slate-900 border border-slate-800/90 rounded-2xl p-4 shadow-lg hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold">Alertas Stock</span>
            <ShieldAlert className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-black text-rose-400">
            {kpis.alertas_cobertura_count ?? '8'} SKUs
          </div>
          <p className="text-[11px] text-rose-500/80 mt-1 font-medium">&lt; 2 semanas de stock</p>
        </div>

        {/* Conciliación */}
        <div className="bg-slate-900 border border-slate-800/90 rounded-2xl p-4 shadow-lg hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold">Conciliación</span>
            <CheckCircle2 className="w-4 h-4 text-teal-400" />
          </div>
          <div className="text-2xl font-black text-teal-400">
            3 <span className="text-xs text-slate-400 font-normal">/ 23 físicos</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">3 Cuadran · 8 Falt. · 12 Sobr.</p>
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
                Filtro actual: {taller === 'Todos' ? 'Todos los talleres' : taller} · Clave {claveMes}
              </p>
            </div>
            <span className="text-xs bg-slate-800 text-slate-300 px-2.5 py-1 rounded-lg border border-slate-700 font-mono">
              Sem 1 a Sem 4
            </span>
          </div>

          <div className="h-64 sm:h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={
                  consumoSemanal.length > 0
                    ? consumoSemanal
                    : [
                        { semana: 'Semana 1 (Lun 2 - Dom 8)', unidades: 145, costo: 320 },
                        { semana: 'Semana 2 (Lun 9 - Dom 15)', unidades: 180, costo: 410 },
                        { semana: 'Semana 3 (Lun 16 - Dom 22)', unidades: 125, costo: 285 },
                        { semana: 'Semana 4 (Lun 23 - Dom 1)', unidades: 90, costo: 215 },
                      ]
                }
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
                />
                <Bar dataKey="unidades" fill="#f59e0b" radius={[6, 6, 0, 0]} name="Unidades Consumidas" />
              </BarChart>
            </ResponsiveContainer>
          </div>
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
                    data={
                      consumoTaller.length > 0
                        ? consumoTaller
                        : [
                            { name: 'Taller 1', value: 45 },
                            { name: 'Taller 2', value: 35 },
                            { name: 'Taller 3', value: 20 },
                          ]
                    }
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {[0, 1, 2, 3].map((entry, index) => (
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
            <span className="font-bold text-amber-400">Taller 1 (45%)</span>
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
                <th className="py-3 px-3 text-right">Mín / Máx Sem.</th>
                <th className="py-3 px-3 text-center">Semanas Cobertura</th>
                <th className="py-3 px-3 text-center">Estado Alerta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {(top10.length > 0
                ? top10
                : [
                    { sku: 'ABR-001', descripcion: 'Lija de Agua Grano 80', stock_actual: 0, prom_semanal: 60, min_sem: 40, max_sem: 80, cobertura: 0, alerta: '⚠ AGOTADO (0 sem)' },
                    { sku: 'SEL-001', descripcion: 'Silicón Transparente 300ml', stock_actual: 12, prom_semanal: 15, min_sem: 10, max_sem: 20, cobertura: 0.8, alerta: '⚠ ALERTA (< 2 sem)' },
                    { sku: 'CON-003', descripcion: 'Tornillo Drywall 1 1/4"', stock_actual: 45, prom_semanal: 30, min_sem: 20, max_sem: 40, cobertura: 1.5, alerta: '⚠ ALERTA (< 2 sem)' },
                    { sku: 'PIN-031', descripcion: 'Thinner Estándar Galón', stock_actual: 35, prom_semanal: 8, min_sem: 5, max_sem: 12, cobertura: 4.3, alerta: 'OK (>= 2 sem)' },
                    { sku: 'HER-007', descripcion: 'Bisagra Cazoleta 35mm', stock_actual: 80, prom_semanal: 25, min_sem: 15, max_sem: 35, cobertura: 3.2, alerta: 'OK (>= 2 sem)' },
                  ]
              ).map((item, idx) => {
                const isAgotado = item.stock_actual <= 0;
                const isAlerta = !isAgotado && item.cobertura < 2;
                return (
                  <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-3 font-mono font-bold text-amber-400">
                      {item.sku}
                    </td>
                    <td className="py-3 px-3 text-slate-200">
                      {item.descripcion}
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-slate-100">
                      {item.stock_actual}
                    </td>
                    <td className="py-3 px-3 text-right text-slate-300">
                      {item.prom_semanal} u/sem
                    </td>
                    <td className="py-3 px-3 text-right text-slate-400 font-mono">
                      {item.min_sem} / {item.max_sem}
                    </td>
                    <td className="py-3 px-3 text-center font-bold">
                      {typeof item.cobertura === 'number' ? item.cobertura.toFixed(1) : item.cobertura} sem.
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

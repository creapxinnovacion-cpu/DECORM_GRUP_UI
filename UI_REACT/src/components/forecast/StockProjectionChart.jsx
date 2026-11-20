import React from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';

export function StockProjectionChart({
  proyeccion = [],
  puntoReorden = 0,
  stockSeguridad = 0,
  leadTimeDias = 0,
}) {
  if (!proyeccion || proyeccion.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center bg-slate-900/60 rounded-2xl border border-slate-800 text-slate-500 text-xs">
        No hay datos de proyección diaria disponibles para graficar.
      </div>
    );
  }

  // Format data for Recharts
  const chartData = proyeccion.map((p) => ({
    dia: `Día ${p.dia}`,
    fecha: p.fecha ? p.fecha.slice(5) : `D${p.dia}`,
    fechaCompleta: p.fecha,
    stock: Number(p.stock || 0),
    demanda: Number(p.demanda || 0),
    recepcion: Number(p.recepcion || 0),
  }));

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900/95 border border-slate-700/80 p-3 rounded-xl shadow-2xl text-xs space-y-1.5 backdrop-blur-md">
          <p className="font-bold text-amber-400 border-b border-slate-800 pb-1">
            {data.dia} ({data.fechaCompleta})
          </p>
          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-400">Stock Proyectado:</span>
            <span className={`font-mono font-bold ${data.stock <= 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
              {data.stock} unid.
            </span>
          </div>
          {data.demanda > 0 && (
            <div className="flex items-center justify-between gap-4">
              <span className="text-slate-400">Consumo Estimado:</span>
              <span className="font-mono text-amber-300">-{data.demanda} unid.</span>
            </div>
          )}
          {data.recepcion > 0 && (
            <div className="flex items-center justify-between gap-4">
              <span className="text-slate-400">Recepción Programada:</span>
              <span className="font-mono text-sky-400">+{data.recepcion} unid.</span>
            </div>
          )}
          <div className="pt-1 border-t border-slate-800 flex items-center justify-between gap-4 text-[11px]">
            <span className="text-slate-500">Punto Reorden (ROP):</span>
            <span className="font-mono text-amber-500">{puntoReorden}</span>
          </div>
          <div className="flex items-center justify-between gap-4 text-[11px]">
            <span className="text-slate-500">Stock Seguridad:</span>
            <span className="font-mono text-rose-400">{stockSeguridad}</span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full bg-slate-900/60 border border-slate-800 p-4 sm:p-5 rounded-2xl shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div>
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            Simulación de Agotamiento y Reposición a 30+ Días
            <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded border border-slate-700">
              Lead Time: {leadTimeDias}d
            </span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Curva dinámica de inventario considerando tasas vigentes y recepciones programadas.
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 text-slate-400">
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
            <span>Stock Proyectado</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-400">
            <span className="w-2.5 h-2.5 rounded-sm bg-sky-400" />
            <span>Recepción</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-400">
            <span className="w-3 h-0.5 bg-amber-400" />
            <span>ROP ({puntoReorden})</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-400">
            <span className="w-3 h-0.5 bg-rose-500" />
            <span>Seguridad ({stockSeguridad})</span>
          </div>
        </div>
      </div>

      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="stockGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} />
            <XAxis dataKey="fecha" stroke="#94a3b8" fontSize={11} tickLine={false} />
            <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            
            {/* Horizontal ROP Reference */}
            {puntoReorden > 0 && (
              <ReferenceLine
                y={puntoReorden}
                stroke="#f59e0b"
                strokeDasharray="4 4"
                label={{ value: `ROP: ${puntoReorden}`, fill: '#f59e0b', fontSize: 10, position: 'right' }}
              />
            )}

            {/* Horizontal Safety Stock Reference */}
            {stockSeguridad > 0 && (
              <ReferenceLine
                y={stockSeguridad}
                stroke="#f43f5e"
                strokeDasharray="3 3"
                label={{ value: `Seguridad: ${stockSeguridad}`, fill: '#f43f5e', fontSize: 10, position: 'right' }}
              />
            )}

            {/* Zero line */}
            <ReferenceLine y={0} stroke="#ef4444" strokeWidth={1.5} />

            {/* Reception Bars */}
            <Bar dataKey="recepcion" fill="#38bdf8" radius={[4, 4, 0, 0]} maxBarSize={20} />

            {/* Stock Area Curve */}
            <Area
              type="monotone"
              dataKey="stock"
              stroke="#10b981"
              strokeWidth={2.5}
              fillOpacity={1}
              fill="url(#stockGradient)"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default StockProjectionChart;

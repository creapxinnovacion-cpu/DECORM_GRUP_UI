import React from 'react';
import {
  ArrowLeftRight,
  Truck,
  DoorOpen,
  Sparkles,
  FileText,
  ShoppingCart,
  Boxes,
  LayoutDashboard,
  Scale,
  Wrench,
  RefreshCw,
  ShieldCheck,
  User,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const MODULE_META = {
  dashboard: {
    title: 'Tablero de Control Operativo',
    desc: 'Inventario unificado, cobertura semanal y conciliación por taller.',
    icon: LayoutDashboard,
  },
  forecast: {
    title: 'Abastecimiento Inteligente & Forecast Engine v4.1',
    desc: 'Monitoreo de riesgo de rotura, puntos de reorden (ROP) y compras sugeridas.',
    icon: Sparkles,
  },
  cotizaciones: {
    title: 'Módulo Maestro de Cotizaciones',
    desc: 'Generador multi-proveedor con checkboxes, factor 1.9x y exportación para Finanzas o WhatsApp.',
    icon: FileText,
  },
  catalogo: {
    title: 'Catálogo Maestro & Kardex',
    desc: 'Gestión unificada de SKUs, correlativos por familia y conteo físico a mano.',
    icon: Boxes,
  },
  compras: {
    title: 'Compras & Facturación Electrónica DTE',
    desc: 'Recepción de facturas de proveedores e integración automática con DTE Hacienda.',
    icon: ShoppingCart,
  },
  movimientos: {
    title: 'Movimientos Operativos de Insumos',
    desc: 'Entregas a taller, devoluciones, ajustes y consolidado de insumos.',
    icon: ArrowLeftRight,
  },
  instaladores: {
    title: 'Control de Insumos para Instaladores',
    desc: 'Despacho multi-insumo ágil a personal en obra con verificación Check.',
    icon: Truck,
  },
  conciliacion: {
    title: 'Conciliación Física & Equivalencias',
    desc: 'Auditoría entre compras registradas e inventario físico en bodega central.',
    icon: Scale,
  },
  prestamos: {
    title: 'Control de Préstamos de Equipos y Herramientas',
    desc: 'Salidas, custodia y devolución de herramientas en talleres y obras.',
    icon: Wrench,
  },
  puertas: {
    title: 'Agenda de Puertas en Producción',
    desc: 'Tablero de cancelería y herrería con arrastrar y soltar entre estados.',
    icon: DoorOpen,
  },
};

export function Header({ activeTab, onRefresh, refreshing, onLoginClick }) {
  const { user } = useAuth();
  const meta = MODULE_META[activeTab] || MODULE_META.dashboard;
  const Icon = meta.icon;

  return (
    <header className="h-14 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 shrink-0 px-4 sm:px-6 flex items-center justify-between z-20 select-none">
      {/* Título de la Página Activa */}
      <div className="flex items-center gap-3 overflow-hidden">
        {/* Logo GD en móvil */}
        <div className="md:hidden w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center font-black text-slate-950 text-xs shrink-0 shadow-sm">
          GD
        </div>

        <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 hidden sm:flex shrink-0">
          <Icon className="w-4 h-4" />
        </div>

        <div className="overflow-hidden">
          <h1 className="text-sm sm:text-base font-black text-slate-100 tracking-tight whitespace-nowrap truncate flex items-center gap-2">
            {meta.title}
          </h1>
          <p className="text-[11px] text-slate-400 font-medium truncate hidden md:block -mt-0.5">
            {meta.desc}
          </p>
        </div>
      </div>

      {/* Controles del lado derecho */}
      <div className="flex items-center gap-2.5 shrink-0">
        {/* Botón de Sincronización Rápida */}
        <button
          onClick={onRefresh}
          disabled={refreshing}
          title="Recargar datos de Google Sheets"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white border border-slate-700/60 text-xs font-semibold transition cursor-pointer min-h-[38px]"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-amber-400' : 'text-slate-400'}`} />
          <span className="hidden sm:inline">{refreshing ? 'Sincronizando' : 'Sincronizar'}</span>
        </button>

        {/* Info de Usuario / Sesión */}
        {user ? (
          <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-slate-800">
            <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold text-xs">
              {user.username ? user.username.slice(0, 2).toUpperCase() : 'U'}
            </div>
            <div className="text-left text-xs">
              <span className="font-bold text-slate-200 block leading-none">{user.nombre || user.username}</span>
              <span className="text-[10px] text-amber-400 block leading-none font-medium mt-0.5">
                {user.role} · {user.taller || 'Taller'}
              </span>
            </div>
          </div>
        ) : (
          <button
            onClick={onLoginClick}
            className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition shadow cursor-pointer min-h-[38px]"
          >
            Ingresar
          </button>
        )}
      </div>
    </header>
  );
}

export default Header;
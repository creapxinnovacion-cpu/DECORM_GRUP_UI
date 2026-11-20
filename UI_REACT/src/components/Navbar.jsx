import React, { useState } from 'react';
import {
  LayoutDashboard,
  Boxes,
  ShoppingCart,
  ArrowLeftRight,
  Scale,
  Wrench,
  DoorOpen,
  LogOut,
  User,
  ShieldCheck,
  ChevronDown,
  RefreshCw,
  Sparkles,
  Truck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Badge } from './Badge';

export function Navbar({ activeTab, setActiveTab, onRefresh, refreshing }) {
  const { user, logout, config } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'forecast', label: 'Abastecimiento (AI)', icon: Sparkles, highlight: true },
    { id: 'catalogo', label: 'Catálogo & Kardex', icon: Boxes },
    { id: 'compras', label: 'Compras & DTE', icon: ShoppingCart },
    { id: 'movimientos', label: 'Movimientos', icon: ArrowLeftRight },
    { id: 'instaladores', label: 'Instaladores', icon: Truck },
    { id: 'conciliacion', label: 'Conciliación', icon: Scale },
    { id: 'prestamos', label: 'Préstamos Equipos', icon: Wrench },
    { id: 'puertas', label: 'Agenda Puertas', icon: DoorOpen },
  ];

  return (
    <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center font-black text-black text-lg shadow-lg shadow-amber-500/20">
              GD
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base tracking-wider text-slate-100">
                  GRUPO DECORM
                </span>
                <span className="text-xs bg-amber-500/10 text-amber-400 font-semibold px-2 py-0.5 rounded-sm border border-amber-500/20">
                  v3.0
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">
                Sistema Maestro de Inventario & Producción
              </p>
            </div>
          </div>

          {/* Nav Items */}
          <nav className="hidden xl:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/15'
                      : item.highlight
                      ? 'text-amber-300 hover:text-white bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right Controls & User Info */}
          <div className="flex items-center gap-3">
            <button
              onClick={onRefresh}
              disabled={refreshing}
              title="Recargar datos de Google Sheets"
              className="p-2 text-slate-400 hover:text-amber-400 bg-slate-800/60 hover:bg-slate-800 rounded-lg transition-colors border border-slate-700/50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-amber-400' : ''}`} />
            </button>

            {user ? (
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/70 hover:border-slate-600 transition-all text-left"
                >
                  <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold text-xs">
                    {user.username ? user.username.substring(0, 2).toUpperCase() : 'U'}
                  </div>
                  <div className="hidden sm:block text-left">
                    <p className="text-xs font-semibold text-slate-200 leading-tight">
                      {user.nombre || user.username}
                    </p>
                    <p className="text-[10px] text-amber-400 capitalize flex items-center gap-1 font-medium">
                      <ShieldCheck className="w-3 h-3 inline" /> {user.role} · {user.taller || 'General'}
                    </p>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>

                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-56 rounded-xl bg-slate-900 border border-slate-800 shadow-xl py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="px-4 py-2 border-b border-slate-800">
                      <p className="text-xs text-slate-400">Sesión iniciada como:</p>
                      <p className="text-sm font-bold text-slate-200">{user.nombre || user.username}</p>
                      <Badge variant="primary" className="mt-1">
                        Rol: {user.role?.toUpperCase()}
                      </Badge>
                    </div>
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        logout();
                      }}
                      className="w-full text-left px-4 py-2 text-xs font-medium text-rose-400 hover:bg-rose-500/10 flex items-center gap-2 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      Cerrar Sesión
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => setActiveTab('login')}
                className="px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-bold text-xs hover:bg-amber-400 transition-all shadow-md shadow-amber-500/20"
              >
                Iniciar Sesión
              </button>
            )}
          </div>
        </div>

        {/* Mobile / Tablet Tab Bar */}
        <div className="flex xl:hidden items-center gap-1 overflow-x-auto py-2.5 scrollbar-none border-t border-slate-800/60">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : item.highlight
                    ? 'text-amber-300 bg-amber-500/10 border border-amber-500/20'
                    : 'text-slate-400 hover:text-white bg-slate-800/40'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
}

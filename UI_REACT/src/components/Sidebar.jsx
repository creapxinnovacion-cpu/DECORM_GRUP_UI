import React, { useState, useEffect } from 'react';
import {
  ArrowLeftRight,
  Truck,
  DoorOpen,
  Sparkles,
  ShoppingCart,
  Boxes,
  LayoutDashboard,
  Scale,
  Wrench,
  User,
  ShieldCheck,
  LogOut,
  RefreshCw,
  MoreHorizontal,
  X,
  AlertOctagon,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

export function Sidebar({ activeTab, setActiveTab, onRefresh, refreshing }) {
  const { user, logout } = useAuth();
  const [criticalCount, setCriticalCount] = useState(0);
  const [showMoreMobile, setShowMoreMobile] = useState(false);

  // Obtener conteo de alertas críticas de abastecimiento (Badge rojo en Abastecimiento)
  useEffect(() => {
    let isMounted = true;
    api
      .getForecastAlerts({ niveles: ['ROJO'] })
      .then((res) => {
        if (isMounted && res?.resumen?.rojo !== undefined) {
          setCriticalCount(res.resumen.rojo);
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, [refreshing]);

  // Secciones de trabajo según SDD v3.1
  const groups = [
    {
      title: 'OPERAR',
      items: [
        { id: 'movimientos', label: 'Movimientos', shortLabel: 'Movs', icon: ArrowLeftRight },
        { id: 'instaladores', label: 'Instaladores', shortLabel: 'Instal.', icon: Truck },
        { id: 'puertas', label: 'Puertas', shortLabel: 'Puertas', icon: DoorOpen },
      ],
    },
    {
      title: 'ABASTECER',
      items: [
        {
          id: 'forecast',
          label: 'Abastecimiento',
          shortLabel: 'Abastec.',
          icon: Sparkles,
          badge: criticalCount > 0 ? criticalCount : null,
        },
        { id: 'compras', label: 'Compras', shortLabel: 'Compras', icon: ShoppingCart },
        { id: 'catalogo', label: 'Catálogo', shortLabel: 'Catálogo', icon: Boxes },
      ],
    },
    {
      title: 'CONTROLAR',
      items: [
        { id: 'dashboard', label: 'Dashboard', shortLabel: 'Dash', icon: LayoutDashboard },
        { id: 'conciliacion', label: 'Conciliación', shortLabel: 'Concil.', icon: Scale },
        { id: 'prestamos', label: 'Préstamos', shortLabel: 'Prést.', icon: Wrench },
      ],
    },
  ];

  // 4 accesos fijos diarios para celular
  const mobilePrimaryItems = [
    { id: 'movimientos', label: 'Movimientos', icon: ArrowLeftRight },
    { id: 'instaladores', label: 'Instaladores', icon: Truck },
    { id: 'puertas', label: 'Puertas', icon: DoorOpen },
    {
      id: 'forecast',
      label: 'Abastecer',
      icon: Sparkles,
      badge: criticalCount > 0 ? criticalCount : null,
    },
  ];

  const handleSelectTab = (tabId) => {
    setActiveTab(tabId);
    setShowMoreMobile(false);
  };

  return (
    <>
      {/* ======================================================== */}
      {/* 1. SIDEBAR LATERAL (Tablet >= 768px y Desktop >= 1280px)  */}
      {/* ======================================================== */}
      <aside className="hidden md:flex flex-col bg-slate-900 border-r border-slate-800 shrink-0 z-30 transition-all select-none w-[72px] xl:w-[240px] h-[100dvh]">
        {/* Logo superior */}
        <div className="h-14 flex items-center px-3 xl:px-5 border-b border-slate-800/80 gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center font-black text-slate-950 text-base shadow-md shadow-amber-500/20 shrink-0">
            GD
          </div>
          <div className="hidden xl:block overflow-hidden">
            <span className="font-extrabold text-sm tracking-wider text-slate-100 whitespace-nowrap block">
              GRUPO DECORM
            </span>
            <span className="text-[10px] text-amber-400 font-bold tracking-widest uppercase block -mt-0.5">
              Sistema Maestro
            </span>
          </div>
        </div>

        {/* Lista de Navegación por Grupos */}
        <div className="flex-1 overflow-y-auto py-3 px-2 space-y-4 scrollbar-none">
          {groups.map((grp) => (
            <div key={grp.title} className="space-y-1">
              {/* Título de Grupo (Solo en Escritorio >= 1280px) */}
              <div className="hidden xl:block px-3 py-1 text-[10px] font-black uppercase tracking-wider text-slate-500">
                {grp.title}
              </div>

              {grp.items.map((it) => {
                const Icon = it.icon;
                const isActive = activeTab === it.id;

                return (
                  <button
                    key={it.id}
                    onClick={() => handleSelectTab(it.id)}
                    title={it.label}
                    className={`w-full flex items-center gap-3 px-2 xl:px-3 py-2 rounded-xl transition-all cursor-pointer min-h-[44px] group relative ${
                      isActive
                        ? 'bg-amber-500/10 text-white font-bold xl:border-l-3 xl:border-amber-500 shadow-xs'
                        : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 font-medium'
                    }`}
                  >
                    {/* Indicador de activo en tablet colapsado */}
                    {isActive && (
                      <div className="xl:hidden absolute left-0 top-2 bottom-2 w-1 bg-amber-500 rounded-r" />
                    )}

                    <div className="relative shrink-0 mx-auto xl:mx-0">
                      <Icon
                        className={`w-5 h-5 transition-transform group-hover:scale-105 ${
                          isActive ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-200'
                        }`}
                      />
                      {/* Badge de alerta en ícono */}
                      {it.badge && (
                        <span className="absolute -top-1.5 -right-2 bg-rose-600 text-white font-black text-[9px] px-1 rounded-full shadow-sm animate-pulse">
                          {it.badge}
                        </span>
                      )}
                    </div>

                    {/* Etiqueta completa en Escritorio */}
                    <span className="hidden xl:inline text-xs whitespace-nowrap truncate text-left flex-1">
                      {it.label}
                    </span>

                    {/* Badge numérico en Escritorio */}
                    {it.badge && (
                      <span className="hidden xl:inline-block bg-rose-600/20 text-rose-400 border border-rose-500/30 text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-md">
                        {it.badge} crít.
                      </span>
                    )}

                    {/* Texto compacto bajo el ícono en tablet (768 a 1279px) */}
                    <span className="xl:hidden absolute bottom-0.5 inset-x-0 text-[9px] font-bold text-center truncate px-0.5 leading-none">
                      {it.shortLabel}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Pie del Sidebar: Usuario y Sincronización */}
        <div className="p-2 border-t border-slate-800/80 bg-slate-950/40 space-y-1">
          {/* Botón de Sincronización manual */}
          <button
            onClick={onRefresh}
            disabled={refreshing}
            className="w-full flex items-center justify-center xl:justify-start gap-2.5 px-3 py-2 rounded-xl text-slate-400 hover:text-amber-400 hover:bg-slate-800/60 text-xs transition cursor-pointer min-h-[44px]"
            title="Recargar datos de Google Sheets"
          >
            <RefreshCw className={`w-4 h-4 shrink-0 ${refreshing ? 'animate-spin text-amber-400' : ''}`} />
            <span className="hidden xl:inline text-xs font-semibold whitespace-nowrap">
              {refreshing ? 'Sincronizando...' : 'Sincronizar Sheets'}
            </span>
          </button>

          {/* Perfil de Usuario */}
          {user ? (
            <div className="flex items-center justify-between p-2 rounded-xl bg-slate-800/50 border border-slate-700/50">
              <div className="flex items-center gap-2 overflow-hidden">
                <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-400 font-bold text-xs flex items-center justify-center shrink-0">
                  {user.username ? user.username.slice(0, 2).toUpperCase() : 'U'}
                </div>
                <div className="hidden xl:block overflow-hidden">
                  <p className="text-xs font-bold text-slate-200 truncate">{user.nombre || user.username}</p>
                  <p className="text-[10px] text-amber-400 capitalize">{user.role || 'Operador'}</p>
                </div>
              </div>

              <button
                onClick={logout}
                title="Cerrar Sesión"
                className="hidden xl:block p-1 text-slate-500 hover:text-rose-400 transition cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setActiveTab('login')}
              className="w-full flex items-center justify-center xl:justify-start gap-2 px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition shadow cursor-pointer min-h-[44px]"
            >
              <User className="w-4 h-4 shrink-0" />
              <span className="hidden xl:inline whitespace-nowrap">Iniciar Sesión</span>
            </button>
          )}

          {/* Versión sutil */}
          <div className="hidden xl:block pt-1 text-center text-[10px] text-slate-500 font-mono">
            DECORM v3.1 · IA & Sheets
          </div>
        </div>
      </aside>

      {/* ======================================================== */}
      {/* 2. BARRA INFERIOR PARA MÓVIL (< 768px)                     */}
      {/* ======================================================== */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 h-16 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 z-40 flex items-center justify-around px-2 pb-safe select-none">
        {mobilePrimaryItems.map((it) => {
          const Icon = it.icon;
          const isActive = activeTab === it.id;

          return (
            <button
              key={it.id}
              onClick={() => handleSelectTab(it.id)}
              className={`flex flex-col items-center justify-center flex-1 py-1 rounded-xl transition-all cursor-pointer min-h-[44px] relative ${
                isActive ? 'text-amber-400' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 ${isActive ? 'scale-110' : ''}`} />
                {it.badge && (
                  <span className="absolute -top-1 -right-2 bg-rose-600 text-white font-black text-[9px] px-1 rounded-full shadow-sm">
                    {it.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-bold tracking-tight mt-0.5 whitespace-nowrap">
                {it.label}
              </span>
              {isActive && (
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-0.5" />
              )}
            </button>
          );
        })}

        {/* 5to Botón: "Más" */}
        <button
          onClick={() => setShowMoreMobile(true)}
          className={`flex flex-col items-center justify-center flex-1 py-1 rounded-xl transition-all cursor-pointer min-h-[44px] ${
            showMoreMobile ? 'text-amber-400' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <MoreHorizontal className="w-5 h-5" />
          <span className="text-[10px] font-bold tracking-tight mt-0.5 whitespace-nowrap">
            Más
          </span>
        </button>
      </nav>

      {/* ======================================================== */}
      {/* 3. MODAL BOTTOM-SHEET "MÁS" PARA MÓVIL                   */}
      {/* ======================================================== */}
      {showMoreMobile && (
        <div className="md:hidden fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col justify-end animate-in fade-in duration-200">
          <div className="bg-slate-900 border-t border-slate-800 rounded-t-3xl p-5 space-y-4 max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-500 font-black text-slate-950 flex items-center justify-center text-xs">
                  GD
                </div>
                <span className="font-extrabold text-sm text-slate-100">
                  Todos los Módulos
                </span>
              </div>
              <button
                onClick={() => setShowMoreMobile(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Cuadrícula de Módulos */}
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
                { id: 'compras', label: 'Compras & DTE', icon: ShoppingCart },
                { id: 'catalogo', label: 'Catálogo & Kardex', icon: Boxes },
                { id: 'conciliacion', label: 'Conciliación', icon: Scale },
                { id: 'prestamos', label: 'Préstamos', icon: Wrench },
              ].map((it) => {
                const Icon = it.icon;
                const isActive = activeTab === it.id;

                return (
                  <button
                    key={it.id}
                    onClick={() => handleSelectTab(it.id)}
                    className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition cursor-pointer min-h-[48px] ${
                      isActive
                        ? 'border-amber-500 bg-amber-500/10 text-white font-bold'
                        : 'border-slate-800 bg-slate-950/60 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <Icon className="w-5 h-5 text-amber-400 shrink-0" />
                    <span className="text-xs font-semibold">{it.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Sincronización y Usuario en Móvil */}
            <div className="pt-3 border-t border-slate-800 space-y-2">
              <button
                onClick={() => {
                  onRefresh();
                  setShowMoreMobile(false);
                }}
                disabled={refreshing}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-800 text-slate-200 text-xs font-bold cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-amber-400' : ''}`} />
                Sincronizar Datos con Google Sheets
              </button>

              {user ? (
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <div>
                    <p className="text-xs font-bold text-slate-200">{user.nombre || user.username}</p>
                    <p className="text-[10px] text-amber-400">{user.role} · {user.taller || 'General'}</p>
                  </div>
                  <button
                    onClick={() => {
                      logout();
                      setShowMoreMobile(false);
                    }}
                    className="px-3 py-1 bg-rose-600/20 text-rose-400 border border-rose-500/30 rounded-lg text-xs font-bold"
                  >
                    Salir
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setActiveTab('login');
                    setShowMoreMobile(false);
                  }}
                  className="w-full py-2.5 rounded-xl bg-amber-500 text-slate-950 text-xs font-bold"
                >
                  Iniciar Sesión
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default Sidebar;
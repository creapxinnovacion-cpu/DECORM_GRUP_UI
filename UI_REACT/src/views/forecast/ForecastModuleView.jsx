import React, { useState } from 'react';
import {
  AlertOctagon,
  TrendingUp,
  LineChart,
  ShoppingCart,
  FileText,
  BrainCircuit,
  Settings,
  Sparkles,
  ChevronRight,
} from 'lucide-react';
import AlertsCenterView from './AlertsCenterView';
import ForecastOverviewView from './ForecastOverviewView';
import SkuProjectionView from './SkuProjectionView';
import PurchasePlanView from './PurchasePlanView';
import ObservationsView from './ObservationsView';
import LearningAccuracyView from './LearningAccuracyView';
import ForecastSettingsView from './ForecastSettingsView';

export function ForecastModuleView({ onNavigateRoot }) {
  const [activeSubTab, setActiveSubTab] = useState('alertas');
  const [selectedSku, setSelectedSku] = useState('ABR-001');

  const subTabs = [
    { id: 'alertas', label: '1. Alertas de Riesgo', icon: AlertOctagon, badge: 'Semáforo' },
    { id: 'tablero', label: '2. Tablero de Pronóstico', icon: TrendingUp },
    { id: 'sku', label: '3. Simulación SKU', icon: LineChart },
    { id: 'compras', label: '4. Plan Semanal', icon: ShoppingCart },
    { id: 'observaciones', label: '5. Anomalías & Consumo', icon: FileText },
    { id: 'aprendizaje', label: '6. Aprendizaje WAPE', icon: BrainCircuit },
    { id: 'configuracion', label: '7. Parámetros & BOM', icon: Settings },
  ];

  const handleSelectSku = (sku) => {
    setSelectedSku(sku);
    setActiveSubTab('sku');
  };

  return (
    <div className="space-y-6">
      {/* Sub-navigation bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-2.5 shadow-xl backdrop-blur-md">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-2 mb-2 px-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="font-extrabold uppercase tracking-wider text-slate-200">
              Módulo v4.1 · Abastecimiento Inteligente & Forecast Engine
            </span>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            7 Pantallas Especializadas
          </span>
        </div>

        <nav className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {subTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span
                    className={`text-[9px] font-black uppercase px-1.5 py-0.2 rounded-full ${
                      isActive ? 'bg-slate-950/20 text-slate-950' : 'bg-rose-500/20 text-rose-300'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Screen Render */}
      <div>
        {activeSubTab === 'alertas' && (
          <AlertsCenterView
            onSelectSku={handleSelectSku}
            onNavigatePlan={() => setActiveSubTab('compras')}
            onNavigateCotizaciones={() => onNavigateRoot && onNavigateRoot('cotizaciones')}
          />
        )}
        {activeSubTab === 'tablero' && (
          <ForecastOverviewView onSelectSku={handleSelectSku} />
        )}
        {activeSubTab === 'sku' && (
          <SkuProjectionView
            sku={selectedSku}
            onBack={() => setActiveSubTab('tablero')}
            onGoToConciliacion={() => onNavigateRoot && onNavigateRoot('conciliacion')}
          />
        )}
        {activeSubTab === 'compras' && (
          <PurchasePlanView
            onNavigateCompras={() => onNavigateRoot && onNavigateRoot('compras')}
          />
        )}
        {activeSubTab === 'observaciones' && <ObservationsView />}
        {activeSubTab === 'aprendizaje' && <LearningAccuracyView />}
        {activeSubTab === 'configuracion' && <ForecastSettingsView />}
      </div>
    </div>
  );
}

export default ForecastModuleView;

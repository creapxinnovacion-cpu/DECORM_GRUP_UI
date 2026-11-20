import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { LoginModal } from './components/LoginModal';
import { DashboardView } from './views/DashboardView';
import { CatalogoView } from './views/CatalogoView';
import { ComprasView } from './views/ComprasView';
import { MovimientosView } from './views/MovimientosView';
import { ConciliacionView } from './views/ConciliacionView';
import { PrestamosView } from './views/PrestamosView';
import { PuertasView } from './views/PuertasView';
import { InstaladoresView } from './views/InstaladoresView';
import { ForecastModuleView } from './views/forecast/ForecastModuleView';

function MainLayout() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);

  const handleRefresh = () => {
    setRefreshing(true);
    setRefreshKey((k) => k + 1);
    setTimeout(() => {
      setRefreshing(false);
    }, 800);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-black">
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={(tab) => {
          if (tab === 'login') {
            setShowLoginModal(true);
          } else {
            setActiveTab(tab);
          }
        }}
        onRefresh={handleRefresh}
        refreshing={refreshing}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6" key={refreshKey}>
        {activeTab === 'dashboard' && <DashboardView />}
        {activeTab === 'forecast' && (
          <ForecastModuleView onNavigateRoot={(tab) => setActiveTab(tab)} />
        )}
        {activeTab === 'catalogo' && <CatalogoView />}
        {activeTab === 'compras' && <ComprasView />}
        {activeTab === 'movimientos' && <MovimientosView />}
        {activeTab === 'instaladores' && <InstaladoresView />}
        {activeTab === 'conciliacion' && <ConciliacionView />}
        {activeTab === 'prestamos' && <PrestamosView />}
        {activeTab === 'puertas' && <PuertasView />}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-4 text-center text-xs text-slate-500">
        <p>
          GRUPO DECORM &copy; 2026 · Sistema Maestro Unificado v3.0 · Forecast Engine & React
        </p>
      </footer>

      {/* Login Modal */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainLayout />
    </AuthProvider>
  );
}

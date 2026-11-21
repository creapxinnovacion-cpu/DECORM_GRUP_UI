import React, { useState } from 'react';
import { AuthProvider } from './context/AuthContext';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
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
  const [activeTab, setActiveTab] = useState('movimientos'); // Acceso por defecto al taller
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
    <div className="h-[100dvh] w-full bg-slate-950 text-slate-100 flex overflow-hidden font-sans selection:bg-amber-500 selection:text-black">
      {/* 1. Barra Lateral (Escritorio y Tablet) + Barra Inferior (Móvil) */}
      <Sidebar
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

      {/* 2. Área Central de Contenido */}
      <div className="flex-1 flex flex-col min-w-0 h-[100dvh] overflow-hidden">
        {/* Cabecera Fija de 56px (h-14) */}
        <Header
          activeTab={activeTab}
          onRefresh={handleRefresh}
          refreshing={refreshing}
          onLoginClick={() => setShowLoginModal(true)}
        />

        {/* Contenedor Principal con Scroll Independiente y padding inferior en móvil para no tapar con la barra */}
        <main
          className="flex-1 overflow-y-auto px-3 sm:px-6 lg:px-8 py-5 pb-24 md:pb-8 w-full max-w-[1600px] mx-auto"
          key={refreshKey}
        >
          {activeTab === 'movimientos' && <MovimientosView />}
          {activeTab === 'instaladores' && <InstaladoresView />}
          {activeTab === 'puertas' && <PuertasView />}
          {activeTab === 'forecast' && (
            <ForecastModuleView onNavigateRoot={(tab) => setActiveTab(tab)} />
          )}
          {activeTab === 'compras' && <ComprasView />}
          {activeTab === 'catalogo' && <CatalogoView />}
          {activeTab === 'dashboard' && <DashboardView />}
          {activeTab === 'conciliacion' && <ConciliacionView />}
          {activeTab === 'prestamos' && <PrestamosView />}
        </main>
      </div>

      {/* Modal de Inicio de Sesión */}
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

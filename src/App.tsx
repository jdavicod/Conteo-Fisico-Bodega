import React, { useState, useEffect } from 'react';
import { ActiveTab, LocationItem, LocationStatus } from './types';
import { 
  loadLocations, 
  saveLocations, 
  decodeLocationsFromShareString 
} from './utils/storage';
import { Navbar } from './components/Navbar';
import { UploadManageTab } from './components/UploadManageTab';
import { MobileCountTab } from './components/MobileCountTab';
import { ExportCompareTab } from './components/ExportCompareTab';
import { SyncQrModal } from './components/SyncQrModal';

export default function App() {
  const [locations, setLocations] = useState<LocationItem[]>(() => {
    // Check if URL hash has shared data from QR
    if (typeof window !== 'undefined' && window.location.hash) {
      const match = window.location.hash.match(/#data=([^&]+)/);
      if (match && match[1]) {
        const decoded = decodeLocationsFromShareString(match[1]);
        if (decoded && decoded.length > 0) {
          saveLocations(decoded);
          return decoded;
        }
      }
    }
    return loadLocations();
  });

  const [activeTab, setActiveTab] = useState<ActiveTab>(() => {
    if (typeof window !== 'undefined') {
      const isMobile = window.innerWidth < 768 || window.location.hash.includes('data=');
      return isMobile ? 'contar' : 'cargar';
    }
    return 'cargar';
  });

  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);

  // Sync to local storage whenever locations change
  useEffect(() => {
    saveLocations(locations);
  }, [locations]);

  // Handle status update (HU-03: guarda de inmediato)
  const handleUpdateStatus = (id: string, status: LocationStatus) => {
    setLocations(prev => prev.map(item => {
      if (item.id === id) {
        return {
          ...item,
          status,
          countedAt: status !== 'pendiente' ? new Date().toISOString() : undefined,
        };
      }
      return item;
    }));
  };

  const handleUpdateLocations = (newItems: LocationItem[]) => {
    setLocations(newItems);
  };

  const handleImportSharedString = (str: string): boolean => {
    const decoded = decodeLocationsFromShareString(str);
    if (decoded && decoded.length > 0) {
      setLocations(decoded);
      return true;
    }
    return false;
  };

  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-900 flex flex-col font-sans selection:bg-blue-100 selection:text-blue-900">
      {/* Top Navigation */}
      <Navbar 
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        locations={locations}
        onOpenSync={() => setIsSyncModalOpen(true)}
      />

      {/* Main Workspace Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {activeTab === 'cargar' && (
          <UploadManageTab 
            locations={locations}
            onUpdateLocations={handleUpdateLocations}
            onGoToCount={() => setActiveTab('contar')}
            onOpenSyncModal={() => setIsSyncModalOpen(true)}
          />
        )}

        {activeTab === 'contar' && (
          <MobileCountTab 
            locations={locations}
            onUpdateStatus={handleUpdateStatus}
            onGoToResults={() => setActiveTab('exportar')}
            onGoToManage={() => setActiveTab('cargar')}
          />
        )}

        {activeTab === 'exportar' && (
          <ExportCompareTab 
            locations={locations}
            onOpenSyncModal={() => setIsSyncModalOpen(true)}
            onGoToCount={() => setActiveTab('contar')}
          />
        )}
      </main>

      {/* Footer information */}
      <footer className="py-4 border-t border-zinc-200 bg-white text-center text-xs text-zinc-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            Gestión y Conteo Físico de Bodega • Formato N#C##E#P# • 100% Web sin instalación
          </span>
          <div className="flex items-center gap-3 text-2xs text-zinc-400">
            <span>HU-01 Cargar</span>
            <span>•</span>
            <span>HU-02 Editar/Eliminar</span>
            <span>•</span>
            <span>HU-03 Contar</span>
            <span>•</span>
            <span>HU-04 Exportar</span>
          </div>
        </div>
      </footer>

      {/* QR Transfer Modal */}
      <SyncQrModal 
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        locations={locations}
        onImportSharedString={handleImportSharedString}
      />
    </div>
  );
}

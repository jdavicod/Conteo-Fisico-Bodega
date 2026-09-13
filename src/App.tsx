import React, { useState, useEffect, useRef } from 'react';
import { ActiveTab, LocationItem, LocationStatus } from './types';
import { 
  loadLocations, 
  saveLocations, 
  decodeLocationsFromShareString 
} from './utils/storage';
import { 
  fetchServerLocations, 
  pushAllLocationsToServer, 
  patchLocationStatusOnServer,
  deleteLocationOnServer,
  deleteBulkLocationsOnServer,
  putLocationOnServer,
  subscribeToLiveUpdates, 
  SyncStatus 
} from './utils/apiSync';
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

  const [syncStatus, setSyncStatus] = useState<SyncStatus>('syncing');
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const isInitialMount = useRef(true);

  // 1. Initial fetch from server and live SSE subscription
  useEffect(() => {
    // Initial fetch from server
    fetchServerLocations().then(serverItems => {
      if (serverItems && serverItems.length > 0) {
        setLocations(serverItems);
        saveLocations(serverItems);
      } else {
        // If server is empty, initialize with current client items
        const local = loadLocations();
        if (local.length > 0) {
          pushAllLocationsToServer(local);
        }
      }
    });

    // Subscribe to real-time events (Server-Sent Events)
    const unsubscribe = subscribeToLiveUpdates((payload) => {
      if (payload.locations) {
        setLocations(payload.locations);
        saveLocations(payload.locations);
      } else if (payload.updatedItem) {
        const updated = payload.updatedItem;
        setLocations(prev => {
          const next = prev.map(item => item.id === updated.id ? updated : item);
          saveLocations(next);
          return next;
        });
      } else if (payload.deletedId) {
        const delId = payload.deletedId;
        setLocations(prev => {
          const next = prev.filter(item => item.id !== delId);
          saveLocations(next);
          return next;
        });
      }
    }, (status) => {
      setSyncStatus(status);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Backup sync to local storage
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    saveLocations(locations);
  }, [locations]);

  // Handle status update (HU-03: guarda de inmediato y propaga al PC en vivo)
  const handleUpdateStatus = (id: string, status: LocationStatus) => {
    const countedAt = status !== 'pendiente' ? new Date().toISOString() : undefined;

    // Optimistic local update
    setLocations(prev => {
      const next = prev.map(item => {
        if (item.id === id) {
          return { ...item, status, countedAt };
        }
        return item;
      });
      saveLocations(next);
      return next;
    });

    // Send to server to notify PC in real time via SSE
    patchLocationStatusOnServer(id, status);
  };

  // Handle mass update / replacement of locations (from PC file upload)
  const handleUpdateLocations = (newItems: LocationItem[]) => {
    setLocations(newItems);
    saveLocations(newItems);
    // Push to server so mobile gets the list instantly
    pushAllLocationsToServer(newItems);
  };

  const handleImportSharedString = (str: string): boolean => {
    const decoded = decodeLocationsFromShareString(str);
    if (decoded && decoded.length > 0) {
      setLocations(decoded);
      saveLocations(decoded);
      pushAllLocationsToServer(decoded);
      return true;
    }
    return false;
  };

  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-900 flex flex-col font-sans selection:bg-blue-100 selection:text-blue-900">
      {/* Top Navigation with Live Sync Indicator */}
      <Navbar 
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        locations={locations}
        onOpenSync={() => setIsSyncModalOpen(true)}
        syncStatus={syncStatus}
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
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>
              Gestión y Conteo Físico de Bodega • Sincronización en Tiempo Real PC ↔ Celular
            </span>
          </div>
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

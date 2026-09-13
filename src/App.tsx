import React, { useState, useEffect, useRef } from 'react';
import { ActiveTab, LocationItem, LocationStatus } from './types';
import { 
  loadLocations, 
  saveLocations, 
  decodeLocationsFromShareString 
} from './utils/storage';
import { 
  CloudSyncService, 
  CloudSyncStatus, 
  getOrCreateRoomId, 
  setCustomRoomId 
} from './utils/cloudSync';
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

  const [roomId, setRoomId] = useState<string>(() => getOrCreateRoomId());
  const [syncStatus, setSyncStatus] = useState<CloudSyncStatus>('connecting');
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);

  const cloudSyncRef = useRef<CloudSyncService | null>(null);
  const locationsRef = useRef<LocationItem[]>(locations);
  locationsRef.current = locations;

  // Initialize Cloud Sync Service
  useEffect(() => {
    const service = new CloudSyncService(roomId);
    cloudSyncRef.current = service;

    const unsubStatus = service.onStatusChange((status) => {
      setSyncStatus(status);
    });

    const unsubMessage = service.onMessage((msg) => {
      if (msg.type === 'UPDATE_STATUS' && msg.payload) {
        const { id, status, countedAt } = msg.payload;
        setLocations((prev) => {
          const next = prev.map((item) =>
            item.id === id ? { ...item, status, countedAt } : item
          );
          saveLocations(next);
          return next;
        });
      } else if (msg.type === 'REPLACE_ALL' && msg.payload?.locations) {
        setLocations(msg.payload.locations);
        saveLocations(msg.payload.locations);
      } else if (msg.type === 'REQUEST_SYNC') {
        // Un nuevo dispositivo (ej. celular) entró a la sala; le compartimos el listado actual
        if (locationsRef.current.length > 0) {
          service.sendSyncResponse(locationsRef.current);
        }
      } else if (msg.type === 'SYNC_RESPONSE' && msg.payload?.locations) {
        // Si nuestro listado local estaba vacío o desactualizado, adoptamos el del compañero
        if (locationsRef.current.length === 0 || locationsRef.current.every(l => l.status === 'pendiente')) {
          setLocations(msg.payload.locations);
          saveLocations(msg.payload.locations);
        }
      }
    });

    return () => {
      unsubStatus();
      unsubMessage();
      service.destroy();
      cloudSyncRef.current = null;
    };
  }, [roomId]);

  // Handle status update (HU-03: guarda de inmediato y propaga al PC en vivo)
  const handleUpdateStatus = (id: string, status: LocationStatus) => {
    const countedAt = status !== 'pendiente' ? new Date().toISOString() : undefined;

    // 1. Optimistic local update (instantáneo en la pantalla del celular)
    setLocations((prev) => {
      const next = prev.map((item) =>
        item.id === id ? { ...item, status, countedAt } : item
      );
      saveLocations(next);
      return next;
    });

    // 2. Broadcast en vivo al PC
    cloudSyncRef.current?.broadcastStatusUpdate(id, status);
  };

  // Handle mass update / replacement of locations (from PC file upload)
  const handleUpdateLocations = (newItems: LocationItem[]) => {
    setLocations(newItems);
    saveLocations(newItems);
    cloudSyncRef.current?.broadcastReplaceAll(newItems);
  };

  const handleChangeRoomId = (newRoom: string) => {
    setCustomRoomId(newRoom);
    setRoomId(newRoom);
  };

  const handleImportSharedString = (str: string): boolean => {
    const decoded = decodeLocationsFromShareString(str);
    if (decoded && decoded.length > 0) {
      setLocations(decoded);
      saveLocations(decoded);
      cloudSyncRef.current?.broadcastReplaceAll(decoded);
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
        roomId={roomId}
      />

      {/* Main Workspace Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6 lg:p-8 pb-24 md:pb-8">
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
              Gestión y Conteo Físico de Bodega • Sincronización en Vivo PC ↔ Celular
            </span>
          </div>
          <div className="flex items-center gap-3 text-2xs text-zinc-400">
            <span>HU-01 Cargar</span>
            <span>•</span>
            <span>HU-02 Editar/Eliminar</span>
            <span>•</span>
            <span>HU-03 Contar</span>
            <span>•</span>
            <span>HU-04 Exportar Excel</span>
          </div>
        </div>
      </footer>

      {/* QR Transfer Modal */}
      <SyncQrModal 
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        locations={locations}
        roomId={roomId}
        onImportSharedString={handleImportSharedString}
        onChangeRoomId={handleChangeRoomId}
      />
    </div>
  );
}

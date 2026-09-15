import React, { useState, useEffect, useRef } from 'react';
import { ActiveTab, LocationItem, LocationStatus, MAX_LOCATIONS_LIMIT } from './types';
import { 
  loadLocations, 
  saveLocations, 
  decodeLocationsFromShareString 
} from './utils/storage';
import { 
  CloudSyncService, 
  CloudSyncStatus, 
  getOrCreateRoomId, 
  setCustomRoomId,
  CLIENT_ID
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
        const { id, code, status, countedAt } = msg.payload;
        setLocations((prev) => {
          const next = prev.map((item) => {
            if (item.id === id || (code && item.code === code)) {
              return { ...item, status, countedAt };
            }
            return item;
          });
          saveLocations(next);
          return next;
        });
      } else if ((msg.type === 'REPLACE_ALL' || msg.type === 'SYNC_RESPONSE') && msg.payload?.locations) {
        const incoming = msg.payload.locations as LocationItem[];
        if (Array.isArray(incoming) && incoming.length > 0) {
          setLocations((prev) => {
            // Fusión inteligente: Si el celular o PC ya contó algunas ubicaciones,
            // no borramos su progreso sino que conservamos su estado 'vacia'/'llena'
            const prevMap = new Map<string, LocationItem>();
            prev.forEach(p => {
              prevMap.set(p.code, p);
              prevMap.set(p.id, p);
            });

            const merged = incoming.map((inc) => {
              const existing = prevMap.get(inc.code) || prevMap.get(inc.id);
              if (existing) {
                // Si el dispositivo local ya lo había marcado como vacia o llena, y el remoto viene pendiente, conservamos el conteo
                if (existing.status !== 'pendiente' && inc.status === 'pendiente') {
                  return { ...inc, status: existing.status, countedAt: existing.countedAt };
                }
                // Si ambos tienen conteo, tomar el más reciente
                if (existing.status !== 'pendiente' && inc.status !== 'pendiente') {
                  if (existing.countedAt && inc.countedAt && existing.countedAt > inc.countedAt) {
                    return { ...inc, status: existing.status, countedAt: existing.countedAt };
                  }
                }
              }
              return inc;
            });

            saveLocations(merged);
            return merged;
          });
        }
      } else if (msg.type === 'REQUEST_SYNC') {
        // Un nuevo dispositivo (ej. celular) entró a la sala; le compartimos el listado completo actual
        if (locationsRef.current.length > 0) {
          service.sendSyncResponse(locationsRef.current);
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
    let targetCode = '';

    // 1. Optimistic local update (instantáneo en la pantalla del celular)
    setLocations((prev) => {
      const next = prev.map((item) => {
        if (item.id === id) {
          targetCode = item.code;
          return { ...item, status, countedAt };
        }
        return item;
      });
      saveLocations(next);
      return next;
    });

    // 2. Broadcast en vivo al PC (incluye código para concordancia exacta)
    cloudSyncRef.current?.broadcastStatusUpdate(id, targetCode, status);
  };

  // Handle mass update / replacement of locations (from PC file upload)
  const handleUpdateLocations = (newItems: LocationItem[]) => {
    const capped = newItems.length > MAX_LOCATIONS_LIMIT ? newItems.slice(0, MAX_LOCATIONS_LIMIT) : newItems;
    setLocations(capped);
    saveLocations(capped);
    cloudSyncRef.current?.broadcastReplaceAll(capped);
  };

  const handleForceSync = async () => {
    setSyncStatus('connecting');
    cloudSyncRef.current?.sendRequestSync();
    if (locationsRef.current.length > 0) {
      await cloudSyncRef.current?.broadcastReplaceAll(locationsRef.current);
    }
  };

  const handleChangeRoomId = (newRoom: string) => {
    setCustomRoomId(newRoom);
    setRoomId(newRoom);
  };

  const handleImportSharedString = (str: string): boolean => {
    const decoded = decodeLocationsFromShareString(str);
    if (decoded && decoded.length > 0) {
      const capped = decoded.length > MAX_LOCATIONS_LIMIT ? decoded.slice(0, MAX_LOCATIONS_LIMIT) : decoded;
      setLocations(capped);
      saveLocations(capped);
      cloudSyncRef.current?.broadcastReplaceAll(capped);
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
        onForceSync={handleForceSync}
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
        onForceSync={handleForceSync}
      />
    </div>
  );
}

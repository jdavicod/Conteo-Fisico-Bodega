import React from 'react';
import { 
  PackageCheck, 
  Layers, 
  Smartphone, 
  QrCode, 
  BarChart3,
  WifiOff,
  RefreshCw,
  Radio
} from 'lucide-react';
import { ActiveTab, LocationItem } from '../types';
import { CloudSyncStatus } from '../utils/cloudSync';

interface Props {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  locations: LocationItem[];
  onOpenSync: () => void;
  syncStatus?: CloudSyncStatus;
  roomId?: string;
}

export function Navbar({ 
  activeTab, 
  onSelectTab, 
  locations, 
  onOpenSync, 
  syncStatus = 'connected',
  roomId = ''
}: Props) {
  const total = locations.length;
  const counted = locations.filter(l => l.status !== 'pendiente').length;
  const isAllCounted = total > 0 && total === counted;

  return (
    <header className="bg-white border-b border-zinc-200 sticky top-0 z-30 shadow-2xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-zinc-900 text-white flex items-center justify-center shadow-xs">
              <PackageCheck className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-sm sm:text-base text-zinc-900 tracking-tight">
                  Conteo Físico de Bodega
                </h1>
                <span className="hidden sm:inline-flex text-3xs font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-600 border border-zinc-200">
                  Web App
                </span>
              </div>
              
              {/* Real-time sync status indicator */}
              <button 
                onClick={onOpenSync}
                className="flex items-center gap-1.5 text-2xs mt-0.5 cursor-pointer hover:opacity-80 transition-opacity"
                title="Haz clic para ver o cambiar la sala de sincronización con el celular"
              >
                {syncStatus === 'connected' ? (
                  <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>Sincronizado en Vivo</span>
                    {roomId && (
                      <span className="font-mono text-3xs text-emerald-800 bg-emerald-100/70 px-1 rounded">
                        {roomId}
                      </span>
                    )}
                  </span>
                ) : syncStatus === 'connecting' ? (
                  <span className="inline-flex items-center gap-1 text-blue-700 font-medium">
                    <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                    Conectando sala...
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-amber-700 font-medium">
                    <WifiOff className="w-2.5 h-2.5" />
                    Modo Local (Reconectando...)
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Desktop Tab Switcher */}
          <nav className="hidden md:flex items-center gap-1 bg-zinc-100/90 p-1 rounded-xl border border-zinc-200">
            <button
              onClick={() => onSelectTab('cargar')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'cargar'
                  ? 'bg-white text-zinc-900 shadow-2xs'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-zinc-500" />
              <span>Épica 1: Gestión (HU-01 & HU-02)</span>
            </button>

            <button
              onClick={() => onSelectTab('contar')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'contar'
                  ? 'bg-white text-blue-700 shadow-2xs'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5 text-blue-600" />
              <span>Épica 2: Conteo Tabla (HU-03)</span>
              {total > 0 && (
                <span className={`ml-1 text-2xs px-1.5 py-0.2 rounded-full font-bold ${
                  isAllCounted 
                    ? 'bg-emerald-100 text-emerald-800' 
                    : 'bg-zinc-200 text-zinc-700'
                }`}>
                  {counted}/{total}
                </span>
              )}
            </button>

            <button
              onClick={() => onSelectTab('exportar')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'exportar'
                  ? 'bg-white text-emerald-700 shadow-2xs'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Épica 3: Exportar Excel (HU-04)</span>
            </button>
          </nav>

          {/* Quick QR link */}
          <div className="flex items-center gap-2">
            <button
              onClick={onOpenSync}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-zinc-700 bg-white hover:bg-zinc-50 border border-zinc-200 rounded-lg transition-colors shadow-2xs cursor-pointer"
              title="Conectar celular mediante código QR"
            >
              <QrCode className="w-4 h-4 text-blue-600" />
              <span className="hidden sm:inline">Conectar Celular (QR)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Bottom-bar Navigation */}
      <div className="md:hidden border-t border-zinc-200 grid grid-cols-3 bg-white">
        <button
          onClick={() => onSelectTab('cargar')}
          className={`py-2 text-2xs font-semibold flex flex-col items-center gap-1 ${
            activeTab === 'cargar' ? 'text-blue-600 font-bold bg-blue-50/50' : 'text-zinc-500'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>1. Gestión</span>
        </button>

        <button
          onClick={() => onSelectTab('contar')}
          className={`py-2 text-2xs font-semibold flex flex-col items-center gap-1 relative ${
            activeTab === 'contar' ? 'text-blue-600 font-bold bg-blue-50/50' : 'text-zinc-500'
          }`}
        >
          <Smartphone className="w-4 h-4" />
          <span>2. Conteo ({counted}/{total})</span>
        </button>

        <button
          onClick={() => onSelectTab('exportar')}
          className={`py-2 text-2xs font-semibold flex flex-col items-center gap-1 ${
            activeTab === 'exportar' ? 'text-blue-600 font-bold bg-blue-50/50' : 'text-zinc-500'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>3. Excel</span>
        </button>
      </div>
    </header>
  );
}

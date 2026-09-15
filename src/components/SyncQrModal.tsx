import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, Smartphone, Copy, Check, Info, Radio, RefreshCw, Sparkles, Send } from 'lucide-react';
import { LocationItem } from '../types';
import { sanitizeRoomId } from '../utils/cloudSync';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  locations: LocationItem[];
  roomId: string;
  onImportSharedString: (str: string) => boolean;
  onChangeRoomId?: (newRoom: string) => void;
  onForceSync?: () => Promise<void> | void;
}

export function SyncQrModal({ 
  isOpen, 
  onClose, 
  locations, 
  roomId, 
  onChangeRoomId,
  onForceSync 
}: Props) {
  const [copied, setCopied] = useState(false);
  const [customRoom, setCustomRoom] = useState(roomId);
  const [isEditingRoom, setIsEditingRoom] = useState(false);
  const [isSyncingNow, setIsSyncingNow] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  if (!isOpen) return null;

  // Resolve base URL:
  // If running in development (ais-dev-...), replace with the public preview (ais-pre-...)
  let origin = window.location.origin;
  if (origin.includes('ais-dev-')) {
    origin = origin.replace('ais-dev-', 'ais-pre-');
  }

  // Create shareable URL containing ?room=<roomId>
  const url = new URL(origin + window.location.pathname);
  url.searchParams.set('room', roomId);
  const shareableUrl = url.toString();

  const handleCopy = () => {
    navigator.clipboard.writeText(shareableUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleManualSync = async () => {
    setIsSyncingNow(true);
    setSyncFeedback(null);
    try {
      if (onForceSync) {
        await onForceSync();
      }
      setSyncFeedback(`¡Sincronizado! ${locations.length} ubicaciones transmitidas a la sala.`);
      setTimeout(() => setSyncFeedback(null), 4000);
    } catch {
      setSyncFeedback('Error al sincronizar. Revisa tu conexión.');
    } finally {
      setIsSyncingNow(false);
    }
  };

  const handleSaveRoom = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = sanitizeRoomId(customRoom);
    if (clean && onChangeRoomId) {
      onChangeRoomId(clean);
      setCustomRoom(clean);
      setIsEditingRoom(false);
      setSyncFeedback(`Cambiado a sala "${clean}".`);
      setTimeout(() => setSyncFeedback(null), 3000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-2xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-zinc-200 relative animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-zinc-400 hover:text-zinc-600 rounded-lg hover:bg-zinc-100 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5 text-blue-600 mb-2">
          <div className="p-2 bg-blue-50 rounded-xl">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-zinc-900">
              Sincronización PC ↔ Celular en Vivo
            </h3>
            <span className="inline-flex items-center gap-1 text-2xs text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full">
              <Radio className="w-2.5 h-2.5 text-emerald-600 animate-pulse" />
              Sala Activa: {roomId}
            </span>
          </div>
        </div>

        <p className="text-xs text-zinc-600 mb-3 leading-relaxed">
          Escanea este código QR con la cámara de tu celular. Optimizado para hasta <strong>500 ubicaciones</strong> con sincronización en tiempo real y ultraligera.
        </p>

        {/* QR container */}
        <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 flex flex-col items-center justify-center mb-3">
          <div className="p-3 bg-white rounded-lg shadow-2xs border border-zinc-200">
            <QRCodeSVG 
              value={shareableUrl}
              size={180}
              level="M"
              includeMargin={false}
            />
          </div>
          <div className="mt-3 text-center">
            <span className="text-3xs uppercase tracking-wider text-zinc-400 font-bold">Código de Sala</span>
            <p className="text-xs font-mono font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-md border border-blue-100 mt-0.5">
              {roomId}
            </p>
            <span className="text-3xs text-zinc-500 mt-1 block">
              {locations.length > 0 
                ? `${locations.length.toLocaleString()} ubicaciones listas para sincronizar` 
                : 'Sin ubicaciones cargadas todavía'}
            </span>
          </div>
        </div>

        {/* Feedback alert */}
        {syncFeedback && (
          <div className="mb-3 p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium rounded-xl flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{syncFeedback}</span>
          </div>
        )}

        {/* Action buttons */}
        <div className="space-y-2.5">
          <button
            onClick={handleManualSync}
            disabled={isSyncingNow}
            className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncingNow ? 'animate-spin' : ''}`} />
            <span>{isSyncingNow ? 'Sincronizando con la nube...' : `Forzar Sincronización Ahora (${locations.length} ubicaciones)`}</span>
          </button>

          <button
            onClick={handleCopy}
            className="w-full py-2.5 px-4 bg-zinc-900 hover:bg-zinc-800 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? '¡Enlace de sincronización copiado!' : 'Copiar enlace al portapapeles'}</span>
          </button>

          {/* Change Room Code Form (Optional) */}
          {isEditingRoom ? (
            <form onSubmit={handleSaveRoom} className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl">
              <label className="block text-2xs font-semibold text-zinc-700 mb-1">
                Escribe un nombre de sala (ej. mi_bodega):
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  value={customRoom}
                  onChange={(e) => setCustomRoom(e.target.value)}
                  className="flex-1 text-xs px-2.5 py-1.5 bg-white border border-zinc-300 rounded-lg font-mono"
                  placeholder="ej. bodega_principal"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg cursor-pointer"
                >
                  Unirse
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingRoom(false)}
                  className="px-2 py-1.5 text-zinc-500 hover:text-zinc-700 text-xs cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            </form>
          ) : (
            <div className="text-center">
              <button
                type="button"
                onClick={() => setIsEditingRoom(true)}
                className="text-2xs text-zinc-500 hover:text-blue-600 font-medium underline cursor-pointer"
              >
                ¿Quieres usar tu propio código o nombre de sala?
              </button>
            </div>
          )}

          <div className="p-3 bg-blue-50/70 rounded-xl border border-blue-100 flex items-start gap-2 text-2xs text-blue-900">
            <Info className="w-4 h-4 shrink-0 text-blue-600 mt-0.5" />
            <div>
              <strong>Optimizado para hasta 500 ubicaciones</strong>
              <p className="mt-0.5 text-blue-800">
                Los datos se transmiten en micro-paquetes instantáneos. Cualquier conteo marcado en el celular se actualiza en el PC en milisegundos.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

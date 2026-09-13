import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, Smartphone, Copy, Check, Info, ExternalLink, Globe } from 'lucide-react';
import { LocationItem } from '../types';
import { encodeLocationsToShareString } from '../utils/storage';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  locations: LocationItem[];
  onImportSharedString: (str: string) => boolean;
}

export function SyncQrModal({ isOpen, onClose, locations, onImportSharedString }: Props) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // Resolve base URL:
  // If running in development (ais-dev-...), replace with the public preview (ais-pre-...)
  // so scanning with mobile does NOT give Google 403 Forbidden.
  let origin = window.location.origin;
  if (origin.includes('ais-dev-')) {
    origin = origin.replace('ais-dev-', 'ais-pre-');
  }

  const baseUrl = origin + window.location.pathname;
  const encodedData = encodeLocationsToShareString(locations);

  // If there are locations and data length fits in QR safely, attach #data=
  const shareableUrl = (encodedData.length > 0 && encodedData.length < 1600)
    ? `${baseUrl}#data=${encodedData}` 
    : baseUrl;

  const handleCopy = () => {
    navigator.clipboard.writeText(shareableUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-2xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-zinc-200 relative animate-in fade-in zoom-in-95 duration-150">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-zinc-400 hover:text-zinc-600 rounded-lg hover:bg-zinc-100"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5 text-blue-600 mb-2">
          <div className="p-2 bg-blue-50 rounded-xl">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-zinc-900">
              Conectar Celular sin Error 403
            </h3>
            <span className="text-2xs text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full">
              Enlace Público Configurado
            </span>
          </div>
        </div>

        <p className="text-xs text-zinc-600 mb-4 leading-relaxed">
          Escanea este código QR con la cámara de tu teléfono. Te llevará al enlace público optimizado para no pedir inicio de sesión ni dar error 403:
        </p>

        {/* QR container */}
        <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-5 flex flex-col items-center justify-center mb-4">
          <div className="p-3 bg-white rounded-lg shadow-2xs border border-zinc-200">
            <QRCodeSVG 
              value={shareableUrl}
              size={180}
              level="M"
              includeMargin={false}
            />
          </div>
          <p className="text-2xs font-mono text-zinc-500 mt-3 text-center break-all max-w-xs">
            {baseUrl}
          </p>
        </div>

        {/* Copy Link button & tips */}
        <div className="space-y-3">
          <button
            onClick={handleCopy}
            className="w-full py-2.5 px-4 bg-zinc-900 hover:bg-zinc-800 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? '¡Enlace público copiado!' : 'Copiar enlace público al portapapeles'}</span>
          </button>

          <div className="p-3 bg-amber-50/80 rounded-xl border border-amber-200 flex items-start gap-2 text-2xs text-amber-900">
            <Info className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
            <div>
              <strong>¿Por qué salía el error 403?</strong>
              <p className="mt-0.5 text-amber-800">
                El celular intentaba acceder a la consola privada de edición de AI Studio. Para que cualquiera en la bodega pueda entrar sin cuenta de Google, se usa este enlace público o se presiona <strong>Publish</strong>.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

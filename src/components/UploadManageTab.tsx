import React, { useState, useRef } from 'react';
import { 
  UploadCloud, 
  Download, 
  Plus, 
  Trash2, 
  Search, 
  Layers, 
  CheckCircle2, 
  AlertCircle, 
  FileSpreadsheet, 
  Sparkles,
  ClipboardPaste,
  Edit2,
  CheckSquare,
  Square,
  X,
  FileCheck2,
  FileWarning
} from 'lucide-react';
import { LocationItem, ParseError } from '../types';
import { parseFileContents, parsePastedLines, formatCode } from '../utils/parser';
import { downloadTemplate4Columns, downloadTemplate1Column } from '../utils/excel';

interface Props {
  locations: LocationItem[];
  onUpdateLocations: (items: LocationItem[]) => void;
  onGoToCount: () => void;
  onOpenSyncModal: () => void;
}

export function UploadManageTab({ locations, onUpdateLocations, onGoToCount, onOpenSyncModal }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [parseErrors, setParseErrors] = useState<ParseError[]>([]);
  const [detectedFormat, setDetectedFormat] = useState<string | null>(null);

  // Text paste state
  const [isPasting, setIsPasting] = useState(false);
  const [pasteText, setPasteText] = useState('');

  // Mass selection for HU-02
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Edit modal for HU-02
  const [editingItem, setEditingItem] = useState<LocationItem | null>(null);
  const [editNivel, setEditNivel] = useState('');
  const [editColumna, setEditColumna] = useState('');
  const [editEstanteria, setEditEstanteria] = useState('');
  const [editPosicion, setEditPosicion] = useState('');

  // Add manual single location
  const [isAdding, setIsAdding] = useState(false);
  const [newNivel, setNewNivel] = useState('1');
  const [newColumna, setNewColumna] = useState('01');
  const [newEstanteria, setNewEstanteria] = useState('A');
  const [newPosicion, setNewPosicion] = useState('1');
  const [addError, setAddError] = useState<string | null>(null);

  // Search & Filter in management view
  const [searchQuery, setSearchQuery] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const processBuffer = async (buffer: ArrayBuffer, fileName: string) => {
    setParseErrors([]);
    setSuccessMsg(null);
    try {
      const { validLocations, errors, formatDetected } = parseFileContents(buffer);
      
      if (validLocations.length === 0 && errors.length > 0) {
        setParseErrors(errors);
        return;
      }

      // Merge or replace
      onUpdateLocations(validLocations);
      setDetectedFormat(formatDetected === '4_columnas' ? '4 Columnas (Nivel, Columna, Estantería, Posición)' : '1 Columna Combinada (N#C##E#P#)');
      setSuccessMsg(`Se cargaron exitosamente ${validLocations.length} ubicaciones desde "${fileName}".`);

      if (errors.length > 0) {
        setParseErrors(errors);
      }
    } catch (err: any) {
      setParseErrors([{ row: 0, value: fileName, reason: err.message || 'Error al procesar el archivo.' }]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      file.arrayBuffer().then(buf => processBuffer(buf, file.name));
    }
  };

  const handlePasteSubmit = () => {
    if (!pasteText.trim()) return;
    setParseErrors([]);
    setSuccessMsg(null);

    try {
      const { validLocations, errors, formatDetected } = parsePastedLines(pasteText);

      if (validLocations.length === 0 && errors.length > 0) {
        setParseErrors(errors);
        return;
      }

      onUpdateLocations(validLocations);
      setDetectedFormat(formatDetected === '4_columnas' ? '4 Columnas' : '1 Columna Combinada');
      setSuccessMsg(`Se cargaron exitosamente ${validLocations.length} ubicaciones pegadas.`);
      setPasteText('');
      setIsPasting(false);

      if (errors.length > 0) {
        setParseErrors(errors);
      }
    } catch (err: any) {
      setParseErrors([{ row: 0, value: 'Texto pegado', reason: err.message || 'Error al procesar el texto.' }]);
    }
  };

  // HU-02: Individual Delete
  const handleDeleteSingle = (id: string) => {
    const updated = locations.filter(l => l.id !== id);
    onUpdateLocations(updated);
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setSuccessMsg('Ubicación eliminada correctamente.');
  };

  // HU-02: Mass Delete
  const handleDeleteSelected = () => {
    if (selectedIds.size === 0) return;
    if (window.confirm(`¿Deseas eliminar las ${selectedIds.size} ubicaciones seleccionadas?`)) {
      const updated = locations.filter(l => !selectedIds.has(l.id));
      onUpdateLocations(updated);
      setSelectedIds(new Set());
      setSuccessMsg(`Se eliminaron ${selectedIds.size} ubicaciones.`);
    }
  };

  // HU-02: Select All
  const handleToggleSelectAll = () => {
    if (selectedIds.size === filteredLocations.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredLocations.map(l => l.id)));
    }
  };

  const handleToggleSelectOne = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // HU-02: Start editing
  const handleOpenEdit = (item: LocationItem) => {
    setEditingItem(item);
    setEditNivel(item.nivel);
    setEditColumna(item.columna);
    setEditEstanteria(item.estanteria);
    setEditPosicion(item.posicion);
  };

  // HU-02: Save edit
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    const newCode = formatCode(editNivel, editColumna, editEstanteria, editPosicion);

    // Verificar si el nuevo código ya existe en otra ubicación
    const duplicate = locations.find(l => l.code === newCode && l.id !== editingItem.id);
    if (duplicate) {
      alert(`Ya existe otra ubicación con el código ${newCode}.`);
      return;
    }

    const updated = locations.map(l => {
      if (l.id === editingItem.id) {
        return {
          ...l,
          code: newCode,
          nivel: editNivel.trim(),
          columna: editColumna.trim().length === 1 ? editColumna.trim().padStart(2, '0') : editColumna.trim(),
          estanteria: editEstanteria.trim(),
          posicion: editPosicion.trim(),
        };
      }
      return l;
    });

    onUpdateLocations(updated);
    setEditingItem(null);
    setSuccessMsg(`Ubicación actualizada a "${newCode}".`);
  };

  // Add single manual location
  const handleAddManual = (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);
    const code = formatCode(newNivel, newColumna, newEstanteria, newPosicion);

    if (locations.some(l => l.code === code)) {
      setAddError(`La ubicación "${code}" ya existe en la lista.`);
      return;
    }

    const newItem: LocationItem = {
      id: `man-${Date.now()}`,
      code,
      nivel: newNivel.trim(),
      columna: newColumna.trim().length === 1 ? newColumna.trim().padStart(2, '0') : newColumna.trim(),
      estanteria: newEstanteria.trim(),
      posicion: newPosicion.trim(),
      status: 'pendiente',
    };

    onUpdateLocations([newItem, ...locations]);
    setIsAdding(false);
    setSuccessMsg(`Ubicación "${code}" agregada con éxito.`);
  };

  const filteredLocations = locations.filter(l => 
    l.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    `n${l.nivel}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
    `c${l.columna}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
    `e${l.estanteria}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
    `p${l.posicion}`.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6" id="epic-1-workarea">
      {/* Header Epic 1 */}
      <div className="bg-white border border-zinc-200 rounded-xl p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-700 text-xs font-semibold mb-2">
              <Layers className="w-3.5 h-3.5" />
              Épica 1: Gestión de Ubicaciones a Contar
            </div>
            <h2 className="text-xl font-bold text-zinc-900 tracking-tight">
              HU-01: Cargar y HU-02: Administrar Ubicaciones
            </h2>
            <p className="text-sm text-zinc-500 mt-1 max-w-2xl">
              Carga tu listado aceptando <strong>4 columnas separadas</strong> (Nivel, Columna, Estantería, Posición) o <strong>1 columna combinada</strong> con el formato <span className="font-mono bg-zinc-100 px-1.5 py-0.5 rounded text-zinc-800 font-semibold">N#C##E(letra)P#</span> (ej. N1C01EAP1).
            </p>
          </div>

          {/* Action buttons & templates */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={downloadTemplate4Columns}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-zinc-700 bg-white hover:bg-zinc-50 border border-zinc-300 rounded-lg transition-colors shadow-2xs cursor-pointer"
              title="Descargar plantilla Excel con 4 columnas (Estantería como Letra)"
            >
              <Download className="w-3.5 h-3.5 text-zinc-500" />
              <span>Plantilla 4 Cols</span>
            </button>

            <button
              onClick={downloadTemplate1Column}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-zinc-700 bg-white hover:bg-zinc-50 border border-zinc-300 rounded-lg transition-colors shadow-2xs cursor-pointer"
              title="Descargar plantilla Excel con 1 columna combinada N#C##E(letra)P#"
            >
              <Download className="w-3.5 h-3.5 text-zinc-500" />
              <span>Plantilla N#C##E(letra)P#</span>
            </button>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl p-4 flex items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{successMsg}</span>
            {detectedFormat && (
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-900 rounded font-medium text-3xs uppercase tracking-wide">
                Formato: {detectedFormat}
              </span>
            )}
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-700 hover:text-emerald-900 font-bold text-sm">✕</button>
        </div>
      )}

      {/* HU-01 CA: Error reporting table if pattern doesn't match */}
      {parseErrors.length > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-rose-900 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-sm text-rose-800">
              <FileWarning className="w-4 h-4 text-rose-600" />
              <span>Se encontraron {parseErrors.length} errores de formato al cargar (Criterio de Aceptación HU-01):</span>
            </div>
            <button
              onClick={() => setParseErrors([])}
              className="text-xs text-rose-600 hover:text-rose-800 font-semibold"
            >
              Cerrar alerta
            </button>
          </div>
          <p className="text-xs text-rose-700">
            Los registros deben tener 4 columnas separadas o cumplir estrictamente con el patrón <code className="font-bold">N#C##E#P#</code> (Ej: N1C01E1P1).
          </p>
          <div className="max-h-48 overflow-y-auto border border-rose-200 rounded-lg bg-white">
            <table className="w-full text-left text-xs">
              <thead className="bg-rose-100/60 text-rose-900 font-semibold">
                <tr>
                  <th className="py-1.5 px-3">Fila</th>
                  <th className="py-1.5 px-3">Valor Detectado</th>
                  <th className="py-1.5 px-3">Motivo de Rechazo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rose-100 font-mono text-2xs">
                {parseErrors.map((err, idx) => (
                  <tr key={idx} className="hover:bg-rose-50/50">
                    <td className="py-1.5 px-3 font-semibold text-rose-700">{err.row > 0 ? `#${err.row}` : '-'}</td>
                    <td className="py-1.5 px-3 text-zinc-800">{err.value}</td>
                    <td className="py-1.5 px-3 text-rose-700 font-sans">{err.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Upload Zone (HU-01) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div 
          className={`lg:col-span-2 border-2 border-dashed rounded-xl p-6 text-center transition-all bg-white flex flex-col justify-center items-center ${
            dragOver ? 'border-blue-500 bg-blue-50/50' : 'border-zinc-300 hover:border-zinc-400'
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          <input 
            type="file" 
            ref={fileInputRef}
            className="hidden" 
            accept=".xlsx, .xls, .csv"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                const file = e.target.files[0];
                file.arrayBuffer().then(buf => processBuffer(buf, file.name));
              }
            }}
          />
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
            <UploadCloud className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-zinc-900">
            Carga de Archivo Excel o CSV (HU-01)
          </h3>
          <p className="text-xs text-zinc-500 mt-1 max-w-md">
            Sube un archivo con <strong>4 columnas</strong> (Nivel, Columna, Estantería, Posición) o con <strong>1 columna combinada</strong> (ej. N1C01E1P1).
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 mt-4">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer shadow-2xs"
            >
              Examinar archivo de Excel / CSV
            </button>
            <button
              onClick={() => setIsPasting(!isPasting)}
              className="px-4 py-2 text-xs font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors cursor-pointer"
            >
              {isPasting ? 'Cerrar pegado' : 'Pegar texto copiado'}
            </button>
          </div>
        </div>

        {/* Demo data / quick load card */}
        <div className="bg-zinc-900 text-white rounded-xl p-5 flex flex-col justify-between shadow-xs">
          <div>
            <div className="flex items-center gap-1.5 text-amber-400 text-xs font-bold uppercase tracking-wider mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              Datos de Muestra (HU-01)
            </div>
            <h4 className="text-sm font-bold text-white mb-1">
              Prueba con ubicaciones reales N#C##E(letra)P#
            </h4>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Carga instantáneamente 12 ubicaciones formateadas (Nivel 1 al 3, Columnas 01 y 02, Estanterías A y B, Posición 1 y 2).
            </p>
          </div>

          <div className="mt-4 pt-4 border-t border-zinc-800 flex flex-col gap-2">
            <button
              onClick={() => {
                import('../utils/storage').then(mod => {
                  onUpdateLocations(mod.SAMPLE_LOCATIONS);
                  setSuccessMsg('Se cargaron las 12 ubicaciones de muestra en formato N#C##E(letra)P#.');
                  setParseErrors([]);
                });
              }}
              className="w-full py-2 px-3 text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-100 rounded-lg transition-colors text-center cursor-pointer"
            >
              Cargar Muestra N#C##E(letra)P#
            </button>

            {locations.length > 0 && (
              <button
                onClick={onGoToCount}
                className="w-full py-2.5 px-3 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Ir al Conteo Físico ({locations.length} ubicaciones)</span>
                <span>→</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Paste text input drawer */}
      {isPasting && (
        <div className="bg-white border border-zinc-300 rounded-xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
              <ClipboardPaste className="w-4 h-4 text-blue-600" />
              Pegar listado de ubicaciones (1 por línea o 4 columnas separadas por tabulador/coma)
            </h4>
            <span className="text-xs text-zinc-400">Ejemplo combinado: N1C01EAP1</span>
          </div>
          <textarea
            rows={5}
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder={`N1C01EAP1
N1C01EAP2
N1C02EBP1
o también 4 columnas:
1	01	A	1
1	01	A	2`}
            className="w-full text-xs font-mono p-3 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setIsPasting(false)}
              className="px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-100 rounded-lg"
            >
              Cancelar
            </button>
            <button
              onClick={handlePasteSubmit}
              disabled={!pasteText.trim()}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 cursor-pointer"
            >
              Procesar y Cargar (HU-01)
            </button>
          </div>
        </div>
      )}

      {/* HU-02: Table with Individual and Mass Edit / Delete */}
      <div className="bg-white border border-zinc-200 rounded-xl shadow-xs overflow-hidden">
        {/* Table actions bar */}
        <div className="p-4 border-b border-zinc-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar N#, C##, E# o P#..."
                className="w-full pl-9 pr-3 py-1.5 text-xs border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {selectedIds.size > 0 && (
              <span className="text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-lg shrink-0">
                {selectedIds.size} seleccionada{selectedIds.size > 1 ? 's' : ''}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 justify-end">
            {/* HU-02: Mass Delete button */}
            {selectedIds.size > 0 && (
              <button
                onClick={handleDeleteSelected}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors cursor-pointer shadow-2xs"
                title="Eliminar masivamente las ubicaciones seleccionadas (HU-02)"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Eliminar Masivo ({selectedIds.size})</span>
              </button>
            )}

            <button
              onClick={() => setIsAdding(!isAdding)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nueva Ubicación</span>
            </button>

            {locations.length > 0 && (
              <button
                onClick={() => {
                  if (window.confirm('¿Deseas vaciar todo el listado de ubicaciones?')) {
                    onUpdateLocations([]);
                    setSelectedIds(new Set());
                    setSuccessMsg('Listado vaciado.');
                  }
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
              >
                Vaciar Todo
              </button>
            )}
          </div>
        </div>

        {/* Add single location inline form */}
        {isAdding && (
          <form onSubmit={handleAddManual} className="p-4 bg-zinc-50 border-b border-zinc-200 flex flex-wrap items-center gap-3">
            <span className="text-xs font-bold text-zinc-700">Agregar manualmente:</span>
            <div className="flex items-center gap-2">
              <label className="text-xs text-zinc-500 font-mono">Nivel:</label>
              <input 
                type="number" 
                required 
                min="1" 
                value={newNivel} 
                onChange={(e) => setNewNivel(e.target.value)} 
                className="w-14 text-xs p-1.5 bg-white border border-zinc-300 rounded-md text-center font-mono"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-zinc-500 font-mono">Columna:</label>
              <input 
                type="text" 
                required 
                value={newColumna} 
                onChange={(e) => setNewColumna(e.target.value)} 
                className="w-14 text-xs p-1.5 bg-white border border-zinc-300 rounded-md text-center font-mono"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-zinc-500 font-mono">Estantería (Letra):</label>
              <input 
                type="text" 
                required 
                maxLength={3}
                placeholder="A"
                value={newEstanteria} 
                onChange={(e) => setNewEstanteria(e.target.value.toUpperCase())} 
                className="w-14 text-xs p-1.5 bg-white border border-zinc-300 rounded-md text-center font-mono uppercase"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-zinc-500 font-mono">Posición:</label>
              <input 
                type="number" 
                required 
                min="1" 
                value={newPosicion} 
                onChange={(e) => setNewPosicion(e.target.value)} 
                className="w-14 text-xs p-1.5 bg-white border border-zinc-300 rounded-md text-center font-mono"
              />
            </div>
            <div className="text-xs font-mono font-bold text-blue-700 bg-blue-50 px-2 py-1 rounded">
              {formatCode(newNivel, newColumna, newEstanteria, newPosicion)}
            </div>
            <button
              type="submit"
              className="px-3.5 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer"
            >
              Guardar
            </button>
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="px-2.5 py-1.5 text-xs text-zinc-500"
            >
              Cancelar
            </button>
            {addError && <span className="text-xs text-rose-600 font-medium">{addError}</span>}
          </form>
        )}

        {/* Locations Table */}
        {filteredLocations.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center mx-auto mb-3 text-zinc-400">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <h5 className="text-sm font-bold text-zinc-800">
              {locations.length === 0 ? 'No hay ubicaciones cargadas' : 'No hay resultados para la búsqueda'}
            </h5>
            <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
              Sube un archivo de Excel con el patrón N#C##E#P# o utiliza el botón de datos de muestra.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-zinc-600">
              <thead className="bg-zinc-50 text-zinc-500 uppercase tracking-wider font-semibold border-b border-zinc-200">
                <tr>
                  <th className="py-2.5 px-3 w-10 text-center">
                    <button 
                      onClick={handleToggleSelectAll}
                      className="p-1 text-zinc-500 hover:text-zinc-800"
                      title="Seleccionar todo para acción masiva (HU-02)"
                    >
                      {selectedIds.size === filteredLocations.length && filteredLocations.length > 0 ? (
                        <CheckSquare className="w-4 h-4 text-blue-600" />
                      ) : (
                        <Square className="w-4 h-4 text-zinc-400" />
                      )}
                    </button>
                  </th>
                  <th className="py-2.5 px-4">Código (N#C##E#P#)</th>
                  <th className="py-2.5 px-3">Nivel</th>
                  <th className="py-2.5 px-3">Columna</th>
                  <th className="py-2.5 px-3">Estantería</th>
                  <th className="py-2.5 px-3">Posición</th>
                  <th className="py-2.5 px-4">Estado</th>
                  <th className="py-2.5 px-4 text-right">Acciones (HU-02)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {filteredLocations.map((item) => {
                  const isSelected = selectedIds.has(item.id);

                  return (
                    <tr 
                      key={item.id} 
                      className={`transition-colors ${isSelected ? 'bg-blue-50/60' : 'hover:bg-zinc-50/70'}`}
                    >
                      <td className="py-2.5 px-3 text-center">
                        <button
                          onClick={() => handleToggleSelectOne(item.id)}
                          className="p-1 text-zinc-400 hover:text-blue-600"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-blue-600" />
                          ) : (
                            <Square className="w-4 h-4 text-zinc-300" />
                          )}
                        </button>
                      </td>
                      <td className="py-2.5 px-4 font-mono font-bold text-zinc-900">
                        {item.code}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-medium text-zinc-700">
                        N{item.nivel}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-medium text-zinc-700">
                        C{item.columna}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-medium text-zinc-700">
                        E{item.estanteria}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-medium text-zinc-700">
                        P{item.posicion}
                      </td>
                      <td className="py-2.5 px-4">
                        {item.status === 'llena' ? (
                          <span className="inline-flex px-2 py-0.5 rounded text-2xs font-bold bg-blue-100 text-blue-800">
                            LLENA
                          </span>
                        ) : item.status === 'vacia' ? (
                          <span className="inline-flex px-2 py-0.5 rounded text-2xs font-bold bg-amber-100 text-amber-800">
                            VACÍA
                          </span>
                        ) : (
                          <span className="inline-flex px-2 py-0.5 rounded text-2xs font-medium bg-zinc-100 text-zinc-500">
                            Pendiente
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Edit single */}
                          <button
                            onClick={() => handleOpenEdit(item)}
                            className="p-1 text-zinc-400 hover:text-blue-600 rounded transition-colors"
                            title="Editar ubicación individualmente (HU-02)"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          {/* Delete single */}
                          <button
                            onClick={() => handleDeleteSingle(item.id)}
                            className="p-1 text-zinc-400 hover:text-rose-600 rounded transition-colors"
                            title="Eliminar ubicación (HU-02)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer info */}
        <div className="p-3 bg-zinc-50 border-t border-zinc-200 flex items-center justify-between text-xs text-zinc-500 px-4">
          <span>
            Mostrando <strong>{filteredLocations.length}</strong> de <strong>{locations.length}</strong> ubicaciones
          </span>
          {locations.length > 0 && (
            <button
              onClick={onGoToCount}
              className="text-blue-600 hover:text-blue-700 font-semibold cursor-pointer"
            >
              Comenzar conteo físico →
            </button>
          )}
        </div>
      </div>

      {/* HU-02: Modal Edit Individual Location */}
      {editingItem && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-zinc-200">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-blue-600" />
                Editar Ubicación (HU-02)
              </h4>
              <button 
                onClick={() => setEditingItem(null)}
                className="p-1 text-zinc-400 hover:text-zinc-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-2xs font-semibold text-zinc-500 uppercase">Nivel (N#)</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={editNivel}
                    onChange={(e) => setEditNivel(e.target.value)}
                    className="w-full text-xs p-2 border border-zinc-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="text-2xs font-semibold text-zinc-500 uppercase">Columna (C##)</label>
                  <input
                    type="text"
                    required
                    value={editColumna}
                    onChange={(e) => setEditColumna(e.target.value)}
                    className="w-full text-xs p-2 border border-zinc-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="text-2xs font-semibold text-zinc-500 uppercase">Estantería (Letra: A, B...)</label>
                  <input
                    type="text"
                    maxLength={3}
                    required
                    value={editEstanteria}
                    onChange={(e) => setEditEstanteria(e.target.value.toUpperCase())}
                    className="w-full text-xs p-2 border border-zinc-300 rounded-lg font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="text-2xs font-semibold text-zinc-500 uppercase">Posición (P#)</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={editPosicion}
                    onChange={(e) => setEditPosicion(e.target.value)}
                    className="w-full text-xs p-2 border border-zinc-300 rounded-lg font-mono"
                  />
                </div>
              </div>

              <div className="p-3 bg-zinc-50 rounded-xl text-center border border-zinc-200">
                <span className="text-3xs font-semibold text-zinc-400 uppercase tracking-wider block">Código resultante:</span>
                <span className="text-base font-black font-mono text-zinc-900">
                  {formatCode(editNivel, editColumna, editEstanteria, editPosicion)}
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-3 py-1.5 text-xs text-zinc-500 hover:bg-zinc-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState, useMemo } from 'react';
import { 
  Check, 
  X, 
  RotateCcw, 
  Filter, 
  Search, 
  SlidersHorizontal, 
  Smartphone, 
  Table, 
  LayoutGrid, 
  Volume2, 
  VolumeX,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { LocationItem, LocationStatus } from '../types';

interface Props {
  locations: LocationItem[];
  onUpdateStatus: (id: string, status: LocationStatus) => void;
  onGoToResults: () => void;
  onGoToManage: () => void;
}

export function MobileCountTab({ locations, onUpdateStatus, onGoToResults, onGoToManage }: Props) {
  // HU-03: 4 Combinable Filters
  const [filterNivel, setFilterNivel] = useState<string>('todos');
  const [filterColumna, setFilterColumna] = useState<string>('todos');
  const [filterEstanteria, setFilterEstanteria] = useState<string>('todos');
  const [filterPosicion, setFilterPosicion] = useState<string>('todos');
  const [filterStatus, setFilterStatus] = useState<'todos' | LocationStatus>('todos');
  const [searchQuery, setSearchQuery] = useState('');

  // Audio / feedback
  const [soundEnabled, setSoundEnabled] = useState(true);

  // View switch: 'table' (HU-03 primary) or 'tactile_cards'
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  // Audio feedback helper
  const playSound = (status: LocationStatus) => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(status === 'llena' ? 587.33 : 440.0, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } catch {
      // ignore
    }

    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(30);
    }
  };

  // Extract unique distinct options for each filter
  const niveles = useMemo(() => {
    const set = new Set(locations.map(l => l.nivel));
    return Array.from(set).sort((a, b) => Number(a) - Number(b));
  }, [locations]);

  const columnas = useMemo(() => {
    const set = new Set(locations.map(l => l.columna));
    return Array.from(set).sort((a, b) => Number(a) - Number(b));
  }, [locations]);

  const estanterias = useMemo(() => {
    const set = new Set(locations.map(l => l.estanteria));
    return Array.from(set).sort((a, b) => Number(a) - Number(b));
  }, [locations]);

  const posiciones = useMemo(() => {
    const set = new Set(locations.map(l => l.posicion));
    return Array.from(set).sort((a, b) => Number(a) - Number(b));
  }, [locations]);

  // HU-03: Combined filtering
  const filteredLocations = useMemo(() => {
    return locations.filter(l => {
      // Nivel filter
      if (filterNivel !== 'todos' && l.nivel !== filterNivel) return false;
      // Columna filter
      if (filterColumna !== 'todos' && l.columna !== filterColumna) return false;
      // Estantería filter
      if (filterEstanteria !== 'todos' && l.estanteria !== filterEstanteria) return false;
      // Posición filter
      if (filterPosicion !== 'todos' && l.posicion !== filterPosicion) return false;
      // Status filter
      if (filterStatus !== 'todos' && l.status !== filterStatus) return false;
      // Text search
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        if (!l.code.toLowerCase().includes(query)) return false;
      }

      return true;
    });
  }, [locations, filterNivel, filterColumna, filterEstanteria, filterPosicion, filterStatus, searchQuery]);

  const handleMark = (id: string, newStatus: LocationStatus) => {
    onUpdateStatus(id, newStatus);
    playSound(newStatus);
  };

  const resetFilters = () => {
    setFilterNivel('todos');
    setFilterColumna('todos');
    setFilterEstanteria('todos');
    setFilterPosicion('todos');
    setFilterStatus('todos');
    setSearchQuery('');
  };

  const hasActiveFilters = 
    filterNivel !== 'todos' || 
    filterColumna !== 'todos' || 
    filterEstanteria !== 'todos' || 
    filterPosicion !== 'todos' || 
    filterStatus !== 'todos' || 
    searchQuery !== '';

  // Stats
  const total = locations.length;
  const counted = locations.filter(l => l.status !== 'pendiente').length;
  const emptyCount = locations.filter(l => l.status === 'vacia').length;
  const fullCount = locations.filter(l => l.status === 'llena').length;
  const progressPercent = total > 0 ? Math.round((counted / total) * 100) : 0;

  if (locations.length === 0) {
    return (
      <div className="bg-white border border-zinc-200 rounded-xl p-8 text-center max-w-md mx-auto my-8">
        <Smartphone className="w-12 h-12 text-zinc-400 mx-auto mb-3" />
        <h3 className="text-base font-bold text-zinc-900">No hay ubicaciones para contar</h3>
        <p className="text-xs text-zinc-500 mt-1 mb-5">
          Debes cargar primero las ubicaciones a contar (Épica 1: HU-01).
        </p>
        <button
          onClick={onGoToManage}
          className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer"
        >
          Cargar Ubicaciones Ahora
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-4xl mx-auto pb-12" id="epic-2-workarea">
      {/* Sticky Top Status & Progress Bar */}
      <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-xs sticky top-2 z-20">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-800">
              HU-03: Conteo Físico Móvil
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-100 transition-colors"
              title={soundEnabled ? 'Sonido activado' : 'Sonido desactivado'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4 text-zinc-700" /> : <VolumeX className="w-4 h-4 text-zinc-400" />}
            </button>

            {/* View Mode Toggle */}
            <div className="flex bg-zinc-100 p-0.5 rounded-lg border border-zinc-200">
              <button
                onClick={() => setViewMode('table')}
                className={`px-2.5 py-1 text-2xs font-bold rounded-md transition-all flex items-center gap-1 cursor-pointer ${
                  viewMode === 'table' ? 'bg-white text-zinc-900 shadow-2xs' : 'text-zinc-500'
                }`}
              >
                <Table className="w-3 h-3" />
                <span>Tabla (HU-03)</span>
              </button>
              <button
                onClick={() => setViewMode('cards')}
                className={`px-2.5 py-1 text-2xs font-bold rounded-md transition-all flex items-center gap-1 cursor-pointer ${
                  viewMode === 'cards' ? 'bg-white text-zinc-900 shadow-2xs' : 'text-zinc-500'
                }`}
              >
                <LayoutGrid className="w-3 h-3" />
                <span>Tarjetas</span>
              </button>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs font-medium text-zinc-600">
            <span>
              Progreso: <strong className="text-zinc-900">{counted}</strong> de {total} ({progressPercent}%)
            </span>
            <span className="flex items-center gap-2 text-2xs">
              <span className="text-amber-700 font-bold">{emptyCount} Vacías</span>
              <span className="text-zinc-300">|</span>
              <span className="text-blue-700 font-bold">{fullCount} Llenas</span>
              <span className="text-zinc-300">|</span>
              <span className="text-zinc-500">{total - counted} Pendientes</span>
            </span>
          </div>
          <div className="w-full h-2 bg-zinc-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-emerald-500 transition-all duration-300 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* HU-03 RF: 4 COMBINABLE FILTERS (Nivel, Columna, Estantería, Posición) */}
        <div className="mt-3 pt-3 border-t border-zinc-100 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-700">
              <Filter className="w-3.5 h-3.5 text-blue-600" />
              <span>Filtros Combinables (HU-03):</span>
            </div>
            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="text-2xs font-semibold text-blue-600 hover:text-blue-800"
              >
                Restablecer filtros
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {/* 1. Nivel */}
            <div>
              <label className="text-3xs font-bold text-zinc-400 uppercase tracking-wider block mb-0.5">
                Nivel (N#)
              </label>
              <select
                value={filterNivel}
                onChange={(e) => setFilterNivel(e.target.value)}
                className="w-full text-xs font-semibold p-1.5 bg-zinc-50 border border-zinc-300 rounded-lg text-zinc-800 focus:ring-2 focus:ring-blue-500"
              >
                <option value="todos">Todos los niveles</option>
                {niveles.map(n => (
                  <option key={n} value={n}>Nivel {n}</option>
                ))}
              </select>
            </div>

            {/* 2. Columna */}
            <div>
              <label className="text-3xs font-bold text-zinc-400 uppercase tracking-wider block mb-0.5">
                Columna (C##)
              </label>
              <select
                value={filterColumna}
                onChange={(e) => setFilterColumna(e.target.value)}
                className="w-full text-xs font-semibold p-1.5 bg-zinc-50 border border-zinc-300 rounded-lg text-zinc-800 focus:ring-2 focus:ring-blue-500"
              >
                <option value="todos">Todas las columnas</option>
                {columnas.map(c => (
                  <option key={c} value={c}>Columna {c}</option>
                ))}
              </select>
            </div>

            {/* 3. Estantería */}
            <div>
              <label className="text-3xs font-bold text-zinc-400 uppercase tracking-wider block mb-0.5">
                Estantería (E#)
              </label>
              <select
                value={filterEstanteria}
                onChange={(e) => setFilterEstanteria(e.target.value)}
                className="w-full text-xs font-semibold p-1.5 bg-zinc-50 border border-zinc-300 rounded-lg text-zinc-800 focus:ring-2 focus:ring-blue-500"
              >
                <option value="todos">Todas las estanterías</option>
                {estanterias.map(e => (
                  <option key={e} value={e}>Estantería {e}</option>
                ))}
              </select>
            </div>

            {/* 4. Posición */}
            <div>
              <label className="text-3xs font-bold text-zinc-400 uppercase tracking-wider block mb-0.5">
                Posición (P#)
              </label>
              <select
                value={filterPosicion}
                onChange={(e) => setFilterPosicion(e.target.value)}
                className="w-full text-xs font-semibold p-1.5 bg-zinc-50 border border-zinc-300 rounded-lg text-zinc-800 focus:ring-2 focus:ring-blue-500"
              >
                <option value="todos">Todas las posiciones</option>
                {posiciones.map(p => (
                  <option key={p} value={p}>Posición {p}</option>
                ))}
              </select>
            </div>

            {/* 5. Estado */}
            <div className="col-span-2 sm:col-span-1">
              <label className="text-3xs font-bold text-zinc-400 uppercase tracking-wider block mb-0.5">
                Estado
              </label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="w-full text-xs font-semibold p-1.5 bg-zinc-50 border border-zinc-300 rounded-lg text-zinc-800 focus:ring-2 focus:ring-blue-500"
              >
                <option value="todos">Todos los estados</option>
                <option value="pendiente">Solo Pendientes</option>
                <option value="vacia">Solo Vacías</option>
                <option value="llena">Solo Llenas</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Main Table View (HU-03) */}
      {filteredLocations.length === 0 ? (
        <div className="bg-white border border-zinc-200 rounded-xl p-8 text-center">
          <AlertCircle className="w-8 h-8 text-zinc-400 mx-auto mb-2" />
          <h4 className="text-sm font-bold text-zinc-900">No hay ubicaciones con los filtros seleccionados</h4>
          <p className="text-xs text-zinc-500 mt-1 mb-4">
            Ajusta los filtros de Nivel, Columna, Estantería o Posición para ver otras ubicaciones.
          </p>
          <button
            onClick={resetFilters}
            className="px-3.5 py-1.5 text-xs font-bold text-white bg-blue-600 rounded-lg"
          >
            Quitar Filtros
          </button>
        </div>
      ) : viewMode === 'table' ? (
        /* HU-03: Responsive Table with per-row Vacía / Llena buttons */
        <div className="bg-white border border-zinc-200 rounded-xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-zinc-600">
              <thead className="bg-zinc-50 text-zinc-500 uppercase tracking-wider font-semibold border-b border-zinc-200">
                <tr>
                  <th className="py-2.5 px-4 font-bold">Código Ubicación</th>
                  <th className="py-2.5 px-2 text-center">N</th>
                  <th className="py-2.5 px-2 text-center">C</th>
                  <th className="py-2.5 px-2 text-center">E</th>
                  <th className="py-2.5 px-2 text-center">P</th>
                  <th className="py-2.5 px-3">Estado Actual</th>
                  <th className="py-2.5 px-4 text-right">Marcar Conteo (HU-03)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {filteredLocations.map((item) => {
                  const isCounted = item.status !== 'pendiente';

                  return (
                    <tr 
                      key={item.id} 
                      className={`transition-colors ${
                        item.status === 'vacia' 
                          ? 'bg-amber-50/40 hover:bg-amber-50/70' 
                          : item.status === 'llena' 
                          ? 'bg-blue-50/40 hover:bg-blue-50/70' 
                          : 'hover:bg-zinc-50/80'
                      }`}
                    >
                      <td className="py-3 px-4 font-mono font-black text-sm text-zinc-900 tracking-tight">
                        {item.code}
                      </td>
                      <td className="py-3 px-2 text-center font-mono text-zinc-600 font-semibold">
                        {item.nivel}
                      </td>
                      <td className="py-3 px-2 text-center font-mono text-zinc-600 font-semibold">
                        {item.columna}
                      </td>
                      <td className="py-3 px-2 text-center font-mono text-zinc-600 font-semibold">
                        {item.estanteria}
                      </td>
                      <td className="py-3 px-2 text-center font-mono text-zinc-600 font-semibold">
                        {item.posicion}
                      </td>
                      <td className="py-3 px-3">
                        {item.status === 'llena' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-blue-100 text-blue-900 border border-blue-200">
                            <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                            LLENA
                          </span>
                        ) : item.status === 'vacia' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-900 border border-amber-200">
                            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                            VACÍA
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-2xs font-semibold bg-zinc-100 text-zinc-500">
                            Pendiente
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-2 justify-end">
                          {/* Botón Vacía */}
                          <button
                            onClick={() => handleMark(item.id, 'vacia')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all transform active:scale-95 cursor-pointer ${
                              item.status === 'vacia'
                                ? 'bg-amber-600 text-white shadow-xs'
                                : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
                            }`}
                            title="Marcar como vacía"
                          >
                            Vacía
                          </button>

                          {/* Botón Llena */}
                          <button
                            onClick={() => handleMark(item.id, 'llena')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all transform active:scale-95 cursor-pointer ${
                              item.status === 'llena'
                                ? 'bg-blue-600 text-white shadow-xs'
                                : 'bg-blue-50 text-blue-800 border border-blue-200 hover:bg-blue-100'
                            }`}
                            title="Marcar como llena"
                          >
                            Llena
                          </button>

                          {/* Reset to uncounted */}
                          {isCounted && (
                            <button
                              onClick={() => handleMark(item.id, 'pendiente')}
                              className="p-1 text-zinc-400 hover:text-zinc-600 rounded"
                              title="Restablecer a pendiente"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="p-3 bg-zinc-50 border-t border-zinc-200 flex items-center justify-between text-xs text-zinc-500 px-4">
            <span>
              Mostrando <strong>{filteredLocations.length}</strong> de <strong>{locations.length}</strong> ubicaciones
            </span>
            <span className="text-2xs text-zinc-400">
              Guardado automático inmediato (HU-03 CA)
            </span>
          </div>
        </div>
      ) : (
        /* Tactile Card View for easy one-hand mobile operation */
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filteredLocations.map((item) => (
            <div 
              key={item.id}
              className={`p-4 bg-white border rounded-xl shadow-2xs flex flex-col justify-between gap-3 ${
                item.status === 'vacia' ? 'border-amber-300 bg-amber-50/20' :
                item.status === 'llena' ? 'border-blue-300 bg-blue-50/20' :
                'border-zinc-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-lg font-black text-zinc-900 tracking-tight">
                  {item.code}
                </span>
                <div className="flex items-center gap-1 text-2xs font-mono text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded">
                  <span>N{item.nivel}</span>•
                  <span>C{item.columna}</span>•
                  <span>E{item.estanteria}</span>•
                  <span>P{item.posicion}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleMark(item.id, 'vacia')}
                  className={`py-2.5 px-3 rounded-lg text-xs font-bold transition-all text-center cursor-pointer ${
                    item.status === 'vacia'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100'
                  }`}
                >
                  Vacía
                </button>
                <button
                  onClick={() => handleMark(item.id, 'llena')}
                  className={`py-2.5 px-3 rounded-lg text-xs font-bold transition-all text-center cursor-pointer ${
                    item.status === 'llena'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-blue-50 text-blue-900 border border-blue-200 hover:bg-blue-100'
                  }`}
                >
                  Llena
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Button to go to Export / Results */}
      <div className="pt-2">
        <button
          onClick={onGoToResults}
          className="w-full py-3.5 px-4 bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-sm rounded-xl transition-colors shadow-xs flex items-center justify-center gap-2 cursor-pointer"
        >
          <span>Ir a Exportar Resultados a Excel (HU-04)</span>
          <span>→</span>
        </button>
      </div>
    </div>
  );
}

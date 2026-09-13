import React, { useState, useMemo } from 'react';
import { 
  Check, 
  X, 
  RotateCcw, 
  Filter, 
  Search, 
  Smartphone, 
  Volume2, 
  VolumeX,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { LocationItem, LocationStatus } from '../types';

export type SortField = 'code' | 'nivel' | 'columna' | 'estanteria' | 'posicion' | 'status';
export type SortDirection = 'asc' | 'desc';

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

  // Sorting state (Menor a mayor / Mayor a menor)
  const [sortField, setSortField] = useState<SortField>('code');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Dropdown state for filters
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  // Audio / feedback
  const [soundEnabled, setSoundEnabled] = useState(true);

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
      try {
        navigator.vibrate(35);
      } catch {
        // ignore
      }
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
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [locations]);

  const posiciones = useMemo(() => {
    const set = new Set(locations.map(l => l.posicion));
    return Array.from(set).sort((a, b) => Number(a) - Number(b));
  }, [locations]);

  // HU-03: Combined filtering and Sorting (de menor a mayor y de mayor a menor para números y letras)
  const filteredLocations = useMemo(() => {
    const result = locations.filter(l => {
      if (filterNivel !== 'todos' && l.nivel !== filterNivel) return false;
      if (filterColumna !== 'todos' && l.columna !== filterColumna) return false;
      if (filterEstanteria !== 'todos' && l.estanteria !== filterEstanteria) return false;
      if (filterPosicion !== 'todos' && l.posicion !== filterPosicion) return false;
      if (filterStatus !== 'todos' && l.status !== filterStatus) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        if (!l.code.toLowerCase().includes(query)) return false;
      }
      return true;
    });

    result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'code':
          // Orden natural para letras y números combinados (ej. N1C01EAP1)
          comparison = a.code.localeCompare(b.code, undefined, { numeric: true, sensitivity: 'base' });
          break;
        case 'nivel':
          // Números de menor a mayor
          comparison = (Number(a.nivel) || 0) - (Number(b.nivel) || 0) || a.nivel.localeCompare(b.nivel);
          break;
        case 'columna':
          // Números de menor a mayor
          comparison = (Number(a.columna) || 0) - (Number(b.columna) || 0) || a.columna.localeCompare(b.columna);
          break;
        case 'estanteria':
          // Letras de A a Z
          comparison = a.estanteria.localeCompare(b.estanteria);
          break;
        case 'posicion':
          // Números de menor a mayor
          comparison = (Number(a.posicion) || 0) - (Number(b.posicion) || 0) || a.posicion.localeCompare(b.posicion);
          break;
        case 'status':
          const statusOrder: Record<LocationStatus, number> = {
            pendiente: 1,
            vacia: 2,
            llena: 3,
          };
          comparison = (statusOrder[a.status] || 0) - (statusOrder[b.status] || 0);
          break;
        default:
          comparison = 0;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [locations, filterNivel, filterColumna, filterEstanteria, filterPosicion, filterStatus, searchQuery, sortField, sortDirection]);

  const handleSortToggle = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

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
    setSortField('code');
    setSortDirection('asc');
  };

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filterNivel !== 'todos') count++;
    if (filterColumna !== 'todos') count++;
    if (filterEstanteria !== 'todos') count++;
    if (filterPosicion !== 'todos') count++;
    if (filterStatus !== 'todos') count++;
    return count;
  }, [filterNivel, filterColumna, filterEstanteria, filterPosicion, filterStatus]);

  const hasActiveFilters = activeFiltersCount > 0 || searchQuery.trim() !== '' || sortField !== 'code' || sortDirection !== 'asc';

  // Stats
  const total = locations.length;
  const counted = locations.filter(l => l.status !== 'pendiente').length;
  const emptyCount = locations.filter(l => l.status === 'vacia').length;
  const fullCount = locations.filter(l => l.status === 'llena').length;
  const progressPercent = total > 0 ? Math.round((counted / total) * 100) : 0;

  if (locations.length === 0) {
    return (
      <div className="bg-white border border-zinc-200 rounded-xl p-8 text-center max-w-md mx-auto my-8 shadow-xs">
        <Smartphone className="w-12 h-12 text-zinc-400 mx-auto mb-3" />
        <h3 className="text-base font-bold text-zinc-900">No hay ubicaciones cargadas</h3>
        <p className="text-xs text-zinc-500 mt-1 mb-5">
          Carga primero el archivo Excel o pega el listado de ubicaciones en la pestaña Gestión.
        </p>
        <button
          onClick={onGoToManage}
          className="px-4 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl cursor-pointer shadow-xs"
        >
          Ir a Cargar Ubicaciones
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2.5 max-w-4xl mx-auto pb-16" id="epic-2-workarea">
      {/* 
        CUADRO COMPACTO SUPERIOR:
        Diseñado para ocupar el mínimo espacio vertical posible en celular
      */}
      <div className="bg-white border border-zinc-200 rounded-xl p-2.5 sm:p-3 shadow-xs sticky top-16 z-20 space-y-2">
        {/* Línea 1: Progreso + Conteo + Etiquetas Vacías/Llenas + Sonido */}
        <div className="flex items-center justify-between gap-1.5 text-2xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="font-bold text-zinc-900">Conteo:</span>
            <span className="font-semibold text-zinc-700 bg-zinc-100 px-1.5 py-0.5 rounded">
              {counted}/{total} ({progressPercent}%)
            </span>
            <span className="inline-flex items-center gap-0.5 text-amber-800 bg-amber-50 border border-amber-200/80 px-1.5 py-0.5 rounded font-bold">
              {emptyCount} Vacías
            </span>
            <span className="inline-flex items-center gap-0.5 text-blue-800 bg-blue-50 border border-blue-200/80 px-1.5 py-0.5 rounded font-bold">
              {fullCount} Llenas
            </span>
            <span className="hidden sm:inline-flex items-center gap-0.5 text-zinc-600 bg-zinc-100 px-1.5 py-0.5 rounded font-medium">
              {total - counted} Pend.
            </span>
          </div>

          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-1 rounded text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100 transition-colors cursor-pointer"
            title={soundEnabled ? 'Sonido activado' : 'Sonido desactivado'}
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-zinc-700" /> : <VolumeX className="w-3.5 h-3.5 text-zinc-400" />}
          </button>
        </div>

        {/* Barra fina de progreso */}
        <div className="w-full h-1 bg-zinc-100 rounded-full overflow-hidden">
          <div 
            className="h-full bg-emerald-500 transition-all duration-300 rounded-full"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Línea 2: Buscador rápido + Botón Desplegable de Filtros */}
        <div className="flex items-center gap-1.5">
          <div className="relative flex-1">
            <Search className="w-3 h-3 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar código (ej. N1C01)..."
              className="w-full text-xs pl-7 pr-6 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <button
            onClick={() => setIsFiltersOpen(!isFiltersOpen)}
            className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg border flex items-center gap-1 transition-all cursor-pointer whitespace-nowrap ${
              isFiltersOpen || activeFiltersCount > 0
                ? 'bg-blue-50 text-blue-700 border-blue-200 shadow-2xs'
                : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-700 border-zinc-200'
            }`}
          >
            <Filter className="w-3 h-3 text-blue-600" />
            <span>Filtros</span>
            {activeFiltersCount > 0 && (
              <span className="w-3.5 h-3.5 rounded-full bg-blue-600 text-white text-3xs font-black flex items-center justify-center">
                {activeFiltersCount}
              </span>
            )}
            {isFiltersOpen ? (
              <ChevronUp className="w-3 h-3 text-zinc-400" />
            ) : (
              <ChevronDown className="w-3 h-3 text-zinc-400" />
            )}
          </button>
        </div>

        {/* Desplegable de Filtros (solo si está abierto) */}
        {isFiltersOpen && (
          <div className="pt-2 border-t border-zinc-100 space-y-2 animate-in fade-in slide-in-from-top-1 duration-150">
            <div className="flex items-center justify-between text-2xs">
              <span className="font-bold text-zinc-700 uppercase tracking-wider">
                Filtros de Ubicación
              </span>
              {hasActiveFilters && (
                <button
                  onClick={resetFilters}
                  className="font-bold text-blue-600 hover:text-blue-800"
                >
                  Restablecer
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
              {/* Nivel */}
              <div>
                <label className="text-3xs font-bold text-zinc-500 uppercase block mb-0.5">Nivel</label>
                <select
                  value={filterNivel}
                  onChange={(e) => setFilterNivel(e.target.value)}
                  className="w-full text-xs p-1.5 bg-white border border-zinc-300 rounded-md text-zinc-800"
                >
                  <option value="todos">Todos</option>
                  {niveles.map(n => <option key={n} value={n}>Nivel {n}</option>)}
                </select>
              </div>

              {/* Columna */}
              <div>
                <label className="text-3xs font-bold text-zinc-500 uppercase block mb-0.5">Columna</label>
                <select
                  value={filterColumna}
                  onChange={(e) => setFilterColumna(e.target.value)}
                  className="w-full text-xs p-1.5 bg-white border border-zinc-300 rounded-md text-zinc-800"
                >
                  <option value="todos">Todas</option>
                  {columnas.map(c => <option key={c} value={c}>Col {c}</option>)}
                </select>
              </div>

              {/* Estantería */}
              <div>
                <label className="text-3xs font-bold text-zinc-500 uppercase block mb-0.5">Estantería</label>
                <select
                  value={filterEstanteria}
                  onChange={(e) => setFilterEstanteria(e.target.value)}
                  className="w-full text-xs p-1.5 bg-white border border-zinc-300 rounded-md text-zinc-800"
                >
                  <option value="todos">Todas</option>
                  {estanterias.map(e => <option key={e} value={e}>Est {e}</option>)}
                </select>
              </div>

              {/* Posición */}
              <div>
                <label className="text-3xs font-bold text-zinc-500 uppercase block mb-0.5">Posición</label>
                <select
                  value={filterPosicion}
                  onChange={(e) => setFilterPosicion(e.target.value)}
                  className="w-full text-xs p-1.5 bg-white border border-zinc-300 rounded-md text-zinc-800"
                >
                  <option value="todos">Todas</option>
                  {posiciones.map(p => <option key={p} value={p}>Pos {p}</option>)}
                </select>
              </div>

              {/* Estado */}
              <div className="col-span-2 sm:col-span-1">
                <label className="text-3xs font-bold text-zinc-500 uppercase block mb-0.5">Estado</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as any)}
                  className="w-full text-xs p-1.5 bg-white border border-zinc-300 rounded-md text-zinc-800"
                >
                  <option value="todos">Todos</option>
                  <option value="pendiente">Solo Pendientes</option>
                  <option value="vacia">Solo Vacías</option>
                  <option value="llena">Solo Llenas</option>
                </select>
              </div>
            </div>

            {/* SECCIÓN DE ORDENAMIENTO: Menor a Mayor / Mayor a Menor */}
            <div className="pt-2 border-t border-zinc-200">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-3xs font-bold text-zinc-700 uppercase flex items-center gap-1">
                  <ArrowUpDown className="w-3 h-3 text-blue-600" />
                  <span>Ordenar listado (Números y Letras)</span>
                </span>
                <span className="text-3xs font-medium text-blue-700">
                  {sortDirection === 'asc' ? '↑ Menor a mayor' : '↓ Mayor a menor'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {/* Selector de columna */}
                <div>
                  <label className="text-3xs font-bold text-zinc-500 uppercase block mb-0.5">Columna a ordenar</label>
                  <select
                    value={sortField}
                    onChange={(e) => setSortField(e.target.value as SortField)}
                    className="w-full text-xs p-1.5 bg-white border border-zinc-300 rounded-md text-zinc-800"
                  >
                    <option value="code">Ubicación (N1C01...)</option>
                    <option value="nivel">Nivel (1, 2, 3...)</option>
                    <option value="columna">Columna (01, 02...)</option>
                    <option value="estanteria">Estantería (A, B, C...)</option>
                    <option value="posicion">Posición (1, 2, 3...)</option>
                    <option value="status">Estado (Pendiente, Vacía, Llena)</option>
                  </select>
                </div>

                {/* Sentido: Menor a Mayor vs Mayor a Menor */}
                <div>
                  <label className="text-3xs font-bold text-zinc-500 uppercase block mb-0.5">Sentido del orden</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSortDirection('asc')}
                      className={`py-1 px-1.5 text-xs font-bold rounded-md border flex items-center justify-center gap-1 cursor-pointer transition-all ${
                        sortDirection === 'asc'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                          : 'bg-zinc-50 text-zinc-700 border-zinc-300 hover:bg-zinc-100'
                      }`}
                    >
                      <ArrowUp className="w-3 h-3" />
                      <span>Menor a Mayor</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSortDirection('desc')}
                      className={`py-1 px-1.5 text-xs font-bold rounded-md border flex items-center justify-center gap-1 cursor-pointer transition-all ${
                        sortDirection === 'desc'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                          : 'bg-zinc-50 text-zinc-700 border-zinc-300 hover:bg-zinc-100'
                      }`}
                    >
                      <ArrowDown className="w-3 h-3" />
                      <span>Mayor a Menor</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => setIsFiltersOpen(false)}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-md shadow-2xs cursor-pointer"
              >
                Aplicar y Cerrar ({filteredLocations.length})
              </button>
            </div>
          </div>
        )}

        {/* Chips de filtros y orden activo */}
        {hasActiveFilters && !isFiltersOpen && (
          <div className="flex items-center gap-1 flex-wrap pt-1 text-3xs">
            <span className="text-zinc-400 font-bold uppercase">Activos:</span>

            {/* Chip de Ordenación actual */}
            <button
              onClick={() => setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')}
              className="inline-flex items-center gap-0.5 bg-zinc-900 text-white px-2 py-0.5 rounded-full font-bold shadow-2xs cursor-pointer active:scale-95"
              title="Toca para invertir el orden"
            >
              <span>
                {sortField === 'code' ? 'Ubicación' : sortField === 'nivel' ? 'Nivel' : sortField === 'columna' ? 'Columna' : sortField === 'estanteria' ? 'Estantería' : sortField === 'posicion' ? 'Posición' : 'Estado'}:
              </span>
              <span>{sortDirection === 'asc' ? 'Menor a Mayor ↑' : 'Mayor a Menor ↓'}</span>
            </button>

            {filterNivel !== 'todos' && (
              <span className="inline-flex items-center gap-0.5 bg-blue-50 text-blue-700 px-1.5 py-0.2 rounded-full border border-blue-200">
                N{filterNivel} <button onClick={() => setFilterNivel('todos')}>×</button>
              </span>
            )}
            {filterColumna !== 'todos' && (
              <span className="inline-flex items-center gap-0.5 bg-blue-50 text-blue-700 px-1.5 py-0.2 rounded-full border border-blue-200">
                C{filterColumna} <button onClick={() => setFilterColumna('todos')}>×</button>
              </span>
            )}
            {filterEstanteria !== 'todos' && (
              <span className="inline-flex items-center gap-0.5 bg-blue-50 text-blue-700 px-1.5 py-0.2 rounded-full border border-blue-200">
                E{filterEstanteria} <button onClick={() => setFilterEstanteria('todos')}>×</button>
              </span>
            )}
            {filterPosicion !== 'todos' && (
              <span className="inline-flex items-center gap-0.5 bg-blue-50 text-blue-700 px-1.5 py-0.2 rounded-full border border-blue-200">
                P{filterPosicion} <button onClick={() => setFilterPosicion('todos')}>×</button>
              </span>
            )}
            {filterStatus !== 'todos' && (
              <span className="inline-flex items-center gap-0.5 bg-blue-50 text-blue-700 px-1.5 py-0.2 rounded-full border border-blue-200">
                {filterStatus} <button onClick={() => setFilterStatus('todos')}>×</button>
              </span>
            )}
            <button onClick={resetFilters} className="text-red-600 font-semibold underline ml-1 cursor-pointer">
              Restablecer
            </button>
          </div>
        )}
      </div>

      {/* 
        TABLA DE UBICACIONES:
        - Mantiene todas las columnas: Ubicación, N, C, E, P, Acción
        - Encabezados interactivos para ordenar con un solo toque (Menor a Mayor / Mayor a Menor)
        - 100% visible en pantalla de celular SIN necesidad de scroll horizontal
      */}
      {filteredLocations.length === 0 ? (
        <div className="bg-white border border-zinc-200 rounded-xl p-6 text-center shadow-xs">
          <AlertCircle className="w-8 h-8 text-zinc-400 mx-auto mb-2" />
          <h4 className="text-sm font-bold text-zinc-900">No hay ubicaciones con los filtros seleccionados</h4>
          <p className="text-xs text-zinc-500 mt-1 mb-3">
            Ajusta los filtros de Nivel, Columna, Estantería o Posición.
          </p>
          <button
            onClick={resetFilters}
            className="px-3 py-1.5 text-xs font-bold text-white bg-blue-600 rounded-lg shadow-xs cursor-pointer"
          >
            Quitar Filtros
          </button>
        </div>
      ) : (
        <div className="bg-white border border-zinc-200 rounded-xl shadow-xs overflow-x-auto">
          <table className="w-full text-left border-collapse table-fixed min-w-[340px]">
            <thead className="bg-zinc-100 text-zinc-600 text-3xs sm:text-2xs uppercase tracking-wider font-bold border-b border-zinc-200">
              <tr>
                {/* 1. Ubicación (Interactivo: A-Z / Z-A) */}
                <th 
                  onClick={() => handleSortToggle('code')}
                  className="py-2 px-1.5 sm:px-3 w-[34%] sm:w-[24%] cursor-pointer hover:bg-zinc-200/80 transition-colors select-none"
                  title="Toca para ordenar de menor a mayor / mayor a menor"
                >
                  <div className="flex items-center gap-1">
                    <span>Ubicación</span>
                    {sortField === 'code' ? (
                      sortDirection === 'asc' ? (
                        <ArrowUp className="w-2.5 h-2.5 text-blue-600 stroke-[3]" />
                      ) : (
                        <ArrowDown className="w-2.5 h-2.5 text-blue-600 stroke-[3]" />
                      )
                    ) : (
                      <ArrowUpDown className="w-2.5 h-2.5 text-zinc-400 opacity-60" />
                    )}
                  </div>
                </th>

                {/* 2. N (Nivel: 1-9 / 9-1) */}
                <th 
                  onClick={() => handleSortToggle('nivel')}
                  className="py-2 px-0.5 text-center w-[5%] sm:w-[6%] cursor-pointer hover:bg-zinc-200/80 transition-colors select-none"
                  title="Ordenar Nivel: menor a mayor / mayor a menor"
                >
                  <div className="flex items-center justify-center gap-0.5">
                    <span>N</span>
                    {sortField === 'nivel' && (
                      sortDirection === 'asc' ? (
                        <ArrowUp className="w-2 h-2 text-blue-600 stroke-[3]" />
                      ) : (
                        <ArrowDown className="w-2 h-2 text-blue-600 stroke-[3]" />
                      )
                    )}
                  </div>
                </th>

                {/* 3. C (Columna: 01-99 / 99-01) */}
                <th 
                  onClick={() => handleSortToggle('columna')}
                  className="py-2 px-0.5 text-center w-[7%] sm:w-[7%] cursor-pointer hover:bg-zinc-200/80 transition-colors select-none"
                  title="Ordenar Columna: menor a mayor / mayor a menor"
                >
                  <div className="flex items-center justify-center gap-0.5">
                    <span>C</span>
                    {sortField === 'columna' && (
                      sortDirection === 'asc' ? (
                        <ArrowUp className="w-2 h-2 text-blue-600 stroke-[3]" />
                      ) : (
                        <ArrowDown className="w-2 h-2 text-blue-600 stroke-[3]" />
                      )
                    )}
                  </div>
                </th>

                {/* 4. E (Estantería: A-Z / Z-A) */}
                <th 
                  onClick={() => handleSortToggle('estanteria')}
                  className="py-2 px-0.5 text-center w-[5%] sm:w-[6%] cursor-pointer hover:bg-zinc-200/80 transition-colors select-none"
                  title="Ordenar Estantería: A-Z / Z-A"
                >
                  <div className="flex items-center justify-center gap-0.5">
                    <span>E</span>
                    {sortField === 'estanteria' && (
                      sortDirection === 'asc' ? (
                        <ArrowUp className="w-2 h-2 text-blue-600 stroke-[3]" />
                      ) : (
                        <ArrowDown className="w-2 h-2 text-blue-600 stroke-[3]" />
                      )
                    )}
                  </div>
                </th>

                {/* 5. P (Posición: 1-9 / 9-1) */}
                <th 
                  onClick={() => handleSortToggle('posicion')}
                  className="py-2 px-0.5 text-center w-[5%] sm:w-[6%] cursor-pointer hover:bg-zinc-200/80 transition-colors select-none"
                  title="Ordenar Posición: menor a mayor / mayor a menor"
                >
                  <div className="flex items-center justify-center gap-0.5">
                    <span>P</span>
                    {sortField === 'posicion' && (
                      sortDirection === 'asc' ? (
                        <ArrowUp className="w-2 h-2 text-blue-600 stroke-[3]" />
                      ) : (
                        <ArrowDown className="w-2 h-2 text-blue-600 stroke-[3]" />
                      )
                    )}
                  </div>
                </th>

                {/* 6. Conteo / Estado */}
                <th 
                  onClick={() => handleSortToggle('status')}
                  className="py-2 px-1 sm:px-3 text-right w-[44%] sm:w-[51%] cursor-pointer hover:bg-zinc-200/80 transition-colors select-none"
                  title="Ordenar por estado"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Conteo</span>
                    {sortField === 'status' ? (
                      sortDirection === 'asc' ? (
                        <ArrowUp className="w-2.5 h-2.5 text-blue-600 stroke-[3]" />
                      ) : (
                        <ArrowDown className="w-2.5 h-2.5 text-blue-600 stroke-[3]" />
                      )
                    ) : (
                      <ArrowUpDown className="w-2.5 h-2.5 text-zinc-400 opacity-60" />
                    )}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {filteredLocations.map((item, idx) => {
                const isCounted = item.status !== 'pendiente';

                return (
                  <tr 
                    key={item.id} 
                    className={`transition-colors ${
                      item.status === 'vacia' 
                        ? 'bg-amber-50/70' 
                        : item.status === 'llena' 
                        ? 'bg-blue-50/70' 
                        : idx % 2 === 0 ? 'bg-white' : 'bg-zinc-50/50'
                    }`}
                  >
                    {/* 1. Código de Ubicación COMPLETO sin cortes (ej. N1C01EBP1) */}
                    <td className="py-2 px-1.5 sm:px-3 font-mono font-black text-xs sm:text-sm text-zinc-950 whitespace-nowrap tracking-tight">
                      {item.code}
                    </td>

                    {/* 2. Nivel */}
                    <td className="py-2 px-0.5 text-center font-mono text-3xs sm:text-xs text-zinc-700">
                      {item.nivel}
                    </td>

                    {/* 3. Columna */}
                    <td className="py-2 px-0.5 text-center font-mono text-3xs sm:text-xs text-zinc-700">
                      {item.columna}
                    </td>

                    {/* 4. Estantería */}
                    <td className="py-2 px-0.5 text-center font-mono text-3xs sm:text-xs font-bold text-blue-700">
                      {item.estanteria}
                    </td>

                    {/* 5. Posición */}
                    <td className="py-2 px-0.5 text-center font-mono text-3xs sm:text-xs text-zinc-700">
                      {item.posicion}
                    </td>

                    {/* 6. Botones de Acción (Vacía y Llena) directamente en la misma pantalla */}
                    <td className="py-2 px-1 sm:px-3 text-right">
                      <div className="flex items-center justify-end gap-1 sm:gap-1.5">
                        {/* Botón Vacía */}
                        <button
                          onClick={() => handleMark(item.id, 'vacia')}
                          className={`flex-1 sm:flex-initial py-1.5 px-1.5 sm:px-2.5 rounded-lg text-2xs sm:text-xs font-bold transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-0.5 shadow-2xs whitespace-nowrap ${
                            item.status === 'vacia'
                              ? 'bg-amber-600 text-white ring-1 ring-amber-500'
                              : 'bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-300'
                          }`}
                        >
                          {item.status === 'vacia' && <Check className="w-3 h-3 stroke-[3]" />}
                          <span>Vacía</span>
                        </button>

                        {/* Botón Llena */}
                        <button
                          onClick={() => handleMark(item.id, 'llena')}
                          className={`flex-1 sm:flex-initial py-1.5 px-1.5 sm:px-2.5 rounded-lg text-2xs sm:text-xs font-bold transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-0.5 shadow-2xs whitespace-nowrap ${
                            item.status === 'llena'
                              ? 'bg-blue-600 text-white ring-1 ring-blue-500'
                              : 'bg-blue-50 hover:bg-blue-100 text-blue-950 border border-blue-300'
                          }`}
                        >
                          {item.status === 'llena' && <Check className="w-3 h-3 stroke-[3]" />}
                          <span>Llena</span>
                        </button>

                        {/* Restablecer (Deshacer) */}
                        {isCounted && (
                          <button
                            onClick={() => handleMark(item.id, 'pendiente')}
                            className="p-1 text-zinc-400 hover:text-zinc-700 rounded active:scale-90"
                            title="Restablecer a pendiente"
                          >
                            <RotateCcw className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Pie de tabla */}
          <div className="p-2 bg-zinc-50 border-t border-zinc-200 flex items-center justify-between text-3xs text-zinc-500 px-3">
            <span>
              Mostrando <strong>{filteredLocations.length}</strong> de <strong>{locations.length}</strong>
            </span>
            <span className="text-emerald-700 font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              En vivo
            </span>
          </div>
        </div>
      )}

      {/* Botón para ir a Exportar a Excel */}
      <div className="pt-1">
        <button
          onClick={onGoToResults}
          className="w-full py-2.5 px-4 bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs rounded-xl transition-colors shadow-xs flex items-center justify-center gap-2 cursor-pointer active:scale-98"
        >
          <span>Ir a Exportar Resultados a Excel (HU-04)</span>
          <span>→</span>
        </button>
      </div>
    </div>
  );
}

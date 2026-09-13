import React, { useState, useMemo } from 'react';
import { 
  FileSpreadsheet, 
  FileText, 
  Download, 
  CheckCircle2, 
  Filter, 
  Search, 
  Copy, 
  Check, 
  BarChart3, 
  Smartphone,
  SlidersHorizontal
} from 'lucide-react';
import { LocationItem, LocationStatus } from '../types';
import { exportToExcel, exportToCsv } from '../utils/excel';

interface Props {
  locations: LocationItem[];
  onOpenSyncModal: () => void;
  onGoToCount: () => void;
}

export function ExportCompareTab({ locations, onOpenSyncModal, onGoToCount }: Props) {
  // Filters before exporting (HU-04 RF & CA)
  const [filterNivel, setFilterNivel] = useState<string>('todos');
  const [filterColumna, setFilterColumna] = useState<string>('todos');
  const [filterEstanteria, setFilterEstanteria] = useState<string>('todos');
  const [filterPosicion, setFilterPosicion] = useState<string>('todos');
  const [filterStatus, setFilterStatus] = useState<'todos' | LocationStatus>('todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);

  // Extract distinct filter values
  const niveles = useMemo(() => {
    return Array.from(new Set(locations.map(l => l.nivel))).sort((a, b) => Number(a) - Number(b));
  }, [locations]);

  const columnas = useMemo(() => {
    return Array.from(new Set(locations.map(l => l.columna))).sort((a, b) => Number(a) - Number(b));
  }, [locations]);

  const estanterias = useMemo(() => {
    return Array.from(new Set(locations.map(l => l.estanteria))).sort((a, b) => Number(a) - Number(b));
  }, [locations]);

  const posiciones = useMemo(() => {
    return Array.from(new Set(locations.map(l => l.posicion))).sort((a, b) => Number(a) - Number(b));
  }, [locations]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    return locations.filter(l => {
      if (filterNivel !== 'todos' && l.nivel !== filterNivel) return false;
      if (filterColumna !== 'todos' && l.columna !== filterColumna) return false;
      if (filterEstanteria !== 'todos' && l.estanteria !== filterEstanteria) return false;
      if (filterPosicion !== 'todos' && l.posicion !== filterPosicion) return false;
      if (filterStatus !== 'todos' && l.status !== filterStatus) return false;
      if (searchQuery.trim() && !l.code.toLowerCase().includes(searchQuery.trim().toLowerCase())) return false;
      return true;
    });
  }, [locations, filterNivel, filterColumna, filterEstanteria, filterPosicion, filterStatus, searchQuery]);

  // Statistics
  const total = locations.length;
  const counted = locations.filter(l => l.status !== 'pendiente').length;
  const pending = total - counted;
  const emptyCount = locations.filter(l => l.status === 'vacia').length;
  const fullCount = locations.filter(l => l.status === 'llena').length;
  const percent = total > 0 ? Math.round((counted / total) * 100) : 0;

  // HU-04: Export Excel respecting filters
  const handleDownloadExcelFiltered = () => {
    const timestamp = new Date().toISOString().slice(0, 10);
    exportToExcel(filteredRows, `Conteo_Ubicaciones_Filtrado_${timestamp}.xlsx`);
  };

  // HU-04: Export all
  const handleDownloadExcelAll = () => {
    const timestamp = new Date().toISOString().slice(0, 10);
    exportToExcel(locations, `Conteo_Ubicaciones_Total_${timestamp}.xlsx`);
  };

  // HU-04: Export CSV respecting filters
  const handleDownloadCsvFiltered = () => {
    const timestamp = new Date().toISOString().slice(0, 10);
    exportToCsv(filteredRows, `Conteo_Ubicaciones_Filtrado_${timestamp}.csv`);
  };

  const handleCopySummary = () => {
    const summary = `📊 RESUMEN CONTEO FÍSICO DE BODEGA
Fecha: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}
Total Ubicaciones: ${total}
Auditadas: ${counted} (${percent}%)
Pendientes: ${pending}
-------------------------------
🟢 LLENAS: ${fullCount}
🟡 VACÍAS: ${emptyCount}
-------------------------------
Filtro activo en pantalla: ${filteredRows.length} ubicaciones`;

    navigator.clipboard.writeText(summary).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto" id="epic-3-workarea">
      {/* Header Epic 3: HU-04 */}
      <div className="bg-white border border-zinc-200 rounded-xl p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-xs font-semibold mb-2">
              <BarChart3 className="w-3.5 h-3.5" />
              Épica 3: Exportación de Resultados
            </div>
            <h2 className="text-xl font-bold text-zinc-900 tracking-tight">
              HU-04: Descargar Resultado del Conteo en Excel / CSV
            </h2>
            <p className="text-sm text-zinc-500 mt-1 max-w-2xl">
              Descarga con un solo clic el archivo en formato <strong>.xlsx</strong> o <strong>.csv</strong> con el código completo y el estado del conteo. Puedes aplicar filtros antes de exportar (Criterio de Aceptación HU-04).
            </p>
          </div>

          {/* Quick Export Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleCopySummary}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-zinc-700 bg-white hover:bg-zinc-50 border border-zinc-300 rounded-lg transition-colors cursor-pointer shadow-2xs"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copiado' : 'Copiar Resumen'}</span>
            </button>

            <button
              onClick={handleDownloadCsvFiltered}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors cursor-pointer shadow-2xs"
              title="Descargar archivo plano CSV respetando filtros aplicados"
            >
              <FileText className="w-3.5 h-3.5 text-zinc-600" />
              <span>Descargar CSV ({filteredRows.length})</span>
            </button>

            <button
              onClick={handleDownloadExcelFiltered}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors cursor-pointer shadow-2xs"
              title="Descargar archivo Excel .xlsx con un clic (HU-04)"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Descargar Excel ({filteredRows.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-2xs">
          <div className="text-3xs font-bold uppercase tracking-wider text-zinc-400 mb-1">
            Total Ubicaciones
          </div>
          <div className="text-2xl font-black text-zinc-900">{total}</div>
          <div className="text-2xs text-zinc-500 mt-1">Registros en el sistema</div>
        </div>

        <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-2xs">
          <div className="text-3xs font-bold uppercase tracking-wider text-zinc-400 mb-1">
            Auditadas / Contadas
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-600">{counted}</span>
            <span className="text-xs font-bold text-emerald-700">({percent}%)</span>
          </div>
          <div className="text-2xs text-zinc-500 mt-1">{pending} pendientes</div>
        </div>

        <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-2xs">
          <div className="text-3xs font-bold uppercase tracking-wider text-blue-600 mb-1">
            Ubicaciones Llenas
          </div>
          <div className="text-2xl font-black text-blue-700">{fullCount}</div>
          <div className="text-2xs text-zinc-500 mt-1">Con mercancía física</div>
        </div>

        <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-2xs">
          <div className="text-3xs font-bold uppercase tracking-wider text-amber-600 mb-1">
            Ubicaciones Vacías
          </div>
          <div className="text-2xl font-black text-amber-600">{emptyCount}</div>
          <div className="text-2xs text-zinc-500 mt-1">Disponibles sin stock</div>
        </div>
      </div>

      {/* Filter and Table Card (HU-04 CA: respeta filtros aplicados) */}
      <div className="bg-white border border-zinc-200 rounded-xl shadow-xs overflow-hidden">
        {/* Filter controls */}
        <div className="p-4 border-b border-zinc-200 space-y-3 bg-zinc-50/50">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-800">
              <SlidersHorizontal className="w-4 h-4 text-emerald-600" />
              <span>Filtrar datos antes de descargar (HU-04 RF):</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleDownloadExcelAll}
                className="text-2xs text-zinc-600 hover:text-zinc-900 underline font-medium"
              >
                Descargar todo sin filtros ({locations.length})
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
            {/* Nivel */}
            <div>
              <label className="text-3xs font-bold text-zinc-400 uppercase block mb-0.5">Nivel</label>
              <select
                value={filterNivel}
                onChange={(e) => setFilterNivel(e.target.value)}
                className="w-full text-xs font-semibold p-1.5 bg-white border border-zinc-300 rounded-lg text-zinc-700"
              >
                <option value="todos">Todos</option>
                {niveles.map(n => <option key={n} value={n}>N{n}</option>)}
              </select>
            </div>

            {/* Columna */}
            <div>
              <label className="text-3xs font-bold text-zinc-400 uppercase block mb-0.5">Columna</label>
              <select
                value={filterColumna}
                onChange={(e) => setFilterColumna(e.target.value)}
                className="w-full text-xs font-semibold p-1.5 bg-white border border-zinc-300 rounded-lg text-zinc-700"
              >
                <option value="todos">Todas</option>
                {columnas.map(c => <option key={c} value={c}>C{c}</option>)}
              </select>
            </div>

            {/* Estantería */}
            <div>
              <label className="text-3xs font-bold text-zinc-400 uppercase block mb-0.5">Estantería</label>
              <select
                value={filterEstanteria}
                onChange={(e) => setFilterEstanteria(e.target.value)}
                className="w-full text-xs font-semibold p-1.5 bg-white border border-zinc-300 rounded-lg text-zinc-700"
              >
                <option value="todos">Todas</option>
                {estanterias.map(e => <option key={e} value={e}>E{e}</option>)}
              </select>
            </div>

            {/* Posición */}
            <div>
              <label className="text-3xs font-bold text-zinc-400 uppercase block mb-0.5">Posición</label>
              <select
                value={filterPosicion}
                onChange={(e) => setFilterPosicion(e.target.value)}
                className="w-full text-xs font-semibold p-1.5 bg-white border border-zinc-300 rounded-lg text-zinc-700"
              >
                <option value="todos">Todas</option>
                {posiciones.map(p => <option key={p} value={p}>P{p}</option>)}
              </select>
            </div>

            {/* Estado */}
            <div>
              <label className="text-3xs font-bold text-zinc-400 uppercase block mb-0.5">Estado</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="w-full text-xs font-semibold p-1.5 bg-white border border-zinc-300 rounded-lg text-zinc-700"
              >
                <option value="todos">Todos</option>
                <option value="llena">Llenas</option>
                <option value="vacia">Vacías</option>
                <option value="pendiente">Pendientes</option>
              </select>
            </div>

            {/* Búsqueda rápida */}
            <div>
              <label className="text-3xs font-bold text-zinc-400 uppercase block mb-0.5">Búsqueda</label>
              <input
                type="text"
                placeholder="Código..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs p-1.5 bg-white border border-zinc-300 rounded-lg text-zinc-700"
              />
            </div>
          </div>
        </div>

        {/* Results preview table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-zinc-600">
            <thead className="bg-zinc-50 text-zinc-500 uppercase tracking-wider font-semibold border-b border-zinc-200">
              <tr>
                <th className="py-2.5 px-4">Código Ubicación</th>
                <th className="py-2.5 px-3">Nivel</th>
                <th className="py-2.5 px-3">Columna</th>
                <th className="py-2.5 px-3">Estantería</th>
                <th className="py-2.5 px-3">Posición</th>
                <th className="py-2.5 px-4">Estado Físico</th>
                <th className="py-2.5 px-4">Fecha/Hora Conteo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 font-mono">
              {filteredRows.map((item) => (
                <tr key={item.id} className="hover:bg-zinc-50/70 transition-colors">
                  <td className="py-2.5 px-4 font-bold text-zinc-900 font-mono">
                    {item.code}
                  </td>
                  <td className="py-2.5 px-3 text-zinc-700">N{item.nivel}</td>
                  <td className="py-2.5 px-3 text-zinc-700">C{item.columna}</td>
                  <td className="py-2.5 px-3 text-zinc-700">E{item.estanteria}</td>
                  <td className="py-2.5 px-3 text-zinc-700">P{item.posicion}</td>
                  <td className="py-2.5 px-4 font-sans">
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
                  <td className="py-2.5 px-4 text-2xs text-zinc-400 font-sans">
                    {item.countedAt ? new Date(item.countedAt).toLocaleString() : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer info & export action bar */}
        <div className="p-4 bg-zinc-50 border-t border-zinc-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <span className="text-zinc-600">
            Mostrando <strong>{filteredRows.length}</strong> de <strong>{locations.length}</strong> registros listos para exportar.
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadExcelFiltered}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Descargar este reporte en Excel (.xlsx)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

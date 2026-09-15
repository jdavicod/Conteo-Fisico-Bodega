import { LocationItem } from '../types';
import { parseCombinedCode } from './parser';

const STORAGE_KEY = 'bodega_conteo_ubicaciones_v3';

export const SAMPLE_LOCATIONS: LocationItem[] = [
  { id: '1', code: 'N1C01EAP1', nivel: '1', columna: '01', estanteria: 'A', posicion: '1', status: 'pendiente' },
  { id: '2', code: 'N1C01EAP2', nivel: '1', columna: '01', estanteria: 'A', posicion: '2', status: 'pendiente' },
  { id: '3', code: 'N1C01EBP1', nivel: '1', columna: '01', estanteria: 'B', posicion: '1', status: 'pendiente' },
  { id: '4', code: 'N1C02EAP1', nivel: '1', columna: '02', estanteria: 'A', posicion: '1', status: 'pendiente' },
  { id: '5', code: 'N1C02EAP2', nivel: '1', columna: '02', estanteria: 'A', posicion: '2', status: 'pendiente' },
  { id: '6', code: 'N2C01EAP1', nivel: '2', columna: '01', estanteria: 'A', posicion: '1', status: 'pendiente' },
  { id: '7', code: 'N2C01EAP2', nivel: '2', columna: '01', estanteria: 'A', posicion: '2', status: 'pendiente' },
  { id: '8', code: 'N2C02EAP1', nivel: '2', columna: '02', estanteria: 'A', posicion: '1', status: 'pendiente' },
  { id: '9', code: 'N2C02EBP1', nivel: '2', columna: '02', estanteria: 'B', posicion: '1', status: 'pendiente' },
  { id: '10', code: 'N3C01EAP1', nivel: '3', columna: '01', estanteria: 'A', posicion: '1', status: 'pendiente' },
  { id: '11', code: 'N3C01EAP2', nivel: '3', columna: '01', estanteria: 'A', posicion: '2', status: 'pendiente' },
  { id: '12', code: 'N3C02EBP1', nivel: '3', columna: '02', estanteria: 'B', posicion: '1', status: 'pendiente' },
];

export function loadLocations(): LocationItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // ignore
  }
  return SAMPLE_LOCATIONS;
}

export function saveLocations(items: LocationItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (err) {
    console.error('Error saving to localStorage', err);
  }
}

export function clearLocations(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Genera 1.000 ubicaciones válidas exactas para pruebas de carga y escalabilidad PC ↔ Celular
 * Distribución: Niveles 1-5, Columnas 01-20, Estanterías A-E, Posiciones 1-2 (5 * 20 * 5 * 2 = 1.000)
 */
export function generate1000SampleLocations(): LocationItem[] {
  const items: LocationItem[] = [];
  const estanterias = ['A', 'B', 'C', 'D', 'E'];
  let count = 0;
  for (let n = 1; n <= 5; n++) {
    for (let c = 1; c <= 20; c++) {
      const colStr = c < 10 ? `0${c}` : `${c}`;
      for (const e of estanterias) {
        for (let p = 1; p <= 2; p++) {
          count++;
          const code = `N${n}C${colStr}E${e}P${p}`;
          items.push({
            id: `loc-gen-${count}`,
            code,
            nivel: `${n}`,
            columna: colStr,
            estanteria: e,
            posicion: `${p}`,
            status: 'pendiente',
          });
        }
      }
    }
  }
  return items;
}

// Empaquetado compacto para pasar entre PC y móvil vía QR sin backend
export function encodeLocationsToShareString(items: LocationItem[]): string {
  try {
    const mini = items.map(it => [
      it.code,
      it.status === 'llena' ? 1 : it.status === 'vacia' ? 0 : 2
    ]);
    return btoa(encodeURIComponent(JSON.stringify(mini)));
  } catch {
    return '';
  }
}

export function decodeLocationsFromShareString(encoded: string): LocationItem[] | null {
  try {
    const jsonStr = decodeURIComponent(atob(encoded));
    const mini = JSON.parse(jsonStr);
    if (!Array.isArray(mini)) return null;

    return mini.map((arr, idx) => {
      const [code, statNum] = arr;
      const status = statNum === 1 ? 'llena' : statNum === 0 ? 'vacia' : 'pendiente';
      const parsed = parseCombinedCode(String(code));
      return {
        id: `shared-${Date.now()}-${idx}`,
        code: String(code),
        nivel: parsed ? parsed.nivel : '1',
        columna: parsed ? parsed.columna : '01',
        estanteria: parsed ? parsed.estanteria : 'A',
        posicion: parsed ? parsed.posicion : '1',
        status,
        countedAt: status !== 'pendiente' ? new Date().toISOString() : undefined,
      };
    });
  } catch {
    return null;
  }
}

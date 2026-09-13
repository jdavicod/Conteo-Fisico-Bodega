export type LocationStatus = 'pendiente' | 'vacia' | 'llena';

export interface LocationItem {
  id: string;
  code: string;        // Ej: "N1C01E1P1"
  nivel: string;       // Ej: "1" o "N1"
  columna: string;     // Ej: "01" o "C01"
  estanteria: string;  // Ej: "1" o "E1"
  posicion: string;    // Ej: "1" o "P1"
  status: LocationStatus; // 'pendiente' | 'vacia' | 'llena'
  countedAt?: string;  // ISO timestamp de cuándo se marcó
}

export interface ParseError {
  row: number;
  value: string;
  reason: string;
}

export interface FilterCriteria {
  nivel: string;
  columna: string;
  estanteria: string;
  posicion: string;
  status: 'todas' | LocationStatus;
  search: string;
}

export type ActiveTab = 'cargar' | 'contar' | 'exportar';

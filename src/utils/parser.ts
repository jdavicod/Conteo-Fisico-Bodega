import * as XLSX from 'xlsx';
import { LocationItem, LocationStatus, ParseError } from '../types';

// Regex que valida y extrae N#C##E(letra)P#
// Admite variaciones de mayúsculas/minúsculas y separadores opcionales (guion, espacio, punto)
// Estantería es formato letra (ej: A, B, C, etc. o EA, EB)
export const COMBINED_PATTERN_REGEX = /^N\s*(\d+)\s*[-_./\s]?\s*C\s*(\d+)\s*[-_./\s]?\s*E\s*([A-Za-z0-9]+)\s*[-_./\s]?\s*P\s*(\d+)$/i;

export interface ParseResult {
  validLocations: LocationItem[];
  errors: ParseError[];
  formatDetected: '4_columnas' | '1_columna_combinada' | 'desconocido';
}

/**
 * Normaliza y formatea el código combinado canónico: ej: N1C01EAP1
 */
export function formatCode(nivel: string, columna: string, estanteria: string, posicion: string): string {
  // Limpiar caracteres "N", "C", "E", "P" si vinieron incluidos
  const cleanN = String(nivel).replace(/^N/i, '').trim();
  const cleanC = String(columna).replace(/^C/i, '').trim();
  const cleanE = String(estanteria).replace(/^E/i, '').trim().toUpperCase();
  const cleanP = String(posicion).replace(/^P/i, '').trim();

  // Asegurar formato C con 2 dígitos como especifica el backlog: N#C##E#P#
  const padC = cleanC.length === 1 ? cleanC.padStart(2, '0') : cleanC;

  return `N${cleanN}C${padC}E${cleanE}P${cleanP}`;
}

/**
 * Intenta parsear un código único combinado (ej: "N1C01EAP1" o "n2 c05 eB p2")
 */
export function parseCombinedCode(codeStr: string): { nivel: string; columna: string; estanteria: string; posicion: string } | null {
  const match = codeStr.trim().match(COMBINED_PATTERN_REGEX);
  if (!match) return null;

  return {
    nivel: match[1],
    columna: match[2].length === 1 ? match[2].padStart(2, '0') : match[2],
    estanteria: match[3].toUpperCase(),
    posicion: match[4],
  };
}

/**
 * Procesa un archivo Excel o CSV que puede venir con 4 columnas o 1 columna
 */
export function parseFileContents(fileBuffer: ArrayBuffer): ParseResult {
  const workbook = XLSX.read(fileBuffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('El archivo no contiene hojas de cálculo.');
  }

  const sheet = workbook.Sheets[firstSheetName];
  const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  if (!rawRows || rawRows.length === 0) {
    throw new Error('El archivo está vacío.');
  }

  return processRawMatrix(rawRows);
}

/**
 * Procesa texto pegado línea por línea
 */
export function parsePastedLines(text: string): ParseResult {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) {
    throw new Error('El texto ingresado está vacío.');
  }

  const rawRows = lines.map(line => {
    if (line.includes('\t')) return line.split('\t').map(c => c.trim());
    if (line.includes(';')) return line.split(';').map(c => c.trim());
    if (line.includes(',')) return line.split(',').map(c => c.trim());
    return [line];
  });

  return processRawMatrix(rawRows);
}

function processRawMatrix(rows: any[][]): ParseResult {
  const validLocations: LocationItem[] = [];
  const errors: ParseError[] = [];
  const seenCodes = new Set<string>();

  let headerRowIndex = -1;
  let nivelCol = -1;
  let columnaCol = -1;
  let estanteriaCol = -1;
  let posicionCol = -1;
  let combinedCol = -1;

  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    const row = rows[i];
    if (!row || !Array.isArray(row)) continue;

    const rowNormalized = row.map(cell => String(cell || '').toLowerCase().trim());

    // Buscar si existen las 4 columnas
    const nIdx = rowNormalized.findIndex(c => c === 'nivel' || c === 'n' || c.startsWith('nivel'));
    const cIdx = rowNormalized.findIndex(c => c === 'columna' || c === 'c' || c.startsWith('columna') || c === 'col');
    const eIdx = rowNormalized.findIndex(c => c === 'estanteria' || c === 'estantería' || c === 'e' || c.startsWith('estan'));
    const pIdx = rowNormalized.findIndex(c => c === 'posicion' || c === 'posición' || c === 'p' || c.startsWith('posic'));

    if (nIdx !== -1 && cIdx !== -1 && eIdx !== -1 && pIdx !== -1) {
      headerRowIndex = i;
      nivelCol = nIdx;
      columnaCol = cIdx;
      estanteriaCol = eIdx;
      posicionCol = pIdx;
      break;
    }

    // Buscar columna combinada
    const combIdx = rowNormalized.findIndex(c => 
      c.includes('ubicacion') || c.includes('ubicación') || c.includes('codigo') || c.includes('código') || c.includes('posicion')
    );
    if (combIdx !== -1) {
      headerRowIndex = i;
      combinedCol = combIdx;
      break;
    }
  }

  const is4Columns = nivelCol !== -1 && columnaCol !== -1 && estanteriaCol !== -1 && posicionCol !== -1;
  const startIndex = headerRowIndex !== -1 ? headerRowIndex + 1 : 0;
  let formatDetected: '4_columnas' | '1_columna_combinada' | 'desconocido' = 
    is4Columns ? '4_columnas' : '1_columna_combinada';

  for (let r = startIndex; r < rows.length; r++) {
    const row = rows[r];
    if (!row || !Array.isArray(row) || row.length === 0) continue;

    // Verificar si la fila está totalmente vacía
    const hasValues = row.some(cell => cell !== undefined && cell !== null && String(cell).trim() !== '');
    if (!hasValues) continue;

    const rowNum = r + 1;

    if (is4Columns) {
      // Formato 4 columnas
      const rawN = String(row[nivelCol] ?? '').trim();
      const rawC = String(row[columnaCol] ?? '').trim();
      const rawE = String(row[estanteriaCol] ?? '').trim();
      const rawP = String(row[posicionCol] ?? '').trim();

      if (!rawN || !rawC || !rawE || !rawP) {
        errors.push({
          row: rowNum,
          value: `Nivel: "${rawN}", Columna: "${rawC}", Estantería: "${rawE}", Posición: "${rawP}"`,
          reason: 'Faltan uno o más campos obligatorios de las 4 columnas (Nivel, Columna, Estantería, Posición).',
        });
        continue;
      }

      const cleanN = rawN.replace(/^N/i, '').trim();
      const cleanC = rawC.replace(/^C/i, '').trim();
      const cleanE = rawE.replace(/^E/i, '').trim().toUpperCase();
      const cleanP = rawP.replace(/^P/i, '').trim();

      // Nivel, Columna y Posición deben ser numéricos; Estantería es formato letra (o alfanumérico)
      if (!/^\d+$/.test(cleanN) || !/^\d+$/.test(cleanC) || !/^[A-Za-z0-9]+$/.test(cleanE) || !/^\d+$/.test(cleanP)) {
        errors.push({
          row: rowNum,
          value: `N:${rawN}, C:${rawC}, E:${rawE}, P:${rawP}`,
          reason: 'Nivel, Columna y Posición deben ser números. La Estantería debe ser letra (ej: A, B, C).',
        });
        continue;
      }

      const code = formatCode(cleanN, cleanC, cleanE, cleanP);
      if (seenCodes.has(code)) {
        continue;
      }
      seenCodes.add(code);

      validLocations.push({
        id: `loc-${Date.now()}-${r}-${Math.random().toString(36).substring(2, 6)}`,
        code,
        nivel: cleanN,
        columna: cleanC.length === 1 ? cleanC.padStart(2, '0') : cleanC,
        estanteria: cleanE,
        posicion: cleanP,
        status: 'pendiente',
      });
    } else {
      // Intento de detectar 4 columnas sin encabezados
      if (row.length >= 4 && /^\d+$/.test(String(row[0]).trim()) && /^\d+$/.test(String(row[1]).trim())) {
        formatDetected = '4_columnas';
        const rawN = String(row[0]).trim();
        const rawC = String(row[1]).trim();
        const rawE = String(row[2]).trim().toUpperCase();
        const rawP = String(row[3]).trim();
        const code = formatCode(rawN, rawC, rawE, rawP);

        if (!seenCodes.has(code)) {
          seenCodes.add(code);
          validLocations.push({
            id: `loc-${Date.now()}-${r}-${Math.random().toString(36).substring(2, 6)}`,
            code,
            nivel: rawN,
            columna: rawC.length === 1 ? rawC.padStart(2, '0') : rawC,
            estanteria: rawE,
            posicion: rawP,
            status: 'pendiente',
          });
        }
        continue;
      }

      // Columna combinada
      const colIdxToUse = combinedCol !== -1 ? combinedCol : 0;
      const rawValue = String(row[colIdxToUse] ?? '').trim();

      if (!rawValue) continue;

      const parsed = parseCombinedCode(rawValue);
      if (!parsed) {
        errors.push({
          row: rowNum,
          value: rawValue,
          reason: `No cumple el patrón N#C##E(letra)P# (Ej: "N1C01EAP1").`,
        });
        continue;
      }

      const code = formatCode(parsed.nivel, parsed.columna, parsed.estanteria, parsed.posicion);
      if (seenCodes.has(code)) {
        continue;
      }
      seenCodes.add(code);

      validLocations.push({
        id: `loc-${Date.now()}-${r}-${Math.random().toString(36).substring(2, 6)}`,
        code,
        nivel: parsed.nivel,
        columna: parsed.columna,
        estanteria: parsed.estanteria,
        posicion: parsed.posicion,
        status: 'pendiente',
      });
    }
  }

  return { validLocations, errors, formatDetected };
}

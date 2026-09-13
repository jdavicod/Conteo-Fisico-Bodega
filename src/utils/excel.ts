import * as XLSX from 'xlsx';
import { LocationItem } from '../types';

export function exportToExcel(items: LocationItem[], fileName: string = 'Resultado_Conteo_Ubicaciones.xlsx') {
  const rows = items.map(item => {
    let estadoTexto = 'PENDIENTE';
    if (item.status === 'vacia') estadoTexto = 'VACÍA';
    if (item.status === 'llena') estadoTexto = 'LLENA';

    return {
      'Código Ubicación': item.code,
      'Nivel': item.nivel,
      'Columna': item.columna,
      'Estantería (Letra)': item.estanteria,
      'Posición': item.posicion,
      'Estado Conteo': estadoTexto,
      'Fecha/Hora Conteo': item.countedAt ? new Date(item.countedAt).toLocaleString() : '',
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet['!cols'] = [
    { wch: 18 }, // Código Ubicación
    { wch: 10 }, // Nivel
    { wch: 12 }, // Columna
    { wch: 16 }, // Estantería
    { wch: 12 }, // Posición
    { wch: 16 }, // Estado Conteo
    { wch: 22 }, // Fecha/Hora Conteo
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Conteo Físico');
  XLSX.writeFile(workbook, fileName);
}

export function exportToCsv(items: LocationItem[], fileName: string = 'Resultado_Conteo_Ubicaciones.csv') {
  const headers = ['Codigo_Ubicacion', 'Nivel', 'Columna', 'Estanteria', 'Posicion', 'Estado', 'Fecha_Hora'];
  const csvLines = [headers.join(',')];

  items.forEach(item => {
    let estadoTexto = 'PENDIENTE';
    if (item.status === 'vacia') estadoTexto = 'VACIA';
    if (item.status === 'llena') estadoTexto = 'LLENA';

    const row = [
      `"${item.code}"`,
      `"${item.nivel}"`,
      `"${item.columna}"`,
      `"${item.estanteria}"`,
      `"${item.posicion}"`,
      `"${estadoTexto}"`,
      `"${item.countedAt ? new Date(item.countedAt).toISOString() : ''}"`,
    ];
    csvLines.push(row.join(','));
  });

  const blob = new Blob([csvLines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Plantilla con 4 columnas separadas (Estantería como Letra)
export function downloadTemplate4Columns() {
  const data = [
    { Nivel: '1', Columna: '01', Estanteria: 'A', Posicion: '1' },
    { Nivel: '1', Columna: '01', Estanteria: 'A', Posicion: '2' },
    { Nivel: '1', Columna: '02', Estanteria: 'A', Posicion: '1' },
    { Nivel: '2', Columna: '01', Estanteria: 'A', Posicion: '1' },
    { Nivel: '2', Columna: '01', Estanteria: 'B', Posicion: '1' },
    { Nivel: '2', Columna: '02', Estanteria: 'B', Posicion: '2' },
  ];
  const ws = XLSX.utils.json_to_sheet(data);
  ws['!cols'] = [{ wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 12 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Plantilla 4 Columnas');
  XLSX.writeFile(wb, 'Plantilla_4_Columnas.xlsx');
}

// Plantilla con 1 columna combinada N#C##E(letra)P#
export function downloadTemplate1Column() {
  const data = [
    { Ubicacion: 'N1C01EAP1' },
    { Ubicacion: 'N1C01EAP2' },
    { Ubicacion: 'N1C02EAP1' },
    { Ubicacion: 'N2C01EAP1' },
    { Ubicacion: 'N2C01EBP1' },
    { Ubicacion: 'N2C02EBP2' },
  ];
  const ws = XLSX.utils.json_to_sheet(data);
  ws['!cols'] = [{ wch: 20 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Plantilla Columna Unica');
  XLSX.writeFile(wb, 'Plantilla_1_Columna_Combinada.xlsx');
}

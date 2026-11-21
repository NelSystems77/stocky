import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { jsPDF } from 'jspdf';
import { MARCA, type DatosReporte, type DatosResumen } from './tipos';

const AZUL_NOCHE: [number, number, number] = [11, 18, 32];
const TURQUESA: [number, number, number] = [45, 212, 191];
const GRIS_CLARO: [number, number, number] = [243, 244, 246];
/** Gris de las filas resaltadas (con diferencia): se distingue del rayado y no gasta los colores de lo urgente. */
const GRIS_RESALTE: [number, number, number] = [209, 213, 219];

/** Genera el PDF en el dispositivo (jspdf se carga solo cuando se pide un reporte). */
export async function generarPdf(d: DatosReporte): Promise<Uint8Array> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const horizontal = d.columnas.length > 5;
  const doc = new jsPDF({ orientation: horizontal ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' });
  const ancho = doc.internal.pageSize.getWidth();
  const alto = doc.internal.pageSize.getHeight();
  const margen = 12;

  encabezadoMarca(doc, d, ancho, margen);

  // Título y detalle
  doc.setTextColor(...AZUL_NOCHE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(d.titulo, margen, 30);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(75, 85, 99);
  let y = 36;
  for (const linea of d.detalle) {
    doc.text(linea, margen, y);
    y += 5;
  }

  const numericas = d.columnasNumericas ?? [];
  const alineacion: Record<number, { halign: 'right' }> = {};
  for (const i of numericas) alineacion[i] = { halign: 'right' };
  const resaltadas = d.filasResaltadas ? new Set(d.filasResaltadas) : undefined;
  const negrita = d.columnasNegrita ?? [];

  autoTable(doc, {
    startY: y + 1,
    head: [d.columnas],
    body: d.filas.map((f) => f.map((c) => String(c))),
    margin: { left: margen, right: margen, bottom: 16 },
    styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 2, textColor: AZUL_NOCHE, overflow: 'linebreak' },
    headStyles: { fillColor: AZUL_NOCHE, textColor: 255, fontStyle: 'bold' },
    // Con filas resaltadas el gris significa «hay diferencia»: no se usa además como rayado.
    ...(resaltadas ? {} : { alternateRowStyles: { fillColor: GRIS_CLARO } }),
    columnStyles: alineacion,
    didParseCell: (datos) => {
      if (datos.section === 'head' && numericas.includes(datos.column.index)) datos.cell.styles.halign = 'right';
      if (datos.section === 'body' && resaltadas?.has(datos.row.index)) {
        datos.cell.styles.fillColor = GRIS_RESALTE;
        if (negrita.includes(datos.column.index)) datos.cell.styles.fontStyle = 'bold';
      }
    },
  });

  // Resumen al pie de la tabla
  const final = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y;
  let yResumen = final + 8;
  if (yResumen > alto - 24) {
    doc.addPage();
    yResumen = 20;
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...AZUL_NOCHE);
  doc.text('Resumen', margen, yResumen);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  for (const linea of d.resumen) {
    yResumen += 5.5;
    doc.text(linea, margen, yResumen);
  }

  pieDePagina(doc, ancho, alto, margen);

  return new Uint8Array(doc.output('arraybuffer'));
}

/** Resumen con varias secciones: cada una con su título, tabla y totales; sin filas dice «Sin registros». */
export async function generarPdfResumen(d: DatosResumen): Promise<Uint8Array> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const ancho = doc.internal.pageSize.getWidth();
  const alto = doc.internal.pageSize.getHeight();
  const margen = 12;

  encabezadoMarca(doc, d, ancho, margen);
  doc.setTextColor(...AZUL_NOCHE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(d.titulo, margen, 30);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(75, 85, 99);
  let y = 36;
  for (const linea of d.detalle) {
    doc.text(linea, margen, y);
    y += 5;
  }
  y += 4;

  const ultimaY = () => (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y;

  for (const s of d.secciones) {
    if (y > alto - 40) {
      doc.addPage();
      y = 18;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...AZUL_NOCHE);
    doc.text(s.titulo, margen, y);
    y += 3;

    if (s.filas.length === 0) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      doc.setTextColor(107, 114, 128);
      y += 5;
      doc.text('Sin registros', margen, y);
      y += 9;
      continue;
    }

    const numericas = s.columnasNumericas ?? [];
    autoTable(doc, {
      startY: y,
      head: [s.columnas],
      body: s.filas.map((f) => f.map((c) => String(c))),
      margin: { left: margen, right: margen, bottom: 16 },
      styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 2, textColor: AZUL_NOCHE, overflow: 'linebreak' },
      headStyles: { fillColor: AZUL_NOCHE, textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: GRIS_CLARO },
      didParseCell: (datos) => {
        if (numericas.includes(datos.column.index)) datos.cell.styles.halign = 'right';
      },
    });
    y = ultimaY() + 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...AZUL_NOCHE);
    for (const linea of s.resumen) {
      if (y > alto - 20) {
        doc.addPage();
        y = 18;
      }
      doc.text(linea, margen, y);
      y += 5;
    }
    y += 6;
  }

  pieDePagina(doc, ancho, alto, margen);
  return new Uint8Array(doc.output('arraybuffer'));
}

/** Banda de marca con usuario, unidad y fecha de generación. */
function encabezadoMarca(doc: jsPDF, d: { usuario: string; unidad: string; generadoEn: Date }, ancho: number, margen: number): void {
  doc.setFillColor(...AZUL_NOCHE);
  doc.rect(0, 0, ancho, 20, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(255, 255, 255);
  doc.text('Stocky', margen, 13);
  doc.setTextColor(...TURQUESA);
  doc.setFontSize(10);
  doc.text('by NelSystems', margen + 23, 13);

  const fecha = format(d.generadoEn, "d 'de' MMMM yyyy, h:mm a", { locale: es });
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`${d.usuario}${d.unidad ? ` · Unidad ${d.unidad}` : ''}`, ancho - margen, 9, { align: 'right' });
  doc.text(`Generado el ${fecha}`, ancho - margen, 14.5, { align: 'right' });
}

/** Pie con la marca y «Página X de Y» en todas las páginas. */
function pieDePagina(doc: jsPDF, ancho: number, alto: number, margen: number): void {
  const paginas = doc.getNumberOfPages();
  for (let i = 1; i <= paginas; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(107, 114, 128);
    doc.text(MARCA, margen, alto - 7);
    doc.text(`Página ${i} de ${paginas}`, ancho - margen, alto - 7, { align: 'right' });
  }
}

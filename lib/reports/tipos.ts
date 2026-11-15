/** Contenido de un reporte, independiente del formato (PDF o Excel). */
export interface DatosReporte {
  titulo: string;
  usuario: string;
  /** `771`, `772` o vacío para el superadmin. */
  unidad: string;
  generadoEn: Date;
  /** Líneas bajo el título (período, fecha del reporte de SIFA, etc.). */
  detalle: string[];
  columnas: string[];
  filas: (string | number)[][];
  /** Índices de columnas que se alinean a la derecha (números). */
  columnasNumericas?: number[];
  /** Líneas de resumen al pie. */
  resumen: string[];
  /** Nombre del archivo sin extensión. */
  nombreArchivo: string;
}

export const MARCA = 'Stocky by NelSystems';

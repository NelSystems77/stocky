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

/** Una sección del resumen mensual: su propia tabla, con totales. Sin filas se muestra «Sin registros». */
export interface SeccionReporte {
  titulo: string;
  columnas: string[];
  filas: (string | number)[][];
  columnasNumericas?: number[];
  resumen: string[];
}

/** Reporte con varias secciones (resumen mensual de labores), independiente del formato. */
export interface DatosResumen {
  titulo: string;
  usuario: string;
  unidad: string;
  generadoEn: Date;
  detalle: string[];
  secciones: SeccionReporte[];
  nombreArchivo: string;
}

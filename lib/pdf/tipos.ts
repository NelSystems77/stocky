import { z } from 'zod';

export const TIPOS_REPORTE = ['existenciasDespacho', 'productosEnDespacho'] as const;
export type TipoReporte = (typeof TIPOS_REPORTE)[number];

/** Columnas numéricas que puede traer un reporte, en el orden en que aparecen en su encabezado. */
export const COLUMNAS = ['cuota', 'cuotaMinima', 'existencia', 'consumo'] as const;
export type Columna = (typeof COLUMNAS)[number];

const Cantidad = z.number().finite().optional();

/** Cantidades tal como vienen en el reporte, en la UD de la fila (ej. `CN` = cientos). */
export const FilaReporteSchema = z.object({
  codigo: z.string().regex(/^\d{3}-\d{2}-\d{4}$/),
  ud: z.string().min(1),
  descripcion: z.string(),
  existencia: Cantidad,
  cuota: Cantidad,
  cuotaMinima: Cantidad,
  consumo: Cantidad,
  /** Fila que conviene revisar en la vista previa (ej. descripción partida en dos líneas). */
  dudosa: z.boolean(),
  nota: z.string().optional(),
});
export type FilaReporte = z.infer<typeof FilaReporteSchema>;

export const ResultadoReporteSchema = z.object({
  tipo: z.enum(TIPOS_REPORTE),
  /** Fecha impresa en el reporte (`YYYY-MM-DD`). */
  fechaReporte: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  despacho: z.object({ codigo: z.string().nullable(), nombre: z.string().nullable() }),
  centro: z.string().nullable(),
  /** Total de productos que declara el propio reporte, para cuadrarlo contra las filas leídas. */
  totalDeclarado: z.number().int().nullable(),
  columnas: z.array(z.enum(COLUMNAS)),
  filas: z.array(FilaReporteSchema),
  advertencias: z.array(z.string()),
});
export type ResultadoReporte = z.infer<typeof ResultadoReporteSchema>;

/** El archivo no es un reporte reconocido o no se pudo leer. El mensaje es apto para mostrarse. */
export class ErrorReporte extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'ErrorReporte';
  }
}

import { describe, expect, it } from 'vitest';
import {
  armarContexto,
  clasificarRespuesta,
  construirPeticionGemini,
  consultarGemini,
  detalleError,
  extraerTexto,
  limitarHistorial,
  limpiarPregunta,
  MAX_CONTEXTO,
  MAX_PREGUNTA,
  MODELOS_CHANGO,
  promptSistema,
  seleccionarProductos,
  type DatosChango,
  type LoteChango,
  type ProductoChango,
  type VencimientosChango,
} from './chango';

const prod = (codigo: string, descripcion: string, extra: Partial<ProductoChango> = {}): ProductoChango => ({
  codigo,
  descripcion,
  ud: 'CN',
  cuota: 30000,
  cuotaMinima: 10000,
  existencia: 20000,
  fechaReporte: '2026-11-12',
  ...extra,
});

const base = (extra: Partial<DatosChango> = {}): DatosChango => ({
  hoy: '2026-11-16',
  unidad: '771',
  productos: [],
  agotados: [],
  tareasHoy: [],
  tareasAtrasadas: [],
  traslados: [],
  preconteos: [],
  danados: [],
  vencidos: [],
  ...extra,
});

describe('seleccionarProductos', () => {
  const productos = [
    prod('110-16-0010', 'AMOXICILINA 500 MG CAPSULAS'),
    prod('110-16-0020', 'PARACETAMOL JARABE 120 MG'),
    prod('110-16-0030', 'AMOXICILINA SUSPENSION 250 MG'),
  ];
  it('encuentra por palabra de la descripción, sin tildes ni mayúsculas', () => {
    expect(seleccionarProductos('¿Dónde está la amoxicilina?', productos).map((p) => p.codigo)).toEqual(['110-16-0010', '110-16-0030']);
  });
  it('encuentra por código, con o sin guiones, y lo pone primero', () => {
    expect(seleccionarProductos('cuánto hay del 110-16-0020 y 1101600', productos).map((p) => p.codigo)).toEqual(['110-16-0020']);
    expect(seleccionarProductos('1101600020', productos)).toEqual([]);
  });
  it('ignora palabras comunes y respeta el máximo', () => {
    expect(seleccionarProductos('¿Qué productos tengo agotados?', productos)).toEqual([]);
    const muchos = Array.from({ length: 20 }, (_, i) => prod(`110-16-${String(i).padStart(4, '0')}`, 'AMOXICILINA'));
    expect(seleccionarProductos('amoxicilina', muchos, 5)).toHaveLength(5);
  });
});

describe('armarContexto', () => {
  it('sin reporte lo dice y no inventa listas', () => {
    const t = armarContexto(base());
    expect(t).toContain('Todavía no hay reporte de existencias');
    expect(t).toContain('Datos que Stocky todavía NO tiene');
    expect(t).not.toContain('## Bajos');
  });
  it('incluye fecha del reporte, resumen y las listas con cantidades en UD', () => {
    const t = armarContexto(
      base({
        productos: [
          prod('110-16-0010', 'AMOXICILINA 500 MG', { existencia: 4000 }), // bajo: 40 CN < 100 CN
          prod('110-16-0020', 'INSULINA', { ud: 'TR', cuota: 40, cuotaMinima: 10, existencia: 0 }), // agotado
          prod('110-16-0030', 'GASA', { riesgo: { nivel: 'critico', cobertura: 3.7, diasAlIngreso: 9 } }),
        ],
      }),
    );
    expect(t).toContain('Último reporte de existencias de SIFA: 2026-11-12');
    expect(t).toContain('agotados 1 · bajos 1 · críticos 1');
    expect(t).toContain('existencia 40 CN');
    expect(t).toContain('alcanza 3 d. hábiles · ingreso en 9');
    expect(t).toContain('Agotados detectados');
  });
  it('agrega los productos que menciona la pregunta', () => {
    const t = armarContexto(base({ productos: [prod('110-16-0010', 'AMOXICILINA 500 MG')] }), '¿cuánta amoxicilina tengo?');
    expect(t).toContain('Productos que menciona la pregunta');
  });
  it('incluye traslados pendientes, preconteo sin recibir, dañados y vencidos del mes', () => {
    const t = armarContexto(
      base({
        productos: [prod('110-16-0010', 'AMOXICILINA 500 MG')],
        traslados: [
          { id: '1', fecha: '2026-11-10', ordenSAP: '5000012345', tipo: 'envio', unidad: 'Hospital', items: [{ codigo: '110-16-0010', cantidad: 100 }], estado: 'pendiente', fechaCierre: null, enSAP: false, enSIFA: false, notas: '' },
        ],
        preconteos: [{ id: '1', fecha: '2026-11-09', codigo: '110-16-0010', cantidad: 500, presentacion: 30, recibida: null, notas: '' }],
        danados: [{ id: '1', fecha: '2026-11-08', codigo: '110-16-0010', lote: 'L1', cantidad: 50, motivo: 'quebrado', notas: '', fotoRuta: null }],
        vencidos: [{ id: '1', fecha: '2026-11-02', codigo: '110-16-0010', lote: 'L9', fechaVencimiento: '2026-10-31', cantidad: 100, origen: 'manual', notas: '' }],
      }),
    );
    expect(t).toContain('Orden 5000012345');
    expect(t).toContain('Pendiente hace 6 días');
    expect(t).toContain('entregado 2026-11-09 · 5 CN');
    expect(t).toContain('Dañados de 2026-11 (1 registros');
    expect(t).toContain('Vencidos de 2026-11 (1 lotes)');
  });
  it('limita las listas y avisa cuántos faltan', () => {
    const muchos = Array.from({ length: 40 }, (_, i) => prod(`110-16-${String(i).padStart(4, '0')}`, `PRODUCTO ${i}`, { existencia: 1 }));
    const t = armarContexto(base({ productos: muchos }));
    expect(t).toContain('(+15 más no listados)');
  });
  it('nunca pasa del tope de caracteres', () => {
    const muchos = Array.from({ length: 500 }, (_, i) => prod(`110-16-${String(i).padStart(4, '0')}`, 'X'.repeat(200), { existencia: 1 }));
    const t = armarContexto(base({ productos: muchos, tareasHoy: Array.from({ length: 100 }, (_, i) => ({ titulo: 'T'.repeat(300) + i, hora: null, fecha: '2026-11-16' })) }));
    expect(t.length).toBeLessThanOrEqual(MAX_CONTEXTO + 40);
  });
});

describe('promptSistema', () => {
  it('fija las reglas de CLAUDE.md §9', () => {
    const p = promptSistema();
    expect(p).toContain('no tengo ese dato');
    expect(p).toContain('Cita la fecha');
    expect(p).toContain('Sugiere, no decidas');
    expect(p).toContain('pacientes');
    expect(p).toContain('Costa Rica');
  });
});

describe('historial y petición', () => {
  it('limita turnos y largo, y descarta basura', () => {
    const h = Array.from({ length: 10 }, (_, i) => ({ rol: i % 2 ? ('chango' as const) : ('usuario' as const), texto: `t${i}`.padEnd(2000, 'x') }));
    const r = limitarHistorial([...h, { rol: 'usuario', texto: '   ' }, { rol: 'otro' as never, texto: 'x' }]);
    expect(r).toHaveLength(6);
    expect(r[0]?.texto.length).toBe(800);
    expect(r.at(-1)?.texto.startsWith('t9')).toBe(true);
    expect(limitarHistorial(undefined)).toEqual([]);
  });
  it('limpia y recorta la pregunta', () => {
    expect(limpiarPregunta('  hola   \n  mundo ')).toBe('hola mundo');
    expect(limpiarPregunta('a'.repeat(900))).toHaveLength(MAX_PREGUNTA);
  });
  it('arma la petición con el contexto en la instrucción de sistema y los roles de Gemini', () => {
    const r = construirPeticionGemini('CONTEXTO', [{ rol: 'usuario', texto: 'hola' }, { rol: 'chango', texto: 'buenas' }], '¿y ahora?');
    expect(r.systemInstruction.parts[0]?.text).toContain('CONTEXTO');
    expect(r.contents.map((c) => c.role)).toEqual(['user', 'model', 'user']);
    expect(r.contents.at(-1)?.parts[0]?.text).toBe('¿y ahora?');
  });
});

describe('respuesta de Gemini', () => {
  it('clasifica por estado HTTP y por estado de la API', () => {
    expect(clasificarRespuesta(200, {})).toBe('ok');
    expect(clasificarRespuesta(429, {})).toBe('cuota');
    expect(clasificarRespuesta(400, { error: { status: 'RESOURCE_EXHAUSTED' } })).toBe('cuota');
    expect(clasificarRespuesta(503, {})).toBe('reintentar');
    expect(clasificarRespuesta(404, {})).toBe('reintentar');
    expect(clasificarRespuesta(400, { error: { status: 'INVALID_ARGUMENT' } })).toBe('error');
    expect(clasificarRespuesta(403, null)).toBe('error');
  });
  it('extrae el texto y devuelve null si está vacío o bloqueado', () => {
    expect(extraerTexto({ candidates: [{ content: { parts: [{ text: 'Hola ' }, { text: 'mundo' }] } }] })).toBe('Hola mundo');
    expect(extraerTexto({ candidates: [{ finishReason: 'SAFETY' }] })).toBeNull();
    expect(extraerTexto({})).toBeNull();
    expect(extraerTexto(null)).toBeNull();
  });
});

describe('consultarGemini', () => {
  const peticion = construirPeticionGemini('C', [], 'hola');
  const ok = (texto: string) => ({ status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: texto }] } }] }) });
  const falla = (status: number, cuerpo: unknown = {}) => ({ status, json: async () => cuerpo });

  it('usa el primer modelo si responde y manda la clave en un encabezado, no en la URL', async () => {
    const llamadas: { url: string; clave: string | undefined }[] = [];
    const r = await consultarGemini(async (url, init) => {
      llamadas.push({ url, clave: init.headers['x-goog-api-key'] });
      return ok('Hola');
    }, 'SECRETA', peticion);
    expect(r).toEqual({ estado: 'ok', texto: 'Hola', modelo: MODELOS_CHANGO[0] });
    expect(llamadas).toHaveLength(1);
    expect(llamadas[0]?.clave).toBe('SECRETA');
    expect(llamadas[0]?.url).not.toContain('SECRETA');
  });
  it('si el primero se queda sin cuota pasa al segundo', async () => {
    let n = 0;
    const r = await consultarGemini(async () => (n++ === 0 ? falla(429) : ok('desde lite')), 'k', peticion);
    expect(r).toEqual({ estado: 'ok', texto: 'desde lite', modelo: MODELOS_CHANGO[1] });
  });
  it('si ambos se quedan sin cuota: sin-cuota', async () => {
    expect(await consultarGemini(async () => falla(429), 'k', peticion)).toEqual({ estado: 'sin-cuota' });
  });
  it('una falla temporal también pasa al siguiente, y de red igual', async () => {
    let n = 0;
    const r = await consultarGemini(async () => {
      if (n++ === 0) throw new Error('red');
      return ok('ok');
    }, 'k', peticion);
    expect(r.estado).toBe('ok');
    expect(await consultarGemini(async () => falla(503), 'k', peticion)).toEqual({ estado: 'error' });
  });
  it('un error de petición o de clave no se reintenta', async () => {
    let n = 0;
    const r = await consultarGemini(async () => {
      n++;
      return falla(403, { error: { status: 'PERMISSION_DENIED' } });
    }, 'k', peticion);
    expect(r).toEqual({ estado: 'error' });
    expect(n).toBe(1);
  });
  it('registra qué pasó con cada modelo, con el motivo que da Google y sin la clave', async () => {
    const intentos: unknown[] = [];
    let n = 0;
    await consultarGemini(
      async () => (n++ === 0 ? falla(429, { error: { status: 'RESOURCE_EXHAUSTED', message: 'Quota exceeded for metric' } }) : ok('bien')),
      'SECRETA',
      peticion,
      MODELOS_CHANGO,
      (i) => intentos.push(i),
    );
    expect(intentos).toEqual([
      { modelo: MODELOS_CHANGO[0], status: 429, resultado: 'cuota', detalle: 'RESOURCE_EXHAUSTED: Quota exceeded for metric' },
      { modelo: MODELOS_CHANGO[1], status: 200, resultado: 'ok' },
    ]);
    expect(JSON.stringify(intentos)).not.toContain('SECRETA');
  });
  it('detalleError: recorta y devuelve undefined si no hay error', () => {
    expect(detalleError({ error: { status: 'NOT_FOUND', message: 'x'.repeat(500) } })?.length).toBe(300);
    expect(detalleError({})).toBeUndefined();
    expect(detalleError(null)).toBeUndefined();
  });
  it('una respuesta vacía o bloqueada pasa al siguiente modelo', async () => {
    let n = 0;
    const r = await consultarGemini(async () => (n++ === 0 ? { status: 200, json: async () => ({ candidates: [{ finishReason: 'SAFETY' }] }) } : ok('bien')), 'k', peticion);
    expect(r.estado).toBe('ok');
  });
});

describe('armarContexto: vencimientos (lotes)', () => {
  const lote = (extra: Partial<LoteChango> = {}): LoteChango => ({
    codigo: '110-16-0010',
    descripcion: 'PARACETAMOL 500 MG',
    ud: 'CN',
    lote: 'A1',
    vence: '2028-01-31',
    cantidad: 100000,
    proyectado: false,
    dias: 437,
    nivel: null,
    ...extra,
  });
  const venc = (lotes: LoteChango[], extra: Partial<VencimientosChango> = {}): VencimientosChango => ({
    resumen: { vencidos: lotes.filter((l) => l.nivel === 'vencido').length, alta: lotes.filter((l) => l.nivel === 'alta').length, media: lotes.filter((l) => l.nivel === 'media').length, a1: lotes.filter((l) => l.excedente !== undefined).length, sinConsumo: 0 },
    umbrales: { alta: 30, media: 90 },
    ultimaCarga: '2026-11-20',
    lotes,
    ingresosSinSumar: [],
    ...extra,
  });
  const contexto = (lotes: LoteChango[], extra: Partial<VencimientosChango> = {}, pregunta = '') =>
    armarContexto(base({ productos: [prod('110-16-0010', 'PARACETAMOL 500 MG')], vencimientos: venc(lotes, extra) }), pregunta);

  it('sin lotes cargados lo dice y no inventa fechas', () => {
    const t = armarContexto(base());
    expect(t).toContain('Todavía no hay reporte de lotes y vencimientos cargado');
    expect(armarContexto(base({ vencimientos: venc([]) }))).toContain('Todavía no hay reporte de lotes');
  });
  it('ya no dice que no tiene lotes ni vencimientos por lote', () => {
    const t = contexto([lote()]);
    expect(t).not.toMatch(/NO tiene[^]*lotes/);
    expect(t).toContain('Ubicaciones de productos y agenda de pedidos y envíos');
  });
  it('resume por nivel con la fecha de la última carga y los umbrales', () => {
    const t = contexto([lote({ nivel: 'vencido', dias: -19, vence: '2026-11-01' }), lote({ lote: 'B', nivel: 'alta', dias: 20, vence: '2026-12-10' }), lote({ lote: 'C', nivel: 'media', dias: 60 }), lote({ lote: 'D' })]);
    expect(t).toContain('Último reporte de lotes y vencimientos: 2026-11-20. Lotes con existencia: 4.');
    expect(t).toContain('Vencidos con existencia: 1 · prioridad alta: 1 · prioridad media: 1');
    expect(t).toContain('faltan 30 días o menos');
    expect(t).toContain('media = 90 días');
  });
  it('lista los vencidos y los de prioridad alta con lote, fecha y cantidad en UD', () => {
    const t = contexto([lote({ nivel: 'vencido', dias: -19, vence: '2026-11-01', cantidad: 30000 }), lote({ lote: 'B', nivel: 'alta', dias: 20, vence: '2026-12-10', cantidad: 20000, proyectado: true, excedente: 15000 })]);
    expect(t).toContain('## Lotes vencidos con existencia');
    expect(t).toContain('lote A1 · vence 2026-11-01 (venció hace 19 d.) · 300 CN · VENCIDO');
    expect(t).toContain('## Lotes de prioridad alta');
    expect(t).toContain('lote B · vence 2026-12-10 (vence en 20 d.) · ≈ 200 CN · prioridad alta · sobran ≈ 150 CN que no se consumirán a tiempo');
  });
  it('los de prioridad media y sin alerta no se listan, solo se cuentan', () => {
    const t = contexto([lote({ nivel: 'media', dias: 60 }), lote({ lote: 'Z' })]);
    expect(t).not.toContain('## Lotes de prioridad alta');
    expect(t).not.toContain('## Lotes vencidos');
    expect(t).toContain('prioridad media: 1');
  });
  it('si la pregunta nombra un producto, trae sus lotes ordenados por vencimiento', () => {
    const t = contexto([lote({ lote: 'TARDE', vence: '2029-01-31' }), lote({ lote: 'PRONTO', vence: '2027-06-30' })], {}, '¿Cuándo vencen los lotes de paracetamol?');
    expect(t).toContain('## Lotes de los productos que menciona la pregunta');
    expect(t.indexOf('lote PRONTO')).toBeLessThan(t.indexOf('lote TARDE'));
  });
  it('avisa de ingresos posteriores al último reporte de lotes', () => {
    expect(contexto([lote()], { ingresosSinSumar: ['2026-11-14'] })).toContain('hubo ingreso de mercadería (2026-11-14) después del último reporte de lotes');
  });
  it('avisa cuántos lotes no tienen consumo', () => {
    const v = venc([lote()]);
    expect(armarContexto(base({ vencimientos: { ...v, resumen: { ...v.resumen, sinConsumo: 7 } } }))).toContain('7 lotes son de productos sin consumo cargado');
  });
  it('limita las listas largas', () => {
    const muchos = Array.from({ length: 40 }, (_, i) => lote({ lote: `L${i}`, nivel: 'alta', dias: 10 }));
    expect(contexto(muchos)).toContain('(+15 más no listados)');
  });
});


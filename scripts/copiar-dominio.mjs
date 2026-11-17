/**
 * Copia a `functions/src/dominio/` la lógica pura de `lib/domain` que usa la Function programada,
 * para que el cliente y el servidor decidan con exactamente el mismo código.
 * Node ESM exige extensión en los imports relativos, así que se agrega `.js`.
 * Se ejecuta solo (prebuild de functions); la carpeta destino está en .gitignore.
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const origen = join(raiz, 'lib', 'domain');
const destino = join(raiz, 'functions', 'src', 'dominio');
const ARCHIVOS = [
  'types', 'calendario', 'recurrencia', 'tareas', 'notificaciones',
  // Chango IA (contexto y cascada de modelos) y todo lo que usa.
  'codigos', 'unidades', 'formato', 'busqueda', 'stock', 'consumo', 'riesgo', 'feriados', 'agotados', 'danados', 'preconteo', 'traslados', 'vencidos', 'chango',
];

rmSync(destino, { recursive: true, force: true });
mkdirSync(destino, { recursive: true });
for (const nombre of ARCHIVOS) {
  const codigo = readFileSync(join(origen, `${nombre}.ts`), 'utf8');
  if (/from '@\//.test(codigo)) throw new Error(`${nombre}.ts usa un alias '@/', no se puede copiar a functions.`);
  const salida = codigo.replace(/from '(\.\/[\w-]+)'/g, "from '$1.js'");
  writeFileSync(join(destino, `${nombre}.ts`), `// GENERADO por scripts/copiar-dominio.mjs desde lib/domain/${nombre}.ts. No editar.\n${salida}`);
}
console.log(`Dominio copiado a ${destino}`);

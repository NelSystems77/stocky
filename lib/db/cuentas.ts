import { collection, onSnapshot, type Unsubscribe } from 'firebase/firestore';
import { z } from 'zod';
import { firestore } from '@/lib/firebase';

export const MODULOS = [
  ['pedidos', 'Pedidos'],
  ['envios', 'Envíos a EBAIS'],
  ['ubicaciones', 'Ubicaciones'],
  ['preconteo', 'Preconteo'],
  ['traslados', 'Traslados'],
  ['danados', 'Dañados'],
  ['chango', 'Chango IA'],
] as const;
export type Modulo = (typeof MODULOS)[number][0];

const CuentaSchema = z.object({
  nombre: z.string(),
  email: z.string(),
  unidad: z.enum(['771', '772']),
  activo: z.boolean(),
  modulosHabilitados: z.array(z.string()).default([]),
});
export type Cuenta = z.infer<typeof CuentaSchema> & { uid: string };

/** Cuentas de usuario en vivo. Solo el superadmin puede listar `usuarios` (lo exigen las reglas). */
export function suscribirCuentas(alCambiar: (c: Cuenta[]) => void, alFallar: () => void): Unsubscribe {
  return onSnapshot(
    collection(firestore(), 'usuarios'),
    (snap) => {
      const lista: Cuenta[] = [];
      for (const d of snap.docs) {
        const r = CuentaSchema.safeParse(d.data());
        if (r.success) lista.push({ uid: d.id, ...r.data });
      }
      alCambiar(lista.toSorted((a, b) => a.unidad.localeCompare(b.unidad) || a.nombre.localeCompare(b.nombre)));
    },
    alFallar,
  );
}

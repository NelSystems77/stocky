import { collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc, updateDoc, type Unsubscribe } from 'firebase/firestore';
import { deleteObject, getBlob, ref, uploadBytes } from 'firebase/storage';
import { z } from 'zod';
import { MOTIVOS_DANADO, type EntradaDanado, type RegistroDanado } from '@/lib/domain/danados';
import { firebaseStorage, firestore } from '@/lib/firebase';
import { registrarEscritura } from './sync';

const Fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const DanadoSchema = z.object({
  fecha: Fecha,
  codigo: z.string().min(1),
  lote: z.string().max(40),
  cantidad: z.number().finite().positive(),
  motivo: z.enum(MOTIVOS_DANADO),
  notas: z.string().max(500),
  fotoRuta: z.string().nullable(),
});

const coleccion = (uid: string) => `usuarios/${uid}/danados`;

/** Dañados en vivo (también sin conexión). Los documentos inválidos se omiten. */
export function suscribirDanados(uid: string, alCambiar: (lista: RegistroDanado[]) => void): Unsubscribe {
  return onSnapshot(
    collection(firestore(), coleccion(uid)),
    (snap) => {
      const lista: RegistroDanado[] = [];
      for (const d of snap.docs) {
        const r = DanadoSchema.safeParse(d.data());
        if (r.success) lista.push({ id: d.id, ...r.data });
      }
      alCambiar(lista);
    },
    () => alCambiar([]),
  );
}

/** Guarda un dañado (sin foto). Devuelve el id para poder adjuntar la foto o deshacer. El ID nace en el cliente. */
export function crearDanado(uid: string, entrada: EntradaDanado): { id: string; escritura: Promise<void> } {
  const id = crypto.randomUUID();
  const escritura = registrarEscritura(
    setDoc(doc(firestore(), `${coleccion(uid)}/${id}`), { ...entrada, fotoRuta: null, creadoEn: serverTimestamp() }),
  );
  return { id, escritura };
}

/** Restaura un registro borrado (Deshacer). Conserva el mismo id. */
export function restaurarDanado(uid: string, r: RegistroDanado): Promise<void> {
  const { id, ...datos } = r;
  return registrarEscritura(setDoc(doc(firestore(), `${coleccion(uid)}/${id}`), { ...datos, creadoEn: serverTimestamp() }));
}

/** Borra el registro. La foto (si hay) se conserva en Storage mientras se pueda deshacer; ver `borrarFoto`. */
export function borrarDanado(uid: string, id: string): Promise<void> {
  return registrarEscritura(deleteDoc(doc(firestore(), `${coleccion(uid)}/${id}`)));
}

/** Corrige un dañado ya guardado (la foto no se toca aquí: ver `adjuntarFoto`). */
export function actualizarDanado(uid: string, id: string, e: EntradaDanado): Promise<void> {
  return registrarEscritura(
    updateDoc(doc(firestore(), `${coleccion(uid)}/${id}`), { fecha: e.fecha, codigo: e.codigo, lote: e.lote, cantidad: e.cantidad, motivo: e.motivo, notas: e.notas }),
  );
}

export function guardarNotasDanado(uid: string, id: string, notas: string): Promise<void> {
  return registrarEscritura(updateDoc(doc(firestore(), `${coleccion(uid)}/${id}`), { notas: notas.slice(0, 500) }));
}

/** Sube la foto (requiere conexión) y la enlaza al registro. Devuelve la ruta en Storage. */
export async function adjuntarFoto(uid: string, id: string, foto: Blob): Promise<string> {
  const ruta = `usuarios/${uid}/danados/${id}.jpg`;
  await uploadBytes(ref(firebaseStorage(), ruta), foto, { contentType: 'image/jpeg' });
  await updateDoc(doc(firestore(), `${coleccion(uid)}/${id}`), { fotoRuta: ruta });
  return ruta;
}

/** Descarga la foto como `Blob` para mostrarla (el navegador no puede leer Storage con un `<img>` sin URL firmada). */
export function leerFoto(ruta: string): Promise<Blob> {
  return getBlob(ref(firebaseStorage(), ruta));
}

export async function borrarFoto(ruta: string): Promise<void> {
  await deleteObject(ref(firebaseStorage(), ruta));
}

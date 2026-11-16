/**
 * Reduce una foto del celular a un JPEG liviano (lado mayor ≤ `lado` px) antes de subirla:
 * una foto de cámara pesa varios MB y las reglas de Storage aceptan menos de 5 MB.
 */
export async function reducirFoto(archivo: File, lado = 1280, calidad = 0.8): Promise<Blob> {
  const bitmap = await createImageBitmap(archivo);
  const escala = Math.min(1, lado / Math.max(bitmap.width, bitmap.height));
  const lienzo = document.createElement('canvas');
  lienzo.width = Math.round(bitmap.width * escala);
  lienzo.height = Math.round(bitmap.height * escala);
  const ctx = lienzo.getContext('2d');
  if (!ctx) throw new Error('No se pudo procesar la foto.');
  ctx.drawImage(bitmap, 0, 0, lienzo.width, lienzo.height);
  bitmap.close();
  return new Promise((resolver, rechazar) =>
    lienzo.toBlob((b) => (b ? resolver(b) : rechazar(new Error('No se pudo procesar la foto.'))), 'image/jpeg', calidad),
  );
}

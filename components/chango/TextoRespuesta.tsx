import { Fragment } from 'react';
import { parsearRespuesta, type Trozo } from '@/lib/chango/texto';

const Trozos = ({ trozos }: { trozos: Trozo[] }) => (
  <>
    {trozos.map((t, i) => (t.negrita ? <strong key={i}>{t.texto}</strong> : <Fragment key={i}>{t.texto}</Fragment>))}
  </>
);

/** Respuesta de Chango con párrafos, listas y negritas (texto plano, nunca HTML). */
export function TextoRespuesta({ texto }: { texto: string }) {
  return (
    <div className="flex flex-col gap-2">
      {parsearRespuesta(texto).map((b, i) =>
        b.tipo === 'parrafo' ? (
          <p key={i}>
            <Trozos trozos={b.trozos} />
          </p>
        ) : (
          <ul key={i} className="ml-4 list-disc">
            {b.items.map((it, j) => (
              <li key={j}>
                <Trozos trozos={it} />
              </li>
            ))}
          </ul>
        ),
      )}
    </div>
  );
}

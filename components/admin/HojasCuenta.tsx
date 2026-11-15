'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Hoja } from '@/components/ui/Hoja';
import { MODULOS, type Cuenta, type Modulo } from '@/lib/db/cuentas';
import { generarClave } from '@/lib/domain/clave';

const campo = 'min-h-11 w-full rounded-2xl bg-surface-2 px-4 text-text placeholder:text-text-muted';

// ───────── Nueva cuenta ─────────
const Esquema = z.object({
  nombre: z.string().trim().min(1, 'Escribe el nombre.').max(100),
  email: z.string().trim().min(1, 'Escribe el correo.').email('Correo no válido.'),
  unidad: z.enum(['771', '772']),
  password: z.string().min(8, 'Mínimo 8 caracteres.').max(128),
});
export type DatosCuenta = z.infer<typeof Esquema>;

interface NuevaProps {
  abierta: boolean;
  alCerrar: () => void;
  alCrear: (d: DatosCuenta) => Promise<void>;
}

export function HojaNuevaCuenta({ abierta, alCerrar, alCrear }: NuevaProps) {
  return (
    <Hoja abierta={abierta} alCerrar={alCerrar} titulo="Nueva cuenta">
      <FormularioCuenta alCerrar={alCerrar} alCrear={alCrear} />
    </Hoja>
  );
}

function FormularioCuenta({ alCerrar, alCrear }: Omit<NuevaProps, 'abierta'>) {
  const {
    register,
    setValue,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<DatosCuenta>({
    resolver: zodResolver(Esquema),
    defaultValues: { nombre: '', email: '', unidad: '771', password: generarClave() },
  });

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={handleSubmit(async (d) => {
        await alCrear(d);
        alCerrar();
      })}
    >
      <label className="flex flex-col gap-1 text-sm">
        Nombre
        <input autoFocus className={campo} {...register('nombre')} />
        {errors.nombre && <span className="text-xs text-critical">{errors.nombre.message}</span>}
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Correo
        <input type="email" inputMode="email" autoComplete="off" className={campo} {...register('email')} />
        {errors.email && <span className="text-xs text-critical">{errors.email.message}</span>}
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Unidad
        <select className={campo} {...register('unidad')}>
          <option value="771">771 · Almacén Local</option>
          <option value="772">772 · Farmacia</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Contraseña inicial
        <div className="flex gap-2">
          <input autoComplete="off" spellCheck={false} className={`${campo} font-mono`} {...register('password')} />
          <Button type="button" variante="secundario" onClick={() => setValue('password', generarClave(), { shouldValidate: true })}>
            Generar
          </Button>
        </div>
        {errors.password && <span className="text-xs text-critical">{errors.password.message}</span>}
      </label>
      <div className="flex gap-3">
        <Button type="button" variante="secundario" className="flex-1" onClick={alCerrar}>
          Cancelar
        </Button>
        <Button type="submit" className="flex-1" disabled={isSubmitting}>
          {isSubmitting ? 'Creando…' : 'Crear cuenta'}
        </Button>
      </div>
    </form>
  );
}

// ───────── Contraseña generada (se muestra una sola vez) ─────────
export interface Credenciales {
  nombre: string;
  email: string;
  password: string;
}

export function HojaCredenciales({ credenciales, alCerrar }: { credenciales: Credenciales | null; alCerrar: () => void }) {
  const [copiado, setCopiado] = useState(false);
  const c = credenciales;

  async function copiar() {
    if (!c) return;
    try {
      await navigator.clipboard.writeText(`Correo: ${c.email}\nContraseña: ${c.password}`);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      // Sin permiso de portapapeles: la persona puede seleccionarla a mano.
    }
  }

  return (
    <Hoja abierta={c !== null} alCerrar={alCerrar} titulo={`Credenciales de ${c?.nombre ?? ''}`}>
      <p className="text-sm text-warning">Cópialas ahora: la contraseña no se vuelve a mostrar.</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-2xl bg-surface-2 p-4 text-sm">
        <dt className="text-text-muted">Correo</dt>
        <dd className="break-all">{c?.email}</dd>
        <dt className="text-text-muted">Contraseña</dt>
        <dd className="font-mono text-base select-all" data-testid="clave-generada">
          {c?.password}
        </dd>
      </dl>
      <div className="flex gap-3">
        <Button variante="secundario" className="flex-1" onClick={() => void copiar()}>
          {copiado ? <Check aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />}
          {copiado ? 'Copiado' : 'Copiar'}
        </Button>
        <Button className="flex-1" onClick={alCerrar}>
          Listo
        </Button>
      </div>
    </Hoja>
  );
}

// ───────── Confirmación ─────────
interface ConfirmarProps {
  titulo: string;
  mensaje: string;
  etiqueta: string;
  abierta: boolean;
  alCerrar: () => void;
  alConfirmar: () => void;
}

export function HojaConfirmar({ titulo, mensaje, etiqueta, abierta, alCerrar, alConfirmar }: ConfirmarProps) {
  return (
    <Hoja abierta={abierta} alCerrar={alCerrar} titulo={titulo}>
      <p className="text-sm text-text-muted">{mensaje}</p>
      <div className="flex gap-3">
        <Button variante="secundario" className="flex-1" onClick={alCerrar}>
          Cancelar
        </Button>
        <Button
          className="flex-1"
          onClick={() => {
            alConfirmar();
            alCerrar();
          }}
        >
          {etiqueta}
        </Button>
      </div>
    </Hoja>
  );
}

// ───────── Módulos habilitados (solo cuentas 772) ─────────
interface ModulosProps {
  cuenta: Cuenta | null;
  alCerrar: () => void;
  alGuardar: (c: Cuenta, modulos: Modulo[]) => Promise<void>;
}

export function HojaModulos({ cuenta, alCerrar, alGuardar }: ModulosProps) {
  return (
    <Hoja abierta={cuenta !== null} alCerrar={alCerrar} titulo={`Módulos de ${cuenta?.nombre ?? ''}`}>
      {cuenta && <ListaModulos cuenta={cuenta} alCerrar={alCerrar} alGuardar={alGuardar} />}
    </Hoja>
  );
}

function ListaModulos({ cuenta, alCerrar, alGuardar }: { cuenta: Cuenta; alCerrar: () => void; alGuardar: ModulosProps['alGuardar'] }) {
  const [elegidos, setElegidos] = useState<Modulo[]>(cuenta.modulosHabilitados.filter((m): m is Modulo => MODULOS.some(([id]) => id === m)));
  const [guardando, setGuardando] = useState(false);

  return (
    <>
      <p className="text-sm text-text-muted">
        La farmacia 772 siempre ve Tareas, Agotados, Vencimientos y Reportes. Habilita aquí lo demás.
      </p>
      <ul className="flex flex-col gap-2">
        {MODULOS.map(([id, etiqueta]) => (
          <li key={id}>
            <label className="flex min-h-12 items-center justify-between gap-3 rounded-2xl bg-surface-2 px-4">
              <span className="text-sm">{etiqueta}</span>
              <input
                type="checkbox"
                role="switch"
                className="size-6 accent-accent"
                checked={elegidos.includes(id)}
                onChange={(e) => setElegidos((l) => (e.target.checked ? [...l, id] : l.filter((x) => x !== id)))}
              />
            </label>
          </li>
        ))}
      </ul>
      <div className="flex gap-3">
        <Button variante="secundario" className="flex-1" onClick={alCerrar}>
          Cancelar
        </Button>
        <Button
          className="flex-1"
          disabled={guardando}
          onClick={async () => {
            setGuardando(true);
            await alGuardar(cuenta, elegidos);
            setGuardando(false);
            alCerrar();
          }}
        >
          Guardar
        </Button>
      </div>
    </>
  );
}

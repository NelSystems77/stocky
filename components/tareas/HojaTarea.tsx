'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Hoja } from '@/components/ui/Hoja';
import { diaSemana, hoyCostaRica } from '@/lib/domain/calendario';
import { PRIORIDADES, type Tarea } from '@/lib/domain/tareas';
import type { Recurrencia } from '@/lib/domain/types';

const FRECUENCIAS = [
  ['unica', 'Una sola vez'],
  ['diaria', 'Todos los días laborables'],
  ['diasSemana', 'Días de la semana'],
  ['quincenal', 'Cada 2 semanas'],
  ['mensual', 'Una vez al mes'],
  ['segundoSabado', 'Cada segundo sábado'],
  ['tercerJueves', 'Cada tercer jueves del mes'],
  ['tercerJuevesMas15', '15 días después del tercer jueves'],
] as const;

const DIAS_LABORALES = [
  [1, 'L'],
  [2, 'M'],
  [3, 'Mi'],
  [4, 'J'],
  [5, 'V'],
] as const;

const Esquema = z
  .object({
    titulo: z.string().trim().min(1, 'Escribe un título.').max(200, 'Máximo 200 caracteres.'),
    frecuencia: z.enum(['unica', 'diaria', 'diasSemana', 'quincenal', 'mensual', 'segundoSabado', 'tercerJueves', 'tercerJuevesMas15']),
    fecha: z.string(),
    dias: z.array(z.number()),
    diaMes: z.number().int().min(1).max(31),
    hora: z.string(),
    prioridad: z.enum(PRIORIDADES),
    notas: z.string().max(1000),
  })
  .superRefine((v, ctx) => {
    if ((v.frecuencia === 'unica' || v.frecuencia === 'quincenal') && !/^\d{4}-\d{2}-\d{2}$/.test(v.fecha)) {
      ctx.addIssue({ code: 'custom', path: ['fecha'], message: 'Elige una fecha.' });
    }
    if (v.frecuencia === 'diasSemana' && v.dias.length === 0) {
      ctx.addIssue({ code: 'custom', path: ['dias'], message: 'Elige al menos un día.' });
    }
  });
type Datos = z.infer<typeof Esquema>;

function aRecurrencia(d: Datos): Recurrencia {
  switch (d.frecuencia) {
    case 'unica':
      return { tipo: 'unica', fecha: d.fecha };
    case 'diaria':
      return { tipo: 'diaria' };
    case 'diasSemana':
      return { tipo: 'diasSemana', dias: d.dias.toSorted((a, b) => a - b) as Extract<Recurrencia, { tipo: 'diasSemana' }>['dias'] };
    case 'quincenal':
      return { tipo: 'quincenal', dia: diaSemana(d.fecha) as 0, ancla: d.fecha };
    case 'mensual':
      return { tipo: 'mensual', diaMes: d.diaMes };
    case 'segundoSabado':
      return { tipo: 'segundoSabado' };
    case 'tercerJueves':
      return { tipo: 'tercerJueves' };
    case 'tercerJuevesMas15':
      return { tipo: 'tercerJuevesMas15' };
  }
}

function valoresIniciales(t: Tarea | null, hoy: string): Datos {
  const r = t?.recurrencia;
  return {
    titulo: t?.titulo ?? '',
    frecuencia: r?.tipo ?? 'unica',
    fecha: r?.tipo === 'unica' ? r.fecha : r?.tipo === 'quincenal' ? r.ancla : hoy,
    dias: r?.tipo === 'diasSemana' ? [...r.dias] : [],
    diaMes: r?.tipo === 'mensual' ? r.diaMes : 1,
    hora: t?.hora ?? '',
    prioridad: t?.prioridad ?? 'media',
    notas: t?.notas ?? '',
  };
}

interface Props {
  abierta: boolean;
  /** `null` = tarea nueva. */
  tarea: Tarea | null;
  alCerrar: () => void;
  alGuardar: (t: Tarea) => void;
}

export function HojaTarea({ abierta, tarea, alCerrar, alGuardar }: Props) {
  return (
    <Hoja abierta={abierta} alCerrar={alCerrar} titulo={tarea ? 'Editar tarea' : 'Nueva tarea'}>
      <Formulario tarea={tarea} alCerrar={alCerrar} alGuardar={alGuardar} />
    </Hoja>
  );
}

function Formulario({ tarea, alCerrar, alGuardar }: Omit<Props, 'abierta'>) {
  const hoy = hoyCostaRica();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<Datos>({ resolver: zodResolver(Esquema), defaultValues: valoresIniciales(tarea, hoy) });

  const frecuencia = useWatch({ control, name: 'frecuencia' });
  const campo = 'min-h-11 w-full rounded-2xl bg-surface-2 px-4 text-text placeholder:text-text-muted';
  const error = (m?: string) => m && <span className="text-xs text-critical">{m}</span>;

  function enviar(d: Datos) {
    alGuardar({
      id: tarea?.id ?? crypto.randomUUID(),
      titulo: d.titulo.trim(),
      recurrencia: aRecurrencia(d),
      hora: d.hora || null,
      prioridad: d.prioridad,
      notas: d.notas.trim(),
      activa: tarea?.activa ?? true,
      desde: tarea?.desde ?? hoy,
    });
    alCerrar();
  }

  return (
    <form onSubmit={handleSubmit(enviar)} noValidate className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        Título
        <input autoFocus className={campo} placeholder="Ej. Revisar temperatura" {...register('titulo')} />
        {error(errors.titulo?.message)}
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Se repite
        <select className={campo} {...register('frecuencia')}>
          {FRECUENCIAS.map(([v, e]) => (
            <option key={v} value={v}>
              {e}
            </option>
          ))}
        </select>
      </label>

      {(frecuencia === 'unica' || frecuencia === 'quincenal') && (
        <label className="flex flex-col gap-1 text-sm">
          {frecuencia === 'unica' ? 'Fecha' : 'Primera vez (se repite cada 2 semanas ese mismo día)'}
          <input type="date" className={campo} {...register('fecha')} />
          {error(errors.fecha?.message)}
        </label>
      )}

      {frecuencia === 'diasSemana' && (
        <fieldset className="flex flex-col gap-1 text-sm">
          <legend className="mb-1">Días</legend>
          <Controller
            control={control}
            name="dias"
            render={({ field }) => (
              <div className="flex gap-2">
                {DIAS_LABORALES.map(([n, etiqueta]) => {
                  const activo = field.value.includes(n);
                  return (
                    <button
                      key={n}
                      type="button"
                      aria-pressed={activo}
                      onClick={() => field.onChange(activo ? field.value.filter((x) => x !== n) : [...field.value, n])}
                      className={`size-11 rounded-full text-sm transition duration-200 ${activo ? 'bg-accent font-semibold text-bg' : 'bg-surface-2 text-text-muted'}`}
                    >
                      {etiqueta}
                    </button>
                  );
                })}
              </div>
            )}
          />
          {error(errors.dias?.message)}
        </fieldset>
      )}

      {frecuencia === 'mensual' && (
        <label className="flex flex-col gap-1 text-sm">
          Día del mes (si no es laborable, pasa al siguiente día laboral)
          <input type="number" min={1} max={31} inputMode="numeric" className={campo} {...register('diaMes', { valueAsNumber: true })} />
          {error(errors.diaMes?.message && 'Entre 1 y 31.')}
        </label>
      )}

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Hora (opcional)
          <input type="time" className={campo} {...register('hora')} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Prioridad
          <select className={campo} {...register('prioridad')}>
            <option value="alta">Alta</option>
            <option value="media">Media</option>
            <option value="baja">Baja</option>
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        Notas (opcional)
        <textarea rows={2} className="rounded-2xl bg-surface-2 p-3 text-text" {...register('notas')} />
      </label>

      <div className="flex gap-3">
        <Button type="button" variante="secundario" className="flex-1" onClick={alCerrar}>
          Cancelar
        </Button>
        <Button type="submit" className="flex-1">
          Guardar
        </Button>
      </div>
    </form>
  );
}

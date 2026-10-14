import React, { useEffect, useState } from 'react';
import type { Circulo, MiembroDeCirculo, ProyectoDeRed } from '../../lib/red-de-contexto-api.js';
import { estadoEnLaCarpeta, slugDeNombre, slugValido } from '../../modules/red-de-contexto/estado.js';
import type { StatusBadgeTone } from '../ui/atoms/StatusBadge.js';
import { Tabla, type ColumnaDeTabla } from '../ui/Tabla.js';
import { ChipsDeEspacios } from './ChipsDeEspacios.js';
import { Button } from '../ui/atoms/Button.js';
import { Dialogo } from '../ui/Dialogo.js';

/**
 * LAS PIEZAS DE LAS CARPETAS COMPARTIDAS que comparten las dos superficies de
 * la red de contexto: la tabla, el formulario para crear y el diálogo para
 * editar. La del espacio arma la red; la de la organización la supervisa
 * (`docs/05-ambito-de-los-modulos.md` del workspace, «Red de contexto»).
 */

/** Mismas superficies que `OrganizationPortsSection`: viven en el mismo panel y tienen que leerse igual. */
export const PANEL_CLASS = 'rounded-xl border border-border bg-muted p-4';
export const INPUT_CLASS =
  'w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary [&>option]:bg-popover [&>option]:text-popover-foreground';

export type CarpetaDeTabla = Circulo & { miembros: MiembroDeCirculo[] };

/* La tabla reparte el ancho que sobra en proporción al ideal de cada columna:
   con 200 · 200 · 600, «Se comparte con» se queda con el 60%. */
const COLUMNAS_CARPETAS: ColumnaDeTabla[] = [
  { id: 'nombre', label: 'Nombre', dato: 'nombre', w: 200 },
  { id: 'descripcion', label: 'Descripción', w: 200, orden: false },
  {
    id: 'espacios',
    label: 'Se comparte con',
    w: 600,
    elastica: true,
    orden: false,
  },
];

/** La descripción es un resumen: más de esto ya no es para leer en una fila. Completa, en el globo. */
const DESCRIPCION_MAX = 200;

/**
 * EL ESTADO ES DE CADA ESPACIO, no de la carpeta: cada uno recibe por su cuenta
 * y uno puede fallar mientras los demás andan. Por eso va en el chip de cada
 * espacio, como un ícono —se ve de un vistazo cuál anda mal— con su detalle en
 * el globo.
 */
const ICONO_DE_ESTADO: Record<StatusBadgeTone, { icono: string; clase: string }> = {
  success: { icono: 'check', clase: 'text-[var(--sw-success)]' },
  warning: { icono: 'alerta', clase: 'text-[var(--sw-warning)]' },
  danger: { icono: 'alerta', clase: 'text-[var(--sw-error)]' },
  neutral: { icono: 'reloj', clase: 'text-muted-foreground' },
  // Pendiente de aprobación: espera a una persona, no al sync.
  info: { icono: 'reloj', clase: 'text-[var(--sw-attention)]' },
};

/**
 * LAS CARPETAS COMPARTIDAS, en la tabla de siempre (`ui/Tabla`, la misma de
 * Puertos y Usuarios).
 *
 * La usan las dos superficies de la red: la del ESPACIO (Ajustes → «Espacio»),
 * donde se arman las carpetas propias y se invita, y la de la ORGANIZACIÓN
 * (Ajustes → «Organización»), que las supervisa.
 *
 * Compartir es una opción del MENÚ DE CADA FILA, y hay una por cada espacio de
 * la organización —menos el propio, en la del espacio—: marcada si ya se
 * comparte con él o está invitado. Tocarla invita (o comparte, si lo hace la
 * organización) o deja de compartir, con confirmación. Lo que el menú y los
 * chips dicen de cada espacio es su estado EN ESTA carpeta
 * (`estadoEnLaCarpeta`): pendiente de aprobación, rechazada, o cómo le va al
 * sync.
 */
export function TablaDeCarpetas({
  carpetas,
  proyectos,
  excluir,
  mostrarDueno = false,
  onCompartir,
  onDejarDeCompartir,
  onDesactivar,
  onActivar,
}: {
  carpetas: CarpetaDeTabla[];
  proyectos: ProyectoDeRed[];
  /** Un espacio que no va en el menú de compartir: el propio, en la superficie del espacio. */
  excluir?: string;
  /** Decir de qué espacio es cada carpeta (en la superficie de la organización). */
  mostrarDueno?: boolean;
  onCompartir: (c: CarpetaDeTabla, p: ProyectoDeRed) => void;
  /* Las tres de abajo ya vienen CONFIRMADAS: la tabla pide la confirmación —en
     un diálogo, encima del modal de Ajustes, sin cerrarlo— y recién ahí llama. */
  onDejarDeCompartir: (c: CarpetaDeTabla, p: ProyectoDeRed) => Promise<boolean>;
  onDesactivar: (c: CarpetaDeTabla) => Promise<boolean>;
  onActivar: (c: CarpetaDeTabla) => Promise<boolean>;
}): React.ReactElement {
  /** La acción que espera confirmación: qué se va a hacer, con qué carpeta y (si aplica) con qué espacio. */
  const [porConfirmar, setPorConfirmar] = useState<
    | { tipo: 'dejar'; c: CarpetaDeTabla; p: ProyectoDeRed; pendiente: boolean }
    | { tipo: 'desactivar' | 'activar'; c: CarpetaDeTabla }
    | null
  >(null);
  const porId = new Map(proyectos.map((p) => [p.id, p]));
  const proyectoDe = (m: MiembroDeCirculo): ProyectoDeRed =>
    porId.get(m.project_id) ?? {
      id: m.project_id,
      name: m.project_id,
      con_modulo: true,
      tiene_root: true,
    };
  /* CON QUIÉN SE COMPARTE: los miembros menos el dueño. El dueño figura como
     miembro de su propia carpeta porque el sync necesita leer lo que publica,
     pero no "se comparte" consigo mismo: nombrarlo acá, o dejar tildarlo en el
     menú, era decir que se compartía con él. */
  const conQuien = (c: CarpetaDeTabla) => c.miembros.filter((m) => m.project_id !== c.owner_project_id);
  const estados = (c: CarpetaDeTabla) =>
    conQuien(c).map((m) => ({
      nombre: proyectoDe(m).name,
      e: estadoEnLaCarpeta(m, proyectoDe(m)),
    }));

  function celda(c: CarpetaDeTabla, col: ColumnaDeTabla): React.ReactNode {
    switch (col.id) {
      case 'nombre':
        /* El nombre y, abajo, dónde vive en cada espacio. */
        return (
          <div className="py-2 leading-tight">
            <div className="flex items-center gap-2">
              <span className={`truncate font-medium ${c.desactivada_at ? 'text-muted-foreground' : 'text-foreground'}`}>
                {c.nombre}
              </span>
              {c.desactivada_at && (
                <span className="shrink-0 rounded-full border border-border px-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                  Desactivada
                </span>
              )}
            </div>
            <code className="text-[11px] text-muted-foreground">contexto-org/{c.slug}/</code>
            {mostrarDueno && (
              <div className="text-[11px] text-muted-foreground">
                {c.owner_project_id
                  ? `de ${porId.get(c.owner_project_id)?.name ?? c.owner_project_id}`
                  : 'de la organización'}
              </div>
            )}
          </div>
        );
      case 'descripcion': {
        /* Hasta dos líneas y DESCRIPCION_MAX caracteres; completa en el globo.
           La tabla deja una sola línea por celda (su CSS es del template y no se
           toca), así que el salto se habilita acá adentro. */
        const texto = c.contexto.trim();
        if (!texto) return <span className="text-muted-foreground">Sin descripción</span>;
        const corto = texto.length > DESCRIPCION_MAX ? `${texto.slice(0, DESCRIPCION_MAX).trimEnd()}…` : texto;
        return (
          <div className="line-clamp-2 whitespace-normal py-2 text-xs leading-snug text-secondary-foreground" title={texto}>
            {corto}
          </div>
        );
      }
      case 'espacios':
        if (c.desactivada_at) return <span className="text-muted-foreground">Desactivada: no se entrega a nadie</span>;
        if (conQuien(c).length === 0) return <span className="text-muted-foreground">Todavía con ningún espacio</span>;
        return (
          <ChipsDeEspacios
            chips={estados(c).map((x) => {
              const i = ICONO_DE_ESTADO[x.e.tono];
              return {
                nombre: x.nombre,
                icono: x.e.icono ?? i.icono,
                claseIcono: i.clase,
                etiqueta: x.e.etiqueta,
                detalle: `${x.e.etiqueta}${x.e.detalle ? ` — ${x.e.detalle}` : ''}`,
              };
            })}
          />
        );
      default:
        return null;
    }
  }

  const confirmacion = (() => {
    const pc = porConfirmar;
    if (!pc) return null;
    if (pc.tipo === 'dejar' && pc.pendiente) {
      return {
        titulo: `Retirar la invitación a «${pc.p.name}»`,
        puntos: [
          'Todavía no recibió nada: la invitación esperaba a la organización.',
          'Para volver a compartir con este espacio hay que invitarlo de nuevo, y que la organización lo apruebe.',
        ],
        boton: 'Retirar la invitación',
        peligro: true,
        hacer: () => onDejarDeCompartir(pc.c, pc.p),
      };
    }
    if (pc.tipo === 'dejar') {
      return {
        titulo: `Dejar de compartir «${pc.c.nombre}» con «${pc.p.name}»`,
        puntos: [
          `«${pc.p.name}» pierde el acceso: se borran de su disco las copias que recibió de esta carpeta.`,
          'Lo que ese espacio publicó en ella deja de llegarles a los demás.',
          'Los originales, en el publicado/ de cada espacio, no se tocan.',
          'Volver a compartir no es inmediato: hay que invitarlo de nuevo y sincronizar, es decir, que el sistema vuelva a copiar los archivos.',
        ],
        boton: 'Dejar de compartir',
        peligro: true,
        hacer: () => onDejarDeCompartir(pc.c, pc.p),
      };
    }
    if (pc.tipo === 'desactivar') {
      return {
        titulo: `Desactivar «${pc.c.nombre}»`,
        puntos: [
          'Deja de verse para todos los espacios con los que se comparte: se borran las copias de sus discos.',
          'Los originales, en el publicado/ de cada espacio, no se tocan.',
          'Reactivarla no es inmediato: el sistema tiene que volver a copiar los archivos a cada espacio, y eso lleva una sincronización.',
        ],
        boton: 'Desactivar',
        peligro: true,
        hacer: () => onDesactivar(pc.c),
      };
    }
    return {
      titulo: `Activar «${pc.c.nombre}»`,
      puntos: [
        'Vuelve a llegarles a los espacios con los que se comparte.',
        'No es inmediato: el sistema tiene que volver a copiar los archivos a cada espacio, y eso lleva una sincronización.',
      ],
      boton: 'Activar',
      peligro: false,
      hacer: () => onActivar(pc.c),
    };
  })();

  return (
    <>
      <ConfirmarAccion
        abierta={confirmacion !== null}
        titulo={confirmacion?.titulo ?? ''}
        puntos={confirmacion?.puntos ?? []}
        boton={confirmacion?.boton ?? ''}
        peligro={confirmacion?.peligro ?? false}
        onConfirmar={() => (confirmacion ? confirmacion.hacer() : Promise.resolve(false))}
        onCerrar={() => setPorConfirmar(null)}
      />
      <Tabla<CarpetaDeTabla>
        titulo="Carpetas compartidas"
        columnas={COLUMNAS_CARPETAS}
        filas={carpetas}
        clave={(c) => c.id}
        nombreFila={(c) => c.nombre}
        seleccion={false}
        celda={celda}
        menuFila={(c) => {
          const miembroDe = (id: string) => c.miembros.find((m) => m.project_id === id);
          const candidatos = proyectos.filter((p) => p.id !== excluir && p.id !== c.owner_project_id);
          return {
            groups: [
              {
                items: candidatos.length
                  ? candidatos.map((p) => {
                      const m = miembroDe(p.id);
                      const sufijo =
                        m?.estado === 'pendiente'
                          ? ' — pendiente de aprobación'
                          : m?.estado === 'rechazada'
                            ? ' — rechazada'
                            : !p.con_modulo
                              ? ' — sin la red'
                              : !p.tiene_root
                                ? ' — sin carpeta'
                                : '';
                      /* Sin carpeta en el servidor no hay dónde recibir: no se
                       ofrece invitarlo. Sí se puede sacar si ya estaba. */
                      const sinDondeRecibir = !p.tiene_root && !m;
                      return {
                        id: `espacio:${p.id}`,
                        label: sinDondeRecibir ? `${p.name} — sin carpeta, no puede recibir` : `${p.name}${sufijo}`,
                        // Rechazada no cuenta como compartida: tocarla la vuelve a pedir.
                        checked: Boolean(m) && m?.estado !== 'rechazada',
                        // Desactivada, no se comparte con nadie: primero se activa.
                        disabled: sinDondeRecibir || Boolean(c.desactivada_at),
                      };
                    })
                  : [
                      {
                        id: 'sin-espacios',
                        label: 'La organización no tiene espacios',
                        disabled: true,
                      },
                    ],
              },
              {
                items: c.desactivada_at
                  ? [{ id: 'activar', label: 'Activar carpeta…', icon: 'eye' }]
                  : [
                      {
                        id: 'desactivar',
                        label: 'Desactivar carpeta…',
                        icon: 'eyeOff',
                        danger: true,
                      },
                    ],
              },
            ],
            onSelect: (id, fila) => {
              if (id === 'desactivar') return setPorConfirmar({ tipo: 'desactivar', c: fila });
              if (id === 'activar') return setPorConfirmar({ tipo: 'activar', c: fila });
              if (id.startsWith('espacio:')) {
                const p = porId.get(id.slice('espacio:'.length));
                if (!p) return;
                const m = fila.miembros.find((x) => x.project_id === p.id);
                if (m && m.estado !== 'rechazada')
                  setPorConfirmar({
                    tipo: 'dejar',
                    c: fila,
                    p,
                    pendiente: m.estado === 'pendiente',
                  });
                else onCompartir(fila, p);
              }
            },
          };
        }}
        textos={{
          vacio: 'Todavía no hay carpetas compartidas',
          vacioPaso: 'Creá la primera con el formulario de arriba.',
        }}
      />
    </>
  );
}

/**
 * Confirmar una acción que AFECTA A OTROS ESPACIOS: dice qué pasa, punto por
 * punto, y sobre todo que volver atrás no es inmediato —para la interfaz es un
 * botón, para el sistema es copiar archivos—. Es un `Dialogo` con su propio
 * botón y no un `confirm()`: quien confirma tiene que poder leerlo.
 *
 * Se abre ENCIMA del modal de Ajustes y cerrarlo no lo cierra: `Dialogo` no
 * deja subir su `close` por el árbol.
 */
export function ConfirmarAccion({
  abierta,
  titulo,
  puntos,
  boton,
  peligro,
  onConfirmar,
  onCerrar,
}: {
  abierta: boolean;
  titulo: string;
  puntos: string[];
  boton: string;
  peligro: boolean;
  onConfirmar: () => Promise<boolean>;
  onCerrar: () => void;
}): React.ReactElement {
  const [enviando, setEnviando] = useState(false);

  async function confirmar(): Promise<void> {
    setEnviando(true);
    const ok = await onConfirmar();
    setEnviando(false);
    if (ok) onCerrar();
  }

  return (
    <Dialogo
      abierto={abierta}
      onCerrar={onCerrar}
      titulo={titulo}
      pie={
        <>
          <Button variant="outline" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button
            variant={peligro ? 'destructive' : 'primary'}
            disabled={enviando}
            onClick={() => void confirmar()}
          >
            {enviando ? 'Un momento…' : boton}
          </Button>
        </>
      }
    >
      <ul className="list-disc space-y-1 pl-5 text-sm text-secondary-foreground">
        {puntos.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
    </Dialogo>
  );
}

/**
 * Editar el nombre y el contexto general de una carpeta compartida. La carpeta
 * en disco (el slug) no se cambia: es la ruta en cada espacio.
 */
export function EditarCarpetaDialog({
  carpeta,
  onCerrar,
  onGuardar,
}: {
  carpeta: Circulo | null;
  onCerrar: () => void;
  onGuardar: (patch: { nombre?: string; contexto?: string }) => Promise<boolean>;
}): React.ReactElement {
  const [nombre, setNombre] = useState('');
  const [contexto, setContexto] = useState('');
  const [guardando, setGuardando] = useState(false);

  // Cada vez que se abre con otra carpeta, el formulario arranca de lo guardado.
  useEffect(() => {
    if (!carpeta) return;
    setNombre(carpeta.nombre);
    setContexto(carpeta.contexto);
  }, [carpeta]);

  const cambio = carpeta !== null && (nombre.trim() !== carpeta.nombre || contexto !== carpeta.contexto);

  async function guardar(): Promise<void> {
    if (!carpeta || !cambio || !nombre.trim()) return;
    setGuardando(true);
    const ok = await onGuardar({
      ...(nombre.trim() !== carpeta.nombre ? { nombre: nombre.trim() } : {}),
      ...(contexto !== carpeta.contexto ? { contexto } : {}),
    });
    setGuardando(false);
    if (ok) onCerrar();
  }

  return (
    <Dialogo
      abierto={carpeta !== null}
      onCerrar={onCerrar}
      ancho={640}
      onSubmit={() => void guardar()}
      titulo="Editar carpeta compartida"
      descripcion={
        carpeta ? (
          <>
            En cada espacio: <code>contexto-org/{carpeta.slug}/</code> — no se cambia.
          </>
        ) : undefined
      }
      pie={
        <>
          <Button variant="outline" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button type="submit" disabled={!cambio || !nombre.trim() || guardando}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <label className="block">
          <span className="mb-1 block text-xs text-muted-foreground">Nombre</span>
          <input className={INPUT_CLASS} value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-muted-foreground">
            Contexto general — lo leen todos los espacios con los que se comparte, y su IA, en el LEEME.md
          </span>
          <textarea
            className={`${INPUT_CLASS} min-h-40 font-mono text-xs`}
            value={contexto}
            placeholder="Para qué existe esta carpeta y qué tiene que saber cada equipo del otro."
            onChange={(e) => setContexto(e.target.value)}
          />
        </label>
      </div>
    </Dialogo>
  );
}

export function NuevoCirculo({
  onCrear,
  vacio,
}: {
  onCrear: (input: { slug: string; nombre: string; contexto?: string }) => Promise<boolean>;
  vacio: boolean;
}): React.ReactElement {
  const [nombre, setNombre] = useState('');
  const [slug, setSlug] = useState('');
  /** Mientras nadie toque el slug, sigue al nombre. Una vez editado a mano, es de quien lo editó. */
  const [slugTocado, setSlugTocado] = useState(false);
  const [contexto, setContexto] = useState('');
  const [creando, setCreando] = useState(false);

  const slugFinal = slugTocado ? slug : slugDeNombre(nombre);
  const valido = nombre.trim().length > 0 && slugValido(slugFinal);

  async function crear(): Promise<void> {
    setCreando(true);
    const ok = await onCrear({
      nombre: nombre.trim(),
      slug: slugFinal,
      ...(contexto.trim() ? { contexto } : {}),
    });
    setCreando(false);
    if (ok) {
      setNombre('');
      setSlug('');
      setSlugTocado(false);
      setContexto('');
    }
  }

  return (
    <div className={PANEL_CLASS}>
      <h3 className="mb-1 text-sm font-semibold text-foreground">
        {vacio ? 'Crear la primera carpeta compartida' : 'Nueva carpeta compartida'}
      </h3>
      {vacio && (
        <p className="mb-3 text-xs text-muted-foreground">
          Por ejemplo «Producto», con diseño y desarrollo adentro: lo que diseño publica le llega a desarrollo, y al
          revés.
        </p>
      )}
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-56 flex-1">
          <span className="mb-1 block text-xs text-muted-foreground">Nombre</span>
          <input
            className={INPUT_CLASS}
            value={nombre}
            placeholder="Producto"
            onChange={(e) => setNombre(e.target.value)}
          />
        </label>
        <label className="w-56">
          <span className="mb-1 block text-xs text-muted-foreground">Carpeta (no se cambia después)</span>
          <input
            className={`${INPUT_CLASS} font-mono`}
            value={slugFinal}
            placeholder="producto"
            onChange={(e) => {
              setSlugTocado(true);
              setSlug(e.target.value);
            }}
          />
        </label>
      </div>
      {slugFinal && !slugValido(slugFinal) && (
        <p className="mt-1 text-xs text-[var(--sw-warning)]">
          La carpeta va en minúsculas, números y guiones, y empieza con letra o número.
        </p>
      )}
      <label className="mt-3 block">
        <span className="mb-1 block text-xs text-muted-foreground">
          Contexto general (opcional, se puede escribir después)
        </span>
        <textarea
          className={`${INPUT_CLASS} min-h-20 font-mono text-xs`}
          value={contexto}
          placeholder="Para qué existe esta carpeta y qué tiene que saber cada equipo del otro."
          onChange={(e) => setContexto(e.target.value)}
        />
      </label>
      <div className="mt-3">
        <Button variant="primary" disabled={!valido || creando} onClick={() => void crear()}>
          Crear carpeta compartida
        </Button>
      </div>
    </div>
  );
}

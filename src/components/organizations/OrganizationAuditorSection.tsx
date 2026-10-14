import React, { useCallback, useEffect, useState } from 'react';
import {
  decidirRevision,
  getAuditoria,
  guardarAuditoria,
  listarRevisiones,
  type Auditoria,
  type Circulo,
  type EstadoRevision,
  type ProyectoDeRed,
  type Revision,
} from '../../lib/red-de-contexto-api.js';
import { startAuditorLogin } from '../../lib/executor-login-api.js';
import { bytesAMb, estadoDeRevision, etiquetaDeMotivo, mbABytes } from '../../modules/red-de-contexto/auditoria.js';
import { ExecutorLoginPrompt } from '../Chat/ExecutorLoginPrompt.js';
import { StatusBadge } from '../ui/atoms/StatusBadge.js';
import { mensajeDeError } from './errores.js';
import { Button } from '../ui/atoms/Button.js';

/** Mismas superficies que la sección de la red: viven en el mismo panel. */
const PANEL_CLASS = 'rounded-xl border border-border bg-muted p-4';
const INPUT_CLASS =
  'w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary [&>option]:bg-popover [&>option]:text-popover-foreground';

const FILTROS: Array<{ valor: EstadoRevision; etiqueta: string }> = [
  { valor: 'cuarentena', etiqueta: 'En cuarentena' },
  { valor: 'pendiente', etiqueta: 'Pendientes' },
  { valor: 'rechazado', etiqueta: 'Rechazados' },
  { valor: 'aprobado', etiqueta: 'Aprobados' },
];

/**
 * EL AUDITOR DE LA RED DE CONTEXTO, del lado de la organización
 * (`MOD-0007:manage`).
 *
 * Revisa lo que cada espacio publica antes de que llegue a los demás: con la
 * auditoría prendida, a un círculo sólo le llega lo aprobado. Todo lo que no
 * pasa —formato, secreto, tamaño, contenido de otro círculo, o lo que retuvo el
 * auditor— queda en cuarentena con su nota, y esta bandeja es donde una persona
 * lo arregla o decide. Aprobar hace que viaje; rechazar lo deja afuera.
 *
 * Es también, por ahora, la notificación: lo que espera a una persona está acá.
 */
export function OrganizationAuditorSection({
  organizationId,
  circulos,
  proyectos,
  vista,
  onCambio,
}: {
  organizationId: string;
  circulos: Circulo[];
  proyectos: ProyectoDeRed[];
  /** Qué pestaña es: qué valida el auditor (`reglas`), o lo que retuvo (`bandeja`). */
  vista: 'reglas' | 'bandeja';
  /** Algo cambió (una decisión, la configuración): quien tiene el contador lo recarga. */
  onCambio?: () => void;
}): React.ReactElement {
  const [auditoria, setAuditoria] = useState<Auditoria | null>(null);
  const [revisiones, setRevisiones] = useState<Revision[]>([]);
  const [filtro, setFiltro] = useState<EstadoRevision>('cuarentena');
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    try {
      const [a, r] = await Promise.all([getAuditoria(organizationId), listarRevisiones(organizationId, filtro)]);
      setAuditoria(a);
      setRevisiones(r);
      setError(null);
    } catch (err) {
      setError(mensajeDeError(err, 'No se pudo cargar el auditor'));
    }
  }, [organizationId, filtro]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function accion(fn: () => Promise<unknown>, fallback: string): Promise<boolean> {
    setError(null);
    try {
      await fn();
      await refresh();
      onCambio?.();
      return true;
    } catch (err) {
      setError(mensajeDeError(err, fallback));
      return false;
    }
  }

  const nombreDeCirculo = new Map(circulos.map((c) => [c.id, c.nombre]));
  const nombreDeProyecto = new Map(proyectos.map((p) => [p.id, p.name]));

  const sesionVencida = auditoria?.auditor.sesion_vencida && (
    <div className={`${PANEL_CLASS} border-[var(--sw-warning)]`}>
      <p className="mb-2 text-sm text-[var(--sw-warning)]">
        La sesión del auditor venció: no se está revisando nada. Lo nuevo queda retenido hasta que vuelva a iniciar.
      </p>
      <ExecutorLoginPrompt
        projectId={null}
        iniciar={startAuditorLogin}
        textoOk="El auditor retoma en unos minutos."
        onResuelto={() => void refresh()}
      />
    </div>
  );

  return (
    <section>
      <p className="mb-3 text-xs text-muted-foreground">
        {vista === 'reglas'
          ? 'Revisa lo que cada espacio publica antes de que llegue a los demás. Acá se decide qué valida.'
          : 'Lo que no pasó la revisión queda acá, con su nota, y sólo sale si alguien lo aprueba.'}
      </p>

      {error && (
        <div className="mb-3 rounded-lg border border-[var(--sw-error)] bg-[var(--sw-error-bg)] px-3 py-2 text-sm text-[var(--sw-on-error)]">
          {error}
        </div>
      )}

      {auditoria && (
        <div className="space-y-4">
          {sesionVencida}

          {vista === 'reglas' ? (
            <Configuracion
              auditoria={auditoria}
              onGuardar={(patch) =>
                accion(() => guardarAuditoria(organizationId, patch), 'No se pudo guardar el auditor')
              }
            />
          ) : (
            <div className={PANEL_CLASS}>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                {FILTROS.map((f) => (
                  <Button
                    key={f.valor}
                    variant={filtro === f.valor ? 'primary' : 'ghost'}
                    onClick={() => setFiltro(f.valor)}
                  >
                    {f.etiqueta} ({auditoria.conteos[f.valor] ?? 0})
                  </Button>
                ))}
              </div>

              {revisiones.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  {filtro === 'cuarentena' ? 'Nada esperando una decisión.' : 'Nada en este estado.'}
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {revisiones.map((r) => (
                    <FilaDeRevision
                      key={`${r.circulo_id}/${r.sha256}`}
                      revision={r}
                      circulo={nombreDeCirculo.get(r.circulo_id) ?? r.circulo_id}
                      proyecto={nombreDeProyecto.get(r.project_id) ?? r.project_id}
                      onDecidir={(estado, nota) =>
                        accion(
                          () =>
                            decidirRevision(organizationId, r, {
                              estado,
                              ...(nota ? { nota } : {}),
                            }),
                          'No se pudo guardar la decisión',
                        )
                      }
                    />
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function Configuracion({
  auditoria,
  onGuardar,
}: {
  auditoria: Auditoria;
  onGuardar: (patch: { activa?: boolean; reglas?: string; umbral_bytes?: number }) => Promise<boolean>;
}): React.ReactElement {
  const [reglas, setReglas] = useState(auditoria.reglas);
  const [umbral, setUmbral] = useState(bytesAMb(auditoria.umbral_bytes));
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    setReglas(auditoria.reglas);
    setUmbral(bytesAMb(auditoria.umbral_bytes));
  }, [auditoria.reglas, auditoria.umbral_bytes]);

  const umbralBytes = mbABytes(umbral);
  const cambio = reglas !== auditoria.reglas || (umbralBytes !== null && umbralBytes !== auditoria.umbral_bytes);

  async function guardar(patch: { activa?: boolean; reglas?: string; umbral_bytes?: number }): Promise<void> {
    setGuardando(true);
    await onGuardar(patch);
    setGuardando(false);
  }

  return (
    <div className={PANEL_CLASS}>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <StatusBadge
          label={auditoria.activa ? 'Auditando' : 'Apagado'}
          tone={auditoria.activa ? 'success' : 'neutral'}
        />
        <span className="flex-1 text-xs text-muted-foreground">
          {auditoria.activa
            ? 'A las carpetas compartidas sólo les llega lo aprobado.'
            : 'Apagado, todo lo publicado viaja sin revisión.'}
          {auditoria.auditor.ultima_revision_at &&
            ` Última revisión: ${new Date(auditoria.auditor.ultima_revision_at).toLocaleString()}.`}
        </span>
        <Button
          variant={auditoria.activa ? 'outline' : 'primary'}
          disabled={guardando}
          onClick={() => {
            if (
              auditoria.activa &&
              !window.confirm(
                '¿Apagar el auditor? Desde la próxima sincronización, todo lo publicado viaja sin revisión.',
              )
            )
              return;
            void guardar({ activa: !auditoria.activa });
          }}
        >
          {auditoria.activa ? 'Apagar' : 'Prender'}
        </Button>
      </div>

      <label className="block">
        <span className="mb-1 block text-xs text-muted-foreground">
          Reglas de la organización — qué no puede salir de un espacio, en tus palabras. Además de estas, el auditor
          siempre retiene credenciales, datos personales, instrucciones dirigidas a una IA y contenido de otra carpeta
          compartida.
        </span>
        <textarea
          className={`${INPUT_CLASS} min-h-24 text-xs`}
          value={reglas}
          placeholder="No se comparten precios ni márgenes negociados con clientes."
          onChange={(e) => setReglas(e.target.value)}
        />
      </label>

      <label className="mt-3 block w-64">
        <span className="mb-1 block text-xs text-muted-foreground">
          Por encima de este tamaño, cuarentena sin consultar a la IA (MB)
        </span>
        <input className={INPUT_CLASS} value={umbral} inputMode="decimal" onChange={(e) => setUmbral(e.target.value)} />
      </label>
      {umbral && umbralBytes === null && (
        <p className="mt-1 text-xs text-[var(--sw-warning)]">Tiene que ser un número mayor que cero.</p>
      )}

      {cambio && (
        <div className="mt-3 flex gap-2">
          <Button
            variant="primary"
            disabled={guardando || umbralBytes === null}
            onClick={() =>
              void guardar({
                ...(reglas !== auditoria.reglas ? { reglas } : {}),
                ...(umbralBytes !== null && umbralBytes !== auditoria.umbral_bytes
                  ? { umbral_bytes: umbralBytes }
                  : {}),
              })
            }
          >
            Guardar
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setReglas(auditoria.reglas);
              setUmbral(bytesAMb(auditoria.umbral_bytes));
            }}
          >
            Descartar
          </Button>
        </div>
      )}
    </div>
  );
}

function FilaDeRevision({
  revision: r,
  circulo,
  proyecto,
  onDecidir,
}: {
  revision: Revision;
  circulo: string;
  proyecto: string;
  onDecidir: (estado: 'aprobado' | 'rechazado', nota: string) => Promise<boolean>;
}): React.ReactElement {
  const [nota, setNota] = useState('');
  const [decidiendo, setDecidiendo] = useState(false);
  const e = estadoDeRevision(r.estado);

  async function decidir(estado: 'aprobado' | 'rechazado'): Promise<void> {
    setDecidiendo(true);
    const ok = await onDecidir(estado, nota.trim());
    setDecidiendo(false);
    if (ok) setNota('');
  }

  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge label={e.etiqueta} tone={e.tono} />
        <code className="text-sm text-foreground">{r.ruta}</code>
        <span className="text-xs text-muted-foreground">
          de {proyecto} · en {circulo} · {etiquetaDeMotivo(r.motivo)}
        </span>
      </div>

      {r.explicacion && <p className="mt-2 text-xs text-secondary-foreground">{r.explicacion}</p>}
      {r.hallazgos.length > 0 && (
        <ul className="mt-1 list-disc pl-5 text-xs text-muted-foreground">
          {r.hallazgos.map((h, i) => (
            <li key={i}>
              {h.regla} — {h.ubicacion}
            </li>
          ))}
        </ul>
      )}
      {r.estado === 'pendiente' && r.ultimo_error && (
        <p className="mt-1 text-xs text-[var(--sw-warning)]">
          El auditor no pudo revisarlo ({r.intentos} intento
          {r.intentos === 1 ? '' : 's'}): {r.ultimo_error}
        </p>
      )}
      {r.nota && <p className="mt-1 text-xs text-muted-foreground">Nota de quien decidió: {r.nota}</p>}

      {r.estado !== 'aprobado' && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            className={`${INPUT_CLASS} max-w-md text-xs`}
            value={nota}
            placeholder="Nota para quien lo publicó (opcional)"
            onChange={(ev) => setNota(ev.target.value)}
          />
          <Button
            variant="outline"
            disabled={decidiendo}
            onClick={() => void decidir('aprobado')}
          >
            Aprobar y compartir
          </Button>
          {r.estado !== 'rechazado' && (
            <Button
              variant="destructive"
              disabled={decidiendo}
              onClick={() => void decidir('rechazado')}
            >
              Rechazar
            </Button>
          )}
        </div>
      )}
    </li>
  );
}

import React, { useEffect, useRef, useState } from 'react';
import { xmlToToonByNotation, validateAnsiDiagram, type AnsiLintWarning } from '../../lib/drawio-to-toon.js';

interface Props {
  /** Initial XML loaded from the .drawio file (empty string = new diagram). */
  initialXml: string;
  /**
   * Optional notation hint — controls (1) which TOON converter is used on save and
   * (2) which drawio palette is opened by default. `null`/missing = generic.
   */
  notation?: string | null;
  /** Called whenever the user saves; receives both XML (for the .drawio file) and TOON (for the MD block). */
  onSave: (xml: string, toon: string) => void;
}

const DRAWIO_URL =
  'https://embed.diagrams.net/?embed=1&proto=json&spin=1&ui=atlas&libraries=1&saveAndExit=0&noExitBtn=1&modified=unsavedChanges';


const EMPTY_XML =
  '<mxfile><diagram><mxGraphModel><root><mxCell id="0" /><mxCell id="1" parent="0" /></root></mxGraphModel></diagram></mxfile>';

/**
 * Drawio embedded editor.
 * The XML in the .drawio file is the source of truth for visual editing.
 * On every save (manual or autosave) we regenerate the TOON block of the .md.
 */
export function DrawioEditor({ initialXml, notation, onSave }: Props): React.ReactElement {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [status, setStatus] = useState<string>('Cargando drawio...');
  const [fullscreen, setFullscreen] = useState(false);
  const [warnings, setWarnings] = useState<AnsiLintWarning[]>([]);

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape' && fullscreen) setFullscreen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullscreen]);

  useEffect(() => {
    function onMessage(event: MessageEvent): void {
      if (event.origin !== 'https://embed.diagrams.net') return;
      if (typeof event.data !== 'string') return;

      let msg: { event?: string; xml?: string } = {};
      try {
        msg = JSON.parse(event.data) as { event?: string; xml?: string };
      } catch {
        return;
      }

      const iframe = iframeRef.current;
      if (!iframe?.contentWindow) return;

      switch (msg.event) {
        case 'init':
          setStatus('Listo' + (notation ? ` (${notation})` : ''));
          iframe.contentWindow.postMessage(
            JSON.stringify({
              action: 'load',
              xml: initialXml || EMPTY_XML,
              autosave: 0,
            }),
            'https://embed.diagrams.net',
          );
          break;

        case 'save':
          if (msg.xml) {
            try {
              const toon = xmlToToonByNotation(msg.xml, notation ?? null);
              onSave(msg.xml, toon);
              // Run ANSI validation only when the diagram declares the notation;
              // for generic flows there is no contract to enforce.
              if (notation === 'ansi-iso-5807') {
                const w = validateAnsiDiagram(msg.xml);
                setWarnings(w);
                setStatus(w.length === 0 ? 'Guardado ✓' : `Guardado con ${w.length} error${w.length === 1 ? '' : 'es'} de modelado`);
              } else {
                setWarnings([]);
                setStatus('Guardado');
              }
            } catch (err) {
              setStatus(
                'Error al generar TOON: ' +
                  (err instanceof Error ? err.message : String(err)),
              );
            }
          }
          break;

        case 'exit':
          // Ignored — we use saveAndExit=0
          break;

        default:
          break;
      }
    }

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [initialXml, notation, onSave]);

  function highlightCell(cellId: string): void {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    iframe.contentWindow.postMessage(
      JSON.stringify({ action: 'selectCells', ids: [cellId], force: true }),
      'https://embed.diagrams.net',
    );
  }

  return (
    <div className={'drawio-editor' + (fullscreen ? ' drawio-fullscreen' : '')}>
      <div className="drawio-status">
        <span>{status}</span>
        <button
          type="button"
          className="drawio-fs-btn"
          onClick={() => setFullscreen((v) => !v)}
          title={fullscreen ? 'Salir de pantalla completa (Esc)' : 'Pantalla completa'}
        >
          {fullscreen ? '⤢ Salir' : '⛶ Pantalla completa'}
        </button>
      </div>
      {warnings.length > 0 && (
        <div className="drawio-warnings" role="alert">
          <div className="drawio-warnings-title">
            ✕ {warnings.length} {warnings.length === 1 ? 'error' : 'errores'} de modelado (ANSI/ISO 5807) — corregilos antes de continuar
          </div>
          <ul className="drawio-warnings-list">
            {warnings.map((w, i) => (
              <li key={`${w.code}-${i}`} className="drawio-warning-item">
                <span className="drawio-warning-msg">{w.message}</span>
                {w.cellId && (
                  <button
                    type="button"
                    className="drawio-warning-locate"
                    onClick={() => highlightCell(w.cellId!)}
                    title="Seleccionar el nodo en el diagrama"
                  >
                    Ver en diagrama
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      <iframe
        ref={iframeRef}
        title="drawio editor"
        src={DRAWIO_URL}
        className="drawio-iframe"
      />
    </div>
  );
}

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { xmlToToonByNotation, validateAnsiDiagram, type AnsiLintWarning } from '../../lib/drawio-to-toon.js';

interface Props {
  initialXml: string;
  notation?: string | null;
  onSave: (xml: string, toon: string) => void;
}

function buildDrawioUrl(notation?: string | null): string {
  const base = 'https://embed.diagrams.net/?embed=1&proto=json&spin=1&ui=atlas&saveAndExit=0&noExitBtn=1&modified=unsavedChanges&configure=1';
  if (notation === 'ansi-iso-5807') {
    return base + '&libs=flowchart';
  }
  return base;
}

const EMPTY_XML =
  '<mxfile><diagram><mxGraphModel><root><mxCell id="0" /><mxCell id="1" parent="0" /></root></mxGraphModel></diagram></mxfile>';

// Shapes shown in the custom toolbox. Each shape is inserted via action:'load'
// with the accumulated XML + new cell appended.
interface ShapeDef {
  label: string;
  icon: string;
  style: string;
  w: number;
  h: number;
}

const ANSI_SHAPES: ShapeDef[] = [
  { label: 'Proceso',           icon: '▭', style: 'rounded=0;whiteSpace=wrap;html=1;',                      w: 160, h: 60 },
  { label: 'Decisión',          icon: '◇', style: 'rhombus;whiteSpace=wrap;html=1;',                        w: 160, h: 80 },
  { label: 'Terminador',        icon: '⬭', style: 'ellipse;whiteSpace=wrap;html=1;',                        w: 120, h: 60 },
  { label: 'Off-page',          icon: '⬠', style: 'shape=offPageConnector;whiteSpace=wrap;html=1;',         w: 80,  h: 60 },
  { label: 'On-page',           icon: '○', style: 'ellipse;whiteSpace=wrap;html=1;aspect=fixed;',           w: 40,  h: 40 },
];

let cellCounter = 100;
function makeCell(style: string, label: string, w: number, h: number): string {
  const id = `inserted-${cellCounter++}`;
  return `<mxCell id="${id}" value="${label}" style="${style}" vertex="1" parent="1"><mxGeometry x="100" y="100" width="${w}" height="${h}" as="geometry"/></mxCell>`;
}

function injectCell(currentXml: string, style: string, label: string, w: number, h: number): string {
  const cell = makeCell(style, label, w, h);
  // Insert before </root>
  return currentXml.replace('</root>', `${cell}</root>`);
}

export function DrawioEditor({ initialXml, notation, onSave }: Props): React.ReactElement {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [status, setStatus] = useState<string>('Cargando drawio...');
  const [fullscreen, setFullscreen] = useState(false);
  const [warnings, setWarnings] = useState<AnsiLintWarning[]>([]);
  // Track the current XML so we can inject cells into it
  const currentXmlRef = useRef<string>(initialXml || EMPTY_XML);

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape' && fullscreen) setFullscreen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullscreen]);

  useEffect(() => {
    currentXmlRef.current = initialXml || EMPTY_XML;
  }, [initialXml]);

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
        case 'configure':
          iframe.contentWindow.postMessage(
            JSON.stringify({ action: 'configure', config: {} }),
            'https://embed.diagrams.net',
          );
          break;

        case 'init':
          setStatus('Listo' + (notation ? ` (${notation})` : ''));
          iframe.contentWindow.postMessage(
            JSON.stringify({
              action: 'load',
              xml: currentXmlRef.current,
              autosave: 0,
            }),
            'https://embed.diagrams.net',
          );
          break;

        case 'save':
          if (msg.xml) {
            currentXmlRef.current = msg.xml;
            try {
              const toon = xmlToToonByNotation(msg.xml, notation ?? null);
              onSave(msg.xml, toon);
              if (notation === 'ansi-iso-5807') {
                const w = validateAnsiDiagram(msg.xml);
                setWarnings(w);
                setStatus(w.length === 0 ? 'Guardado ✓' : `Guardado con ${w.length} error${w.length === 1 ? '' : 'es'} de modelado`);
              } else {
                setWarnings([]);
                setStatus('Guardado');
              }
            } catch (err) {
              setStatus('Error al generar TOON: ' + (err instanceof Error ? err.message : String(err)));
            }
          }
          break;

        case 'exit':
          break;

        default:
          break;
      }
    }

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [initialXml, notation, onSave]);

  const insertShape = useCallback((shape: ShapeDef) => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    const newXml = injectCell(currentXmlRef.current, shape.style, shape.label, shape.w, shape.h);
    currentXmlRef.current = newXml;
    iframe.contentWindow.postMessage(
      JSON.stringify({ action: 'load', xml: newXml, autosave: 0 }),
      'https://embed.diagrams.net',
    );
  }, []);

  function highlightCell(cellId: string): void {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    iframe.contentWindow.postMessage(
      JSON.stringify({ action: 'selectCells', ids: [cellId], force: true }),
      'https://embed.diagrams.net',
    );
  }

  const shapes = notation === 'ansi-iso-5807' || !notation ? ANSI_SHAPES : ANSI_SHAPES;

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
      <div className="drawio-workspace">
        <div className="drawio-toolbox">
          <div className="drawio-toolbox-title">Formas</div>
          {shapes.map((shape) => (
            <button
              key={shape.label}
              type="button"
              className="drawio-toolbox-item"
              onClick={() => insertShape(shape)}
              title={`Insertar: ${shape.label}`}
            >
              <span className="drawio-toolbox-icon">{shape.icon}</span>
              <span className="drawio-toolbox-label">{shape.label}</span>
            </button>
          ))}
        </div>
        <iframe
          ref={iframeRef}
          title="drawio editor"
          src={buildDrawioUrl(notation)}
          className="drawio-iframe"
        />
      </div>
    </div>
  );
}

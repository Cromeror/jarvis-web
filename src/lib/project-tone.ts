// Orden validado con el método de paleta categórica (ver dataviz skill):
// pasa piso de chroma, separación CVD y contraste — la anterior (con indigo y
// cyan-700) fallaba el piso de chroma y tenía un par adyacente al límite.
// indigo queda afuera a propósito: es el color de marca/primario, y un tag de
// proyecto en indigo se confundiría con "activo".
const PROJECT_CHIP_TONES = [
  'bg-blue-100 text-blue-600',
  'bg-emerald-100 text-emerald-600',
  'bg-rose-100 text-rose-600',
  'bg-amber-100 text-amber-600',
  'bg-cyan-100 text-cyan-600',
  'bg-violet-100 text-violet-600',
];

/** Deterministic tone per project name, so the same project always gets the same chip color wherever it's shown. */
export function toneForProject(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return PROJECT_CHIP_TONES[Math.abs(hash) % PROJECT_CHIP_TONES.length]!;
}

/**
 * Lazy mermaid loader — imports mermaid only when first needed.
 * Design §Mermaid integration.
 */

let mermaidInstance: typeof import('mermaid').default | null = null;
let initPromise: Promise<typeof import('mermaid').default> | null = null;

export async function getMermaid(): Promise<typeof import('mermaid').default> {
  if (mermaidInstance) return mermaidInstance;

  if (!initPromise) {
    initPromise = import('mermaid').then((mod) => {
      const m = mod.default;
      m.initialize({
        startOnLoad: false,
        theme: 'default',
        securityLevel: 'loose',
      });
      mermaidInstance = m;
      return m;
    });
  }

  return initPromise;
}

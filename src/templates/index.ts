import type { DocType } from '../lib/markdown-parser.js';
import { flujoTemplate } from './flujo.md.js';
import { arquitecturaTemplate } from './arquitectura.md.js';
import { genericoTemplate } from './generico.md.js';

export function getTemplate(type: DocType, title: string): string {
  switch (type) {
    case 'flujo':
      return flujoTemplate(title);
    case 'arquitectura':
      return arquitecturaTemplate(title);
    case 'generico':
    default:
      return genericoTemplate(title);
  }
}

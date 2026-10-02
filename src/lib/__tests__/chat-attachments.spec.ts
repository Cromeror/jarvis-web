import { describe, it, expect } from 'vitest';
import {
  ACCEPTED_ATTACHMENT_EXTENSIONS,
  attachmentIconName,
  describeAttachment,
  splitByAcceptedFormat,
} from '../chat-attachments.js';

/** Un File de mentira: de un adjunto sólo se miran `name` y `size`. */
function archivo(name: string, size = 1024): File {
  const file = new File(['x'], name);
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

describe('splitByAcceptedFormat', () => {
  it('parte en lo que se puede mandar y lo que no, y los rechazados vuelven por nombre', () => {
    const { accepted, rejected } = splitByAcceptedFormat([
      archivo('tablero.png'),
      archivo('contrato.docx'),
      archivo('notas.md'),
      archivo('backup.zip'),
    ]);
    expect(accepted.map((f) => f.name)).toEqual(['tablero.png', 'notas.md']);
    expect(rejected).toEqual(['contrato.docx', 'backup.zip']);
  });

  it('la extensión se mira sin distinguir mayúsculas — el disco de Windows las trae así', () => {
    const { accepted } = splitByAcceptedFormat([archivo('CAPTURA.PNG')]);
    expect(accepted).toHaveLength(1);
  });

  it('un nombre sin extensión no pasa: el servidor decide por extensión Y firma', () => {
    const { accepted, rejected } = splitByAcceptedFormat([archivo('README')]);
    expect(accepted).toHaveLength(0);
    expect(rejected).toEqual(['README']);
  });
});

/**
 * El espejo del catálogo del servidor. Si allá se agrega un formato y acá no,
 * el composer rechaza un archivo que la API hubiera aceptado — y al revés, lo
 * deja subir 10 MB para que el servidor lo tire.
 */
describe('ACCEPTED_ATTACHMENT_EXTENSIONS', () => {
  it('dice lo mismo que ALLOWED_ATTACHMENT_EXTENSIONS del core', () => {
    expect([...ACCEPTED_ATTACHMENT_EXTENSIONS].sort()).toEqual(
      ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.pdf', '.md', '.markdown'].sort(),
    );
  });
});

describe('el chip', () => {
  it('lleva el ícono según se vea o se lea', () => {
    expect(attachmentIconName(archivo('tablero.png'))).toBe('image');
    expect(attachmentIconName(archivo('contrato.pdf'))).toBe('doc');
  });

  it('su title es «nombre · tipo · peso», como en el composer del template', () => {
    expect(describeAttachment(archivo('contrato.pdf', 2 * 1024 * 1024))).toBe('contrato.pdf · PDF · 2.0 MB');
  });
});

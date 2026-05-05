export const flujoTemplate = (titulo: string): string => `# ${titulo}

## Resumen

> Descripción breve del flujo.

## Actores

- Actor 1
- Actor 2

## Precondiciones

- Condición previa 1

## Pasos

\`\`\`mermaid
sequenceDiagram
  actor PM
  PM->>Sistema: acción
\`\`\`

## Casos alternos

\`\`\`mermaid
flowchart TD
  A[Inicio] --> B{Condición}
  B -- Sí --> C[Resultado]
  B -- No --> D[Alternativa]
\`\`\`

## Reglas de negocio

- RN-1:

## Notas

## Referencias

- [Notion](https://notion.so/...)
`;

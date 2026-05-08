export const flujoTemplate = (titulo: string): string => {
  const slug = titulo
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `# ${titulo}

## Resumen

> Descripción breve del flujo.

## Actores

- Actor 1
- Actor 2

## Precondiciones

- Condición previa 1

## Pasos

<!-- jarvis:diagram src=diagrams/${slug}-pasos.drawio -->

\`\`\`toon
diagram: flow
direction: LR
nodes[0]{id,label,shape,group}:
edges[0]{from,to,label}:
\`\`\`

## Casos alternos

<!-- jarvis:diagram src=diagrams/${slug}-alternos.drawio -->

\`\`\`toon
diagram: flow
direction: LR
nodes[0]{id,label,shape,group}:
edges[0]{from,to,label}:
\`\`\`

## Reglas de negocio

- RN-1:

## Notas

## Referencias

- [Notion](https://notion.so/...)
`;
};

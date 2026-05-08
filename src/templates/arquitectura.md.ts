export const arquitecturaTemplate = (titulo: string): string => {
  const slug = titulo
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `# ${titulo}

## Resumen

> Descripción del componente o módulo.

## Diagrama

<!-- jarvis:diagram src=diagrams/${slug}.drawio -->

\`\`\`toon
diagram: flow
direction: LR
nodes[0]{id,label,shape,group}:
edges[0]{from,to,label}:
\`\`\`

## Componentes

| Componente | Responsabilidad |
|------------|-----------------|
| -          | -               |

## Dependencias

- dep-1

## Decisiones

| Decisión | Justificación |
|----------|---------------|
| -        | -             |

## Referencias
`;
};

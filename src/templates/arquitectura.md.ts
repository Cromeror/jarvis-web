export const arquitecturaTemplate = (titulo: string): string => `# ${titulo}

## Resumen

> Descripción del componente o módulo.

## Diagrama

\`\`\`mermaid
C4Context
  title Diagrama de contexto
  Person(user, "Usuario")
  System(sistema, "Sistema")
  Rel(user, sistema, "usa")
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

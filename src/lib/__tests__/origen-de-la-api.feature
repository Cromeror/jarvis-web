# language: es
Característica: El front habla con una API que puede estar en otro origen

  Este repo se separó del monorepo de Jarvis cuando la API dejó de servir la
  SPA. Desde entonces el front y la API son dos despliegues independientes, y
  este archivo especifica la mitad que le toca al front: **cómo resuelve dónde
  está la API**.

  LA OTRA MITAD VIVE EN EL CORE. Que `http-api` no sirva el bundle, que los dos
  despliegues sean independientes y el CORS que lo habilita se especifican en
  `packages/http-api/src/__tests__/despliegue-web-desacoplado.feature` del repo
  `jarvis-agent`. El contrato está partido porque los repos lo están: un parity
  no puede leer specs del otro lado.

  EL DEFAULT NO PUEDE ROMPER NADA. Sin `VITE_API_URL`, el origen es la cadena
  vacía y toda URL queda relativa — que es lo que hace que un checkout recién
  clonado ande sin leer un runbook, y lo que sigue funcionando cuando un proxy
  publica el front y la API bajo el mismo origen. La configuración habilita la
  separación, no la impone.

  EL MODO DE FALLA A EVITAR ES SILENCIOSO. El interceptor de `fetch`
  (`src/lib/auth-fetch-interceptor.ts`) reconocía una llamada a la API con
  `url.startsWith('/api/')`. Con un origen absoluto ese prefijo deja de
  matchear y el interceptor deja de hacer sus TRES trabajos: no manda el
  `Authorization`, no guarda el `X-Jarvis-Token` renovado y no reacciona al
  401. Nada tira una excepción — la app simplemente empieza a deslogearse
  sola. Por eso `apiRequestPath()` normaliza ANTES de decidir.

  Y LOS STREAMS NO PASAN POR EL INTERCEPTOR. Hay CINCO `EventSource` (chat,
  plan-runs, pipelines, login, file/watch) y `EventSource` no pasa por
  `window.fetch` ni admite header `Authorization` — de ahí que su token viaje
  por query string. Resolver el origen sólo en el interceptor dejaría los cinco
  apuntando al origen viejo: el chat se quedaría mudo sin un solo error en
  consola. Por eso hay un Escenario propio para SSE y otro que prohíbe
  construir el origen a mano.

  # --- Resolución del origen ---------------------------------------

  Escenario: Sin configuración, la API vive en el mismo origen
    Dado que no se declaró un origen para la API
    Cuando el front arma la URL de una llamada
    Entonces queda relativa, igual que hoy
    Y un checkout sin configurar sigue funcionando

  Escenario: Configurado otro origen, las llamadas salen hacia allá
    Dado un origen declarado para la API
    Cuando el front arma la URL de una llamada
    Entonces apunta a ese origen y conserva el path bajo /api

  Escenario: El interceptor reconoce la API también cuando la URL es absoluta
    Dado un origen declarado distinto del origen del front
    Cuando sale una llamada a la API
    Entonces el interceptor la reconoce como llamada a la API
    Y le adjunta el Authorization igual que a una relativa

  Escenario: El token renovado se guarda aunque la API esté en otro origen
    Dado una respuesta de la API con el header del token renovado
    Cuando el origen de la API no es el del front
    Entonces el token nuevo se guarda igual
    Y la sesión sigue deslizándose en vez de cortarse al techo absoluto

  Escenario: El 401 sigue cerrando la sesión con la API en otro origen
    Dado una llamada a la API que responde 401
    Cuando el origen de la API no es el del front
    Entonces la sesión se limpia y se redirige a /login

  Escenario: Los streams SSE resuelven contra el mismo origen que el resto
    Dado que EventSource no pasa por el interceptor de fetch
    Cuando el front abre cualquiera de sus cinco streams
    Entonces la URL sale del mismo resolvedor de origen que las llamadas fetch

  Escenario: Ningún módulo del front escribe el origen a mano
    Cuando reviso los módulos del front que llaman a la API
    Entonces ninguno construye un origen absoluto literal
    Y el único lugar que decide el origen es el resolvedor compartido

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

  LOS STREAMS TAMBIÉN VAN POR `fetch`, Y ESO FUE UN CAMBIO DE TRANSPORTE. Los
  cinco (chat, plan-runs, pipelines, login, file/watch) usaban `EventSource`,
  que no pasa por `window.fetch` ni admite header `Authorization` — así que su
  única forma de autenticarse era mandar el JWT en la query, y eso lo dejaba
  escrito en los logs de acceso del reverse proxy y en el historial del
  navegador. Ahora van sobre `fetch` (`src/lib/sse-stream.ts`) y heredan las tres
  cosas del interceptor: token en el header, resolución del origen y manejo del
  401.

  Lo que hubo que reponer a mano es la RECONEXIÓN: `EventSource` la hacía el
  browser. Sin ella, un corte de red dejaría el chat mudo hasta un refresh. El
  Escenario de acá fija que nadie vuelva a `EventSource`; el backoff y el parseo
  del protocolo los cubre `sse-stream.spec.ts`.

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

  Escenario: Ningún stream se abre con EventSource
    Dado que EventSource no admite headers y obliga a mandar el JWT en la query
    Cuando reviso cómo el front abre sus cinco streams
    Entonces ninguno usa EventSource
    Y todos pasan por openSseStream, que va sobre fetch y hereda el interceptor

  Escenario: Ningún módulo del front escribe el origen a mano
    Cuando reviso los módulos del front que llaman a la API
    Entonces ninguno construye un origen absoluto literal
    Y el único lugar que decide el origen es el resolvedor compartido

  # --- El despliegue, que es independiente del de la API -------------------
  #
  # Estos tres venían del feature del core y se mudaron acá: hablan de lo que
  # hace (y no hace) el deploy de ESTE repo, y su script vive acá. El core no
  # puede leerlo — clonado solo, `../web` no existe.
  #
  # Son la razón de ser de toda la separación: mientras la SPA vivía dentro de
  # `http-api`, publicar front obligaba a reiniciar la API, y ese restart mata
  # las sesiones de chat en curso de TODOS los proyectos.

  Escenario: Publicar la web no reinicia el proceso de la API
    Dado un despliegue que sólo cambia archivos de este repo
    Cuando lo publico
    Entonces no se ejecuta "systemctl restart jarvis-api"

  Escenario: Una conversación en curso sobrevive a un despliegue de la web
    Dado un chat con un turno corriendo
    Cuando publico la web
    Entonces el turno sigue vivo y su sesión nativa no se reinicia

  Escenario: La web se revierte sin tocar la API
    Dado un bundle publicado que resultó defectuoso
    Cuando vuelvo al bundle anterior
    Entonces la API no se reinicia ni cambia de versión

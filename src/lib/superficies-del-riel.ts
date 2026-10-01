import type { CatalogSuite, CatalogModuleTool } from './catalog-api.js';

/**
 * QUÉ ENTRADAS TIENE EL RIEL — la regla sola, sin render.
 *
 * Vive fuera del componente por lo mismo que `proyecto-activo.ts`: es lo que
 * decide qué ve cada usuario, así que es lo que hay que poder fijar con tests.
 * Importar el componente para probarla arrastraría el registro de íconos, que
 * escribe en `window`.
 *
 * EL RIEL NO LISTA PROYECTOS EN NINGÚN NIVEL. El proyecto es el ÁMBITO —se
 * elige una vez, arriba del riel— y no un objeto que se navegue: listarlo
 * además en el nivel 2 de cada herramienta ponía la misma decisión en dos
 * lugares, y uno de los dos siempre iba a quedar desactualizado respecto del
 * otro. Elegido el ámbito, una herramienta ya sabe de qué proyecto es: entra
 * directo.
 */

/**
 * UNA HERRAMIENTA DEL MÓDULO.
 *
 * En la API esto se llama `moduleTool`, y acá NO: de este lado el vocabulario es
 * «herramienta», que es lo que el usuario lee y donde viven — la caja de
 * herramientas de la columna derecha. El renombre se detiene en este borde a
 * propósito: `CatalogModuleTool`, `runModuleTool` y `/api/catalog/moduleTools` son el
 * contrato con el otro repo, y traducirlo a medias —el tipo sí, el endpoint
 * no— dejaría dos nombres para lo mismo sin una línea que diga cuál es cuál.
 * Esta es esa línea.
 */
export type HerramientaDeMenu = {
  id: string;
  name: string;
  description: string | null;
  /** La tool que la respalda. `null` = declarada antes de que su tool exista. */
  toolName: string | null;
  /** La fila tal cual vino de la API, para quien tenga que hablarle de vuelta. */
  cruda: CatalogModuleTool;
};

export type ModuloDeMenu = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  herramientas: HerramientaDeMenu[];
};

export type Superficie = {
  /** El id es la ruta SIN proyecto: es lo estable entre dos ámbitos distintos. */
  id: string;
  /** A dónde lleva el clic — con el ámbito adentro cuando la sección lo admite. */
  to: string;
  /**
   * Con qué prefijo se decide que la ruta actual es de esta superficie, que NO
   * es `to`: una herramienta apunta a `/plans/<ámbito>` pero también es la
   * superficie de `/plans` pelado, que es la pantalla sin ámbito elegido.
   * Comparar contra `to` dejaría esa pantalla marcando el Dashboard.
   */
  match: string;
  icono: string;
  label: string;
  exacta?: boolean;
  /** Sin nivel 2: la pantalla ya es el destino. */
  directa?: boolean;
  /** Qué lista el nivel 2, para el rótulo del vacío. */
  unidad?: string;
  modulos?: ModuloDeMenu[];
  /** Va al pie del riel, detrás del borde que lo separa de las herramientas. */
  alPie?: boolean;
};

/**
 * Las herramientas del producto, y son DEL OPERADOR: el Dashboard mira el
 * estado de la flota, y Planes, Environments y Workspaces son la maquinaria con
 * la que se construye. Un cliente no opera nada de eso — entra a usar lo que
 * tiene contratado.
 *
 * TODAS SON DIRECTAS. Antes desplegaban un nivel 2 con la lista de proyectos,
 * que es justamente lo que el ámbito reemplazó.
 *
 * EL CHAT NO ESTÁ. No es una superficie del riel: es el panel flotante anclado
 * a la columna derecha, presente en todas las pantallas. Tenerlo también acá
 * daría dos vistas de la misma conversación y una de las dos se escribe sin
 * mirar — el mismo motivo por el que el flotante se escondía en `/chat`.
 */
const HERRAMIENTAS: { id: string; icono: string; label: string; conProyecto: boolean; exacta?: boolean }[] = [
  { id: '/', icono: 'grid', label: 'Dashboard', conProyecto: false, exacta: true },
  { id: '/plans', icono: 'listaCheck', label: 'Planes', conProyecto: true },
  { id: '/environments', icono: 'cubo', label: 'Environments', conProyecto: true },
  { id: '/workspaces', icono: 'folder', label: 'Workspaces', conProyecto: true },
];

/** Administración del producto: el catálogo y quién entra. Sólo el operador. */
const ADMINISTRACION: Superficie[] = [
  { id: '/catalogo', to: '/catalogo', match: '/catalogo', icono: 'lista', label: 'Catálogo', directa: true, alPie: true },
  { id: '/users', to: '/users', match: '/users', icono: 'users', label: 'Usuarios', directa: true, alPie: true },
];

/**
 * Dónde vive la pantalla de cada módulo de INSTALACIÓN.
 *
 * La ruta y el ícono son de la web; el nombre sale del módulo, que es quien lo
 * declara. Por eso el mapa lleva sólo lo primero: duplicar el label acá daría
 * dos nombres para la misma cosa y el día que no coincidan gana el equivocado.
 *
 * Una `key` que el servidor devuelva y no esté acá se ignora — es un módulo más
 * nuevo que este bundle, y perderse una entrada del riel es mejor que romperlo
 * entero por una ruta que no existe.
 */
const PANTALLAS_DE_INSTALACION: Record<string, { to: string; icono: string }> = {
  'port-grants-003': { to: '/puertos', icono: 'enchufe' },
};

/**
 * El riel que le toca a este usuario en este proyecto.
 *
 * SON DOS RIELES DISJUNTOS, no uno con recortes:
 *
 *  · EL CLIENTE VE SUS SUITES, Y NADA MÁS. Ni Dashboard ni la maquinaria del
 *    producto: entra a usar lo que tiene habilitado en su proyecto.
 *  · EL OPERADOR VE LA MAQUINARIA Y LA ADMINISTRACIÓN, y NO ve suites. No es
 *    una restricción: los módulos por proyecto son del modelo del cliente
 *    —organización → proyectos → suites habilitadas— y el operador es hoy
 *    superadmin del producto. Lo suyo es el catálogo entero desde `/catalogo`,
 *    que es de dónde salen las suites de todos; darle además los de un
 *    proyecto sería mostrarle un recorte de lo que ya administra completo, y
 *    encima atado a un ámbito que en su caso ni siquiera se autoelige.
 *
 * Sin proyecto elegido no hay suites que mostrar —no porque falten permisos,
 * sino porque la pregunta «¿cuáles?» todavía no tiene sujeto.
 *
 * ASÍ QUE EL RIEL DE UN CLIENTE PUEDE QUEDAR VACÍO: sin ámbito, o con un
 * proyecto sin suites habilitadas. No es un menú roto — el chat flotante está
 * en todas las pantallas y no se navega, así que sigue habiendo qué hacer. Lo
 * que no hay es a dónde ir, y eso es exactamente lo que pasa cuando a alguien
 * todavía no le habilitaron nada.
 */
export function superficiesDe(entrada: {
  suites: CatalogSuite[];
  projectId: string | null;
  esOperador: boolean;
  /**
   * Los módulos de instalación de esta entrega. Omitirlo = ninguno, y entonces
   * no se dibuja ninguna pantalla de instalación.
   *
   * Es opcional porque no todos los llamadores dibujan el riel —`rutaDeAterrizaje`
   * sólo quiere a dónde mandar a alguien— y un parámetro obligatorio los
   * obligaría a cargar algo que no usan. Quien dibuja el riel (`Sidebar`) sí lo
   * pasa.
   */
  modulosDeInstalacion?: { key: string; name: string }[];
}): Superficie[] {
  const { suites, projectId, esOperador, modulosDeInstalacion = [] } = entrada;

  const herramientas: Superficie[] = (esOperador ? HERRAMIENTAS : []).map((h) => ({
    id: h.id,
    match: h.id,
    /* El destino lleva el ámbito adentro: elegido el proyecto, una herramienta
       no vuelve a preguntar cuál. Sin ámbito cae a la ruta pelada, que es la
       que muestra el selector de la propia pantalla. */
    to: h.conProyecto && projectId ? `${h.id}/${projectId}` : h.id,
    icono: h.icono,
    label: h.label,
    exacta: h.exacta,
    directa: true,
  }));

  const deSuites: Superficie[] =
    projectId && !esOperador
      ? suites.map((suite) => ({
          id: `/suites/${suite.slug}`,
          to: `/suites/${projectId}/${suite.slug}`,
          match: `/suites/${projectId}/${suite.slug}`,
          icono: 'layers',
          label: suite.name,
          unidad: 'módulo',
          modulos: suite.modules.map((m) => ({
            id: `/suites/${projectId}/${suite.slug}/${m.slug}`,
            slug: m.slug,
            name: m.name,
            description: m.description,
            herramientas: m.module_tools.map((u: CatalogModuleTool) => ({
              id: u.id,
              name: u.name,
              description: u.description,
              toolName: u.tool_name,
              cruda: u,
            })),
          })),
        }))
      : [];

  /* Lo que la entrega trae compilado, y nada más: si el módulo no está en el
     artefacto el servidor no lo lista, así que la pantalla no se ofrece. Ése es
     el límite de un on-premise recortado — no una fila de configuración que el
     superadmin del cliente pueda editar. */
  const deInstalacion: Superficie[] = esOperador
    ? modulosDeInstalacion.flatMap((m) => {
        const pantalla = PANTALLAS_DE_INSTALACION[m.key];
        if (!pantalla) return [];
        return [{
          id: pantalla.to,
          to: pantalla.to,
          match: pantalla.to,
          icono: pantalla.icono,
          label: m.name,
          directa: true,
          alPie: true,
        }];
      })
    : [];

  return [...herramientas, ...deSuites, ...(esOperador ? ADMINISTRACION : []), ...deInstalacion];
}

/**
 * Qué superficie corresponde a una ruta.
 *
 * Se recorre AL REVÉS porque las rutas anidan: `/suites/p/facturacion` y
 * `/suites/p/facturacion/emision` matchean las dos por prefijo, y las
 * superficies de suite van después de las herramientas. Sin nada que matchee
 * cae en la primera —el Dashboard—, que es el único destino que siempre existe.
 */
export function superficieDeLaRuta(pathname: string, superficies: Superficie[]): Superficie | undefined {
  const calza = (s: Superficie): boolean =>
    s.exacta ? pathname === s.match : pathname === s.match || pathname.startsWith(`${s.match}/`);
  return [...superficies].reverse().find(calza) ?? superficies[0];
}

/**
 * QUÉ MÓDULO SE ESTÁ MIRANDO, a partir de la ruta.
 *
 * Existe porque las herramientas del módulo NO viven en el sidebar: viven en la
 * pestaña Herramientas de la columna derecha, que se dibuja desde el layout y
 * no desde el riel. Los dos necesitan leer la misma respuesta de navegación, y
 * el que pregunta «¿qué módulo?» no es el mismo que dibuja el menú.
 *
 * Se resuelve contra las superficies ya armadas y no contra la URL a secas: un
 * slug que la navegación no devolvió no es un módulo de este usuario, aunque la
 * ruta exista.
 *
 * EN LA SUITE SIN MÓDULO EN LA URL CAE AL PRIMERO, igual que `SuitePage`.
 * Esa página muestra el primer módulo cuando la ruta no dice cuál —entrar a un
 * suite y ver una pantalla vacía obligaría a un clic más—, así que sin este
 * fallback la caja de herramientas se quedaba vacía justo en la pantalla de
 * llegada: el centro mostraba un módulo y la derecha decía que no había
 * ninguno. Los dos tienen que caer al MISMO, o dicen cosas distintas de la
 * misma pantalla.
 */
export function moduloDeLaRuta(
  pathname: string,
  superficies: Superficie[],
): { modulo: ModuloDeMenu; suite: Superficie } | null {
  for (const s of superficies) {
    const modulo = s.modulos?.find((m) => m.id === pathname || pathname.startsWith(`${m.id}/`));
    if (modulo) return { modulo, suite: s };
  }
  for (const s of superficies) {
    const enLaSuite = pathname === s.to || pathname.startsWith(`${s.to}/`);
    const primero = s.modulos?.[0];
    if (enLaSuite && primero) return { modulo: primero, suite: s };
  }
  return null;
}

/**
 * DÓNDE ATERRIZA ESTE USUARIO.
 *
 * Existe porque `/` es el Dashboard y el Dashboard es del operador: un cliente
 * que entra cae en una pantalla que su propio riel no tiene. No alcanza con
 * sacarla del menú — si la ruta raíz sigue mostrándola, sigue mostrándose.
 *
 * Devuelve `null` cuando no hay a dónde ir, que es el caso real de un cliente
 * sin suites habilitadas. Ahí NO se inventa un destino: redirigir a algo que
 * tampoco le corresponde sería cambiar una pantalla equivocada por otra.
 */
export function rutaDeAterrizaje(superficies: Superficie[]): string | null {
  return superficies.find((s) => !s.alPie)?.to ?? null;
}

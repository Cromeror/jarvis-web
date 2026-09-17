/* ============================================================================
   SpaceMyWork — Iconos
   ----------------------------------------------------------------------------
   FUENTE UNICA DE ICONOS. Ningun componente escribe un <svg> literal ni define
   su propio helper. Se pide por nombre: window.SW.icon('clock').

   LUCIDE 1.43.0 (ISC). Se vendorizan los shapes, no la libreria: la PoC es
   vanilla, sin build y tiene que abrirse con doble clic sobre file://, asi que
   un <script> de CDN o un import ES no son opciones. Lo que hay aca es el arte
   real de Lucide, recortado del paquete lucide-static.

   CONVENCION LUCIDE, respetada tal cual: grilla 24x24, fill none, stroke
   currentColor, stroke-width 2, linecap y linejoin round. El grosor NO se baja
   a 1,5 como hacia el set anterior: a 14px de render, el trazo 2 sobre una
   grilla de 24 da 1,17px efectivos —cerca del filete de 1px del sistema—
   mientras que 1,5 daba 0,875px, sub-pixel y desvaido. Se respeta la libreria.

   El tamano NO se declara aca: sale de --sw-ico-* en tokens.css, y el color
   siempre de currentColor. Un icono nunca trae color propio.

   El registro tiene SOLO lo que el layout usa. Se sacaron seis que venian del
   set anterior sin consumidor (database, info, link, paquete, scissors,
   shield): un icono que nadie pide es codigo muerto, igual que un token que
   nadie lee. Agregar uno es una linea — buscarlo en lucide.dev y pegar su
   shape acá.
   ============================================================================ */

window.SW = window.SW || {};

/* La MARCA no es de Lucide: es el monograma del producto, y es lo unico del
   registro que se pinta con --sw-brand en vez de currentColor. */
const SW_LOGO = '<path d="M14.4 2.6L15.0 2.8L15.6 3.1L16.1 3.4L16.6 3.7L17.0 4.2L17.4 4.7L17.8 5.5L18.0 6.6L17.8 8.3L16.9 10.4L15.7 12.2L14.5 13.6L13.6 14.5L12.9 15.2L12.4 15.7L12.1 16.1L11.8 16.5L11.6 16.9L11.4 17.3L11.4 17.7L11.5 18.2L11.7 18.6L12.0 19.0L12.4 19.3L12.8 19.6L13.4 19.9L14.2 20.1L15.2 20.3L16.5 20.3L18.2 19.9L20.1 18.6L21.4 16.4L21.7 13.6L21.2 10.9L20.3 8.7L19.2 6.9L18.1 5.4L16.9 4.1L15.7 3.1L14.4 2.3L13.1 1.7L11.7 1.2L10.3 1.0L8.8 1.0L7.4 1.2L6.1 1.7L5.0 2.3L4.0 3.1L3.2 4.0L2.5 5.0L2.0 6.0L1.7 7.1L1.5 8.1L1.4 9.1L1.3 10.1L1.4 11.1L1.5 12.2L1.7 13.3L2.0 14.6L2.5 16.0L3.3 17.5L4.5 19.2L6.1 20.8L8.2 22.1L10.6 22.8L12.9 23.0L14.9 22.8L16.6 22.3L17.9 21.7L19.1 21.0L20.0 20.3L20.8 19.6L21.4 18.8L21.9 18.0L22.3 17.1L22.6 16.2L22.7 15.2L22.6 14.2L22.3 13.1L21.8 12.0L21.0 10.9L20.0 9.9L18.7 9.0L17.4 8.2L16.0 7.6L14.7 7.2L13.6 6.9L12.6 6.8L11.8 6.6L11.1 6.5L10.5 6.4L10.0 6.4L9.5 6.3L9.0 6.2L8.6 6.1L8.1 6.0L7.6 5.9L7.0 5.7L6.1 5.5L4.8 5.4L3.0 6.0L2.2 8.4L3.2 10.8L4.7 12.9L6.1 14.5L7.1 15.7L7.8 16.5L8.3 17.1L8.6 17.6L8.7 17.8L8.7 17.9L8.7 17.9L8.8 17.7L8.8 17.6L8.9 17.6L8.8 17.7L8.5 17.8L8.2 18.0L7.7 18.1L7.1 18.2L6.6 18.1L6.3 18.0L6.0 17.6L6.0 16.6L6.4 15.2L7.1 13.9L7.8 12.9L8.5 12.0L9.1 11.3L7.6 9.8L6.8 10.6L6.0 11.6L5.2 12.8L4.3 14.2L3.6 16.0L3.4 18.0L4.0 19.8L5.3 20.9L6.7 21.4L7.8 21.4L8.8 21.4L9.7 21.2L10.5 20.9L11.1 20.4L11.7 19.9L12.2 19.1L12.4 18.2L12.4 17.4L12.2 16.5L11.8 15.7L11.3 15.0L10.7 14.1L9.8 13.2L8.8 12.1L7.5 10.7L6.1 9.0L5.3 7.7L5.1 7.9L5.1 7.9L5.8 7.9L6.5 8.0L7.1 8.1L7.7 8.2L8.2 8.3L8.7 8.4L9.2 8.4L9.7 8.5L10.2 8.6L10.8 8.6L11.5 8.7L12.2 8.9L13.1 9.0L14.1 9.3L15.2 9.7L16.4 10.2L17.5 10.9L18.4 11.6L19.1 12.5L19.5 13.2L19.8 13.9L19.9 14.6L19.9 15.1L19.8 15.6L19.6 16.1L19.4 16.6L19.1 17.1L18.6 17.6L18.1 18.1L17.4 18.6L16.6 19.1L15.6 19.6L14.3 20.0L12.8 20.2L11.1 20.1L9.3 19.6L7.7 18.7L6.4 17.5L5.5 16.2L4.8 15.0L4.4 13.8L4.1 12.8L4.0 11.9L3.9 11.0L3.9 10.1L3.9 9.3L4.1 8.5L4.3 7.8L4.5 7.1L4.9 6.4L5.4 5.8L5.9 5.3L6.6 4.8L7.3 4.5L8.1 4.3L9.0 4.2L9.9 4.3L10.8 4.5L11.8 4.8L12.7 5.3L13.7 5.9L14.6 6.7L15.5 7.6L16.4 8.8L17.3 10.2L18.0 11.9L18.5 13.8L18.4 15.6L17.9 16.8L17.1 17.5L16.1 17.8L15.3 17.8L14.6 17.8L14.1 17.7L13.7 17.6L13.4 17.5L13.2 17.5L13.1 17.4L13.1 17.5L13.0 17.5L13.0 17.5L13.0 17.3L13.0 17.1L13.2 16.8L13.4 16.4L13.8 15.9L14.4 15.2L15.3 14.2L16.4 12.8L17.7 10.8L18.6 8.5L18.8 6.6L18.5 5.2L18.0 4.4L17.4 3.8L16.9 3.4L16.3 3.1L15.7 2.8L15.1 2.7L14.4 2.6Z"/>';

window.SW.icons = {
  logo: SW_LOGO,
  doc:        /* lucide file-text */ '<path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"/> <path d="M14 2v5a1 1 0 0 0 1 1h5"/> <path d="M10 9H8"/> <path d="M16 13H8"/> <path d="M16 17H8"/>',
  info:       /* lucide info */ '<circle cx="12" cy="12" r="10"/> <path d="M12 16v-4"/> <path d="M12 8h.01"/>',
  send:       /* lucide arrow-up */ '<path d="m5 12 7-7 7 7"/> <path d="M12 19V5"/>',
  graph:      /* lucide workflow */ '<rect width="8" height="8" x="3" y="3" rx="2"/> <path d="M7 11v4a2 2 0 0 0 2 2h4"/> <rect width="8" height="8" x="13" y="13" rx="2"/>',
  clock:      /* lucide clock */ '<circle cx="12" cy="12" r="10"/> <path d="M12 6v6l4 2"/>',
  sliders:    /* lucide sliders-horizontal */ '<path d="M10 5H3"/> <path d="M12 19H3"/> <path d="M14 3v4"/> <path d="M16 17v4"/> <path d="M21 12h-9"/> <path d="M21 19h-5"/> <path d="M21 5h-7"/> <path d="M8 10v4"/> <path d="M8 12H3"/>',
  search:     /* lucide search */ '<path d="m21 21-4.34-4.34"/> <circle cx="11" cy="11" r="8"/>',
  chevron:    /* lucide chevron-down */ '<path d="m6 9 6 6 6-6"/>',
  /* La flecha que sale del panel hacia el rincon: «sacar de la caja». Es
     el par de panelRight, que es «meterlo». */
  salir:      /* lucide arrow-down-left */ '<path d="M17 7 7 17"/> <path d="M17 17H7V7"/>',
  /* El par de `salir`: la flecha que vuelve al panel. Las dos ubicaciones
     del chat se dicen con la misma figura girada, que es lo que hace que se
     lean como ida y vuelta de lo mismo y no como dos acciones sueltas. */
  /* El par minimizar/agrandar de la tarjeta flotante. Es UN control con dos
     glifos, como el de enviar/detener del composer: minimizar y agrandar no
     conviven nunca, asi que dos botones dejarian uno siempre inutil. */
  minus:      /* lucide minus */ '<path d="M5 12h14"/>',
  chevronUp:  /* lucide chevron-up */ '<path d="m18 15-6-6-6 6"/>',
  /* La firma del asistente en el hilo. No es un avatar: es la onda de una
     voz que responde. */
  /* EL SET DE «CAVILANDO» — lo que gira mientras el asistente piensa.
     Ninguno significa nada por si mismo: el mensaje es el movimiento, no el
     glifo. Por eso pueden entrar y salir sin que nada se rompa. */
  bombita:    /* lucide lightbulb */ '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/> <path d="M9 18h6"/> <path d="M10 22h4"/>',
  brujula:    /* lucide compass */ '<path d="m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z"/> <circle cx="12" cy="12" r="10"/>',
  patito:     /* lucide bird — el patito de goma del rubber duck debugging */ '<path d="M16 7h.01"/> <path d="M3.4 18H12a8 8 0 0 0 8-8V7a4 4 0 0 0-7.28-2.3L2 20"/> <path d="m20 7 2 .5-2 .5"/> <path d="M10 18v3"/> <path d="M14 17.75V21"/> <path d="M7 18a6 6 0 0 0 3.84-10.61"/>',
  /* lucide save — el disquete. Es el unico simbolo de guardar que todo el
     mundo lee sin leyenda, aunque nadie haya usado uno. */
  disco: '<path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/> <path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"/> <path d="M7 3v4a1 1 0 0 0 1 1h7"/>',
  /* ALINEACION — cuatro variantes de lucide align-*. Son lo unico del panel
     de texto que necesita dibujo: negrita, cursiva, subrayado y tachado se
     muestran con su propia letra, que dice mas que cualquier icono. */
  /* LA LISTA CON TILDES — lucide list-checks. Encabeza la fila de «elegir
     todos»: dice que lo que sigue es una lista de la que se eligen cosas,
     antes de que el usuario toque la casilla. */
  listaCheck: '<path d="m3 17 2 2 4-4"/> <path d="m3 7 2 2 4-4"/> <path d="M13 6h8"/> <path d="M13 12h8"/> <path d="M13 18h8"/>',
  /* EL COMPROBANTE — lucide receipt. El papel con el canto dentado es el
     glifo universal del ticket, y se distingue de `archivo` justo en eso: uno
     es «un archivo cualquiera» y el otro «un papel que dice cuánto». */
  receipt: '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/> <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/> <path d="M12 17.5v-11"/>',
  /* LA ESCOBA — lucide brush-cleaning. El cepillo CON las migas cayendo, y no
     una escoba a secas: las dos rayitas de abajo son lo que convierte «esto es
     un cepillo» en «esto barre». Sin ellas el glifo se lee como una herramienta
     de pintura, que es justo lo contrario de lo que hace el boton. */
  escoba: '<path d="m16 22-1-4"/> <path d="M19 13.99a1 1 0 0 0 1-1V12a2 2 0 0 0-2-2h-3a1 1 0 0 1-1-1V4a2 2 0 0 0-4 0v5a1 1 0 0 1-1 1H6a2 2 0 0 0-2 2v.99a1 1 0 0 0 1 1"/> <path d="M5 14h14l1.973 6.767A1 1 0 0 1 20 22H4a1 1 0 0 1-.973-1.233z"/> <path d="m8 22 1-4"/>',
  /* LOS TRES PUNTOS de la fila — lucide ellipsis. Horizontal y no vertical:
     la columna que lo aloja mide 44px y es la ultima, asi que el glifo tiene
     el ancho y no el alto; el vertical obliga a apretar la fila. */
  puntos: '<circle cx="12" cy="12" r="1"/> <circle cx="19" cy="12" r="1"/> <circle cx="5" cy="12" r="1"/>',
  /* ORDENAR — lucide chevrons-up-down. Es el estado SIN ordenar de una
     columna que se puede ordenar: las dos flechas dicen «esto se puede mover
     para los dos lados». Cuando esta ordenada se cambia por chevronUp o
     chevron, que dicen para donde. */
  ordenar: '<path d="m7 15 5 5 5-5"/> <path d="m7 9 5-5 5 5"/>',
  /* LA LISTA — lucide list. Es una de las dos vistas de la superficie: las
     facturas en tabla. Su par es `layers`, el mazo. Los dos glifos tienen que
     leerse como opuestos y lo son: renglones contra cartas apiladas. */
  lista: '<path d="M3 5h.01"/> <path d="M3 12h.01"/> <path d="M3 19h.01"/> <path d="M8 5h13"/> <path d="M8 12h13"/> <path d="M8 19h13"/>',
  /* EL BILLETE — lucide banknote. Los montos de una factura. No alcanzaba con
     `receipt`: ese es el documento entero y esto es la plata que dice adentro,
     que son dos secciones distintas de la misma ficha. */
  billete: '<rect x="2" y="6" width="20" height="12" rx="2"/> <circle cx="12" cy="12" r="2"/> <path d="M6 12h.01M18 12h.01"/>',
  /* LA IDENTIFICACION — lucide id-card. Los datos de quien emitió: nombre, NIT,
     régimen. Un `users` diria «varias personas» y acá es una sola, la de esta
     factura. */
  ficha: '<path d="M16 10h2"/> <path d="M16 14h2"/> <path d="M6.17 15a3 3 0 0 1 5.66 0"/> <circle cx="9" cy="11" r="2"/> <rect x="2" y="5" width="20" height="14" rx="2"/>',
  /* EL ESCUDO — lucide shield. Es el certificado digital, que es el metodo de
     sincronizacion recomendado: se configura una vez y despues anda solo. El
     glifo dice «esto te acredita», que es exactamente lo que hace un .pfx. */
  shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
  /* LA PLANILLA — lucide file-spreadsheet. La hoja CON celdas adentro y no la
     grilla suelta (`table`, que ya existe): esto es un ARCHIVO que se baja y
     se sube, no una vista de datos. La diferencia importa porque los dos
     conviven en esta superficie. */
  planilla: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/> <path d="M14 2v4a2 2 0 0 0 2 2h4"/> <path d="M8 13h2"/> <path d="M14 13h2"/> <path d="M8 17h2"/> <path d="M14 17h2"/>',
  /* VARIOS — lucide copy. Dos cuadrados corridos: es el glifo de «mas de
     uno», y es lo que muestra el disparador cuando hay varios origenes o
     varios destinos elegidos. Poner el logo del primero seria mentir sobre
     los otros. */
  varios: '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/> <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  /* EL AGARRE — lucide grip-vertical. Dos columnas de tres puntos: es el
     glifo que toda la industria usa para «esto se arrastra», y esa
     convencion es el 90% de que se entienda sin explicacion. */
  agarre: '<circle cx="9" cy="12" r="1"/> <circle cx="9" cy="5" r="1"/> <circle cx="9" cy="19" r="1"/> <circle cx="15" cy="12" r="1"/> <circle cx="15" cy="5" r="1"/> <circle cx="15" cy="19" r="1"/>',
  /* LAS DOS NUBES — lucide cloud-upload / cloud-download.

     Son EL MISMO dibujo con la flecha al reves, y aca eso es una virtud y no
     el riesgo que el comentario de .sw-vista marca: no compiten en una fila de
     iconos sueltos, van una en cada cabecera de panel a 32px y con su titulo
     al lado. La simetria es lo que dice que son las dos mitades de la misma
     operacion — sacar y traer.

     La nube va identica en las dos y solo cambia la flecha: si el dibujo de la
     nube se toca, se tocan las dos. */
  nubeSube: '<path d="M12 13v8"/> <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/> <path d="m8 17 4-4 4 4"/>',
  nubeBaja: '<path d="M12 13v8"/> <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/> <path d="m16 17-4 4-4-4"/>',
  /* La ficha de un archivo en la lista — lucide file. El tipo no se dibuja:
     va escrito encima, que es lo que hace la referencia (un rectangulo con
     «PDF»). Un icono por extension seria un juego de iconos entero. */
  /* EL DOBLEZ NO PISA LA DIAGONAL. El `file` de lucide dibuja el contorno
     cerrando en diagonal de (15,2) a (20,7) y despues el doblez por CASI la
     misma linea: a 30px eso se ve como un trazo doble, mas pesado que todo lo
     demas del sistema.

     Aca la diagonal es del contorno y el doblez es una ELE por dentro —baja y
     dobla— asi que no se superponen en ningun punto. Es el mismo dibujo de
     documento con una linea menos. */
  archivo:  '<path d="M5 5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z"/> <path d="M14 3v5h5"/>',
  /* LA CARPETA — lucide folder. Entró para el hueco de «nueva carpeta» del
     inicio de Contabilidad (16 de septiembre): el registro no tenía ninguna, y
     `archivo` es un documento con la punta doblada, que dice otra cosa. */
  folder:   '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
  /* lucide link-2, para el campo de importar por URL. */
  enlace:   '<path d="M9 17H7A5 5 0 0 1 7 7h2"/> <path d="M15 7h2a5 5 0 1 1 0 10h-2"/> <line x1="8" x2="16" y1="12" y2="12"/>',
  /* lucide loader-circle: un arco de tres cuartos que gira. El arco tiene que
     ser INCOMPLETO o girando no se nota que gira. Lo hace girar el CSS con
     transform (regla 7); el icono no sabe nada de la animacion. */
  cargando: '<path d="M21 12a9 9 0 1 1-6.219-8.56"/>',
  /* SUBIR — lucide upload. Su pareja natural seria `download`, y a 15px las
     dos son la misma bandeja con la flecha al reves: justo el caso que el
     comentario de .sw-vista en chrome.css marca como limite del patron («dos
     iconos parecidos dejan de informar»). Asi que «Traer» usa el clip, que
     ademas es el que ya esta adentro de su zona de soltar. */
  subir: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/> <polyline points="17 8 12 3 7 8"/> <line x1="12" x2="12" y1="3" y2="15"/>',
  /* SECCIONES DE LA CAJA DE TEXTO — lucide type, palette, unfold-vertical,
     pilcrow. Son los rotulos laterales de text-tools.js: la caja reducida a riel
     deja solo el icono, asi que cada seccion necesita uno que la diga sola.
     */
  tipografia: '<polyline points="4 7 4 4 20 4 20 7"/> <line x1="9" x2="15" y1="20" y2="20"/> <line x1="12" x2="12" y1="4" y2="20"/>',
  paleta:     '<circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/> <circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/> <circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/> <circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/> <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>',
  espaciado:  '<path d="m7 15 5 5 5-5"/> <path d="m7 9 5-5 5 5"/>',
  pilcrow:    '<path d="M13 4v16"/> <path d="M17 4v16"/> <path d="M19 4H9.5a4.5 4.5 0 0 0 0 9H13"/>',
  /* FORMATO DE TEXTO — lucide bold, italic, underline, strikethrough.
     Antes estas cuatro se mostraban con su propia letra (B, I, U, S) como en
     la referencia. Se cambiaron a icono por pedido: las letras sueltas en
     cajas contiguas se leian como un bloque de texto y no como cuatro
     controles. */
  negrita:   '<path d="M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8"/>',
  cursiva:   '<line x1="19" x2="10" y1="4" y2="4"/> <line x1="14" x2="5" y1="20" y2="20"/> <line x1="15" x2="9" y1="4" y2="20"/>',
  subrayado: '<path d="M6 4v6a6 6 0 0 0 12 0V4"/> <line x1="4" x2="20" y1="20" y2="20"/>',
  tachado:   '<path d="M16 4H9a3 3 0 0 0-2.83 4"/> <path d="M14 12a4 4 0 0 1 0 8H6"/> <line x1="4" x2="20" y1="12" y2="12"/>',
  /* CAJA — lucide case-upper / case-lower / case-sensitive. */
  cajaAlta:  '<path d="m3 15 4-8 4 8"/> <path d="M4 13h6"/> <path d="M15 11h4.5a2 2 0 0 1 0 4H15V7h4a2 2 0 0 1 0 4"/>',
  cajaBaja:  '<circle cx="7" cy="12" r="3"/> <path d="M10 9v6"/> <circle cx="17" cy="12" r="3"/> <path d="M14 7v8"/>',
  cajaComo:  '<path d="m3 15 4-8 4 8"/> <path d="M4 13h6"/> <circle cx="18" cy="12" r="3"/> <path d="M21 9v6"/>',
  alinIzq:    '<line x1="21" x2="3" y1="6" y2="6"/> <line x1="15" x2="3" y1="12" y2="12"/> <line x1="17" x2="3" y1="18" y2="18"/>',
  alinCentro: '<line x1="21" x2="3" y1="6" y2="6"/> <line x1="17" x2="7" y1="12" y2="12"/> <line x1="19" x2="5" y1="18" y2="18"/>',
  alinDer:    '<line x1="21" x2="3" y1="6" y2="6"/> <line x1="21" x2="9" y1="12" y2="12"/> <line x1="21" x2="7" y1="18" y2="18"/>',
  alinJust:   '<line x1="3" x2="21" y1="6" y2="6"/> <line x1="3" x2="21" y1="12" y2="12"/> <line x1="3" x2="21" y1="18" y2="18"/>',
  /* DESCARGAR ES OTRA COSA QUE «MARCAR COMO NO SUBIDA». Ya había `nubeBaja`,
     que es la nube con la flecha hacia abajo y significa un ESTADO —esta factura
     no está en el software—. Esto es el gesto de bajar un archivo a la máquina.
     Dos flechas parecidas que dicen cosas distintas se separan por el resto del
     dibujo: una tiene nube, la otra tiene bandeja. */
  bajar:      /* lucide download */ '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/> <path d="M7 10l5 5 5-5"/> <path d="M12 15V3"/>',
  /* LA NUMERACION. No es «etiqueta» ni «almohadilla»: acá el numeral es lo que
     antecede a un consecutivo, que es de lo que habla el botón. */
  hash:       /* lucide hash */ '<path d="M4 9h16"/> <path d="M4 15h16"/> <path d="M10 3L8 21"/> <path d="M16 3l-2 18"/>',
  /* DESHACER, en el sentido de «revertir esta operación». La flecha va a la
     IZQUIERDA y `rehacer` es el giro completo: son dos gestos y no uno con dos
     nombres. */
  deshacer:   /* lucide undo-2 */ '<path d="M9 14L4 9l5-5"/> <path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5 5.5 5.5 0 0 1-5.5 5.5H11"/>',
  /* EL TRIANGULO, que es la forma que se lee como advertencia sin color. El
     círculo de `info` dice «esto hay que saberlo»; el triángulo dice «esto puede
     salir mal». Un mismo ícono para las dos cosas obliga a leer para saber cuál
     es cuál. */
  alerta:     /* lucide triangle-alert */ '<path d="M21.73 18l-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/> <path d="M12 9v4"/> <path d="M12 17h.01"/>',
  rehacer:    /* lucide rotate-ccw */ '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/> <path d="M3 3v5h5"/>',
  audioLines: /* lucide audio-lines */ '<path d="M2 10v3"/> <path d="M6 6v11"/> <path d="M10 3v18"/> <path d="M14 8v7"/> <path d="M18 5v13"/> <path d="M22 10v3"/>',
  /* Fijar una respuesta. La funcionalidad todavia no existe — el boton si,
     porque la fila del nombre se disenia entera o no se disenia. */
  pin:        /* lucide pin */ '<path d="M12 17v5"/> <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>',
  entrar:     /* lucide arrow-up-right */ '<path d="M7 17 17 7"/> <path d="M7 7h10v10"/>',
  /* AVANZAR — la flecha del botón de entrar. No es `entrar`, aunque el botón se
     llame así: la diagonal se lee como «abre afuera», y el botón no saca a
     ningún lado, hace seguir. */
  avanzar:    /* lucide arrow-right */ '<path d="M5 12h14"/> <path d="m12 5 7 7-7 7"/>',
  panelRight: /* lucide panel-right */ '<rect width="18" height="18" x="3" y="3" rx="2"/> <path d="M15 3v18"/>',
  code:       /* lucide code */ '<path d="m16 18 6-6-6-6"/> <path d="m8 6-6 6 6 6"/>',
  pen:        /* lucide pencil */ '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/> <path d="m15 5 4 4"/>',
  grid:       /* lucide grid-3x3 */ '<rect width="18" height="18" x="3" y="3" rx="2"/> <path d="M3 9h18"/> <path d="M3 15h18"/> <path d="M9 3v18"/> <path d="M15 3v18"/>',
  play:       /* lucide play */ '<path d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z"/>',
  spark:      /* lucide sparkles */ '<path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"/> <path d="M20 2v4"/> <path d="M22 4h-4"/> <circle cx="4" cy="20" r="2"/>',
  monitor:    /* lucide monitor */ '<rect width="20" height="14" x="2" y="3" rx="2"/> <line x1="8" x2="16" y1="21" y2="21"/> <line x1="12" x2="12" y1="17" y2="21"/>',
  sun:        /* lucide sun */ '<circle cx="12" cy="12" r="4"/> <path d="M12 2v2"/> <path d="M12 20v2"/> <path d="m4.93 4.93 1.41 1.41"/> <path d="m17.66 17.66 1.41 1.41"/> <path d="M2 12h2"/> <path d="M20 12h2"/> <path d="m6.34 17.66-1.41 1.41"/> <path d="m19.07 4.93-1.41 1.41"/>',
  moon:       /* lucide moon */ '<path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401"/>',
  table:      /* lucide table */ '<path d="M12 3v18"/> <rect width="18" height="18" x="3" y="3" rx="2"/> <path d="M3 9h18"/> <path d="M3 15h18"/>',
  chart:      /* lucide chart-line */ '<path d="M3 3v16a2 2 0 0 0 2 2h16"/> <path d="m19 9-5 5-4-4-3 3"/>',
  check:      /* lucide check */ '<path d="M20 6 9 17l-5-5"/>',
  left:       /* lucide chevron-left */ '<path d="m15 18-6-6 6-6"/>',
  right:      /* lucide chevron-right */ '<path d="m9 18 6-6-6-6"/>',
  calendario: /* lucide calendar */ '<path d="M8 2v4"/> <path d="M16 2v4"/>' +
              '<rect width="18" height="18" x="3" y="4" rx="2"/> <path d="M3 10h18"/>',
  filter:     /* lucide filter */ '<path d="M10 20a1 1 0 0 0 .553.895l2 1A1 1 0 0 0 14 21v-7a2 2 0 0 1 .517-1.341L21.74 4.67A1 1 0 0 0 21 3H3a1 1 0 0 0-.742 1.67l7.225 7.989A2 2 0 0 1 10 14z"/>',
  open:       /* lucide external-link */ '<path d="M15 3h6v6"/> <path d="M10 14 21 3"/> <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  /* EL TIEMPO QUE PASA SOLO. No es un estado que el usuario pueda cambiar: es
     un trámite andando del otro lado. Por eso reloj y no spinner — el spinner
     dice «esperá acá», y esto dura dos días. */
  reloj:      /* lucide clock */ '<circle cx="12" cy="12" r="10"/> <path d="M12 6v6l4 2"/>',
  zap:        /* lucide zap */ '<path d="M15.914 4a1.5 1.5 0 00-2.474-1.561l-9 9A1.5 1.5 0 005.5 14h4.002a.5.5 0 01.471.666L8.086 20a1.5 1.5 0 002.475 1.56l9-9A1.5 1.5 0 0018.5 10h-3.997a.5.5 0 01-.472-.667z"/>',
  message:    /* lucide message-square */ '<path d="M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z"/>',
  /* Dos globos: una conversación, no un mensaje. Lo usa el chat vacío. */
  mensajes:   /* lucide messages-square */ '<path d="M16 10a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 14.286V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/> <path d="M20 9a2 2 0 0 1 2 2v10.286a.71.71 0 0 1-1.212.502l-2.202-2.202A2 2 0 0 0 17.172 19H10a2 2 0 0 1-2-2v-1"/>',
  wrench:     /* lucide wrench */ '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.106-3.105c.32-.322.863-.22.983.218a6 6 0 0 1-8.259 7.057l-7.91 7.91a1 1 0 0 1-2.999-3l7.91-7.91a6 6 0 0 1 7.057-8.259c.438.12.54.662.219.984z"/>',
  layers:     /* lucide layers */ '<path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z"/> <path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12"/> <path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17"/>',
  maximize:   /* lucide maximize */ '<path d="M8 3H5a2 2 0 0 0-2 2v3"/> <path d="M21 8V5a2 2 0 0 0-2-2h-3"/> <path d="M3 16v3a2 2 0 0 0 2 2h3"/> <path d="M16 21h3a2 2 0 0 0 2-2v-3"/>',
  wand:       /* lucide wand-sparkles */ '<path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72"/> <path d="m14 7 3 3"/> <path d="M5 6v4"/> <path d="M19 14v4"/> <path d="M10 2v2"/> <path d="M7 8H3"/> <path d="M21 16h-4"/> <path d="M11 3H9"/>',
  copy:       /* lucide copy */ '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/> <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  power:      /* lucide power */ '<path d="M12 2v10"/> <path d="M18.4 6.6a9 9 0 1 1-12.77.04"/>',
  trash:      /* lucide trash-2 */ '<path d="M10 11v6"/> <path d="M14 11v6"/> <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/> <path d="M3 6h18"/> <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  users:      /* lucide users */ '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/> <path d="M16 3.128a4 4 0 0 1 0 7.744"/> <path d="M22 21v-2a4 4 0 0 0-3-3.87"/> <circle cx="9" cy="7" r="4"/>',
  branch:     /* lucide git-branch */ '<path d="M15 6a9 9 0 0 0-9 9V3"/> <circle cx="18" cy="6" r="3"/> <circle cx="6" cy="18" r="3"/>',
  mail:       /* lucide mail */ '<path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7"/> <rect x="2" y="4" width="20" height="16" rx="2"/>',
  /* El par de mostrar/ocultar la contraseña. Es UN control con dos glifos
     —como minimizar/agrandar—: el estado lo dice aria-pressed, el ícono sólo
     lo dibuja. */
  eye:        /* lucide eye */ '<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/> <circle cx="12" cy="12" r="3"/>',
  eyeOff:     /* lucide eye-off */ '<path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"/> <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242"/> <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"/> <path d="m2 2 20 20"/>',
  api:        /* lucide webhook */ '<path d="M18 16.98h-5.99c-1.1 0-1.95.94-2.48 1.9A4 4 0 0 1 2 17c.01-.7.2-1.4.57-2"/> <path d="m6 17 3.13-5.78c.53-.97.1-2.18-.5-3.1a4 4 0 1 1 6.89-4.06"/> <path d="m12 6 3.13 5.73C15.66 12.7 16.9 13 18 13a4 4 0 0 1 0 8"/>',
  plus:       /* lucide plus */ '<path d="M5 12h14"/> <path d="M12 5v14"/>',
  mic:        /* lucide mic */ '<path d="M12 19v3"/> <path d="M19 10v2a7 7 0 0 1-14 0v-2"/> <rect x="9" y="2" width="6" height="13" rx="3"/>',
  x:          /* lucide x */ '<path d="M18 6 6 18"/> <path d="m6 6 12 12"/>',
  stop:       /* lucide square */ '<rect width="18" height="18" x="3" y="3" rx="2"/>',
  clip:       /* lucide paperclip */ '<path d="M13.234 20.252 21 12.3"/> <path d="m16 6-8.414 8.586a2 2 0 0 0 0 2.828 2 2 0 0 0 2.828 0l8.414-8.586a4 4 0 0 0 0-5.656 4 4 0 0 0-5.656 0l-8.415 8.585a6 6 0 1 0 8.486 8.486"/>',
  image:      /* lucide image */ '<rect width="18" height="18" x="3" y="3" rx="2"/> <circle cx="9" cy="9" r="2"/> <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>',
  globe:      /* lucide globe */ '<circle cx="12" cy="12" r="10"/> <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/> <path d="M2 12h20"/>',
  pause:      /* lucide pause */ '<rect x="14" y="4" width="4" height="16" rx="1"/> <rect x="6" y="4" width="4" height="16" rx="1"/>',
  cubo:       /* lucide box */ '<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/> <path d="m3.3 7 8.7 5 8.7-5"/> <path d="M12 22V12"/>',
  enchufe:    /* lucide plug-zap */ '<path d="M6.3 20.3a2.4 2.4 0 0 0 3.4 0L12 18l-6-6-2.3 2.3a2.4 2.4 0 0 0 0 3.4Z"/> <path d="m2 22 3-3"/> <path d="M7.5 13.5 10 11"/> <path d="M10.5 16.5 13 14"/> <path d="m18 3-4 4h6l-4 4"/>',
  /* EXCEPCION ANOTADA, la tercera del registro (las otras dos son la marca
     del producto y el play del boton primario). Este NO es un icono de
     Lucide: es la marca de Slack, y va con SUS colores porque una marca
     monocroma deja de ser esa marca.

     Por eso cada path trae su `fill` propio y el svg pide la clase
     .sw-ico--marca, que apaga el `stroke: currentColor` de la regla
     general — si no, el trazo del sistema le dibujaria un contorno encima.

     Uso nominativo: identifica una integracion con Slack, que es para lo
     que sirve. No se recolorea, no se deforma y no se usa como icono
     generico de "integracion". */
  /* MARCAS DE TERCEROS. Van en el mismo registro que los iconos pero NO son
     iconos del sistema: traen su color, se declaran en MARCAS (abajo) y el
     svg sale con .sw-ico--marca, que apaga el trazo general.

     SON REDIBUJOS SIMPLIFICADOS, no los archivos oficiales. Alcanzan para
     reconocer la app en un menu; si esto sale de la PoC, cada logo tiene que
     venir del brand kit de su duenio —Slack, Atlassian y Google publican el
     suyo— y respetar sus reglas de uso. Uso nominativo: identifican una
     integracion, no se recolorean ni se deforman. */
  github:     '<path fill="currentColor" stroke="none" d="M12 .5C5.37.5 0 5.78 0 12.292c0 5.211 3.438 9.63 8.205 11.188.6.111.82-.254.82-.567 0-.28-.01-1.022-.015-2.005-3.338.711-4.042-1.582-4.042-1.582-.546-1.361-1.335-1.725-1.335-1.725-1.087-.731.084-.716.084-.716 1.205.084 1.838 1.215 1.838 1.215 1.07 1.803 2.809 1.282 3.495.981.108-.763.417-1.282.76-1.577-2.665-.295-5.466-1.309-5.466-5.827 0-1.287.465-2.339 1.235-3.164-.135-.298-.54-1.497.105-3.121 0 0 1.005-.316 3.3 1.209.96-.262 1.98-.392 3-.398 1.02.006 2.04.136 3 .398 2.28-1.525 3.285-1.209 3.285-1.209.645 1.624.24 2.823.12 3.121.765.825 1.23 1.877 1.23 3.164 0 4.53-2.805 5.527-5.475 5.817.42.354.81 1.077.81 2.182 0 1.578-.015 2.846-.015 3.229 0 .309.21.678.825.56C20.565 21.917 24 17.495 24 12.292 24 5.78 18.627.5 12 .5z"/>',
  drive:      '<path fill="#FFBA00" stroke="none" d="M12 2.5 6.75 11.5 12 14.5l5.25-3z"/><path fill="#0066DA" stroke="none" d="M6.75 11.5 1.5 20.5H12l0-6z"/><path fill="#00AC47" stroke="none" d="M17.25 11.5 22.5 20.5H12l0-6z"/>',
  jira:       '<path fill="#2684FF" stroke="none" d="M11.53 2 3 10.53a1.5 1.5 0 0 0 0 2.12l4.24 4.25 4.29-4.3a1.5 1.5 0 0 0 0-2.12z"/><path fill="#0052CC" stroke="none" d="M16.76 7.24 12.47 11.53a1.5 1.5 0 0 0 0 2.12L16.71 17.9 21 13.6a1.5 1.5 0 0 0 0-2.12z"/><path fill="#2684FF" stroke="none" d="M12 13.65 7.71 17.94 12 22.23l4.29-4.29z"/>',
  slack:      '<path fill="#36C5F0" stroke="none" d="M9 6a2 2 0 1 1 2-2v2H9Zm0 1a2 2 0 0 1 0 4H4a2 2 0 0 1 0-4h5Z"/> <path fill="#2EB67D" stroke="none" d="M18 9a2 2 0 1 1 2 2h-2V9Zm-1 0a2 2 0 0 1-4 0V4a2 2 0 1 1 4 0v5Z"/> <path fill="#ECB22E" stroke="none" d="M15 18a2 2 0 1 1-2 2v-2h2Zm0-1a2 2 0 0 1 0-4h5a2 2 0 0 1 0 4h-5Z"/> <path fill="#E01E5A" stroke="none" d="M6 15a2 2 0 1 1-2-2h2v2Zm1 0a2 2 0 0 1 4 0v5a2 2 0 1 1-4 0v-5Z"/>',
  bell:       /* lucide bell */ '<path d="M10.268 21a2 2 0 0 0 3.464 0"/> <path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/>',
};

/* EL unico helper. Antes esta misma funcion estaba copiada en siete archivos
   —chat, chrome, menus, side, sidecol, toolbox, tools— y canvas.js ademas
   tenia su propio registro en una grilla de 16, incompatible con el resto. */
/* Las marcas traen color propio y no heredan currentColor. */
const MARCAS = new Set(['slack', 'github', 'drive', 'jira']);

window.SW.icon = function (name) {
  const shape = window.SW.icons[name];
  if (!shape) return '';
  /* La clase es el gancho de UNA regla base en base.css. Antes cada
     componente redeclaraba stroke, fill y tamano: 30 reglas, 10 tamanos
     distintos y 2 grosores. El tamano se controla con --sw-ico. */
  return '<svg class="sw-ico' + (MARCAS.has(name) ? ' sw-ico--marca' : '') + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + shape + '</svg>';
};

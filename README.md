# Cádiz in Love — Libreto (web estática)

Web estática (HTML/CSS/JS puro, sin build) para la parte de **libreto y
audios** del coro **Cádiz in Love** (Carnaval de Cádiz). Pensada para
desplegar directamente en Netlify.

> El repo Flutter [coro](https://github.com/RayGadir/coro) (clonado en
> `../coro`) se usó solo como **referencia de arquitectura** (modelo de datos
> de letras/audios, modo ensayo). Es de una chirigota; esta web es para un
> **coro**, así que el esquema de tipos de letra es distinto (ver abajo).

## Qué hace

- **Tres apartados** (pestañas arriba): **Inicio** (tablón de avisos del
  director + resumen del repertorio), **Libreto** (solo lectura, para
  ensayar sin sonido) y **Audios** (para escuchar). Libreto y Audios
  muestran las mismas canciones agrupadas en el mismo orden: Presentación,
  Tangos, Cuplés (con Estribillo) y Popurrí, cada lista en una sola columna
  (pensado para móvil, uno debajo de otro).
- Buscador por título (funciona en Libreto y Audios).
- En Libreto: tocar una canción abre su letra a pantalla completa.
- En Audios: tocar una canción la reproduce/pausa in situ; la fila que suena
  se resalta. La barra de progreso se puede arrastrar libremente con el dedo
  o el ratón, hacia delante y hacia atrás.
- **Modo ensayo**: encadena la reproducción de todas las canciones que
  coincidan con la búsqueda activa, con opción de barajar el orden de los
  cuplés y elegir voz/pista de audio (el selector se rellena solo según los
  tipos de audio que haya en los datos). Mientras suena, se muestra
  automáticamente la letra de la canción actual — se puede leer mientras se
  escucha.
- Interfaz responsive, pensada primero para móvil.
- **Sistema visual unificado** ("Nocturne": fondo índigo oscuro, acento
  lavanda, tipografía Inter) — el mismo en las tres pestañas.

## Estructura

```
index.html         Estructura de la página
css/styles.css      Estilos (tokens de color, tipografía, componentes)
css/fonts.css       @font-face de Inter (no tocar salvo para cambiar de fuente)
js/app.js           Toda la lógica (carga datos, pestañas, reproductor, modo ensayo, admin)
data/songs.json     Letras + referencias a los audios
data/avisos.json    Avisos del tablón de Inicio (vacío por defecto — ver abajo)
audio/               Ficheros de audio
fonts/                Ficheros .woff2 de Inter
```

## Inicio (el tablón)

Pantalla de bienvenida con dos partes, ambas con datos reales (no hay
contenido de ejemplo inventado):

- **Avisos**: se leen de `data/avisos.json`. Vacío por defecto — se muestra
  "Todavía no hay avisos". Para publicar uno, añade un objeto a la lista:

  ```json
  { "id": "aviso-1", "tag": "Aviso", "title": "Título", "body": "Texto del aviso", "date": "12 mar" }
  ```

  Por ahora se edita el JSON a mano — no hay panel de administración en la
  web todavía.
- **El repertorio**: no son datos de ejemplo — cuenta canciones reales de
  `data/songs.json`. Un tipo (Presentación, Tangos, Cuplés, Popurrí)
  aparece "Disponible" en cuanto tiene al menos una canción; si no, "Sin
  letras todavía". Tocar una fila lleva a la pestaña Libreto.

## Administrador (aviso importante)

Esta web es 100% estática — **no hay servidor ni base de datos**, así que no
puede haber cuentas de usuario reales ni contraseñas. Lo que hay es un
ajuste guardado en `localStorage` de *este navegador* (`cadizInLove.isAdmin`)
que marca a quien lo abre como administrador (se ve en el avatar "AD" de la
cabecera). Por ahora no desbloquea ninguna función especial — es la base
para cuando se añadan funciones de gestión (editar avisos, repertorio...).

Importante: esto **no es seguridad real**. No protege nada ni distingue
usuarios entre sí — es solo un interruptor local. Si en el futuro se
necesita que solo ciertas personas puedan publicar avisos o editar el
repertorio de verdad, hace falta un backend (aunque sea mínimo, tipo
Firebase o Supabase) con autenticación real; con solo HTML/CSS/JS estático
no es posible.

## Estado actual de los datos

`data/songs.json` tiene ya 7 canciones reales:

| Canción | Tipo | Audio |
|---|---|---|
| El Coro (1994) | Presentación | Sí |
| La Orquesta Cádiz | Presentación | No (falta el audio) |
| El Mejor Coro del Mundo (2007) | Tango | Sí |
| Los Caleteros (1960) | Tango | Sí |
| Los Pintores (1949) | Tango | Sí |
| Los Taberneros del Puerto | Tango | No (falta el audio) |
| Los últimos de Filipinas (1998) | Tango | Sí |

Las letras que venían en mayúsculas en el documento original se dejaron tal
cual (no se ha "corregido" ortografía, acentos ni mayúsculas, para no alterar
el contenido real). El resto del repertorio se irá añadiendo igual.

## Cómo añadir canciones

Edita `data/songs.json`. Cada canción sigue este formato:

```json
{
  "id": "identificador-unico",
  "title": "Título de la canción",
  "kind": "presentacion | tango | cuple | estribillo | popurri",
  "letter": "Texto de la letra, con \n para saltos de línea",
  "audios": [
    { "type": "grupo", "url": "audio/archivo.mp3" }
  ]
}
```

- `kind`: uno de `presentacion`, `tango`, `cuple`, `estribillo`, `popurri`.
  Los apartados de la web (Libreto y Audios) están organizados en secciones
  fijas para esos tipos — si el repertorio real añade un tipo nuevo (romance,
  parodia...) hay que añadir una sección para él en `SECTIONS`, en
  [js/app.js](js/app.js), o esas canciones no aparecerán en ninguna lista.
- `type` (dentro de `audios`): libre — `grupo`, `tenor`, `segunda`,
  `guitarra`, `voces`... lo que corresponda. El selector de voz del modo
  ensayo se genera automáticamente a partir de lo que haya en los datos.
- `url` puede apuntar a un fichero local dentro de `audio/` o a una URL
  externa (por ejemplo, un enlace directo a Firebase Storage).

No hace falta ningún backend ni login: todo el contenido se sirve como
ficheros estáticos.

## Desarrollo local

No requiere instalación, pero **usa un servidor que soporte peticiones HTTP
Range** (necesarias para poder arrastrar la barra de progreso del audio):

```sh
npx serve .
```

`python -m http.server` no vale para probar el audio: no soporta Range y el
arrastre de la barra de progreso no funciona con él (sí funciona igual en
Netlify, que si lo soporta). Tampoco abras `index.html` directamente con
`file://`: el listado no carga (`fetch` está restringido).

## Despliegue en Netlify

Este proyecto no tiene build step: `netlify.toml` ya publica la raíz (`.`)
tal cual. Basta con conectar el repo en Netlify (o arrastrar la carpeta en
app.netlify.com/drop) y desplegar.

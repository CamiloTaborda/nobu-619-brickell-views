# 03 · Arquitectura

Cómo está construido el menú de vistas y por qué. Para ponerlo en marcha, ver el [README](../README.md).

## Principios

1. **Data-driven.** Pisos, colecciones, residencias, vistas y planos salen de `data/*.json`, generados desde los materiales de Inflight. Ningún componente tiene pisos, posiciones ni URLs escritos a mano.
2. **Un solo estado.** Visor, barra, menú de pisos, portada y planos leen el mismo store (`src/app/store.ts`); la URL lo refleja (`src/app/router.ts`).
3. **Nunca fuera de la foto.** Ninguna combinación de giro, inclinación, zoom o transición deja ver negro.
4. **Continuidad.** Cambiar de piso, hora o residencia conserva el zoom y la dirección real de la mirada.
5. **Honestidad.** Lo que no existe se dice (vista del piso fotografiado más cercano, foto compartida entre B y C, nivel sin planta).

---

## Mapa de módulos

```
 data/building.json ─┐
 data/panoramas.json ┼─▶ src/data/catalog.ts ──▶ consultas puras: resolveView, positionsAt,
 data/headings.json  │                           collectionOf, floorGroups, railLevel…
 data/hero.json      │
 data/plans/*.json  ─┘
                                 │
                       src/app/store.ts (zustand) ◀──▶ src/app/router.ts (hash)
                                 │
     ┌──────────────┬────────────┼───────────────┬──────────────────┐
 features/splash  features/home  features/viewer  features/hud     features/plans
 arranque         portada,       PanoViewer +     barra, menú de   panel, planta con
 (servidor)       fichas         StitchedAdapter  pisos, brújula   zonas, invitación
                                 │
                       lib/stitch (+ Worker), lib/camera, lib/prefetch, lib/heading
```

Modos (`store.mode`): `tower` (portada) y `view` (visor, con el panel de planos como capa).

---

## Datos

```
Hoja de activos (CSV + enlaces) ── data:manifest ──▶ panoramas.base.json   162 vistas
Paquetes Panotour en S3        ── data:probe    ──▶ panoramas.json        + geometría y tiles
Medidas sobre el render        ── data:hero     ──▶ hero.json             56 pisos
PDF del proyecto               ── build-plan-assets.py ──▶ public/plans, public/brand, data/plans
Fotos (horizonte)              ── calibrate-headings.py ──▶ headings.json  rumbo de cada foto
```

`catalog.ts` une `panoramas.json` con `headings.json` (cada vista recibe su `northOffset`) y expone consultas puras. Un piso sin fotos usa el **piso fotografiado más cercano** (`nearestCapture`); el menú de pisos marca el más cercano **de la misma colección** (`railLevel`).

### Orientación real (`calibrate-headings.py`)

Los paquetes de Inflight vienen con `heading="0"`. Un edificio lejano aparece en el mismo rumbo desde cualquier punto cercano, así que basta emparejar el horizonte entre dos fotos (SIFT sobre una franja de −14° a +6°) para saber cuánto está girada una respecto a la otra.

- **Parejas:** misma unidad a otra altura (sin paralaje horizontal), Día con Twilight de la misma toma y, solo en pisos altos, unidades distintas del mismo piso.
- **Ajuste:** un árbol con las parejas más sólidas desenrolla los ángulos; después, mínimos cuadrados con todas. Las parejas que contradicen al conjunto se descartan por rondas (35 de 498).
- **Ancla:** la cúpula del loanDepot park, medida en la foto de 345° del piso 71, fija el norte. Comprobación independiente: las torres Continuum de South Pointe caen a 1,9° de su posición real.
- **Resultado:** 160 de 162 vistas orientadas, con un error típico de 0,05° entre fotos. Las dos que no emparejan (B-West y C-West del piso 65, de día) se muestran sin brújula.

### Plantas y zonas (`build-plan-assets.py`)

El PDF es vectorial y conserva las capas de CAD. Para cada colección se rasterizan solo muros, puertas y núcleo, y la planta se reparte con una cuenca (watershed) sembrada desde la etiqueta de cada unidad:

- Las puertas separan las regiones por sus cuellos, sin cerrarlas a mano.
- El núcleo (ascensores, escaleras, recorridos de evacuación) se siembra con las puertas selladas, y se le quitan las "alas" que una abertura sin puerta dibujada une a él.
- Las unidades que se venden juntas se fusionan (5CB y 5CC → 5CC).
- Las líneas B y C se dividen en zona principal y zona West por un muro macizo idéntico en las cuatro plantas.
- Las anotaciones se apagan por capa; la interfaz dibuja sus propias etiquetas.

---

## Visor de panorámicas

### Imagen

Las fotos son esferas parciales en tiles Panotour de 512 px. `lib/stitch.ts` elige el nivel más nítido que cabe en la GPU y en la memoria del dispositivo, y un **Web Worker** (`stitch.worker.ts`) descarga y une los tiles en un `ImageBitmap` sin recomprimir. `StitchedAdapter` lo entrega a Photo Sphere Viewer con su `panoData` (recorte dentro de la esfera completa).

- **Carga progresiva:** primero el nivel más ligero, luego el nítido con un fundido.
- **Caché por megapíxeles:** se liberan las vistas menos usadas, nunca las que están en pantalla.
- **Precarga** (`lib/prefetch.ts`): al terminar una escena, la otra hora, los pisos vecinos y las demás residencias del piso (en escritorio también en nítido). En la portada, el piso señalado se prepara antes del clic.

### Cámara (`lib/camera.ts`)

- **Límites:** el ancho de la foto (`hmin/hmax`) y todo su alto real con 2° de margen. El rango vertical de Inflight era solo un encuadre: fuera hay cielo y ciudad, sin máscaras. Se conserva como **inclinación de reposo**.
- **Esquinas reales:** con la cámara inclinada, las esquinas de una proyección rectilínea abarcan más ángulo horizontal que el centro del borde. El giro permitido se calcula con ellas; si no, aparece una cuña negra en los extremos.
- **Zoom común:** el rango de zoom es el mismo para todas las vistas (`sharedFov`), el más abierto que cabe en la toma más estrecha (61° de entrada en 16:9). Por eso pasar de una vista a otra nunca cambia el encuadre.
- **Inclinación:** con el zoom de entrada solo gira en horizontal. Al acercar, la inclinación se libera de forma progresiva y vuelve sola al alejar.
- Verificado por trazado de rayos: 761.400 combinaciones de vista, zoom, posición y formato de pantalla, ninguna sale de la foto.

### Marco geográfico y transiciones

El yaw del visor es el **rumbo real** (0 = norte): cada foto se gira con `sphereCorrection.pan = −northOffset` (en Photo Sphere Viewer el pan va en sentido contrario al yaw).

| Cambio | Transición |
|---|---|
| Piso u hora | Se conserva el rumbo (limitado a la nueva foto). El fotograma saliente se congela y se funde sobre la vista nueva. |
| Residencia del mismo piso | La cámara apunta al encuadre de la nueva residencia. El fotograma saliente se desliza en el sentido del giro mientras la vista nueva termina de girar dentro de su foto. |
| Primera vista desde la portada | Vuelo de la portada hacia el piso y fundido. |

Las dos imágenes son siempre encuadres válidos, así que nunca se ve negro. Un barrido continuo de cámara entre dos fotos no sirve: atraviesa sectores que ninguna cubre (por ejemplo, entre B al este y B-West al oeste).

La **brújula** sigue el rumbo con un resorte: la marca superior es hacia donde se mira y la N señala el norte real. Con el panel de planos abierto se desliza a su izquierda con el mismo resorte que el panel (en pantallas compactas, donde el panel ocupa todo el ancho, se oculta).

---

## Portada

- El render se encuadra en *cover*, alineado a la derecha y con la corona a la vista. Pisos, banda de luz y fichas comparten esa geometría (`HERO_ALIGN_Y`).
- La pantalla de arranque usa la misma geometría y el mismo título, así que al fundirse nada se mueve.
- **Fichas:** solo mientras se señala algo, con 450 ms de margen para llevar el cursor hasta ellas. La de piso muestra un recorte real de su vista (`ViewPreview`, desde la versión ligera ya precargada). La de colección resume sus datos y su planta.
- La ficha sigue a la cámara de entrada mediante valores de Motion, sin volver a renderizar React, y nunca se sale de la pantalla.

## Planos

- Planta real como imagen (1400 px, unos 260 KB) y zonas como trazados SVG en las mismas coordenadas.
- La imagen se precarga y decodifica tras el arranque; si aún no está lista, las residencias se dibujan a trazo y todo aparece a la vez.
- El panel sigue a la vista: el selector de colección navega, y plano, barra y menú responden al mismo estado.
- En niveles sin planta (gimnasio, garaje) el panel invita a explorar las colecciones.

### Plano ampliado (`lib/split.ts`)

En escritorio (desde 1181 px de ancho) el panel se amplía a media pantalla: el plano llena el alto, la lista se reduce a una fila con la residencia señalada o la que se está viendo, y la otra mitad muestra esa vista.

- Un valor animado, `split` (0 = panel lateral, 1 = mitad y mitad), se publica como `--split` en la sección del visor. Panel, controles y visor calculan su geometría con él en CSS, sin volver a renderizar React.
- **Sin redimensionar WebGL en cada fotograma.** Mientras el panel crece, el visor conserva su tamaño y solo se desplaza (`translateX(-split · 25vw)`), de modo que el centro de la vista sigue al centro de su mitad. Al terminar, `dock()` encaja el visor en su mitad dentro del evento `before-render` de Photo Sphere Viewer: el lienzo cambia de tamaño y se redibuja en el mismo fotograma. Con el mismo alto y el mismo campo de visión, la imagen es idéntica y el cambio no se ve. Al cerrar, el orden es el inverso: primero se libera y después el panel vuelve.
- Al cambiar de tamaño, el visor conserva el campo de visión exacto (Photo Sphere Viewer lo redondearía a un nivel de zoom entero).
- El panel se vuelve opaco a medida que crece: encajado, ya no tiene la foto detrás y su tono no debe cambiar.

---

## CORS

El bucket S3 de Inflight no envía cabeceras CORS y WebGL las exige para usar imágenes como texturas. `next.config.ts` sirve el bucket bajo `/s3` con un rewrite, y `lib/assetUrl.ts` reescribe las URLs. Los `+` del bucket se envían como `%20`: codificados como `%2B`, S3 responde 403.

## Accesibilidad

- Navegación completa por teclado (atajos en el README), foco visible, botones con nombre.
- `prefers-reduced-motion`: fundidos en lugar de deslizamientos, giros y resortes.
- `prefers-reduced-transparency` y `prefers-contrast`: materiales más sólidos.

# 01 · Análisis de los materiales de referencia

Análisis realizado inspeccionando el código y los datos públicos de cada pieza (estructura del DOM, scripts, XML de los tours) el 9 nov 2026.

---

## A. Referencia: Drone Genius — `tours.thedronegenius.com/619brickell-residences/`

### Cómo está construida

| Aspecto | Implementación |
|---|---|
| Portada | Render vertical de la torre (3200×2277) dentro de un `<svg>`; **54 polígonos** (uno por piso, niveles 12–71) dibujados encima. Un único hit-area para toda la torre; el piso se calcula por la `y` del puntero. |
| Colecciones | 4 bloques: C2 (12–27), C3 (30–43), C4 (46–59), C5 (62–71). Botones flotantes que resaltan la banda de pisos. |
| Transición | *Fly-in*: anima el `viewBox` del SVG hacia el piso (600 ms, ease-in-out) + blur + fade al visor. *Fly-out* inverso. |
| Visor | `views.html` en un **iframe**, con **Marzipano 0.10** que lee directamente el XML de un export **Panotour Pro 2.5** (krpano): 140 escenas, 20 grupos (10 niveles × Midday/Dusk). Cubos multires 512 px. |
| Datos | Un objeto JSON embebido (`EX`) con geometría de pisos, colecciones (unidades, SF, layout, polígonos de residencias sobre el plano) y `cap` = niveles capturados por posición. |
| Captura más cercana | Si el piso elegido no tiene foto, usa el nivel capturado más cercano y lo indica ("captured at 58"). |
| Planos | Drawer con el plano de la colección (JPG) + polígonos SVG por residencia; tarjetas con SF/layout y botones Midday/Dusk por vista. Swipe entre colecciones en móvil. |
| Extras del visor | Brújula con *heading* por escena calibrado a mano, mapa satelital (Leaflet + ArcGIS World Imagery) con puntos por unidad, mantiene el rumbo al cambiar de piso/hora, crossfade Midday↔Dusk precargando tiles, auto-rotación opcional, modo `?edit`. |
| Deep links | `#l=52&u=4CB&p=Unit%20B&t=Dusk` |
| Tipografía | Fraunces (display) + IBM Plex Sans/Mono; acento latón `#d9b878` sobre tinta `#0d1418`. |

### Valoración

**Lo que hace muy bien (y conservamos):**
- Metáfora clara: *"toca la torre a la altura que quieras"*. Cero curva de aprendizaje.
- Datos centralizados y deep links compartibles.
- Transparencia: avisa cuándo la vista es de otro nivel; disclaimer legal de vistas.
- Detalles finos de visor: mantener rumbo entre pisos, crossfade sin "flash", precarga.

**Oportunidades de mejora (donde aportamos):**
1. **No hay 3D real**: es un render 2D con polígonos. No se puede girar el edificio ni entender la orientación de cada residencia respecto a la ciudad/bahía.
2. **El visor vive en un iframe** y se coordina con `setInterval` (inyecta CSS cada 500 ms, reposiciona el botón de planos cada 700 ms). Funciona, pero es frágil y duplica cargas.
3. **Planos raster** (JPG) con polígonos aproximados; no se relaciona la residencia con *hacia dónde mira* su vista.
4. **Navegación vertical limitada** dentro del visor: el cambio de piso está en el drawer; no hay un "ascensor" persistente.
5. Solo **2 momentos del día**, sin comparador lado a lado.
6. En móvil el render alto obliga a mucho *pan*; la torre no aprovecha el ancho.
7. Accesibilidad: hit-area única, sin foco de teclado por piso.

---

## B. Menú antiguo de Inflight — `P2VR TESTS/Bahia Mar_2T_4`

| Aspecto | Implementación |
|---|---|
| Motor | **Pano2VR 7.1.9** (player + `skin.js`). |
| Contenido | 109 nodos: 2 torres (South / North residences), varios momentos: **day, golden hour, sunrise, twilight**. |
| Organización | Metadatos en *tags* por nodo: orientación (`CENTER`, `NORTH`), momento, nivel (`rd_24`, `rsr_22`…). |
| UI | Portada con aérea del proyecto y pins por torre → listas de niveles → botones por hora. Galería. |
| Skin | `skin.js` de **~1.2 MB**: un elemento por cada botón (`st_d_3`, `st_gh_4`, `hrs_st_5`, …). |

### Valoración

- **Funciona**, pero cada proyecto exige reconstruir la skin a mano: no escala y es propenso a errores.
  Ejemplo real encontrado: el nodo con título `17_rs_d` está etiquetado `rd_18` (piso equivocado en el tag).
- No hay planos, ni ficha de residencia, ni orientación, ni relación piso↔edificio.
- Estética funcional, sin la sofisticación esperada por marcas como Nobu, Cipriani, Baccarat o Ritz-Carlton (clientes de Inflight).

**Conclusión:** el mayor salto de valor no es solo visual: es pasar de **"skin dibujada a mano"** a **"experiencia generada desde datos"**. Una plantilla que se alimenta del Sheet que Inflight ya usa sirve para el próximo proyecto en horas, no en días.

---

## C. Inspiración (reels de Instagram)

Los tres reels compartidos no se pudieron reproducir desde el entorno de análisis (Instagram requiere sesión). **TODO para Camilo**: verlos y anotar aquí 2–3 patrones concretos (p. ej. corte de sección del edificio, transición cámara-dron → interior, tipografía cinética), para justificar las decisiones de motion en [04 · UX](04-ux-flujos.md).

| Reel | Patrón visual | Cómo lo aplicamos |
|---|---|---|
| DfVT3CKT_45 | _pendiente_ | |
| DezgO5dtxnX | _pendiente_ | |
| DevaTLEN6lE | _pendiente_ | |

---

## D. Inflight Solutions (contexto de negocio)

- Contenido aéreo para desarrollos de lujo: **vistas 360°**, *hero backplates* para renders, videos *lifestyle*, avances de obra.
- Clientes: Related, Waldorf Astoria, Ritz-Carlton Residences, Cipriani, Baccarat, Rosewood, Fontainebleau, Douglas Elliman, One Sotheby's, Arquitectonica, SOM, KPF…
- Operación en 20+ ciudades de EE. UU., licencias FAA y seguro de aviación.
- Implicación para el producto: el menú es **herramienta de venta** (sala de ventas, tablet del broker, link a comprador). Debe verse impecable en pantalla grande, ser robusto offline y reutilizable entre proyectos.

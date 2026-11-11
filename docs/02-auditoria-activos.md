# 02 · Auditoría de activos

> Auditoría del día 0. Ya resueltos: los niveles 4 y 7 son gimnasio y garaje G9 (banda "Lower" del menú), y la alineación Día/Twilight se resolvió con la orientación real calculada por `scripts/calibrate-headings.py` (ver [03 · Arquitectura](03-arquitectura.md#orientación-real-calibrate-headingspy)).

Fuente: Google Sheet **"For assestment"** (exportado a `data/source/for-assessment.xlsx`) + lectura de los 162 paquetes en S3 (`index.xml` / `index_vr.xml` de cada uno), 9 nov 2026.
Regenerable con `npm run data:all` → revisa `warnings` en `data/panoramas.json`.

---

## 1. Inventario

- **162 panorámicas** tipo **CUT VIEW** = 81 posiciones × {DAY, TWILIGHT}.
- **11 niveles** capturados: `71 · 65 · 58 · 51 · 43 · 37 · 30 · 23 · 16 · 7 · 4`.
- Cada fila del Sheet → `=HYPERLINK(" https://…/LEVEL+71/0055-UNIT+A/index.html " , " LEVEL 71 ")` (4 celdas usan hipervínculo de celda en lugar de fórmula: F93, F133, F185, F187).
- Hosting: `s3://sftp-bucket-inflightll/customer/13TH FLOOR INVESTMENTS - KEY INTERNATIONAL/PRJ2589 - 609 BRICKELL AVE/CUT VIEW/`
  - Twilight → `M316/TWILIGHT/CUT VIEW LT-AL/LEVEL N/<toma>-UNIT X/`
  - Day → `F256/DAY/LT-AL/LEVEL N/<toma>-UNIT X/`
  (M316 / F256 parecen identificar el vuelo/dron de cada sesión.)

### Matriz de posiciones por nivel (igual para Día y Twilight)

| Nivel | Colección | A | B | B-W | C | C-W | D | E | F |
|---|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| 71 | C5 | ● | ● | ● | ◐ | ◐ | ● | | |
| 65 | C5 | ● | ● | ● | ◐ | ◐ | ● | | |
| 58 | C4 | ● | ● | ● | ◐ | ◐ | ● | ● | |
| 51 | C4 | ● | ● | ● | ◐ | ◐ | ● | ● | |
| 43 | C3 | ● | ● | ● | ◐ | ◐ | ● | ● | ● |
| 37 | C3 | ● | ● | ● | ◐ | ◐ | ● | ● | ● |
| 30 | C3 | ● | ● | ● | ◐ | ◐ | ● | ● | ● |
| 23 | C2 | ● | ● | ● | ◐ | ◐ | ● | ● | ● |
| 16 | C2 | ● | ● | ● | ◐ | ◐ | ● | ● | ● |
| 7 | ¿? ("G9") | ● | ● | ● | ◐ | ◐ | ● | ● | ● |
| 4 | ¿? ("GYM") | ● | ● | ● | ◐ | ◐ | ● | — | ● |

● foto propia · ◐ reutiliza la foto de B / B-W · — sin captura

Coincide con las residencias por colección de la referencia (C5 no tiene E/F; en C5 la residencia 5CC une B+C).

---

## 2. Formato técnico de cada paquete

Exportados con **Panotour Pro 2.5.14** (krpano 1.19), junio 2026.

- `image type="SPHERE"` **parcial** (`full360="false"`), multires, `tilesize=512`, `baseindex=0`, **4 niveles**.
- Patrón de tiles: `<carpeta>/<nivel>/<fila>_<col>.jpg` — **excepción**: el nivel más alto de las tomas de 345° usa `<nivel>/<fila>/<col>.jpg`.
- Fallbacks de cubo: `html5/`, `tablet/`, `mobile/` (6 caras cada uno), `preview.jpg` (cubestrip) y `thumbnail.jpg`.
- Límites de cámara (`hmin/hmax/vmin/vmax`, `fovmax` 90–96.5°) definidos por toma.

### Geometría típica por posición (hfov × vfov)

| Posición | Orientación (archivo) | Niveles altos | Niveles medios/bajos |
|---|---|---|---|
| A | EAST | 345° × 140° (71–51) | 200° × 140° (43–4) |
| B / C | WEST | 195° × 140° (71–51) | 165° (43–23) · 185° (16–4) |
| B-W / C-W | "EAST - UNIT B WEST" | Twilight 108° × 120° · Day 170° × 163° | Twilight 126° × 140° · Day 146° × 140° (43 Day: 187° × 180°) |
| D | SOUTH | 295° × 140° (71–65) | 215° × 140° (58–4) |
| E | SOUTH | 180° × 140° | 180° × 140° |
| F | EAST | — | 205° × 140° |

Resolución del nivel máximo: de 6000 × 6667 px (B-W) a **19167 × 7778 px** (A, 345°). Nivel 2 ≈ la mitad (≤ 9.6K de ancho), nivel 1 ≈ 4.8K.

---

## 3. Anomalías encontradas

| # | Hallazgo | Evidencia | Tratamiento propuesto |
|---|---|---|---|
| 1 | **C = B** y **C-W = B-W** en todos los niveles y ambos momentos | Mismo `scene`/carpeta y mismo archivo fuente ("…UNIT B…") | UI: "Misma vista que Residence B"; se carga una sola vez. Confirmar con Inflight. |
| 2 | **Niveles 4 y 7** con alias **"GYM"** y **"G9"** en archivos fuente | `0038 LEVEL GYM EAST - UNIT A`, `0037 LEVEL G9 EAST - UNIT A` (D/E del nivel 7 sí dicen "LEVEL 7"/"07") | Etiqueta provisional "Level 4 / Level 7" + `$todo` en `building.json`; validar con el PDF. |
| 3 | Niveles 4 y 7 **no existen en la referencia** (que arranca en 12) | `EX.geo.floors` de la referencia | Nueva banda "Lower Levels" en la torre 3D hasta confirmar. |
| 4 | **Etiquetas inconsistentes** en el Sheet | "LEVEL 43 - UNIT A" vs "LEVEL 71 UNIT A", espacios iniciales, F antes que D en nivel 4 | Normalizado por regex en `build-manifest.mjs`. |
| 5 | Carpeta y toma no coinciden | Day L43 Unit E → carpeta `0027-UNIT E`, foto `0191 … UNIT E` | Solo nomenclatura; el contenido es correcto. Se reporta en `warnings`. |
| 6 | Nivel 4 **sin Unit E** | Sheet + S3 | Mostrar la captura más cercana (nivel 7) con aviso, o deshabilitar. |
| 7 | **Día y Twilight no están alineados**: distinto encuadre, campo de visión y rumbo inicial | p. ej. L71-A: Day `h=-55°` vs Twilight `h=0°`; B-W 170×163° vs 108×120° | Calibrar `northOffset` por toma (`?calibrate`) para que el cambio Día↔Twilight mantenga la dirección real. |
| 8 | "B WEST" se llama "EAST – UNIT B WEST" en el archivo | Nombres fuente | Usar el rumbo calibrado, no el texto, para la brújula. |
| 9 | Las tomas de la referencia son de **otro vuelo** (niveles 17, 25, 35…) | XML de Drone Genius | No reutilizar sus *headings*; solo como guía aproximada. |
| 10 | **Sin CORS** en el bucket | `fetch` cross-origin falla | Proxy/rewrite o `data:sync` (ver arquitectura). |

---

## 4. Planos (`619-BRICKELL.pdf`)

- Archivo en Drive de Inflight (`erica@inflightllc.com`), **~94 MB**. No fue posible extraerlo en el análisis automático por tamaño.
- Pasos: descargar a `assets/plans/source/619-BRICKELL.pdf` → seguir `assets/plans/README.md` (rasterizar páginas de *floor plate* por colección a WebP 2–3K + vectorizar polígonos de residencias a `data/plans/*.json`).
- Prioridad: plates de **C2, C3, C4, C5** y el de niveles bajos (para resolver la anomalía 2).

---

## Preguntas abiertas

1. ¿Niveles 4 y 7 = "GYM" / "G9"? ¿Qué colección y residencias tienen?
2. ¿C = B (y C-W = B-W) es intencional?
3. ¿Activan CORS en el bucket para el dominio de la demo, o servimos los tiles nosotros?
4. ¿Existe modelo 3D del edificio (GLB/FBX/Revit/SketchUp) o render de fachada en alta?
5. ¿Dispositivo principal de presentación: pantalla de sala de ventas, tablet o web pública?
6. ¿Se quieren más momentos del día (golden hour, sunrise) como en Bahia Mar, aunque aquí solo hay Day/Twilight?
7. ¿Disclaimer legal estándar de Inflight para vistas ("views are approximate…")?

# CLAUDE.md — contexto para asistentes de IA

Proyecto: menú interactivo de vistas para **Nobu Residences 619 Brickell** (prueba técnica para Inflight Solutions). Lee `README.md` y `docs/03-arquitectura.md` antes de cambios grandes.

## Reglas
- **Data-driven**: nunca codificar pisos, posiciones ni URLs en componentes. Todo sale de `data/building.json` y `data/panoramas.json` vía `src/data/catalog.ts`.
- `data/panoramas*.json` son **generados**: no editarlos a mano; cambia `scripts/*.mjs` y regenera (`npm run data:all`).
- Las URLs del bucket S3 pasan siempre por `assetUrl()` (`src/lib/assetUrl.ts`) por el proxy de CORS.
- Panorámicas = **esferas parciales** (hfov/vfov por toma). La cámara usa el ancho de `pano.view` (hmin/hmax, bordes de la foto) y todo el alto real de la foto con margen; la inclinación de reposo es el centro del rango vertical de Inflight. Todas las vistas comparten el mismo rango de zoom (el que cabe en la más estrecha). Sin zoom la cámara solo gira en horizontal; con zoom también inclina. Nunca enseña fuera de la foto (`src/lib/camera.ts`).
- Rumbo absoluto = `yaw + northOffset`; el visor trabaja en ese marco (yaw = rumbo real). `northOffset` sale de `data/headings.json`, generado por `scripts/calibrate-headings.py` (no editar a mano). Al cambiar de piso u hora se conserva el rumbo; al cambiar de residencia la cámara gira hacia la nueva.
- Estado global solo en `src/app/store.ts` (zustand); la URL se sincroniza en `src/app/router.ts`.
- Estilos: **Tailwind CSS v4**; tokens en el `@theme` de `src/styles/tokens.css`. Sin otras librerías de componentes.
- Diseño y movimiento: seguir la skill `apple-design` (`.claude/skills/apple-design`). Resortes sin rebote de `src/lib/motion.ts`.
- TypeScript estricto; componentes funcionales; nombres en inglés, comentarios y docs en español.
- Mantener accesibilidad: atajos de teclado, foco visible, `prefers-reduced-motion`.

## Comandos
- `npm run dev` · `npm run build` · `npm run typecheck`
- `npm run data:all` (manifest + probe) · `npm run data:hero`
- Generadores en Python (venv propio, ver README): `scripts/build-plan-assets.py` y `scripts/calibrate-headings.py`

## Glosario
- **Position**: punto de captura por residencia/fachada: A, B, B-W, C, C-W, D, E, F (`-W` = vista "West" de esa línea).
- **Collection**: banda de pisos con el mismo plano (C2 12–27, C3 30–43, C4 46–59, C5 62–71).
- **Cut view**: panorámica recortada a lo visible desde la fachada.
- **Captured level**: piso con fotos (71, 65, 58, 51, 43, 37, 30, 23, 16, 7, 4). Otros pisos usan la captura más cercana.

## Registro de IA
Anota en `docs/ai-log.md` los prompts y decisiones relevantes (Inflight evalúa el uso de IA).

# 05 · Roadmap y estimación

> **Documento histórico:** propuesta del día 0, antes de construir. Lo implementado está en el [README](../README.md) y en [03 · Arquitectura](03-arquitectura.md); la torre 3D y la herramienta `?calibrate` se sustituyeron por el render de portada y la calibración automática.

Supuestos: una persona a tiempo completo, desarrollo asistido por IA, respuestas de Inflight a las preguntas abiertas en ≤ 1 día, planos PDF disponibles.

## Fases

| Fase | Días | Entregable | Hecho = |
|---|---|---|---|
| **0 · Fundaciones** ✅ | 0.5 | Análisis, auditoría, arquitectura, pipeline de datos, scaffold | Este repo |
| **1 · Visor** | 1.5 | Visor de panorámicas parciales (estrategia A), límites, Día↔Twilight con crossfade, selector de posiciones, ascensor de pisos, deep links | Se navegan las 162 vistas sin errores |
| **2 · Torre 3D** | 1.5 | Masa procedural, bandas por colección, hover/click por piso, fly-in/out, iluminación por hora | Desde la portada se llega a cualquier vista en ≤ 3 clics |
| **3 · Planos** | 1 | Planos por colección desde el PDF, residencias clicables, fichas, conos de vista | Plano ⇄ vista sincronizados |
| **4 · Pulido y QA** | 1 | Dirección visual final, estados vacíos/errores, móvil/tablet, performance, accesibilidad, modo presentación, deploy | Versión presentable con URL pública |
| **5 · Extras** (opcional) | 2–3 | Calibración de brújula + hitos, comparador, estrategia B (tiles pre-baked), PWA offline, GLB real | — |

**Versión presentable: 5 días hábiles** (fases 0–4). Con extras: ~8 días hábiles.

## Hitos de revisión con Inflight

1. Fin del día 2 — link con el visor navegando todas las vistas (feedback temprano sobre la experiencia de panorámicas, que es lo que más les interesa optimizar).
2. Fin del día 4 — torre 3D + planos integrados.
3. Día 5 — entrega + walkthrough de 20 min (decisiones, uso de IA, cómo escalar a otros proyectos).

## Riesgos y mitigación

| Riesgo | Prob. | Mitigación |
|---|---|---|
| CORS del bucket bloquea texturas | Alta (confirmado) | Proxy dev/prod ya configurado; plan B `data:sync`. |
| Memoria en móviles con tomas de 345° | Media | Nivel 1 (≈4.8K) en móvil, `maxTextureSize`, liberar texturas. |
| Planos PDF pesados / no vectoriales | Media | Raster WebP + polígonos dibujados a mano asistidos por IA. |
| Datos ambiguos (niveles 4/7, C = B) | Alta | UI honesta + preguntas enviadas el día 0. |
| Sin modelo 3D del edificio | Media | Masa procedural elegante; GLB intercambiable si llega. |
| Alineación Día/Twilight imprecisa | Media | Herramienta `?calibrate` (≈1 h para 162 tomas). |

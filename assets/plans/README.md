# Planos

`619-BRICKELL.pdf` (juego de planos de Sieger Suarez, ~94 MB) va en `assets/plans/source/` y no se versiona. Se descarga desde el enlace de Drive del correo de Inflight.

Todo lo que la app usa del PDF lo genera un solo script:

```bash
.venv/Scripts/python scripts/build-plan-assets.py assets/plans/source/619-BRICKELL.pdf
```

| Salida | Contenido |
|---|---|
| `public/brand/hero-{1920,3840}.webp` | Render de portada (lámina A-903) |
| `public/plans/collection-N.webp` | Planta de cada colección, solo trazo con alfa, sin anotaciones |
| `data/plans/collection-N.json` | Zonas de cada residencia (principal y West) como trazados SVG, y posición de su etiqueta |

Cómo se obtienen las zonas: [docs/03 · Arquitectura › Plantas y zonas](../../docs/03-arquitectura.md#plantas-y-zonas-build-plan-assetspy).

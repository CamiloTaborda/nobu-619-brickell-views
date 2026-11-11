# 04 · UX, flujos y dirección visual

> **Documento histórico:** propuesta del día 0, antes de construir. Lo implementado está en el [README](../README.md) y en [03 · Arquitectura](03-arquitectura.md); la torre 3D y la herramienta `?calibrate` se sustituyeron por el render de portada y la calibración automática.

## Usuarios y contexto

| Usuario | Contexto | Necesita |
|---|---|---|
| Broker / equipo de ventas | Sala de ventas, pantalla grande o iPad, presentando a un comprador | Llegar rápido a "la vista de la 58B al atardecer", modo presentación, cero fallos. |
| Comprador (link enviado) | Móvil, solo, curioseando | Entender qué ve desde cada residencia y compartirlo. |
| Equipo Inflight | Producción de nuevos proyectos | Cargar datos de otro edificio sin reprogramar. |

## Flujo principal

```
[Portada / Torre 3D]
   │ hover piso → etiqueta "Level 58 · Collection 4 · 7 views"
   │ click piso (o colección)
   ▼
[Vista]  ← fly-in de cámara + fundido
   │  HUD inferior: [▲ 58 ▼]  [A  B  B·W  C  C·W  D  E]  [Day | Twilight]
   │  HUD superior: Nobu 619 Brickell / Collection 4 / Level 58 / Residence 4CB · West
   │  Brújula + mini-plano con cono de visión (esquina)
   ├─▶ [Planos] drawer lateral: plano de la colección, residencias clicables, ficha
   ├─▶ cambiar piso (ascensor) → conserva posición y rumbo
   ├─▶ cambiar hora → crossfade, mismo encuadre
   └─▶ [Esc / ← Building] vuelve a la torre (fly-out)
```

Atajos: `↑/↓` piso · `←/→` posición · `T` hora · `P` planos · `F` pantalla completa · `Esc` volver · `Space` (modo presentación) pausa.

## Estados que hay que diseñar

| Estado | Comportamiento |
|---|---|
| Piso sin captura (p. ej. 60) | Usa nivel capturado más cercano (58) y lo dice: "View captured at Level 58". |
| Posición sin captura en ese piso (E en nivel 4) | Botón deshabilitado con tooltip, o salto a la captura más cercana. |
| Posición con foto compartida (C) | Chip "Same view as Residence B". |
| Cargando | `preview.jpg` borroso al instante → tiles nítidos con fade (sin spinner a pantalla completa). |
| Error de red | Mantener última vista, toast discreto con reintento. |
| Móvil vertical | HUD colapsado en un "dock" inferior; planos como *bottom sheet*. |

## Modo presentación

- `?present` o botón discreto: oculta cromo, pantalla completa.
- Recorrido automático: sube la torre piso a piso con *pan* lento en cada vista (configurable), alterna Día/Twilight.
- Control remoto por teclado / clicker.

## Momentos "wow" (sin sacrificar claridad)

1. **Fly-in** desde la torre 3D al piso, y la cámara 3D "atraviesa" la fachada hacia la panorámica.
2. **Day → Twilight** como un *time-lapse* corto (crossfade + ajuste de exposición) manteniendo el encuadre.
3. **Conos de vista** en la torre y el plano: entender de un vistazo hacia dónde mira cada residencia.
4. **Comparador** (fase 2): split vertical Día | Twilight o Piso 23 | Piso 71 con el mismo rumbo.

---

## Dirección visual

Inspiración: estética Nobu (minimalismo japonés cálido) + lenguaje de Inflight (aéreo, cielo).

| Token | Valor | Uso |
|---|---|---|
| `--ink` | `#0E0F10` | Fondos, HUD |
| `--washi` | `#F3EEE6` | Texto principal sobre oscuro, fondos claros |
| `--stone` | `#8C8A85` | Texto secundario, líneas |
| `--bronze` | `#B08A57` | Acento (selección, foco, piso activo) |
| `--twilight` | `#2B3550` | Tinte para el modo twilight |
| `--glass` | `rgba(14,15,16,.55)` + `backdrop-filter: blur(18px)` | Paneles flotantes |

- **Tipografía**: *Cormorant Garamond* (display, light/regular, tracking amplio en versalitas) + *Manrope* (UI, 400–600). Números tabulares para pisos.
- **Movimiento**: curvas suaves (`cubic-bezier(.22,.61,.36,1)`), 400–900 ms; nada rebota.
- **Retícula**: márgenes generosos, HUD en los bordes para no tapar la vista; la panorámica es la protagonista.
- **Iconografía**: línea fina 1.25 px, sin rellenos.

Referencias de estilo a completar tras ver los reels de inspiración (ver [01](01-analisis-referencia.md#c-inspiración-reels-de-instagram)).

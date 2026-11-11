# Nobu Residences 619 Brickell — Views

An interactive menu to explore the real, drone-captured views from every residence of **Nobu Residences 619 Brickell** in Miami. Browse **building → collection → floor → residence → view (Day / Twilight)**, with the project's floor plans alongside.

Built as a technical assessment for **Inflight Solutions**.

**Live demo:** https://nobu-619-brickell-views.vercel.app

---

## Highlights

| Area | What it does |
|---|---|
| **Opening** | Server-rendered loading screen: the real floors of the rendering light up while fonts, the cover image and (for direct links) the first view load. It fades into the cover without anything moving. |
| **Cover** | Rendering of the building with its 56 floors mapped. Point at a floor and it lights up with a card showing a real crop of the view from that height; point at a collection to see its summary (floors, residences per floor, bedrooms, areas, plan). |
| **Viewer** | Partial panoramas from 108° to 345°. The camera never shows anything outside the photo. It pans horizontally at the default zoom and can also tilt when zoomed in. Every view shares the same zoom range. |
| **True orientation** | Each photo is aligned to true north. Changing floor or time keeps the direction you are looking at; changing residence turns the camera towards the new one. Compass in the corner. |
| **Floor menu** | Captured floors grouped by collection, with the current collection highlighted. |
| **Floor plans** | The real plan of each collection (from the architect's drawing set) with the exact area of each residence, one zone per view (main and West). On desktop the plan can be **enlarged to half the screen** while the other half shows the view selected on it. |
| **Links** | Every view has a shareable URL: `#m=view&l=58&p=B-W&t=twilight&h=212`. |

Keyboard shortcuts in the viewer: `↑/↓` floor · `←/→` residence · `T` Day/Twilight · `P` floor plans · `F` full screen · `Esc` one step back (enlarged plan → panel → cover).

---

## Getting started

**Requirements:** [Node.js](https://nodejs.org) 20.19 or newer, and npm.

```bash
git clone https://github.com/CamiloTaborda/nobu-619-brickell-views.git
cd nobu-619-brickell-views
npm install
npm run dev
```

Open http://localhost:3000.

| Command | Description |
|---|---|
| `npm run dev` | Development server with hot reload. |
| `npm run build` | Production build. |
| `npm start` | Serves the production build (run `npm run build` first). |
| `npm run typecheck` | Strict TypeScript check. |

No environment variables or API keys are needed. The panoramas are loaded from Inflight's public S3 bucket through the `/s3` rewrite in `next.config.ts` (the bucket does not send CORS headers, which WebGL requires).

### Regenerating the data (optional)

Everything the app shows comes from `data/*.json`, generated from Inflight's materials. These files are committed, so this step is only needed if the source materials change.

| Command | Output |
|---|---|
| `npm run data:manifest` | Asset sheet → `data/panoramas.base.json` (162 normalized views). |
| `npm run data:probe` | Reads each Panotour package on S3 → `data/panoramas.json` (geometry, tiles, source file). |
| `npm run data:hero` | Floors measured on the rendering → `data/hero.json`. |
| `npm run data:all` | `data:manifest` + `data:probe`. |

Two Python generators need their own virtual environment and the project PDF (not included in the repository):

```bash
python -m venv .venv
.venv/Scripts/pip install pymupdf pillow scikit-image opencv-python-headless numpy   # on macOS/Linux: .venv/bin/pip

# Plans, residence outlines and cover rendering, from the drawing set
.venv/Scripts/python scripts/build-plan-assets.py assets/plans/source/619-BRICKELL.pdf

# True north of every photo → data/headings.json (downloads the photos to .cache/headings)
.venv/Scripts/python scripts/calibrate-headings.py
```

Generated files (`data/panoramas*.json`, `data/hero.json`, `data/headings.json`, `data/plans/*.json`) are never edited by hand: change the script and regenerate.

---

## How it works

- **Data-driven.** No component hard-codes floors, positions or URLs. `src/data/catalog.ts` is the single entry point to the data.
- **One state.** The cover, viewer, controls and plans share one Zustand store, mirrored in the URL hash.
- **Images off the main thread.** A Web Worker downloads and stitches the Panotour tiles into an `ImageBitmap`, handed to Photo Sphere Viewer through a custom adapter. Progressive loading, a memory-bounded cache and intent-based prefetching keep changes nearly instant.
- **Never outside the photo.** Camera limits are computed from the real screen corners and a zoom range shared by all views; transitions blend two valid frames instead of sweeping the camera across areas no photo covers.
- **True north.** The photos shipped without orientation. `scripts/calibrate-headings.py` matches the distant skyline between photos (SIFT), solves one rotation per photo by least squares and anchors north on a known landmark.
- **Exact residence areas.** The PDF keeps its CAD layers: `scripts/build-plan-assets.py` rasterizes only the walls and splits each plan with a watershed seeded from each unit label.

The full technical write-up (in Spanish) is in [docs/03 · Arquitectura](docs/03-arquitectura.md).

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router) + strict TypeScript |
| UI | React 19 + Tailwind CSS v4 (design tokens in `src/styles/tokens.css`) |
| State | Zustand, synced with the URL hash |
| Panoramas | Photo Sphere Viewer 5 with a custom adapter |
| Motion | Motion (critically damped, interruptible springs; `prefers-reduced-motion` respected) |
| Data | Node and Python scripts in `scripts/` |

## Project structure

```
data/                     building.json (hand-written) + generated JSON + source materials
scripts/                  data generators (Node and Python)
public/brand, public/plans  cover rendering and floor plans (generated from the PDF)
src/
  app/        layout, page, client bootstrap, store and hash router
  data/       types and catalog.ts
  features/   splash · home (cover) · viewer · hud (controls, floor menu, compass) · plans
  lib/        camera, headings, tile stitching worker, prefetching, split view
  ui/         shared pieces (segmented control, title, icons)
  styles/     Tailwind theme and global styles
docs/         analysis, architecture and AI log (Spanish)
```

---

## Deployment

The app is deployed on [Vercel](https://vercel.com): import the repository and deploy with the default Next.js settings. No environment variables are required. For production at scale, enabling CORS on the S3 bucket (or serving it through CloudFront) would let the browser load the panoramas directly and remove the `/s3` proxy.

---

## Next steps

- **3D floor plans.** An interactive architectural model of each collection (orbit and zoom), with residences highlighted and linked to their views. The PDF's CAD layers already separate walls, doors and the building core, so the walls can be extruded from the same data that produces today's residence areas.
- **3D building on the cover.** A navigable model of the tower to choose a floor in three dimensions, with the camera flying from the building into the view.
- Satellite minimap showing where you are looking.
- Automated tests: unit tests for the pure modules (`camera.ts`, `catalog.ts`, `heading.ts`) and an end-to-end run in CI.

## Open questions for Inflight

1. **Source of truth for areas.** The sales sheet and the PDF differ for Collection 3 (the PDF merges 3CA with the F line; 3CF has no area on the plan), 4CE (1,176 vs 1,172 SF), 5CB/5CC (separate vs merged) and level 12.
2. **Sales floor plans.** The PDF is the permit set (Dec. 2025); if marketing plans exist, the outlines can be regenerated with the same script.
3. **Legal copy** for the views and plans disclaimer (the current text is a placeholder).
4. **Unit C** uses the same photo as **Unit B** on every floor; the interface says so.

---

## AI usage

This project was built with Claude Code as a coding assistant, following the rules in [CLAUDE.md](CLAUDE.md). Every relevant decision (request, approach, result and human review) is logged in [docs/ai-log.md](docs/ai-log.md).

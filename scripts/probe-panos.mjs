#!/usr/bin/env node
/**
 * probe-panos.mjs
 * ------------------------------------------------------------------
 * Enriquece data/panoramas.base.json leyendo el XML de cada paquete
 * Panotour Pro (krpano) publicado en S3 y escribe data/panoramas.json.
 *
 * Por cada panorámica extrae:
 *  - geometría parcial (hfov × vfov, voffset)  → son "cut views", NO 360° completos
 *  - vista inicial y límites (h, v, fov, hmin/hmax, vmin/vmax, fovmax)
 *  - niveles multires (ancho × alto, tile 512, patrón de URL de tiles)
 *  - nombre del archivo fuente (alias de piso y unidad, para avisos de calidad)
 *  - duplicados: paquetes que apuntan a la misma foto (p. ej. Unit C = Unit B)
 *
 * Corre en TU máquina (Node ≥ 20). El bucket S3 no envía cabeceras CORS,
 * así que esto no se puede hacer desde el navegador en otro dominio.
 *
 * Uso:  npm run data:probe            (usa data/panoramas.base.json)
 *       npm run data:probe -- --limit 5
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { XMLParser } from 'fast-xml-parser';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = resolve(root, 'data/panoramas.base.json');
const OUT = resolve(root, 'data/panoramas.json');

const args = process.argv.slice(2);
const limit = Number(args[args.indexOf('--limit') + 1]) || Infinity;
const CONCURRENCY = 8;

const base = JSON.parse(readFileSync(BASE, 'utf8'));
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });
const num = (v) => (v === undefined || v === '' ? null : Number(v));

async function getText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

function parseSource(vrXml) {
  // Panotour deja el archivo fuente en un comentario: <!-- **** Source : "...\0055 LEVEL 71 EAST - UNIT A - 345X140.jpg" **** -->
  const m = vrXml.match(/([^\\/"*]+\.(?:jpe?g|tiff?|png|psb))/i);
  if (!m) return null;
  const file = m[1].trim();
  const floorAlias = file.match(/LEVEL\s+([A-Z0-9]+)/i)?.[1] ?? null; // "71", "G9", "GYM"
  const unitInFile = file.match(/UNIT\s+([A-F])(\s+WEST)?/i);
  return {
    file,
    floorAlias,
    unitInFile: unitInFile ? unitInFile[1].toUpperCase() + (unitInFile[2] ? '-W' : '') : null,
  };
}

async function probe(item) {
  const xml = await getText(item.packageBase + 'index.xml');
  let vr = '';
  try {
    vr = await getText(item.packageBase + 'index_vr.xml');
  } catch {
    /* opcional */
  }
  const doc = parser.parse(xml);
  const scene = [doc.krpano?.scene].flat()[0];
  const pv = scene.panoview ?? {};
  const images = [scene.image].flat();
  const sphere = images.find((i) => i.type === 'SPHERE');
  const levels = [sphere?.level ?? []].flat().map((l) => ({
    width: num(l.tiledimagewidth),
    height: num(l.tiledimageheight),
    url: l.sphere.url, // ej. "unit_a_22/2/%v_%u.jpg"  (%v = fila, %u = columna)
  }));
  const cubeFallback = Object.fromEntries(
    images
      .filter((i) => i.type === 'CUBE')
      .map((i) => [i.devices, ['front', 'right', 'back', 'left', 'up', 'down'].map((f) => i[f]?.url)]),
  );
  const folder = scene.thumburl?.replace('%FIRSTXML%/', '').split('/')[0];

  return {
    ...item,
    pano: {
      scene: scene.name,
      folder,
      full360: scene.full360 === 'true',
      hfov: num(sphere?.hfov),
      vfov: num(sphere?.vfov),
      voffset: num(sphere?.voffset) ?? 0,
      tileSize: num(sphere?.tilesize),
      levels: levels.sort((a, b) => a.width - b.width),
      cubeFallback,
      preview: `${folder}/preview.jpg`,
      thumbnail: `${folder}/thumbnail.jpg`,
      view: {
        h: num(pv.h),
        v: num(pv.v),
        fov: num(pv.fov),
        hmin: num(pv.hmin),
        hmax: num(pv.hmax),
        vmin: num(pv.vmin),
        vmax: num(pv.vmax),
        fovmax: num(pv.fovmax),
      },
    },
    source: parseSource(vr),
  };
}

async function run() {
  const items = base.items.slice(0, limit);
  const out = [];
  const errors = [];
  for (let i = 0; i < items.length; i += CONCURRENCY) {
    const batch = items.slice(i, i + CONCURRENCY);
    const res = await Promise.allSettled(batch.map(probe));
    res.forEach((r, k) => {
      if (r.status === 'fulfilled') out.push(r.value);
      else {
        errors.push({ id: batch[k].id, error: String(r.reason) });
        out.push({ ...batch[k], pano: null, source: null });
      }
    });
    process.stdout.write(`\r  ${Math.min(i + CONCURRENCY, items.length)}/${items.length}`);
  }
  process.stdout.write('\n');

  // Detecta paquetes que muestran la misma foto (misma fuente) dentro de un mismo nivel/tiempo
  const byPhoto = new Map();
  for (const it of out) {
    if (!it.source?.file) continue;
    const k = `${it.time}|${it.level}|${it.source.file}`;
    byPhoto.set(k, [...(byPhoto.get(k) ?? []), it.id]);
  }
  for (const it of out) {
    const k = it.source?.file && `${it.time}|${it.level}|${it.source.file}`;
    const group = k ? byPhoto.get(k) : null;
    it.sharedWith = group && group.length > 1 ? group.filter((id) => id !== it.id) : [];
  }

  // Avisos de calidad de datos
  const warnings = [];
  for (const it of out) {
    if (!it.source) continue;
    if (it.source.unitInFile && it.source.unitInFile !== it.position)
      warnings.push(`${it.id}: el archivo fuente es de ${it.source.unitInFile} ("${it.source.file}")`);
    if (it.source.floorAlias && it.source.floorAlias !== String(it.level) && it.source.floorAlias !== String(it.level).padStart(2, '0'))
      warnings.push(`${it.id}: el archivo fuente dice LEVEL ${it.source.floorAlias}`);
    if (it.folder && it.shot && !it.source.file.startsWith(it.shot))
      warnings.push(`${it.id}: carpeta ${it.folder} pero toma ${it.source.file.slice(0, 4)}`);
  }

  writeFileSync(
    OUT,
    JSON.stringify(
      { ...base, probedAt: new Date().toISOString(), errors, warnings, items: out },
      null,
      2,
    ),
  );
  console.log(`✔ ${out.length - errors.length}/${out.length} paquetes leídos → ${OUT}`);
  if (errors.length) console.warn(`⚠ ${errors.length} errores (ver "errors" en el JSON)`);
  if (warnings.length) console.warn(`⚠ ${warnings.length} avisos de calidad de datos (ver "warnings")`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * build-manifest.mjs
 * ------------------------------------------------------------------
 * Lee la hoja de activos de Inflight (data/source/for-assessment.xlsx,
 * exportada desde Google Sheets) y genera data/panoramas.base.json:
 * una entrada normalizada por panorámica (162 = 81 posiciones × Día/Twilight).
 *
 * Por qué hace falta:
 *  - Las etiquetas del sheet no son consistentes ("LEVEL 43 - UNIT A",
 *    " LEVEL 16 UNIT B", "LEVEL 4 UNIT F" antes que "D", espacios extra…).
 *  - Las URLs están dentro de fórmulas =HYPERLINK(" url " , " LEVEL 71 ")
 *    y unas pocas como hipervínculo de celda. El CSV exportado las pierde.
 *
 * Uso:  npm run data:manifest
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const XLSX_SRC = resolve(root, 'data/source/for-assessment.xlsx');
const CSV_SRC = resolve(root, 'data/source/for-assessment.csv');
const LINKS_SRC = resolve(root, 'data/source/panorama-links.json');
const OUT = resolve(root, 'data/panoramas.base.json');
const LABEL_RE = /^\s*LEVEL\s+(\d+)\s*-?\s*UNIT\s+([A-F])(\s+WEST)?\s*$/i;

/** Filas { row, time, type, label, url } desde el .xlsx (preferido) o CSV + panorama-links.json. */
async function readRows() {
  if (existsSync(XLSX_SRC)) {
    const { default: XLSX } = await import('xlsx');
    const wb = XLSX.read(readFileSync(XLSX_SRC), { cellFormula: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const range = XLSX.utils.decode_range(ws['!ref']);
    const cell = (r, c) => ws[XLSX.utils.encode_cell({ r, c })];
    const urlFrom = (c) => {
      if (!c) return null;
      if (c.f && /HYPERLINK/i.test(c.f)) return c.f.match(/HYPERLINK\(\s*"\s*([^"]+?)\s*"/i)?.[1]?.trim() ?? null;
      return c.l?.Target?.trim() ?? null;
    };
    const rows = [];
    for (let r = range.s.r; r <= range.e.r; r++)
      rows.push({
        row: r + 1,
        time: String(cell(r, 1)?.v ?? '').trim(), // col B
        type: String(cell(r, 2)?.v ?? '').trim(), // col C
        label: cell(r, 3)?.v ?? null, // col D
        url: urlFrom(cell(r, 4)) ?? urlFrom(cell(r, 5)), // col E / F
      });
    console.log('  fuente: for-assessment.xlsx');
    return rows;
  }
  // Fallback: el CSV no trae URLs → se emparejan en orden con panorama-links.json
  const links = JSON.parse(readFileSync(LINKS_SRC, 'utf8'));
  const csv = readFileSync(CSV_SRC, 'utf8').split(/\r?\n/).map((l) => l.split(','));
  const data = csv.filter((c) => ['DAY', 'TWILIGHT'].includes((c[1] ?? '').trim()) && c[3]);
  if (data.length !== links.rows.length) throw new Error(`CSV (${data.length}) y links (${links.rows.length}) no coinciden`);
  console.log('  fuente: for-assessment.csv + panorama-links.json (descarga el .xlsx del Sheet para la fuente completa)');
  return data.map((c, i) => ({
    row: links.rows[i][0],
    time: c[1].trim(),
    type: c[2].trim(),
    label: c[3],
    url: links.prefix + links.rows[i][1] + links.suffix,
  }));
}

const items = [];
const problems = [];

for (const { row, time, type, label, url } of await readRows()) {
  if (!['DAY', 'TWILIGHT'].includes(time) || !label) continue;

  const m = String(label).match(LABEL_RE);
  if (!m) {
    problems.push({ row, label, issue: 'etiqueta no reconocida' });
    continue;
  }
  const level = Number(m[1]);
  const line = m[2].toUpperCase();
  const variant = m[3] ? 'west' : 'main';
  if (!url) problems.push({ row, label, issue: 'sin URL' });

  const t = time === 'DAY' ? 'day' : 'twilight';
  const position = variant === 'west' ? `${line}-W` : line;
  const folder = url ? decodeURIComponent(url.split('/').slice(-2, -1)[0].replace(/\+/g, ' ')) : null;
  const shot = folder?.match(/^(\d{4})/)?.[1] ?? null;

  items.push({
    id: `L${level}-${position}-${t}`,
    level,
    line,
    variant,
    position,
    time: t,
    type, // "CUT VIEW"
    url,
    packageBase: url ? url.replace(/index\.html$/, 'indexdata/') : null,
    folder,
    shot,
    sheet: { row, label: String(label).trim() },
  });
}

// Orden estable: nivel desc, posición, tiempo
const posOrder = ['A', 'B', 'B-W', 'C', 'C-W', 'D', 'E', 'F'];
items.sort(
  (a, b) =>
    b.level - a.level ||
    posOrder.indexOf(a.position) - posOrder.indexOf(b.position) ||
    a.time.localeCompare(b.time),
);

const levels = [...new Set(items.map((i) => i.level))].sort((a, b) => b - a);
const summary = Object.fromEntries(
  levels.map((lv) => [lv, [...new Set(items.filter((i) => i.level === lv).map((i) => i.position))]]),
);

writeFileSync(
  OUT,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      source: existsSync(XLSX_SRC) ? 'data/source/for-assessment.xlsx' : 'data/source/for-assessment.csv + panorama-links.json',
      count: items.length,
      levels,
      positionsByLevel: summary,
      problems,
      items,
    },
    null,
    2,
  ),
);

console.log(`✔ ${items.length} panorámicas → ${OUT}`);
console.log(`  niveles: ${levels.join(', ')}`);
if (problems.length) console.warn('⚠ problemas:', problems);

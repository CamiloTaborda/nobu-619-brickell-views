#!/usr/bin/env python3
"""
build-plan-assets.py
------------------------------------------------------------------
Extrae de 619-BRICKELL.pdf (juego de planos de Sieger Suarez):
  - public/brand/hero-{1920,3840}.webp     render de portada (lámina A-903)
  - public/plans/collection-N.webp         planta de cada colección, trazo con alfa
  - data/plans/collection-N.json           zonas de cada residencia: principal y, si la hay, oeste

Contornos: el PDF conserva las capas de CAD, así que se rasterizan solo los muros
y se reparte la planta con una cuenca (watershed) sembrada desde la etiqueta de
cada unidad. Los cuellos de las puertas separan las regiones sin tener que cerrar
cada puerta a mano; el núcleo común se siembra aparte con las puertas selladas,
porque si no los vestíbulos de ascensor se cuelan en la residencia vecina.

Las anotaciones se apagan por capa: la UI dibuja las etiquetas desde los datos,
porque las superficies del PDF no siempre coinciden con las de venta.

Requisitos:  pip install pymupdf pillow scikit-image
Uso:         python scripts/build-plan-assets.py ruta/a/619-BRICKELL.pdf
"""
import json
import pathlib
import re
import sys
import warnings

warnings.filterwarnings('ignore')
import numpy as np
import pymupdf
from PIL import Image, ImageDraw
from scipy import ndimage as ndi
from skimage.measure import approximate_polygon, find_contours
from skimage.segmentation import watershed

ROOT = pathlib.Path(__file__).resolve().parent.parent
HERO_PAGE = 53
# página del PDF (base 1) por colección; todas comparten encuadre de la torre
PLATES = {2: 30, 3: 33, 4: 36, 5: 39}
PLATE_CLIP = pymupdf.Rect(205, 650, 1440, 2080)  # puntos PDF, la losa completa
PLATE_WIDTH = 2000  # resolución de análisis; es también el sistema de coordenadas de los contornos
IMAGE_WIDTH = 1400  # imagen publicada: nítida a 3x en el panel y ligera de descargar y decodificar
ZOOM = PLATE_WIDTH / PLATE_CLIP.width
# Muro macizo de las líneas B y C que separa su ala oeste; es igual en las cuatro plantas.
WEST_WALL = (pymupdf.Point(713.3, 1243.5), pymupdf.Point(674.8, 1405.9))
TINT = (243, 238, 230)
UNIT_LABEL = re.compile(r"\b([1-5][CN][A-G])\b")

# Capas de CAD, sin el prefijo de la referencia externa ("A2110-Core.C3|").
WALL_LAYERS = {'a-stud', 'a-fin', 'a-block', 'a-col-fill', 'a-col', 'a-fill', 'a-slab', 'a-rail'}
DOOR_LAYERS = {'a-dr', 'a-drsw'}
CORE_LAYERS = {'a-elev', 'a-str', 'a-str-cl-path'}
HIDDEN_LAYERS = {
    'title', 'a-note', 'a-note2', 'note', 'a-text', 'a-dim', 'a-dim2', 'a-dim unit', 'a-zoning layers',
    'property line', 'a-property line', 'centerline', 'a-beam above', 'a-str-cl-path', 'a-hrs', 'i-rmname',
}

EXTERIOR, CORE, FIRST_UNIT = 1, 2, 3
OUTLINE_TOLERANCE = 1.5  # px sobre la imagen de 2000; por debajo de lo que se aprecia en pantalla
CORE_NECK = 26  # px; aberturas más estrechas que el doble de esto no conectan el núcleo con otra estancia
CORE_REACH = 12  # px; margen con el que los ascensores alcanzan su vestíbulo una vez estrechado
POCKET_AREA = 10_000  # px²; a partir de aquí un hueco sin etiqueta y delgado es banda de losa, no un armario
POCKET_WIDTH = 70  # px; radio máximo de esas bandas (una estancia siempre supera este valor)
WING_AREA = 20_000  # px²; a partir de aquí, una parte estrechada del núcleo sin ascensor ni escalera es un ala


def hero(doc: pymupdf.Document) -> None:
    page = doc[HERO_PAGE - 1]
    # El render viene partido en varias imágenes y la página está girada 90°.
    rect = pymupdf.Rect()
    for image in page.get_images(full=True):
        for part in page.get_image_rects(image[0]):
            rect |= part
    rect = rect * page.rotation_matrix
    out = ROOT / 'public/brand'
    out.mkdir(parents=True, exist_ok=True)
    pix = page.get_pixmap(matrix=pymupdf.Matrix(3840 / rect.width, 3840 / rect.width), clip=rect, alpha=False)
    img = Image.frombytes('RGB', (pix.width, pix.height), pix.samples)
    img.save(out / 'hero-3840.webp', quality=86, method=6)
    img.resize((1920, round(pix.height * 1920 / pix.width)), Image.LANCZOS).save(out / 'hero-1920.webp', quality=84, method=6)
    print(f'hero {pix.width}x{pix.height}')


def layer_key(layer: str | None) -> str:
    return (layer or '').split('|')[-1].strip().lower()


def flatten(item: tuple) -> list[pymupdf.Point]:
    """Vértices de un segmento de trazado del PDF."""
    kind = item[0]
    if kind == 'l':
        return [item[1], item[2]]
    if kind == 're':
        r = item[1]
        return [r.tl, r.tr, r.br, r.bl, r.tl]
    if kind == 'qu':
        q = item[1]
        return [q.ul, q.ur, q.lr, q.ll, q.ul]
    if kind == 'c':
        p0, p1, p2, p3 = item[1:5]
        return [p0 * (1 - t) ** 3 + p1 * 3 * (1 - t) ** 2 * t + p2 * 3 * (1 - t) * t**2 + p3 * t**3 for t in (i / 12 for i in range(13))]
    return []


def to_plate(point: pymupdf.Point, page: pymupdf.Page) -> tuple[float, float]:
    """Punto del PDF a píxel de la imagen; las coordenadas ignoran el giro de la página."""
    p = point * page.rotation_matrix
    return (p.x - PLATE_CLIP.x0) * ZOOM, (p.y - PLATE_CLIP.y0) * ZOOM


def rasterize(page: pymupdf.Page, size: tuple[int, int]) -> dict[str, np.ndarray]:
    """Máscaras de muros, puertas y núcleo a partir de las capas de CAD."""
    canvases = {name: Image.new('1', size, 0) for name in ('walls', 'fills', 'doors', 'core', 'lifts')}
    pens = {name: ImageDraw.Draw(c) for name, c in canvases.items()}
    for drawing in page.get_drawings():
        key = layer_key(drawing.get('layer'))
        pen = pens['walls'] if key in WALL_LAYERS else pens['doors'] if key in DOOR_LAYERS else pens['core'] if key in CORE_LAYERS else None
        if pen is None or not (drawing['rect'] * page.rotation_matrix).intersects(PLATE_CLIP):
            continue
        targets = [pen, pens['fills']] if key in WALL_LAYERS else [pen]
        subpath: list[tuple[float, float]] = []

        def fill_subpath() -> None:
            if 'f' in drawing['type'] and len(subpath) >= 3:
                for target in targets:
                    target.polygon(subpath, fill=1)

        for item in drawing['items']:
            points = [to_plate(p, page) for p in flatten(item)]
            if len(points) < 2:
                continue
            pen.line(points, fill=1, width=2)
            if key == 'a-elev':
                pens['lifts'].line(points, fill=1, width=2)
            if subpath and points[0] != subpath[-1]:
                fill_subpath()
                subpath = []
            subpath.extend(points)
        fill_subpath()
    return {name: np.array(c, bool) for name, c in canvases.items()}


def unit_labels(page: pymupdf.Page) -> dict[str, pymupdf.Rect]:
    """Rectángulo (en puntos, ya girado) de la etiqueta de cada unidad del PDF."""
    labels = {}
    for x0, y0, x1, y1, text, *_ in page.get_text('blocks'):
        rect = pymupdf.Rect(x0, y0, x1, y1) * page.rotation_matrix
        match = UNIT_LABEL.search(text)
        if match and rect.intersects(PLATE_CLIP):
            labels[match.group(1)] = rect
    return labels


def segment(masks: dict[str, np.ndarray], boxes: dict[str, tuple[int, int, int, int]]) -> tuple[np.ndarray, dict[str, int]]:
    """Reparte la planta entre exterior, núcleo y unidades. Devuelve la etiqueta de cada píxel."""
    walls = masks['walls']
    markers = np.zeros(walls.shape, np.int32)
    ids = {}
    for offset, (label, (x0, y0, x1, y1)) in enumerate(boxes.items()):
        ids[label] = FIRST_UNIT + offset
        markers[y0:y1, x0:x1] = ids[label]

    # Exterior: lo que conecta con el borde y las bandas delgadas entre curvas de losa. Un ala sin
    # etiqueta también puede quedar aislada por una línea de muro, pero tiene estancias anchas.
    clearance = ndi.distance_transform_edt(~walls)
    free, count = ndi.label(~walls)
    with_unit = set(np.unique(free[markers >= FIRST_UNIT]))
    indices = range(1, count + 1)
    areas = ndi.sum_labels(np.ones(free.shape), free, indices)
    widths = ndi.maximum(clearance, free, indices)
    pockets = [i for i in indices if i not in with_unit and areas[i - 1] >= POCKET_AREA and widths[i - 1] < POCKET_WIDTH]
    markers[np.isin(free, [free[0, 0], *pockets])] = EXTERIOR

    # Núcleo: los recintos con puertas selladas donde cae un ascensor, escalera o recorrido de
    # evacuación. Una abertura sin puerta dibujada puede unir uno de ellos con un ala de residencia,
    # así que se estrecha el recinto para separar sus partes y se le quitan las que son un ala:
    # grandes, o con etiqueta de unidad, y sin ascensor ni escalera.
    sealed = walls | masks['doors']
    rooms, _ = ndi.label(~sealed)
    outside = np.unique(rooms[markers == EXTERIOR])
    enclosures = np.isin(rooms, np.setdiff1d(np.unique(rooms[masks['core'] & ~sealed]), np.append(outside, 0)))

    narrowed = enclosures & ~ndi.binary_dilation(sealed, iterations=CORE_NECK)
    parts, part_count = ndi.label(narrowed)
    # Los ascensores se ensanchan para alcanzar su vestíbulo, que queda aislado de ellos al estrechar.
    lobbies = ndi.binary_dilation(masks['lifts'] & ~sealed, iterations=CORE_NECK + CORE_REACH, mask=~sealed)
    anchored = set(np.unique(parts[masks['core'] | lobbies]))
    labelled = set(np.unique(parts[markers >= FIRST_UNIT]))
    part_ids = range(1, part_count + 1)
    part_areas = ndi.sum_labels(np.ones(parts.shape), parts, part_ids)
    wings = [i for i in part_ids if i in labelled or (i not in anchored and part_areas[i - 1] >= WING_AREA)]
    core = enclosures & ~ndi.binary_dilation(np.isin(parts, wings), iterations=CORE_NECK, mask=enclosures)
    markers[core & (markers == 0)] = CORE

    # Los muros macizos pegados al núcleo son núcleo: así el contorno corre por su cara exterior.
    solids, _ = ndi.label(masks['fills'])
    touching = np.unique(solids[ndi.binary_dilation(core, iterations=6) & masks['fills']])
    markers[np.isin(solids, touching[touching > 0]) & (markers == 0)] = CORE

    # El núcleo ya tiene su extensión exacta: si también inundara, ganaría a las residencias la carrera
    # por cualquier ala conectada con él por una abertura sin puerta dibujada.
    regions = watershed(-clearance, markers, mask=markers != CORE)
    regions[markers == CORE] = CORE
    return regions, ids


def outline(mask: np.ndarray) -> str:
    """Contorno SVG, en píxeles de la imagen, de la mayor región de una máscara."""
    # La apertura quita pelos en los muros; el cierre, las ranuras finas entre dos líneas de un tabique.
    solid = ndi.binary_fill_holes(ndi.binary_closing(ndi.binary_opening(mask, iterations=3), iterations=4))
    regions, count = ndi.label(solid)
    largest = 1 + int(np.argmax(ndi.sum_labels(solid, regions, range(1, count + 1))))
    # Con un margen de un píxel el contorno siempre se cierra.
    contour = max(find_contours(np.pad(regions == largest, 1).astype(float), 0.5), key=len)
    points = approximate_polygon(contour - 1, OUTLINE_TOLERANCE)[:-1]
    return 'M' + 'L'.join(f'{round(x)} {round(y)}' for y, x in points) + 'Z'


def residence_of(label: str, residences: list[dict]) -> dict | None:
    """Residencia comercial de una unidad del PDF: por id o, si se venden unidas, por línea."""
    return next((r for r in residences if r['id'] == label), None) or next((r for r in residences if label[-1] in r['line']), None)


def west_of_wall(shape: tuple[int, int]) -> np.ndarray:
    """Semiplano al oeste de la prolongación del muro WEST_WALL, en píxeles de análisis."""
    (ax, ay), (bx, by) = [((p.x - PLATE_CLIP.x0) * ZOOM, (p.y - PLATE_CLIP.y0) * ZOOM) for p in WEST_WALL]
    ys, xs = np.indices(shape)
    return (bx - ax) * (ys - ay) - (by - ay) * (xs - ax) > 0


def visual_center(mask: np.ndarray) -> tuple[int, int]:
    """Punto (x, y) más alejado de los bordes: donde mejor cabe una etiqueta."""
    y, x = np.unravel_index(np.argmax(ndi.distance_transform_edt(mask)), mask.shape)
    return int(x), int(y)


def plate(doc: pymupdf.Document, source: dict, collection: int, spec: dict) -> None:
    page = doc[PLATES[collection] - 1]
    image_zoom = IMAGE_WIDTH / PLATE_CLIP.width
    pix = page.get_pixmap(matrix=pymupdf.Matrix(image_zoom, image_zoom), clip=PLATE_CLIP, alpha=False)
    gray = Image.frombytes('RGB', (pix.width, pix.height), pix.samples).convert('L')
    alpha = gray.point(lambda v: 255 - v)
    rgba = Image.merge('RGBA', (*[Image.new('L', gray.size, c) for c in TINT], alpha))
    out = ROOT / 'public/plans'
    out.mkdir(parents=True, exist_ok=True)
    rgba.save(out / f'collection-{collection}.webp', quality=82, method=6)

    labels = source['labels']
    scale = lambda rect: tuple(int(v) for v in ((rect.x0 - PLATE_CLIP.x0) * ZOOM, (rect.y0 - PLATE_CLIP.y0) * ZOOM, (rect.x1 - PLATE_CLIP.x0) * ZOOM, (rect.y1 - PLATE_CLIP.y0) * ZOOM))
    regions, ids = segment(source['masks'], {label: scale(rect) for label, rect in labels.items()})

    residences = spec['residences']
    groups: dict[str, list[str]] = {}
    for label in labels:
        residence = residence_of(label, residences)
        if residence is None:
            print(f'  aviso: {label} no tiene residencia en building.json')
            continue
        groups.setdefault(residence['id'], []).append(label)

    height, width = regions.shape
    west_side = west_of_wall(regions.shape)
    zone = lambda variant, mask, x, y: {'variant': variant, 'x': round(x / width, 4), 'y': round(y / height, 4), 'outline': outline(mask)}

    data = {}
    for residence_id, members in groups.items():
        residence = next(r for r in residences if r['id'] == residence_id)
        mask = np.isin(regions, [ids[m] for m in members])
        # La etiqueta principal queda donde la puso el arquitecto; si se unen varias unidades, entre ellas.
        centers = [(labels[m].x0 + labels[m].x1, labels[m].y0 + labels[m].y1) for m in members]
        x = (sum(c[0] for c in centers) / (2 * len(centers)) - PLATE_CLIP.x0) * ZOOM
        y = (sum(c[1] for c in centers) / (2 * len(centers)) - PLATE_CLIP.y0) * ZOOM
        if any(f'{line}-W' in spec['positions'] for line in residence['line']):
            west = mask & west_side
            zones = [zone('main', mask & ~west_side, x, y), zone('west', west, *visual_center(west))]
        else:
            zones = [zone('main', mask, x, y)]
        data[residence_id] = {'zones': zones}

    folder = ROOT / 'data/plans'
    folder.mkdir(parents=True, exist_ok=True)
    (folder / f'collection-{collection}.json').write_text(
        json.dumps({'image': f'plans/collection-{collection}.webp', 'width': width, 'height': height, 'residences': data}, indent=2) + '\n',
        encoding='utf8',
    )
    missing = [r['id'] for r in residences if r['id'] not in data]
    print(f'C{collection}: {pix.width}x{pix.height}', {k: len(v['zones']) for k, v in data.items()}, f'sin contorno: {missing}' if missing else '')


def main() -> None:
    doc = pymupdf.open(sys.argv[1])
    hero(doc)
    building = json.loads((ROOT / 'data/building.json').read_text(encoding='utf8'))
    collections = {c['id']: c for c in building['collections']}

    # Primero se leen vectores y etiquetas: apagar capas también los oculta.
    sources = {}
    for collection, page_no in PLATES.items():
        page = doc[page_no - 1]
        size = (PLATE_WIDTH, round(PLATE_CLIP.height * ZOOM))
        sources[collection] = {'labels': unit_labels(page), 'masks': rasterize(page, size)}

    for config in doc.layer_ui_configs():
        if config['type'] == 'checkbox' and layer_key(config['text']) in HIDDEN_LAYERS:
            doc.set_layer_ui_config(config['number'], action=2)

    for collection, source in sources.items():
        plate(doc, source, collection, collections[f'C{collection}'])


if __name__ == '__main__':
    main()

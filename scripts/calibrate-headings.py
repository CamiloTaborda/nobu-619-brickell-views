#!/usr/bin/env python3
"""
calibrate-headings.py
------------------------------------------------------------------
Calcula hacia dónde mira cada foto (northOffset: rumbo real del yaw 0) y escribe
data/headings.json. Inflight publica los paquetes con heading="0", sin orientar.

1. Rumbos relativos. Un edificio lejano se ve en el mismo rumbo desde cualquier
   punto cercano, así que basta emparejar el horizonte (SIFT) entre dos fotos para
   saber cuánto está girada una respecto a la otra. La misma unidad a otra altura
   no tiene paralaje horizontal: esas parejas, y día con atardecer, son las más
   fiables; entre unidades del mismo piso solo se usan pisos altos, donde domina
   el horizonte lejano.
2. Ajuste global. Con todas las parejas se resuelve por mínimos cuadrados un giro
   por foto, coherente en todo el conjunto, y se informa del error de cada pareja.
3. Ancla absoluta. Un punto de referencia conocido, medido en una sola foto, fija
   el norte de todas. Se comprueba con otros puntos (ANCHORS).

Requisitos:  pip install opencv-python-headless numpy pillow
Uso:         python scripts/calibrate-headings.py [carpeta-caché]
"""
import io
import json
import math
import pathlib
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from itertools import combinations

import cv2
import numpy as np
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
CACHE = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / '.cache/headings'
LEVEL = 1  # resolución de trabajo (~14 px/°): suficiente para décimas de grado
BAND = (-14, 6)  # franja en grados respecto al horizonte (negativo = arriba)
RATIO = 0.75  # prueba de Lowe
AGREE = 0.6  # ° de tolerancia del consenso de una pareja
MIN_INLIERS = 12
LATERAL_MIN_LEVEL = 37  # unidades distintas del mismo piso: solo desde aquí hacia arriba
MAX_ROUNDS = 12
MIN_OUTLIER = 1.5  # ° por debajo de los cuales una pareja nunca se descarta
OUTLIER_SIGMAS = 3.0

# Puntos de referencia: foto, yaw medido sobre la foto (°, 0 = centro) y coordenadas del punto.
# El primero es el ancla; el resto sirve para comprobar el resultado.
ANCHORS: list[dict] = [
    # Cúpula del loanDepot park, al oeste: inconfundible y a 3,3 km, poco sensible al error de posición.
    {'name': 'loanDepot park', 'photo': 'L71-A-day', 'yaw': 111.63, 'lat': 25.7781, 'lng': -80.2197},
    # Torres Continuum de South Pointe, al este, al fondo del canal Government Cut.
    {'name': 'Continuum South Pointe', 'photo': 'L71-A-day', 'yaw': -89.16, 'lat': 25.7690, 'lng': -80.1335},
]

building = json.loads((ROOT / 'data/building.json').read_text(encoding='utf8'))
ORIGIN = building['project']['location']
items = [p for p in json.loads((ROOT / 'data/panoramas.json').read_text(encoding='utf8'))['items'] if p.get('pano')]


def photo_key(p: dict) -> str:
    """Las residencias que comparten foto comparten orientación."""
    return f"{p['time']}:{p['level']}:{(p.get('source') or {}).get('file') or p['id']}"


def tile_url(p: dict, row: int, col: int) -> str:
    url = p['packageBase'] + p['pano']['levels'][LEVEL]['url'].replace('%v', str(row)).replace('%u', str(col))
    return url.replace('+', '%20')


def compose(p: dict) -> np.ndarray:
    target = CACHE / f"{p['id']}.jpg"
    if target.exists():
        return np.asarray(Image.open(target).convert('RGB'))
    level = p['pano']['levels'][LEVEL]
    size = p['pano']['tileSize']
    canvas = Image.new('RGB', (level['width'], level['height']))
    for row in range(-(-level['height'] // size)):
        for col in range(-(-level['width'] // size)):
            with urllib.request.urlopen(tile_url(p, row, col), timeout=60) as response:
                canvas.paste(Image.open(io.BytesIO(response.read())).convert('RGB'), (col * size, row * size))
    CACHE.mkdir(parents=True, exist_ok=True)
    canvas.save(target, quality=90)
    return np.asarray(canvas)


def features(p: dict):
    pano = p['pano']
    image = compose(p)
    ppd = image.shape[1] / pano['hfov']
    top = round((BAND[0] - pano['voffset'] + pano['vfov'] / 2) * ppd)
    bottom = round((BAND[1] - pano['voffset'] + pano['vfov'] / 2) * ppd)
    gray = cv2.createCLAHE(2.0, (8, 8)).apply(cv2.cvtColor(image[top:bottom], cv2.COLOR_RGB2GRAY))
    keypoints, descriptors = cv2.SIFT_create(5000).detectAndCompute(gray, None)
    yaws = np.array([k.pt[0] / ppd - pano['hfov'] / 2 for k in keypoints])
    return yaws, descriptors


def relative(a, b):
    """Giro de B respecto a A (yaw_b - yaw_a para un mismo punto lejano) y apoyos."""
    (ya, da), (yb, db) = a, b
    if da is None or db is None or len(da) < 2 or len(db) < 2:
        return None
    pairs = cv2.BFMatcher().knnMatch(da, db, k=2)
    good = [m for m, n in (p for p in pairs if len(p) == 2) if m.distance < RATIO * n.distance]
    if len(good) < MIN_INLIERS:
        return None
    diff = np.array([yb[m.trainIdx] - ya[m.queryIdx] for m in good])
    votes = [(int((np.abs(diff - d) < AGREE).sum()), d) for d in diff]
    inliers, best = max(votes)
    if inliers < MIN_INLIERS:
        return None
    return float(np.median(diff[np.abs(diff - best) < AGREE])), inliers, len(good)


def wrap(angle: float) -> float:
    return (angle + 180) % 360 - 180


def solve(keys: list[str], edges: list) -> tuple[dict[str, float], dict[str, int]]:
    """
    Giro por foto que mejor explica las parejas: N_a - N_b = yaw_b - yaw_a.
    Un árbol con las parejas más sólidas desenrolla los ángulos; después, mínimos cuadrados con todas.
    Devuelve el giro y el grupo conectado de cada foto.
    """
    parent = {k: k for k in keys}

    def find(k: str) -> str:
        while parent[k] != k:
            parent[k] = parent[parent[k]]
            k = parent[k]
        return k

    adjacency: dict[str, list] = {k: [] for k in keys}
    for ka, kb, delta, weight, _ in sorted(edges, key=lambda e: -e[3]):
        ra, rb = find(ka), find(kb)
        if ra != rb:
            parent[ra] = rb
            adjacency[ka].append((kb, delta))
            adjacency[kb].append((ka, -delta))

    offset: dict[str, float] = {}
    for start in keys:
        if start in offset:
            continue
        offset[start] = 0.0
        stack = [start]
        while stack:
            current = stack.pop()
            for other, delta in adjacency[current]:
                if other not in offset:
                    offset[other] = offset[current] - delta
                    stack.append(other)

    for _ in range(200):  # Gauss-Seidel con media circular alrededor del valor actual
        for k in keys:
            total = weights = 0.0
            for ka, kb, delta, weight, _ in edges:
                if k == ka:
                    total += weight * wrap(offset[kb] + delta - offset[k])
                elif k == kb:
                    total += weight * wrap(offset[ka] - delta - offset[k])
                else:
                    continue
                weights += weight
            if weights:
                offset[k] += total / weights
    groups = {k: find(k) for k in keys}
    ids = {root: i for i, root in enumerate(dict.fromkeys(groups.values()))}
    return offset, {k: ids[r] for k, r in groups.items()}


def bearing(lat: float, lng: float) -> float:
    """Rumbo (°, 0 = norte, horario) desde la torre hasta un punto."""
    phi1, phi2 = math.radians(ORIGIN['lat']), math.radians(lat)
    dl = math.radians(lng - ORIGIN['lng'])
    y = math.sin(dl) * math.cos(phi2)
    x = math.cos(phi1) * math.sin(phi2) - math.sin(phi1) * math.cos(phi2) * math.cos(dl)
    return math.degrees(math.atan2(y, x)) % 360


def main() -> None:
    photos: dict[str, dict] = {}
    for p in items:
        photos.setdefault(photo_key(p), p)
    keys = list(photos)
    print(f'{len(keys)} fotos distintas; componiendo y extrayendo rasgos…')
    with ThreadPoolExecutor(6) as pool:
        feats = dict(zip(keys, pool.map(lambda k: features(photos[k]), keys)))

    def wanted(a: dict, b: dict) -> float:
        """Peso de la pareja según su fiabilidad; 0 si no se compara."""
        if a['position'] == b['position'] and a['time'] == b['time']:
            return 1.0  # misma unidad a otra altura: sin paralaje horizontal
        if a['level'] == b['level'] and a['position'] == b['position']:
            return 0.6  # día y atardecer de la misma toma
        if a['level'] == b['level'] and a['time'] == b['time'] and a['level'] >= LATERAL_MIN_LEVEL:
            return 0.4  # otra unidad del mismo piso alto
        return 0.0

    edges = []
    for ka, kb in combinations(keys, 2):
        weight = wanted(photos[ka], photos[kb])
        if weight == 0:
            continue
        result = relative(feats[ka], feats[kb])
        if result:
            delta, inliers, matches = result
            edges.append((ka, kb, delta, weight * min(1.0, inliers / 60), inliers))
    print(f'{len(edges)} parejas con acuerdo')

    # Las coincidencias falsas (patrones repetidos, luces de noche) se descartan por iteración:
    # se resuelve, se apartan las parejas que contradicen al conjunto y se vuelve a resolver.
    kept = edges
    for round_ in range(1, MAX_ROUNDS + 1):
        offset, group_of = solve(keys, kept)
        errors = np.array([abs(wrap(offset[ka] - offset[kb] - delta)) for ka, kb, delta, _, _ in kept])
        limit = max(MIN_OUTLIER, OUTLIER_SIGMAS * 1.4826 * float(np.median(errors)))
        survivors = [e for e, err in zip(kept, errors) if err <= limit]
        print(f'ronda {round_}: {len(kept)} parejas, mediana {np.median(errors):.2f}°, límite {limit:.2f}°, fuera {len(kept) - len(survivors)}')
        if len(survivors) == len(kept):
            break
        kept = survivors

    errors = sorted(((abs(wrap(offset[ka] - offset[kb] - delta)), ka, kb, inl) for ka, kb, delta, _, inl in kept), reverse=True)
    print('error final de pareja: mediana %.2f°, p90 %.2f°, máximo %.2f°' % (np.median([e[0] for e in errors]), np.percentile([e[0] for e in errors], 90), errors[0][0]))
    groups: dict[int, list[str]] = {}
    for k in keys:
        groups.setdefault(group_of[k], []).append(k)
    print('grupos conectados:', sorted((len(v) for v in groups.values()), reverse=True))
    support = {k: sum(1 for ka, kb, *_ in kept if k in (ka, kb)) for k in keys}
    weak = sorted(photos[k]['id'] for k, n in support.items() if n < 2)
    if weak:
        print('fotos con una sola pareja (menos comprobadas):', weak)

    anchor = ANCHORS[0]
    anchor_key = photo_key(next(p for p in items if p['id'] == anchor['photo']))
    shift = bearing(anchor['lat'], anchor['lng']) - anchor['yaw'] - offset[anchor_key]
    north = {k: (offset[k] + shift) % 360 for k in groups[group_of[anchor_key]]}
    for check in ANCHORS[1:]:
        key = photo_key(next(p for p in items if p['id'] == check['photo']))
        if key in north:
            print('comprobación %s: %.1f° de error' % (check['name'], wrap(check['yaw'] + north[key] - bearing(check['lat'], check['lng']))))
    missing = [photos[k]['id'] for k in keys if k not in north]
    if missing:
        print('sin orientar (fuera del grupo del ancla):', missing)

    data = {p['id']: round(north[photo_key(p)], 2) for p in items if photo_key(p) in north}
    (ROOT / 'data/headings.json').write_text(json.dumps({'$comment': 'Generado por scripts/calibrate-headings.py: rumbo real (°) del yaw 0 de cada foto.', 'northOffset': data}, indent=1) + '\n', encoding='utf8')
    print(f'data/headings.json: {len(data)} vistas orientadas')


if __name__ == '__main__':
    main()

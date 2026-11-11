/**
 * Descarga y decodifica las plantas, de una en una, para que el panel se abra ya listo.
 * Las imágenes se conservan: si no, el navegador podría descartar lo decodificado.
 */
import { planImages } from '../data/catalog';

const kept: HTMLImageElement[] = [];

export async function preloadPlans() {
  for (const path of planImages) {
    const image = new Image();
    image.src = `/${path}`;
    kept.push(image);
    await image.decode().catch(() => {});
  }
}

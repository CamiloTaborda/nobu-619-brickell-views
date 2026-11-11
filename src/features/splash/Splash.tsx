/** Se renderiza en el servidor para pintarse antes que el JavaScript. La retira `dismiss.ts`. */
import { preload } from 'react-dom';
import { hero, HERO_ALIGN_Y, HERO_IMAGE_SIZES } from '../../data/catalog';
import HeroTitle from '../../ui/HeroTitle';
import { SPLASH_ID } from './constants';

const TOWER_PADDING = 28; // unidades del render alrededor de la torre

const pct = (value: number, total: number) => `${(value / total) * 100}%`;

export default function Splash() {
  // El render empieza a descargarse con el HTML, sin esperar al JavaScript de la portada.
  preload(hero.src1920, { as: 'image', fetchPriority: 'high', imageSrcSet: `${hero.src1920} 1920w, ${hero.src3840} 3840w`, imageSizes: HERO_IMAGE_SIZES });

  const { width, height, tower } = hero;
  const coverHeight = `max(100dvh, calc(100vw * ${height / width}))`;

  return (
    <div id={SPLASH_ID} className="fixed inset-0 z-50 overflow-hidden bg-ink" role="status" aria-label="Loading">
      <div aria-hidden="true" className="splash-enter absolute inset-0">
        {/* Misma geometría que la imagen de portada: al fundirse, nada se mueve. */}
        <div className="absolute right-0" style={{ width: `max(100vw, calc(100dvh * ${width / height}))`, height: coverHeight, top: `calc((100dvh - ${coverHeight}) * ${HERO_ALIGN_Y})` }}>
          <svg className="absolute inset-0 size-full" viewBox={`0 0 ${width} ${height}`}>
            {hero.floors.map((floor) => (
              <polygon key={floor.level} points={floor.points.map((p) => p.join(',')).join(' ')} className="fill-champagne/4 stroke-champagne/55 stroke-[0.75] [vector-effect:non-scaling-stroke]" />
            ))}
          </svg>
          {/* Una tapa del color del fondo se retira hacia arriba; su borde inferior es la luz que sube. */}
          <div
            className="splash-rise absolute"
            style={{
              left: pct(tower.x0 - TOWER_PADDING, width),
              top: pct(tower.y0 - TOWER_PADDING, height),
              width: pct(tower.x1 - tower.x0 + 2 * TOWER_PADDING, width),
              height: pct(tower.y1 - tower.y0 + 2 * TOWER_PADDING, height),
            }}
          >
            <div className="absolute inset-0 bg-ink" />
            <div className="absolute inset-x-0 bottom-0 h-px bg-champagne shadow-[0_0_18px_3px_rgb(227_207_168/0.5)]" />
          </div>
        </div>
        <HeroTitle />
      </div>
    </div>
  );
}

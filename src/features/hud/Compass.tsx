/** La marca superior es la dirección de la mirada; la N, el norte real. Se actualiza fuera de React. */
import { animate, motion, useMotionValue, useReducedMotion, type MotionStyle } from 'motion/react';
import { useEffect, useRef } from 'react';
import { useApp } from '../../app/store';
import { resolveView } from '../../data/catalog';
import { norm } from '../../lib/heading';
import { springSheet } from '../../lib/motion';
import { COMPACT_QUERY, useMediaQuery } from '../../lib/useMediaQuery';

const ROSE_SPRING = { type: 'spring', bounce: 0, duration: 0.45 } as const;
const POINTS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
const describe = (heading: number) => `Facing ${POINTS[Math.round(heading / 45) % 8]}`;

export default function Compass() {
  const rose = useRef<SVGGElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const level = useApp((s) => s.level);
  const position = useApp((s) => s.position);
  const time = useApp((s) => s.time);
  const plansOpen = useApp((s) => s.plansOpen);
  const compact = useMediaQuery(COMPACT_QUERY);
  const reduceMotion = useReducedMotion();
  const oriented = level != null && resolveView(level, position, time).pano?.northOffset != null;

  // Con el panel de planos abierto se desliza a su izquierda con el mismo resorte que el panel.
  // Desplazamiento = ancho del panel lateral × (1 − split): con el plano ampliado, los controles ya
  // ocupan solo la mitad de la vista y la brújula sigue el borde del panel sin desplazarse más.
  // En pantallas compactas el panel ocupa todo el ancho: ahí se oculta.
  const open = useMotionValue(0);
  useEffect(() => {
    const target = plansOpen && !compact ? 1 : 0;
    if (reduceMotion) return open.set(target);
    const controls = animate(open, target, springSheet);
    return () => controls.stop();
  }, [plansOpen, compact, reduceMotion, open]);

  const angle = useMotionValue(0);
  const shown = useRef<number | null>(null);
  useEffect(() => {
    const unsubscribeAngle = angle.on('change', (a) => {
      if (rose.current) rose.current.style.transform = `rotate(${-a}deg)`;
    });
    const follow = (heading: number | null) => {
      if (heading == null) return;
      host.current?.setAttribute('aria-label', describe(heading));
      // Por el camino corto: de 350° a 10° se gira 20°, no 340°.
      const target = shown.current == null ? heading : shown.current + norm(heading - shown.current);
      if (shown.current == null || reduceMotion) angle.set(target);
      else animate(angle, target, ROSE_SPRING);
      shown.current = target;
    };
    follow(useApp.getState().heading);
    const unsubscribeStore = useApp.subscribe((s, previous) => {
      if (s.heading !== previous.heading) follow(s.heading);
    });
    return () => {
      unsubscribeAngle();
      unsubscribeStore();
    };
  }, [oriented, angle, reduceMotion]);

  if (!oriented) return null;

  return (
    <motion.div
      ref={host}
      role="img"
      style={{ '--open': open } as MotionStyle}
      className={`material pointer-events-none absolute top-(--safe-top) right-gutter grid size-tap place-items-center rounded-full translate-x-[calc(var(--open,0)*var(--spacing-plans)*(var(--split,0)-1))] transition-opacity duration-300 ease-out ${plansOpen && compact ? 'opacity-0' : ''}`}
    >
      <svg className="size-9" viewBox="-20 -20 40 40" aria-hidden="true">
        <path d="M0 -18.5l2.4 3.6h-4.8z" className="fill-paper stroke-none" />
        {/* En SVG el origen del giro se mide desde la esquina del lienzo: (0,0) es el centro de la rosa. */}
        <g ref={rose} className="origin-top-left">
          <circle r="13" className="fill-none stroke-paper/35 stroke-[1.1]" />
          {[45, 90, 135, 180, 225, 270, 315].map((a) => (
            <line key={a} y1={-13} y2={a % 90 ? -11.4 : -10.2} transform={`rotate(${a})`} className="stroke-paper/60 stroke-1" />
          ))}
          <path d="M0 -13.6l2.2 4.6h-4.4z" className="fill-champagne stroke-none" />
          <text y="-3.4" textAnchor="middle" dominantBaseline="middle" className="fill-champagne text-[7.5px] font-semibold">
            N
          </text>
        </g>
      </svg>
    </motion.div>
  );
}

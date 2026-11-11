/** Recorte de la panorámica en su versión ligera, la misma que la portada precarga al señalar el piso. */
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import type { Panorama } from '../../data/types';
import { getStitched, type StitchResult } from '../../lib/stitch';

const SPAN = 96; // grados de horizonte que muestra el recorte
const OUTPUT_WIDTH = 720; // px del lienzo: nítido a 2x en la ficha

/** Dibuja el centro de la toma; la imagen compuesta llega invertida en vertical. */
function draw(canvas: HTMLCanvasElement, pano: Panorama, image: StitchResult) {
  const { hfov, vfov, voffset, view } = pano.pano!;
  const ppd = image.width / hfov;
  const aspect = canvas.width / canvas.height;
  const width = Math.min(SPAN, view.hmax - view.hmin) * ppd;
  const height = Math.min(width / aspect, (view.vmax - view.vmin) * ppd);
  const cropWidth = height * aspect;

  const left = Math.min(Math.max((view.h + hfov / 2) * ppd - cropWidth / 2, (view.hmin + hfov / 2) * ppd), (view.hmax + hfov / 2) * ppd - cropWidth);
  const top = ((view.vmin + view.vmax) / 2 - voffset + vfov / 2) * ppd - height / 2;

  const context = canvas.getContext('2d')!;
  context.setTransform(1, 0, 0, -1, 0, canvas.height);
  context.drawImage(image.bitmap, left, image.height - top - height, cropWidth, height, 0, 0, canvas.width, canvas.height);
}

function Frame({ pano, aspect }: { pano: Panorama; aspect: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [drawn, setDrawn] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    getStitched(pano, 0, controller.signal)
      .then((image) => {
        if (controller.signal.aborted || !canvas.current) return;
        draw(canvas.current, pano, image);
        setDrawn(true);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [pano]);

  return (
    <motion.canvas
      ref={canvas}
      width={OUTPUT_WIDTH}
      height={Math.round(OUTPUT_WIDTH / aspect)}
      className="absolute inset-0 size-full"
      initial={{ opacity: 0 }}
      animate={{ opacity: drawn ? 1 : 0 }}
      exit={{ opacity: 0, transition: { duration: 0.35 } }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
    />
  );
}

export default function ViewPreview({ pano, aspect, className = '' }: { pano: Panorama | undefined; aspect: number; className?: string }) {
  return (
    <div className={`relative overflow-hidden bg-shade ${className}`} style={{ aspectRatio: aspect }}>
      <AnimatePresence initial={false}>{pano?.pano && <Frame key={pano.id} pano={pano} aspect={aspect} />}</AnimatePresence>
    </div>
  );
}

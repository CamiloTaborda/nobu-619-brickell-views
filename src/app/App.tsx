import { lazy, Suspense, useEffect } from 'react';
import { AnimatePresence, motion, type MotionStyle } from 'motion/react';
import { useApp } from './store';
import Home from '../features/home/Home';
import { split } from '../lib/split';

const loadViewer = () => import('../features/viewer/PanoViewer');
const PanoViewer = lazy(loadViewer);
const Hud = lazy(() => import('../features/hud/Hud'));
const PlansDrawer = lazy(() => import('../features/plans/PlansDrawer'));

export default function App() {
  const mode = useApp((s) => s.mode);

  // Precarga el código del visor para que el primer vuelo no espere la descarga.
  useEffect(() => {
    const id = setTimeout(loadViewer, 800);
    return () => clearTimeout(id);
  }, []);

  return (
    <main className="fixed inset-0">
      <AnimatePresence>
        {mode !== 'tower' && (
          <motion.section key="view" className="fixed inset-0" style={{ '--split': split } as MotionStyle} exit={{ opacity: 0, transition: { delay: 0.5, duration: 0.2 } }}>
            <Suspense fallback={null}>
              <PanoViewer />
              <Hud />
              <PlansDrawer />
            </Suspense>
          </motion.section>
        )}
      </AnimatePresence>
      <Home />
    </main>
  );
}

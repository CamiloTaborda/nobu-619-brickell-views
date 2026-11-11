/** Silueta de una planta: los contornos de sus residencias a trazo fino, nítidos a cualquier tamaño. */
import type { Plan } from '../data/types';

export default function PlanMark({ plan, className = '' }: { plan: Plan; className?: string }) {
  return (
    <svg className={`flex-none ${className}`} viewBox={`0 0 ${plan.width} ${plan.height}`} aria-hidden="true">
      {Object.values(plan.residences).flatMap((r) => r.zones.map((z) => <path key={z.outline} d={z.outline} className="stroke-1 [vector-effect:non-scaling-stroke]" />))}
    </svg>
  );
}

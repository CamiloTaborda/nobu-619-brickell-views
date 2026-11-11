/** Iconos de línea en una retícula de 16 px; heredan el color del texto. */
type IconProps = { className?: string };

const Icon = ({ className = 'size-4', d }: IconProps & { d: string }) => (
  <svg className={className} viewBox="0 0 16 16" aria-hidden="true">
    <path d={d} />
  </svg>
);

export const ArrowRight = ({ className }: IconProps) => <Icon className={className} d="M3 8h9.5M8.5 4l4 4-4 4" />;
export const ChevronDown = ({ className }: IconProps) => <Icon className={className} d="M3.5 6l4.5 4.5L12.5 6" />;
export const ChevronUp = ({ className }: IconProps) => <Icon className={className} d="M3.5 10l4.5-4.5 4.5 4.5" />;
export const ChevronLeft = ({ className }: IconProps) => <Icon className={className} d="M10 3.5L5.5 8l4.5 4.5" />;
export const Expand = ({ className }: IconProps) => <Icon className={className} d="M9.5 2.5h4v4M13.5 2.5L9 7M6.5 13.5h-4v-4M2.5 13.5L7 9" />;
export const Shrink = ({ className }: IconProps) => <Icon className={className} d="M13 7H9V3M9 7l4.5-4.5M3 9h4v4M7 9l-4.5 4.5" />;
export const Close =({ className }: IconProps) => <Icon className={className} d="M4 4l8 8M12 4l-8 8" />;

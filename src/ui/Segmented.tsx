/** La marca de selección se desliza con un resorte y puede cambiar de destino en pleno movimiento. */
import { motion } from 'motion/react';
import { springUi } from '../lib/motion';

interface Props<T extends string> {
  id: string;
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  /** El cursor o el foco llegan a una opción: permite anticipar su contenido. */
  onIntent?: (value: T) => void;
  className?: string;
  stretch?: boolean;
}

export default function Segmented<T extends string>({ id, label, value, options, onChange, onIntent, className = '', stretch = false }: Props<T>) {
  return (
    <div className={`flex gap-0.5 ${className}`} role="radiogroup" aria-label={label}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            role="radio"
            aria-checked={on}
            className={`press relative min-h-9 rounded-full px-3.5 text-ui font-medium tracking-small whitespace-nowrap ${stretch ? 'flex-1' : ''} ${on ? 'text-ink' : 'text-paper-2 hover:text-paper'}`}
            onPointerEnter={() => onIntent?.(o.value)}
            onFocus={() => onIntent?.(o.value)}
            onClick={() => onChange(o.value)}
          >
            {on && <motion.span layoutId={`${id}-thumb`} className="absolute inset-0 rounded-[inherit] bg-paper" transition={springUi} />}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

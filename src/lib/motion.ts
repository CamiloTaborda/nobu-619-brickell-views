/**
 * Curvas de movimiento del proyecto. Todo son resortes críticamente amortiguados
 * (sin rebote): se pueden interrumpir y arrancan desde el valor actual en pantalla.
 */
export const springQuick = { type: 'spring', bounce: 0, duration: 0.3 } as const;
export const springUi = { type: 'spring', bounce: 0, duration: 0.4 } as const;
export const springSheet = { type: 'spring', bounce: 0, duration: 0.5 } as const;
export const springFlight = { type: 'spring', bounce: 0, duration: 1 } as const;

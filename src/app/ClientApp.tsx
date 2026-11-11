'use client';

/** WebGL, hash de la URL y teclado: la experiencia se monta solo en el navegador. */
import dynamic from 'next/dynamic';

const ClientApp = dynamic(() => import('./bootstrap'), { ssr: false });

export default ClientApp;

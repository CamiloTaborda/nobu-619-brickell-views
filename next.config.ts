import type { NextConfig } from 'next';

// El bucket S3 de Inflight no envía cabeceras CORS → WebGL no puede usar sus
// imágenes como texturas desde otro dominio. Se sirven bajo /s3 con un rewrite,
// válido tanto en desarrollo como en producción.
const S3 = 'https://sftp-bucket-inflightll.s3.us-east-1.amazonaws.com';

const nextConfig: NextConfig = {
  devIndicators: false,
  async rewrites() {
    return [{ source: '/s3/:path*', destination: `${S3}/:path*` }];
  },
};

export default nextConfig;

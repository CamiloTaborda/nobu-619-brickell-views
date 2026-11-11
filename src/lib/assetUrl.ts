/**
 * Reescribe URLs del bucket S3 de Inflight a /s3 (rewrite de next.config.ts)
 * para poder usarlas como texturas WebGL.
 * Los "+" pasan a "%20": si un proxy los codifica como "%2B", S3 responde 403.
 */
const S3 = 'https://sftp-bucket-inflightll.s3.us-east-1.amazonaws.com';

export function assetUrl(url: string): string {
  return url.startsWith(S3) ? '/s3' + url.slice(S3.length).replace(/\+/g, '%20') : url;
}

/** URL de un tile krpano: patrón "%v" fila, "%u" columna. */
export function tileUrl(packageBase: string, pattern: string, row: number, col: number): string {
  return assetUrl(packageBase + pattern.replace('%v', String(row)).replace('%u', String(col)));
}

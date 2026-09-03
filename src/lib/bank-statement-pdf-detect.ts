/** Tiny PDF signature helpers — no pdfjs dependency (avoids circular imports). */

export function isPdfMagic(bytes: Uint8Array): boolean {
  if (bytes.length < 5) return false;
  return (
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  );
}

export function pdfLooksEncrypted(bytes: Uint8Array): boolean {
  const sample = new TextDecoder("latin1").decode(bytes.slice(0, Math.min(bytes.length, 512_000)));
  return /\/Encrypt\b/.test(sample);
}

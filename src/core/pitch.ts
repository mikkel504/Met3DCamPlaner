/**
 * Automatische Pitch-Berechnung: Kamera blickt von ihrer Höhe auf den
 * Fokuspunkt herab (bzw. hinauf), abhängig vom Höhenunterschied.
 *
 * Konvention in Met.3D verifiziert (Test-Import 2026-11-20): pitch = 90 ist
 * horizontal, Werte > 90 blicken nach OBEN, Werte < 90 nach UNTEN.
 * Liegt die Kamera über dem Fokuspunkt, muss sie nach unten schauen:
 *   pitch = 90 − atan2(cameraZ − focusZ, horizontale Distanz)
 */
export function computeAutoPitch(
  cameraLat: number,
  cameraLon: number,
  cameraZ: number,
  focusLat: number,
  focusLon: number,
  focusZ: number,
): number {
  // Horizontale Distanz in Kartekoordinaten (Grad), konsistent zur
  // Kreisberechnung in core/paths/circle.ts.
  const horizontal = Math.hypot(cameraLat - focusLat, cameraLon - focusLon);
  const tiltRad = Math.atan2(cameraZ - focusZ, horizontal);
  return 90 - (tiltRad * 180) / Math.PI;
}

/**
 * Automatische Pitch-Berechnung: Kamera blickt von ihrer Höhe auf den
 * Fokuspunkt herab (bzw. hinauf), abhängig vom Höhenunterschied.
 *
 * ANNAHME (wie in yaw.ts / Referenzdatei): pitch = 90 bedeutet horizontal.
 * Liegt die Kamera über dem Fokuspunkt, wird die Kamera nach unten geneigt:
 *   pitch = 90 + atan2(cameraZ − focusZ, horizontale Distanz)
 * Der Wert muss wie die yaw-Formel in Met.3D verifiziert werden (siehe README).
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
  return 90 + (tiltRad * 180) / Math.PI;
}

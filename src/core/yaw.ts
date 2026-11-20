/**
 * Berechnet den Blickwinkel (yaw) einer Kamera, die auf einen Fokuspunkt zeigt.
 *
 * ANNAHME (aus reference/Base_Sequence.xml abgeleitet, Abschnitt 4):
 *   yaw = (360 − Kompasspeilung Kamera→Fokuspunkt) mod 360
 * mit Kompasspeilung: Norden = 0°, im Uhrzeigersinn (Ost = 90°).
 * yaw zählt also entgegen dem Uhrzeigersinn.
 *
 * Diese Annahme muss mit Met.3D verifiziert werden (siehe README).
 */
export function computeYaw(
  cameraLat: number,
  cameraLon: number,
  focusLat: number,
  focusLon: number,
): number {
  const dNorth = focusLat - cameraLat;
  const dEast = focusLon - cameraLon;
  const bearingDeg = (Math.atan2(dEast, dNorth) * 180) / Math.PI;
  const bearing = (bearingDeg + 360) % 360;
  return (360 - bearing) % 360;
}

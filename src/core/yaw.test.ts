import { describe, expect, it } from 'vitest';
import { computeYaw } from './yaw';

describe('computeYaw', () => {
  // ANNAHME aus reference/Base_Sequence.xml (Abschnitt 4):
  // Vier Referenz-Keys auf einem Quadrat um (0, 0), Blick zur Mitte.
  it('reproduziert die vier Referenzwerte', () => {
    expect(computeYaw(50, 50, 0, 0)).toBe(135); // NO
    expect(computeYaw(-50, 50, 0, 0)).toBe(45); // SO
    expect(computeYaw(-50, -50, 0, 0)).toBe(315); // SW
    expect(computeYaw(50, -50, 0, 0)).toBe(225); // NW
  });

  it('liefert Ergebnisse im Bereich 0..360', () => {
    for (const [lat, lon] of [[90, 0], [-90, 0], [0, 180], [0, -180]] as const) {
      const yaw = computeYaw(lat, lon, 0, 0);
      expect(yaw).toBeGreaterThanOrEqual(0);
      expect(yaw).toBeLessThan(360);
    }
  });

  it('Nordlich der Kamera liegt der Fokus im Süden -> yaw 180', () => {
    expect(computeYaw(10, 0, 0, 0)).toBeCloseTo(180);
  });

  it('Östlich der Kamera liegt der Fokus im Westen -> yaw 90', () => {
    expect(computeYaw(0, 10, 0, 0)).toBeCloseTo(90);
  });
});

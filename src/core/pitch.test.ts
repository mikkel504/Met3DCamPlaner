import { describe, expect, it } from 'vitest';
import { computeAutoPitch } from './pitch';

describe('computeAutoPitch', () => {
  it('ergibt 90° bei gleicher Höhe (horizontal)', () => {
    expect(computeAutoPitch(0, 50, 25, 0, 0, 25)).toBeCloseTo(90);
  });

  it('neigt sich nach unten, wenn die Kamera über dem Fokus liegt', () => {
    // Met.3D-Konvention (Import-Test 2026-11-20): < 90 blickt nach unten.
    // 50° horizontaler Abstand, 25 Einheiten höher: 90 − atan(25/50) ≈ 63.43.
    const pitch = computeAutoPitch(0, 50, 25, 0, 0, 0);
    expect(pitch).toBeCloseTo(90 - (Math.atan2(25, 50) * 180) / Math.PI);
    expect(pitch).toBeLessThan(90);
    expect(pitch).toBeGreaterThan(0);
  });

  it('neigt sich nach oben, wenn die Kamera unter dem Fokus liegt', () => {
    const pitch = computeAutoPitch(0, 50, 0, 0, 0, 25);
    expect(pitch).toBeGreaterThan(90);
    expect(pitch).toBeLessThan(180);
  });

  it('blickt senkrecht nach unten, direkt über dem Fokus', () => {
    const pitch = computeAutoPitch(0, 0, 25, 0, 0, 0);
    expect(pitch).toBeCloseTo(0);
  });

  it('liefert für identische Positionen ohne Höhenunterschied 90°', () => {
    expect(computeAutoPitch(0, 0, 25, 0, 0, 25)).toBeCloseTo(90);
  });
});

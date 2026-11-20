import { describe, expect, it } from 'vitest';
import { COMMON_DEFAULTS } from '../fields';
import { CIRCLE_FULL_SWEEP, circlePath, type CircleParams } from './circle';
import type { CommonParams } from '../types';

function circleParams(overrides: Partial<CircleParams> = {}): CircleParams {
  // Doppel-Assertion nötig, weil CircleParams den Index-Signatur-Typ
  // ParamRecord erweitert und object spread sonst `| undefined` erzeugt.
  return { ...circlePath.defaults, ...overrides } as CircleParams;
}

/** Index-Zugriff mit kurzer Assert-Message (noUncheckedIndexedAccess). */
function at<T>(items: T[], index: number): T {
  const item = items[index];
  if (item === undefined) {
    throw new Error(`Erwartetes Element an Index ${index} fehlt.`);
  }
  return item;
}

function common(overrides: Partial<CommonParams> = {}): CommonParams {
  return { ...COMMON_DEFAULTS, ...overrides };
}

function distanceToFocus(key: { lat: number; lon: number }, focusLat: number, focusLon: number): number {
  return Math.hypot(key.lat - focusLat, key.lon - focusLon);
}

describe('circlePath.generate – Vollkreis', () => {
  const params = circleParams({ radius: 40, sweepAngle: CIRCLE_FULL_SWEEP });
  const keys = circlePath.generate(common({ keyframeCount: 8 }), params);

  it('erzeugt genau N Keys', () => {
    expect(keys).toHaveLength(8);
  });

  it('hat keinen doppelten Start-/Endpunkt', () => {
    const first = at(keys, 0);
    const last = at(keys, keys.length - 1);
    expect(first.lat).not.toBeCloseTo(last.lat);
    expect(first.lon).not.toBeCloseTo(last.lon);
    // Abstand erster→letzter Key entspricht einem Schritt (Nachbarn auf dem Kreis).
    const stepDeg = CIRCLE_FULL_SWEEP / 8;
    const stepChord = 2 * params.radius * Math.sin((stepDeg / 2) * (Math.PI / 180));
    expect(Math.hypot(first.lat - last.lat, first.lon - last.lon)).toBeCloseTo(stepChord, 6);
  });

  it('alle Keys haben gleichen Abstand zum Fokuspunkt', () => {
    const c = common({ keyframeCount: 8, focusLat: 12.5, focusLon: -33 });
    const generated = circlePath.generate(c, params);
    for (const key of generated) {
      expect(distanceToFocus(key, c.focusLat, c.focusLon)).toBeCloseTo(params.radius, 6);
    }
  });

  it('Keys liegen gleichverteilt (Schrittweite 360/N)', () => {
    const c = common({ keyframeCount: 6 });
    const generated = circlePath.generate(c, circleParams({ radius: 30 }));
    const chords: number[] = [];
    for (let i = 0; i < generated.length; i++) {
      const a = at(generated, i);
      const b = at(generated, (i + 1) % generated.length);
      chords.push(Math.hypot(a.lat - b.lat, a.lon - b.lon));
    }
    const [firstChord, ...restChords] = chords;
    expect(firstChord).toBeDefined();
    for (const chord of restChords) {
      expect(chord).toBeCloseTo(firstChord ?? 0, 6);
    }
  });

  it('yaw zeigt bei jedem Key zum Fokuspunkt (Referenz-Geometrie)', () => {
    // Radius 50/cos(45°) und Start 45° -> Ecken des Referenzquadrats.
    const r = 50 / Math.cos((45 * Math.PI) / 180);
    const generated = circlePath.generate(
      common({ keyframeCount: 4, pitch: 90 }),
      circleParams({ radius: r, startAngle: 45, sweepAngle: CIRCLE_FULL_SWEEP, direction: -1 }),
    );
    const yaws = generated.map((k) => Math.round(k.yaw));
    expect(yaws).toEqual([135, 45, 315, 225]);
  });
});

describe('circlePath.generate – Teilkreis', () => {
  it('Teilkreis enthält Start- und Endpunkt (N−1 Intervalle)', () => {
    const params = circleParams({ radius: 20, startAngle: 0, sweepAngle: 180, direction: 1 });
    const keys = circlePath.generate(common({ keyframeCount: 5 }), params);
    expect(keys).toHaveLength(5);
    // Formel aus AGENTS.md: lat += r·sin θ, lon += r·cos θ  →  Start 0° = Osten.
    expect(at(keys, 0).lat).toBeCloseTo(0);
    expect(at(keys, 0).lon).toBeCloseTo(20);
    // Ende bei 180° = Westen.
    const last = at(keys, keys.length - 1);
    expect(last.lat).toBeCloseTo(0, 6);
    expect(last.lon).toBeCloseTo(-20);
  });

  it('Richtung -1 spiegelt die Bahn an der Ost-West-Achse', () => {
    const c = common({ keyframeCount: 5 });
    const ccw = circlePath.generate(c, circleParams({ radius: 20, sweepAngle: 180, direction: 1 }));
    const cw = circlePath.generate(c, circleParams({ radius: 20, sweepAngle: 180, direction: -1 }));
    // Startwinkel 0° (Ost): gespiegelt wird die Nord-Süd-Ablenkung.
    expect(at(cw, 1).lat).toBeCloseTo(-at(ccw, 1).lat);
    expect(at(cw, 1).lon).toBeCloseTo(at(ccw, 1).lon);
  });
});

describe('circlePath.generate – Grad der Kartenebene', () => {
  it('trägt den Radius ohne cos(lat)-Skalierung in lat/lon ein', () => {
    // Bewusst keine Längengrad-Korrektur: die Referenzdatei behandelt lat/lon
    // wie rechtwinklige Kartekoordinaten, und die Vorschau nutzt dieselbe Ebene.
    const keys = circlePath.generate(
      common({ focusLat: 60 }),
      circleParams({ radius: 10, startAngle: 0, sweepAngle: CIRCLE_FULL_SWEEP }),
    );
    // startAngle 0° = östliche Richtung: Verschiebung um genau radius Grad Längengrad.
    expect(at(keys, 0).lon).toBeCloseTo(10);
    expect(at(keys, 0).lat).toBeCloseTo(60); // keine Nord-Süd-Verschiebung
  });
});

describe('circlePath.generate – autoPitch', () => {
  it('nutzt manuellen pitch, wenn autoPitch deaktiviert ist', () => {
    const keys = circlePath.generate(common({ pitch: 45 }), circleParams({ radius: 20 }));
    for (const key of keys) {
      expect(key.pitch).toBe(45);
    }
  });

  it('berechnet pitch aus Höhenunterschied, wenn autoPitch aktiv ist', () => {
    // Kamera 25 Einheiten über dem Fokuspunkt (focusZ 0), Radius 20.
    const keys = circlePath.generate(
      common({ autoPitch: true, cameraZ: 25, focusZ: 0, pitch: 45 }),
      circleParams({ radius: 20, sweepAngle: CIRCLE_FULL_SWEEP }),
    );
    const expected = 90 - (Math.atan2(25, 20) * 180) / Math.PI;
    for (const key of keys) {
      // Horizontaler Abstand ist auf dem Kreis überall = radius.
      expect(key.pitch).toBeCloseTo(expected, 6);
    }
  });

  it('ignoriert den manuellen pitch-Wert bei autoPitch', () => {
    const keys = circlePath.generate(common({ autoPitch: true, pitch: NaN }), circleParams({ radius: 20 }));
    for (const key of keys) {
      expect(Number.isFinite(key.pitch)).toBe(true);
    }
  });
});

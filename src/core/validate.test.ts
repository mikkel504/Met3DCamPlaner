import { describe, expect, it } from 'vitest';
import { COMMON_DEFAULTS } from './fields';
import { circlePath, type CircleParams } from './paths/circle';
import { validateParams } from './validate';
import type { CommonParams, Issue, ParamRecord } from './types';

function common(overrides: Partial<CommonParams> = {}): CommonParams {
  return { ...COMMON_DEFAULTS, ...overrides };
}

function params(overrides: Partial<CircleParams> = {}): ParamRecord {
  // Merged-Partial erzeugt `| undefined` auf bekannten Schlüsseln; für die
  // Validierungs-Tests ist das unproblematisch, deshalb die Assertion.
  const merged = { ...circlePath.defaults, ...overrides } as CircleParams;
  // Kreis-Annahme der Tests beibehalten: zweiter Radius folgt dem ersten.
  if (overrides.radiusLon === undefined) {
    merged.radiusLon = merged.radius;
  }
  return merged as ParamRecord;
}

/** Index-Zugriff mit kurzer Assert-Message (noUncheckedIndexedAccess). */
function at<T>(items: T[], index: number): T {
  const item = items[index];
  if (item === undefined) {
    throw new Error(`Erwartetes Element an Index ${index} fehlt.`);
  }
  return item;
}

function errors(issues: Issue[]): Issue[] {
  return issues.filter((i) => i.severity === 'error');
}

function expectErrorFor(issues: Issue[], field: string): void {
  const found = issues.some((i) => i.severity === 'error' && i.field === field);
  expect(found, `erwartete Fehlermeldung für Feld "${field}", erhalten: ${JSON.stringify(issues)}`).toBe(true);
}

describe('validateParams', () => {
  it('gültige Default-Eingaben ergeben keine Issues', () => {
    const issues = validateParams(common(), circlePath, params());
    expect(issues).toEqual([]);
  });

  it('Breitengrad außerhalb −90…90', () => {
    const issues = validateParams(common({ focusLat: 95 }), circlePath, params());
    expectErrorFor(issues, 'common.focusLat');
  });

  it('Längengrad außerhalb −180…180', () => {
    const issues = validateParams(common({ focusLon: -200 }), circlePath, params());
    expectErrorFor(issues, 'common.focusLon');
  });

  it('leeres Zahlenfeld (Parse-Ergebnis NaN) wird als Fehler gemeldet', () => {
    const issues = validateParams(common({ focusLat: Number.parseFloat('') }), circlePath, params());
    expectErrorFor(issues, 'common.focusLat');
  });

  it('NaN in Kamerafeld wird als Fehler gemeldet', () => {
    const issues = validateParams(common({ cameraZ: Number.NaN }), circlePath, params());
    expectErrorFor(issues, 'common.cameraZ');
  });

  it('pitch-Fehler nur bei manueller Eingabe; bei autoPitch wird pitch ignoriert', () => {
    const manual = validateParams(common({ pitch: Number.NaN }), circlePath, params());
    expectErrorFor(manual, 'common.pitch');
    const auto = validateParams(
      common({ pitch: Number.NaN, autoPitch: true }),
      circlePath,
      params(),
    );
    expect(auto).toEqual([]);
  });

  it('Radius <= 0 ist ein Fehler', () => {
    const issues = validateParams(common(), circlePath, params({ radius: 0 }));
    expectErrorFor(issues, 'path.radius');
    const neg = validateParams(common(), circlePath, params({ radius: -10 }));
    expectErrorFor(neg, 'path.radius');
  });

  it('zweiter Radius (Ost–West) <= 0 ist ein Fehler', () => {
    const issues = validateParams(common(), circlePath, params({ radiusLon: 0 }));
    expectErrorFor(issues, 'path.radiusLon');
    const nan = validateParams(common(), circlePath, params({ radiusLon: Number.NaN }));
    expectErrorFor(nan, 'path.radiusLon');
  });

  it('Umlaufwinkel außerhalb 0…360 ist ein Fehler', () => {
    const zero = validateParams(common(), circlePath, params({ sweepAngle: 0 }));
    expectErrorFor(zero, 'path.sweepAngle');
    const big = validateParams(common(), circlePath, params({ sweepAngle: 450 }));
    expectErrorFor(big, 'path.sweepAngle');
  });

  it('nicht-ganzzahlige Keyframe-Anzahl wird abgelehnt', () => {
    const issues = validateParams(common({ keyframeCount: 7.5 }), circlePath, params());
    expectErrorFor(issues, 'common.keyframeCount');
  });

  it('Keyframe-Anzahl außerhalb 2…360 wird abgelehnt', () => {
    expectErrorFor(validateParams(common({ keyframeCount: 1 }), circlePath, params()), 'common.keyframeCount');
    expectErrorFor(validateParams(common({ keyframeCount: 361 }), circlePath, params()), 'common.keyframeCount');
  });

  it('Vollkreis verlangt mindestens 3 Keyframes', () => {
    const issues = validateParams(
      common({ keyframeCount: 2 }),
      circlePath,
      params({ sweepAngle: 360 }),
    );
    expectErrorFor(issues, 'common.keyframeCount');
  });

  it('Teilkreis erlaubt 2 Keyframes', () => {
    const issues = validateParams(
      common({ keyframeCount: 2 }),
      circlePath,
      params({ sweepAngle: 180 }),
    );
    expect(errors(issues)).toEqual([]);
  });

  it('Kamerapositionen außerhalb des erlaubten Bereichs ergeben eine Warnung', () => {
    const issues = validateParams(
      common({ focusLat: 80, keyframeCount: 8 }),
      circlePath,
      params({ radius: 30 }),
    );
    const warnings = issues.filter((i) => i.severity === 'warning');
    expect(warnings.length).toBeGreaterThan(0);
    expect(at(warnings, 0).message).toContain('außerhalb');
  });

  it('ungültige Umlaufrichtung wird abgelehnt', () => {
    const issues = validateParams(common(), circlePath, params({ direction: 0 }));
    expectErrorFor(issues, 'path.direction');
  });
});

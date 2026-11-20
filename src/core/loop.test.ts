import { describe, expect, it } from 'vitest';
import { applyLoop } from './loop';
import { COMMON_DEFAULTS } from './fields';
import { CIRCLE_FULL_SWEEP, circlePath, type CircleParams } from './paths/circle';
import type { CommonParams, SequenceKey } from './types';

function common(overrides: Partial<CommonParams> = {}): CommonParams {
  return { ...COMMON_DEFAULTS, ...overrides };
}

function at<T>(items: T[], index: number): T {
  const item = items[index];
  if (item === undefined) {
    throw new Error(`Erwartetes Element an Index ${index} fehlt.`);
  }
  return item;
}

describe('applyLoop', () => {
  const keys: SequenceKey[] = [
    { advanceTimestep: 0, isOrthographic: 0, label: 'a', lat: 1, lon: 2, pitch: 90, roll: 0, transition: 1, yaw: 45, z: 25 },
    { advanceTimestep: 0, isOrthographic: 0, label: '', lat: 3, lon: 4, pitch: 90, roll: 0, transition: 1, yaw: 90, z: 25 },
  ];

  it('hängt eine exakte Kopie des ersten Keyframes an', () => {
    const looped = applyLoop(keys, true);
    expect(looped).toHaveLength(3);
    expect(at(looped, 2)).toEqual(at(keys, 0));
  });

  it('verändert die Eingabe nicht (seitfrei)', () => {
    applyLoop(keys, true);
    expect(keys).toHaveLength(2);
  });

  it('liefert bei loop=false die Keys unverändert', () => {
    expect(applyLoop(keys, false)).toBe(keys);
  });

  it('hängt nichts an, wenn keine Keys existieren', () => {
    expect(applyLoop([], true)).toEqual([]);
  });

  it('Vollkreis + Loop: N+1 Keys, letzter liegt exakt auf dem ersten', () => {
    const params = { ...circlePath.defaults, sweepAngle: CIRCLE_FULL_SWEEP } as CircleParams;
    const generated = circlePath.generate(common({ keyframeCount: 6 }), params);
    const looped = applyLoop(generated, true);
    expect(looped).toHaveLength(7);
    const first = at(looped, 0);
    const last = at(looped, looped.length - 1);
    expect(last).toEqual(first);
  });
});

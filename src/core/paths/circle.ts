import {
  MAX_SWEEP_ANGLE,
  MIN_KEYFRAMES,
  MIN_KEYFRAMES_FULL_CIRCLE,
} from '../constants';
import type { Issue } from '../types';
import type { CommonParams, ParamRecord, PathType } from '../types';
import { computeAutoPitch } from '../pitch';
import { computeYaw } from '../yaw';

/**
 * Ein Kreis ist technisch alles zwischen Viertel- und Vollkreis
 * (AGENTS.md Abschnitt 5, Erweiterbarkeit): startAngle + sweepAngle
 * machen daraus Voll-, Halb- oder Viertelkreis.
 */
export interface CircleParams extends ParamRecord {
  /** Radius in Grad (Kartenebene, wie in der Referenzdatei) */
  radius: number;
  startAngle: number;
  sweepAngle: number;
  /** +1 = im Uhrzeigersinn, -1 = gegen den Uhrzeigersinn */
  direction: number;
}

export const CIRCLE_FULL_SWEEP = 360;

export function isFullCircle(params: CircleParams): boolean {
  return params.sweepAngle === CIRCLE_FULL_SWEEP;
}

/** Anzahl gültiger Keys für einen Kreis (Vollkreis: 3, Teilkreis: 2). */
export function minKeyframesFor(params: CircleParams): number {
  return isFullCircle(params) ? MIN_KEYFRAMES_FULL_CIRCLE : MIN_KEYFRAMES;
}

/** Pfadspezifische Prüfung; Feldgrenzen aus paramSchema prüft validate.ts generisch. */
export function validateCircle(params: CircleParams): Issue[] {
  const issues: Issue[] = [];
  if (params.direction !== 1 && params.direction !== -1) {
    issues.push({ field: 'path.direction', severity: 'error', message: 'Umlaufrichtung ist ungültig.' });
  }
  return issues;
}

export const circlePath: PathType<CircleParams> = {
  id: 'circle',
  label: '360°-Kreis',
  defaults: {
    radius: 50,
    startAngle: 0,
    sweepAngle: CIRCLE_FULL_SWEEP,
    direction: 1,
  },
  paramSchema: [
    {
      key: 'radius',
      label: 'Radius',
      kind: 'number',
      unit: '°',
      exclusiveMin: 0,
      step: 1,
      help: 'Abstand der Kamera zum Fokuspunkt, in Grad der Kartenebene (wie in der Referenzdatei).',
    },
    {
      key: 'startAngle',
      label: 'Startwinkel',
      kind: 'number',
      unit: '°',
      step: 15,
      help: 'Wo beginnt die Fahrt? Winkel um den Fokuspunkt: 0° = Osten, 90° = Norden (wachsend gegen den Uhrzeigersinn).',
    },
    {
      key: 'sweepAngle',
      label: 'Umlaufwinkel',
      kind: 'number',
      unit: '°',
      exclusiveMin: 0,
      max: MAX_SWEEP_ANGLE,
      step: 45,
      help: '360° = voller Kreis, 180° = Halbkreis, 90° = Viertelkreis.',
    },
    {
      key: 'direction',
      label: 'Umlaufrichtung',
      kind: 'select',
      options: [
        { value: -1, label: 'im Uhrzeigersinn' },
        { value: 1, label: 'gegen den Uhrzeigersinn' },
      ],
      help: 'Blick von oben auf die Karte.',
    },
  ],

  generate(common: CommonParams, params: CircleParams) {
    const n = common.keyframeCount;
    // Vollkreis: N Keys mit Schrittweite sweep/N (kein doppelter Endpunkt).
    // Teilkreis: N−1 Intervalle, damit Start- UND Endpunkt getroffen werden.
    const stepDivisor = isFullCircle(params) ? n : n - 1;
    const keys = [];
    for (let i = 0; i < n; i++) {
      const thetaDeg = params.startAngle + params.direction * i * (params.sweepAngle / stepDivisor);
      const theta = (thetaDeg * Math.PI) / 180;

      // Karte: lat = y-Achse (Nord), lon = x-Achse (Ost). Der Radius wird wie in
      // der Referenzdatei direkt in Grad der Kartenebene eingetragen.
      const lat = common.focusLat + params.radius * Math.sin(theta);
      const lon = common.focusLon + params.radius * Math.cos(theta);

      keys.push({
        advanceTimestep: common.advanceTimestep,
        isOrthographic: 0 as const,
        label: '',
        lat,
        lon,
        // autoPitch: Blick hebt/senkt sich je nach Höhe der Kamera über dem
        // Fokuspunkt (sonst manueller pitch aus dem Formular).
        pitch: common.autoPitch
          ? computeAutoPitch(lat, lon, common.cameraZ, common.focusLat, common.focusLon, common.focusZ)
          : common.pitch,
        roll: common.roll,
        transition: common.transition,
        yaw: computeYaw(lat, lon, common.focusLat, common.focusLon),
        z: common.cameraZ,
      });
    }
    return keys;
  },

  isClosed: (_common, params) => isFullCircle(params),
  validate: validateCircle,
  minKeyframes: minKeyframesFor,
};

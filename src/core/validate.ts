import {
  MAX_LAT,
  MAX_LON,
  MIN_KEYFRAMES,
  MIN_KEYFRAMES_FULL_CIRCLE,
  MIN_LAT,
  MIN_LON,
} from './constants';
import { COMMON_FIELDS } from './fields';
import type {
  CommonParams,
  Issue,
  ParamField,
  ParamRecord,
  PathType,
} from './types';

/**
 * Validierung aller Eingaben (AGENTS.md Abschnitt 6.5).
 * Reine Funktion: gibt Issues zurück, UI rendert sie am jeweiligen Feld.
 * Feldnamen: "common.<key>" bzw. "path.<key>".
 */
export function validateParams(
  common: CommonParams,
  path: PathType,
  pathParams: ParamRecord,
): Issue[] {
  const issues: Issue[] = [];
  issues.push(...validateCommon(common));
  issues.push(...validateSchema(path.paramSchema, pathParams));
  if (path.validate) {
    issues.push(...path.validate(pathParams));
  }
  issues.push(...validateKeyframeCount(common, path, pathParams));
  issues.push(...validateGeneratedPositions(common, path, pathParams));
  return issues;
}

function validateCommon(common: CommonParams): Issue[] {
  const issues: Issue[] = [];
  for (const field of COMMON_FIELDS) {
    const value = common[field.key];
    const fieldId = `common.${String(field.key)}`;
    // Bei automatischer Pitch-Berechnung ist die manuelle Eingabe wirkungslos
    // und wird deshalb nicht geprüft.
    if (field.key === 'pitch' && common.autoPitch) {
      continue;
    }
    if (field.kind === 'number') {
      const num = Number(value);
      if (typeof value === 'string' && value.trim() === '') {
        issues.push({ field: fieldId, severity: 'error', message: `${field.label} darf nicht leer sein.` });
        continue;
      }
      if (!Number.isFinite(num)) {
        issues.push({ field: fieldId, severity: 'error', message: `${field.label} muss eine Zahl sein.` });
        continue;
      }
      issues.push(...rangeIssue(fieldId, field.label, num, field.min, field.max, field.unit));
    }
  }
  return issues;
}

function validateSchema(schema: ParamField[], values: ParamRecord): Issue[] {
  const issues: Issue[] = [];
  for (const field of schema) {
    const fieldId = `path.${field.key}`;
    const value = values[field.key];
    if (field.kind === 'number') {
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        issues.push({ field: fieldId, severity: 'error', message: `${field.label} muss eine Zahl sein.` });
        continue;
      }
      if (field.exclusiveMin !== undefined && value <= field.exclusiveMin) {
        issues.push({
          field: fieldId,
          severity: 'error',
          message: `${field.label} muss größer als ${field.exclusiveMin}${field.unit ?? ''} sein.`,
        });
        continue;
      }
      issues.push(...rangeIssue(fieldId, field.label, value, field.min, field.max, field.unit));
    }
  }
  return issues;
}

function rangeIssue(
  fieldId: string,
  label: string,
  value: number,
  min: number | undefined,
  max: number | undefined,
  unit: string | undefined,
): Issue[] {
  if (min !== undefined && max !== undefined && (value < min || value > max)) {
    return [{
      field: fieldId,
      severity: 'error',
      message: `${label} muss zwischen ${min}${unit ?? ''} und ${max}${unit ?? ''} liegen.`,
    }];
  }
  if (min !== undefined && value < min) {
    return [{ field: fieldId, severity: 'error', message: `${label} muss mindestens ${min}${unit ?? ''} sein.` }];
  }
  if (max !== undefined && value > max) {
    return [{ field: fieldId, severity: 'error', message: `${label} darf höchstens ${max}${unit ?? ''} sein.` }];
  }
  return [];
}

function validateKeyframeCount(
  common: CommonParams,
  path: PathType,
  pathParams: ParamRecord,
): Issue[] {
  const fieldId = 'common.keyframeCount';
  const n = common.keyframeCount;
  if (!Number.isInteger(n)) {
    return [{ field: fieldId, severity: 'error', message: 'Anzahl Keyframes muss ganzzahlig sein.' }];
  }
  if (n < MIN_KEYFRAMES || n > 360) {
    return [{ field: fieldId, severity: 'error', message: `Anzahl Keyframes muss zwischen ${MIN_KEYFRAMES} und 360 liegen.` }];
  }
  const min = path.minKeyframes ? path.minKeyframes(pathParams) : MIN_KEYFRAMES;
  if (n < min) {
    const suffix = min === MIN_KEYFRAMES_FULL_CIRCLE ? ' (Vollkreis)' : '';
    return [{ field: fieldId, severity: 'error', message: `Für diese Fahrt werden mindestens ${min} Keyframes benötigt${suffix}.` }];
  }
  return [];
}

/**
 * Hinweis (kein Fehler), falls berechnete Kamerapositionen außerhalb des
 * gültigen lat/lon-Bereichs liegen (AGENTS.md Abschnitt 6.5).
 */
function validateGeneratedPositions(
  common: CommonParams,
  path: PathType,
  pathParams: ParamRecord,
): Issue[] {
  let keys;
  try {
    keys = path.generate(common, pathParams);
  } catch {
    return [];
  }
  const outside = keys.some(
    (k) => k.lat < MIN_LAT || k.lat > MAX_LAT || k.lon < MIN_LON || k.lon > MAX_LON,
  );
  if (!outside) {
    return [];
  }
  return [{
    severity: 'warning',
    field: 'path.radius',
    message: 'Achtung: Kamerapositionen liegen außerhalb von −90…90° bzw. −180…180°. Met.3D könnte die Fahrt abschneiden.',
  }];
}

import type { PathRegistryEntry, PathType, ParamRecord } from '../types';
import { circlePath } from './circle';

/**
 * Registry aller Kamerafahrten (AGENTS.md Abschnitt 5):
 * Neue Fahrtypen = neue Datei + ein Eintrag hier. Kein Fahrtyp-spezifischer
 * Code in ui/ oder view3d/.
 */
const entries: PathRegistryEntry[] = [
  { path: circlePath, enabled: true },
];

export function listPathTypes(): PathRegistryEntry[] {
  return entries;
}

export function getPathType(id: string): PathType | undefined {
  return entries.find((entry) => entry.path.id === id)?.path;
}

export function getDefaultPathType(): PathType {
  const first = entries.find((entry) => entry.enabled)?.path ?? entries[0]?.path;
  if (!first) {
    throw new Error('Kein Kamerafahrt-Typ registriert.');
  }
  return first;
}

export function defaultParamsFor(path: PathType): ParamRecord {
  return { ...path.defaults };
}

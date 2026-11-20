import type { SequenceKey } from './types';

/**
 * Loop-Option (Anfrage 2026-11-20): bei aktivem Loop wird eine exakte Kopie
 * des ersten Keyframes am Ende angehängt, damit die Sequenz in Met.3D nahtlos
 * zum Startpunkt zurückkehrt.
 *
 * Wird zentral nach path.generate() angewendet – die PathTypes bleiben damit
 * frei von Fahrtyp-unabhängiger Zusatzlogik (AGENTS.md Abschnitt 5).
 */
export function applyLoop(keys: SequenceKey[], loop: boolean): SequenceKey[] {
  const first = keys[0];
  if (!loop || first === undefined) {
    return keys;
  }
  return [...keys, { ...first }];
}

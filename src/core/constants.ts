/** Zentrale Konstanten – keine Magic Numbers im Code (AGENTS.md Abschnitt 9). */

/**
 * Standard-Tension der UI (aNfrage 2026-11-20: glatterer Wert 0.05).
 * Als String konserviert, damit der Wert verbatim ins XML geschrieben wird
 * und keine float-Rundungsartefakte entstehen (siehe core/xml.ts).
 */
export const DEFAULT_TENSION_XML = '0.05';
export const DEFAULT_TENSION = Number(DEFAULT_TENSION_XML);

/**
 * Tension exakt wie in reference/Base_Sequence.xml (float32-Präzision aus
 * Met.3D, C#-Artikulation). Wird nur für den Byte-Identitäts-Snapshot-Test
 * der Referenzdatei verwendet, nicht mehr als UI-Default.
 */
export const REFERENCE_TENSION_XML = '0.059999998658895493';

export const DEFAULT_NAME = 'Sequence';
export const DEFAULT_CAMERA_Z = 25;
export const DEFAULT_PITCH = 90;
/** Default: manuelle Pitch-Eingabe (Referenzdatei nutzt konstant pitch=90). */
export const DEFAULT_AUTO_PITCH = false;
export const DEFAULT_ROLL = 0;
export const DEFAULT_TRANSITION = 1;
export const DEFAULT_ADVANCE_TIMESTEP = 0;
/** Default: kein Loop (Referenzdatei endet ohne Wiederholungs-Key). */
export const DEFAULT_LOOP = false;

export const MIN_KEYFRAMES = 2;
export const MAX_KEYFRAMES = 360;
/** Vollkreis braucht mindestens 3 Punkte, sonst entsteht keine Kreisbahn. */
export const MIN_KEYFRAMES_FULL_CIRCLE = 3;

export const MIN_RADIUS = 0;
export const MAX_SWEEP_ANGLE = 360;

export const MIN_LAT = -90;
export const MAX_LAT = 90;
export const MIN_LON = -180;
export const MAX_LON = 180;

/** Maximale Nachkommastellen im XML-Export (Abschnitt 4). */
export const MAX_XML_DECIMALS = 6;

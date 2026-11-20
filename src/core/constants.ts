/** Zentrale Konstanten – keine Magic Numbers im Code (AGENTS.md Abschnitt 9). */

/**
 * Default-Tension exakt wie in reference/Base_Sequence.xml.
 * ANNAHME: Der Wert ist float32-Präzision aus Met.3D (C#-Artikulation).
 * Die kürzest mögliche double-Darstellung ("...49") unterscheidet sich im
 * letzten Zeichen, deshalb wird der Referenzwert als String konserviert,
 * damit der Default-Export byte-identisch zur Referenz bleibt.
 */
export const DEFAULT_TENSION_XML = '0.059999998658895493';
export const DEFAULT_TENSION = Number(DEFAULT_TENSION_XML);

export const DEFAULT_NAME = 'Sequence';
export const DEFAULT_CAMERA_Z = 25;
export const DEFAULT_PITCH = 90;
/** Default: manuelle Pitch-Eingabe (Referenzdatei nutzt konstant pitch=90). */
export const DEFAULT_AUTO_PITCH = false;
export const DEFAULT_ROLL = 0;
export const DEFAULT_TRANSITION = 1;
export const DEFAULT_ADVANCE_TIMESTEP = 0;

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

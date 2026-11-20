/**
 * Reine Datentypen der Sequenz-Logik. Kein DOM, kein three.js (siehe AGENTS.md Abschnitt 5).
 */

export interface SequenceKey {
  advanceTimestep: number;
  isOrthographic: 0 | 1;
  label: string;
  lat: number;
  lon: number;
  pitch: number;
  roll: number;
  transition: number;
  yaw: number;
  z: number;
}

export interface CommonParams {
  /** Fokuspunkt, Grad */
  focusLat: number;
  focusLon: number;
  /** Höhe des Fokuspunkts in Met.3D-Szeneneinheiten */
  focusZ: number;
  /** Kamerahöhe in Met.3D-Szeneneinheiten */
  cameraZ: number;
  keyframeCount: number;
  pitch: number;
  /**
   * ERGÄNZUNG: true => pitch wird je Keyframe automatisch aus dem
   * Höhenunterschied Kamera/Fokuspunkt berechnet; false => manuell über pitch.
   */
  autoPitch: boolean;
  /**
   * ERGÄNZUNG (Anfrage 2026-11-20): true => am Ende wird eine exakte Kopie des
   * ersten Keyframes angehängt, damit die Fahrt in Met.3D zum Start zurückkehrt.
   */
  loop: boolean;
  roll: number;
  transition: number;
  /**
   * ERGÄNZUNG zur Vorgabe in AGENTS.md: advanceTimestep ist in Abschnitt 6.1
   * als UI-Eingabe gefordert, fehlt aber in CommonParams. Daher hier ergänzt.
   */
  advanceTimestep: number;
  tension: number;
  name: string;
}

/** Werte, die ein PathType-Parameter im Formular annehmen kann. */
export type ParamValue = number | boolean | string;

export type ParamRecord = Record<string, ParamValue>;

/** Beschreibung eines zusätzlichen UI-Felds eines Pfadtyps (Abschnitt 5/6.1). */
export interface ParamField {
  key: string;
  label: string;
  kind: 'number' | 'checkbox' | 'select';
  unit?: string;
  /** Tooltip/Kurzhilfe im Formular */
  help?: string;
  min?: number;
  max?: number;
  /** Untergrenze exklusiv (Wert muss größer sein) */
  exclusiveMin?: number;
  step?: number;
  options?: { value: string | number; label: string }[];
}

/** Beschreibung eines CommonParams-Felds im Formular. */
export interface CommonField {
  key: keyof CommonParams;
  label: string;
  kind: 'number' | 'text' | 'checkbox';
  group: 'focus' | 'path' | 'camera';
  unit?: string;
  help?: string;
  min?: number;
  max?: number;
  step?: number;
  /** Wert muss ganzzahlig sein */
  integer?: boolean;
  /**
   * ERGÄNZUNG (Checkbox-Felder): deaktiviert ein anderes Feld, wenn angehakt,
   * z. B. autoPitch => pitch. Hält Formular und Logik an einer Stelle.
   */
  disables?: keyof CommonParams;
}

export interface PathType<P extends ParamRecord = ParamRecord> {
  id: string;
  /** Anzeigename (Deutsch) */
  label: string;
  paramSchema: ParamField[];
  defaults: P;
  generate(common: CommonParams, params: P): SequenceKey[];
  /**
   * ERGÄNZUNG: Ob die Keyframe-Kette geschlossen ist (Vollkreis).
   * Wird nur für die 3D-Vorschau (geschlossener Spline) benötigt.
   * Hinweis: bewusst Methodensignatur (nicht `(x)=>T`-Property), damit ein
   * PathType<CircleParams> den Registry-Typ PathType<ParamRecord> erfüllt.
   */
  isClosed?(common: CommonParams, params: P): boolean;
  /** ERGÄNZUNG: Pfadeigene Feldprüfung (nur die eigenen Parameter). */
  validate?(params: P): Issue[];
  /** ERGÄNZUNG: Mindestanzahl Keyframes für diesen Fahrtyp. */
  minKeyframes?(params: P): number;
}

/** Eintrag der Pfadtyp-Registry inkl. Freigabe-Status für die UI. */
export interface PathRegistryEntry {
  path: PathType;
  /** false => Dropdown-Eintrag ausgegraut mit Hinweis "folgt" (Abschnitt 6.1). */
  enabled: boolean;
}

export type IssueSeverity = 'error' | 'warning';

export interface Issue {
  /** Bezugsfeld, z. B. "common.focusLat" oder "path.radius"; ohne Feld = global. */
  field?: string;
  severity: IssueSeverity;
  message: string;
}

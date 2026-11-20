import { MAX_XML_DECIMALS } from './constants';
import type { SequenceKey } from './types';

/**
 * Zahlenformat für XML-Attribute (AGENTS.md Abschnitt 4):
 * Punkt als Dezimaltrenner, max. `maxDecimals` Nachkommastellen,
 * keine wissenschaftliche Notation, ganze Zahlen ohne ".0", "-0" vermeiden.
 */
export function formatNumber(value: number, maxDecimals = MAX_XML_DECIMALS): string {
  if (!Number.isFinite(value)) {
    // Defensive: validierung fängt NaN/Infinity ab; trotzdem deterministisch bleiben.
    return '0';
  }
  let rounded = Number(value.toFixed(maxDecimals));
  if (Object.is(rounded, -0)) {
    rounded = 0;
  }
  const out = String(rounded);
  if (!out.includes('e') && !out.includes('E')) {
    return out;
  }
  // String() wechselt bei sehr kleinen/großen Zahlen in Exponent-Schreibweise.
  // Intl mit festem 'en-US' liefert garantiert Punktnotation ohne Exponent.
  const formatter = new Intl.NumberFormat('en-US', {
    useGrouping: false,
    maximumFractionDigits: Math.min(maxDecimals, 20),
  });
  const plain = formatter.format(rounded);
  return plain === '-0' ? '0' : plain;
}

/**
 * Tension wird nicht auf 6 Nachkommastellen gerundet: Der Referenzwert
 * "0.059999998658895493" ist float32-Präzision aus Met.3D. Nur so ist der
 * Export byte-identisch zur Referenz. Strings werden verbatim übernommen
 * (nach Format-Prüfung), Zahlen mit ausreichenden Stellen ohne Exponent
 * expandiert.
 */
const NUMBER_RE = /^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/;

export function formatTension(value: number | string): string {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (NUMBER_RE.test(trimmed)) {
      return includesExponent(trimmed) ? expandExponent(trimmed) : trimmed;
    }
    return formatTension(Number(trimmed));
  }
  if (!Number.isFinite(value)) {
    return '0';
  }
  const out = String(value);
  return includesExponent(out) ? expandExponent(out) : out;
}

function includesExponent(s: string): boolean {
  return /e/i.test(s);
}

/** Writeet exponentielle Schreibweise in normale Dezimalschreibweise um. */
function expandExponent(s: string): string {
  const n = Number(s);
  // toFixed erlaubt max. 100 Nachkommastellen; für plausible Tension-Werte ausreichend.
  const decimals = Math.min(100, Math.max(0, -Math.floor(Math.log10(Math.abs(n))) + 17));
  return n.toFixed(decimals).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
}

/** XML-Escaping für Attributwerte (relevant für label und name). */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Ein Keyframe als selbstschließendes Element, Attributreihenfolge alphabetisch. */
export function buildSequenceKeyXml(key: SequenceKey): string {
  const attrs = [
    `advanceTimestep="${formatNumber(key.advanceTimestep)}"`,
    `isOrthographic="${key.isOrthographic}"`,
    `label="${escapeXml(key.label)}"`,
    `lat="${formatNumber(key.lat)}"`,
    `lon="${formatNumber(key.lon)}"`,
    `pitch="${formatNumber(key.pitch)}"`,
    `roll="${formatNumber(key.roll)}"`,
    `transition="${formatNumber(key.transition)}"`,
    `yaw="${formatNumber(key.yaw)}"`,
    `z="${formatNumber(key.z)}"`,
  ];
  return `  <SequenceKey ${attrs.join(' ')}/>`;
}

/**
 * Baut complete Base_Sequence-Datei (ohne <?xml?>-Header, mit DOCTYPE,
 * 2 Leerzeichen Einrückung, Unix-Zeilenende, abschließender Umbruch).
 */
export function buildSequenceXml(
  name: string,
  tension: number | string,
  keys: SequenceKey[],
): string {
  const lines: string[] = [
    '<!DOCTYPE CameraSequence>',
    `<CameraSequence name="${escapeXml(name)}" tension="${formatTension(tension)}">`,
    ...keys.map(buildSequenceKeyXml),
    '</CameraSequence>',
  ];
  return lines.join('\n') + '\n';
}

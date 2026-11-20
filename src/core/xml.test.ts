import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DEFAULT_TENSION_XML } from './constants';
import { buildSequenceXml, escapeXml, formatNumber, formatTension } from './xml';
import type { SequenceKey } from './types';

const referencePath = fileURLToPath(new URL('../../reference/Base_Sequence.xml', import.meta.url));
const referenceXml = readFileSync(referencePath, 'utf8');

/** Die vier Referenz-Keys exakt wie in reference/Base_Sequence.xml. */
function refKey(lat: number, lon: number, yaw: number): SequenceKey {
  return {
    advanceTimestep: 0,
    isOrthographic: 0,
    label: '',
    lat,
    lon,
    pitch: 90,
    roll: 0,
    transition: 1,
    yaw,
    z: 25,
  };
}

describe('buildSequenceXml', () => {
  it('erzeugt für die Referenz-Keys einen byte-identischen Output', () => {
    const keys = [
      refKey(50, 50, 135),
      refKey(-50, 50, 45),
      refKey(-50, -50, 315),
      refKey(50, -50, 225),
    ];
    const output = buildSequenceXml('Sequence', DEFAULT_TENSION_XML, keys);
    // Zeilenende-Normalisierung: Dateien könnten mit CRLF Checked-out sein.
    expect(output.replace(/\r\n/g, '\n')).toBe(referenceXml.replace(/\r\n/g, '\n'));
  });

  it('endet auf Zeilenumbruch und enthält keinen XML-Header', () => {
    const output = buildSequenceXml('Sequence', DEFAULT_TENSION_XML, []);
    expect(output.endsWith('\n')).toBe(true);
    expect(output.startsWith('<!DOCTYPE CameraSequence>')).toBe(true);
    expect(output).not.toContain('<?xml');
  });

  it('escaped name-Attribut', () => {
    const output = buildSequenceXml('A&B<C>"D"', DEFAULT_TENSION_XML, []);
    expect(output).toContain('name="A&amp;B&lt;C&gt;&quot;D&quot;"');
  });

  it('escaped label-Attribut', () => {
    const key = refKey(0, 0, 0);
    key.label = '<tag> & "zitiert"';
    const output = buildSequenceXml('Sequence', DEFAULT_TENSION_XML, [key]);
    expect(output).toContain('label="&lt;tag&gt; &amp; &quot;zitiert&quot;"');
  });
});

describe('formatNumber', () => {
  it('schreibt ganze Zahlen ohne .0', () => {
    expect(formatNumber(50)).toBe('50');
    expect(formatNumber(-50)).toBe('-50');
    expect(formatNumber(25.0)).toBe('25');
  });

  it('vermeidet -0', () => {
    expect(formatNumber(-0)).toBe('0');
    expect(formatNumber(-0.0000001)).toBe('0');
  });

  it('rundet auf max. 6 Nachkommastellen', () => {
    expect(formatNumber(12.345678)).toBe('12.345678');
    expect(formatNumber(12.3456789)).toBe('12.345679');
    expect(formatNumber(0.1 + 0.2)).toBe('0.3');
  });

  it('nutzt nie wissenschaftliche Notation', () => {
    expect(formatNumber(1e-7)).toBe('0');
    expect(formatNumber(0.000000123)).toBe('0');
    expect(formatNumber(1e21)).toBe('1000000000000000000000');
  });

  it('verwendet Punkt als Dezimaltrenner', () => {
    expect(formatNumber(1.5)).toBe('1.5');
  });
});

describe('formatTension', () => {
  it('erhält die float32-Präzision des Referenzwerts', () => {
    expect(formatTension(DEFAULT_TENSION_XML)).toBe('0.059999998658895493');
  });
});

describe('escapeXml', () => {
  it('escaped alle kritischen Zeichen', () => {
    expect(escapeXml('&<>"')).toBe('&amp;&lt;&gt;&quot;');
  });

  it('lässt normale Zeichen unverändert', () => {
    expect(escapeXml('Kamerafahrt Süd 2024')).toBe('Kamerafahrt Süd 2024');
  });
});

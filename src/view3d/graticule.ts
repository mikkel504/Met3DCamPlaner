import * as THREE from 'three';
import { GRATICULE_Z, MAP_LAT_MAX, MAP_LAT_MIN, MAP_LON_MAX, MAP_LON_MIN } from './basemap';
import { makeLabelSprite, scaleLabelSprite } from './label';
import type { LabelColors } from './label';

/**
 * Gradnetz (Graticule) für die 3D-Vorschau.
 *
 * Das Netz deckt exakt die Kartengrundlage ab (Länge -180…180, Breite -90…90) und
 * nutzt deshalb dieselben Grenzen wie basemap.ts: eine Linie alle 10°, Äquator und
 * Null-Meridian stärker gezeichnet. Alle 30° steht eine Gradzahl direkt auf der
 * äußeren Randlinie – Längengrade am Südrand, Breitengrade am Westrand – mit
 * Himmelsrichtungs-Endung (N/S für Breite, E/W für Länge).
 *
 * Bewusst feste, vorhersagbare Werte (dauerhaft alle 30°) statt einer automatisch
 * ausgedünnten Dichte; die Beschriftungen skalieren wie die Achsenbeschriftungen
 * (siehe label.ts).
 */

export const GRATICULE_STEP = 10;

/** Randbeschriftung nur an jedem n-ten Netzschritt (n * 10° = 30°). */
const LABEL_EVERY = 3;

/** Höhenlage der Sprites über den Netzlinien, damit sie nie darin verschwinden. */
const LABEL_Z = GRATICULE_Z + 0.7;

export interface GraticuleOptions extends LabelColors {
  lineColor: number;
  majorLineColor: number;
}

export interface GraticuleHandle {
  group: THREE.Group;
  /**
   * Größe der Beschriftungen an die aktuelle Kamera anpassen (screenkonstant).
   * `viewHeightWorldAt` liefert die Welteinheiten, die der Viewport-Höhe an der
   * übergebenen Position entsprechen – dieselbe Rechnung wie für die Achsen.
   */
  updateLabels(viewHeightWorldAt: (position: THREE.Vector3) => number): void;
  dispose(): void;
}

/**
 * Gradzahl mit Himmelsrichtungs-Endung: 50 -> „50 N", -30 -> „30 S". Der 0-Wert
 * bekommt keine Endung, weil er richtungslos ist.
 */
function formatLat(lat: number): string {
  if (lat === 0) return '0';
  return `${Math.abs(lat)} ${lat > 0 ? 'N' : 'S'}`;
}

function formatLon(lon: number): string {
  if (lon === 0) return '0';
  return `${Math.abs(lon)} ${lon > 0 ? 'E' : 'W'}`;
}

export function createGraticule(options: GraticuleOptions): GraticuleHandle {
  const group = new THREE.Group();
  const textures: THREE.CanvasTexture[] = [];
  const labels: THREE.Sprite[] = [];

  /** Randbeschriftungen entstehen nur an jedem `LABEL_EVERY`-ten Netzschritt. */
  const hasLabel = (i: number): boolean => i % LABEL_EVERY === 0;

  const minor: THREE.Vector3[] = [];
  const major: THREE.Vector3[] = [];

  // Meridiane: konstanter Längengrad, über die volle Höhe der Karte.
  let i = 0;
  for (let lon = MAP_LON_MIN; lon <= MAP_LON_MAX; lon += GRATICULE_STEP, i++) {
    const target = lon === 0 ? major : minor;
    target.push(
      new THREE.Vector3(lon, MAP_LAT_MIN, GRATICULE_Z),
      new THREE.Vector3(lon, MAP_LAT_MAX, GRATICULE_Z),
    );
    // Am Südwest-Eck würde die Längengrad-Zahl die Breitengrad-Zahl überdecken –
    // dort steht nur die Breitengrad-Zahl (die Randlinie ist selbst -180°/180°).
    if (!hasLabel(i) || lon === MAP_LON_MIN) continue;
    const sprite = makeLabelSprite(formatLon(lon), options, textures);
    sprite.position.set(lon, MAP_LAT_MIN, LABEL_Z);
    group.add(sprite);
    labels.push(sprite);
  }

  // Breitenkreise: konstanter Breitengrad, über die volle Breite der Karte.
  i = 0;
  for (let lat = MAP_LAT_MIN; lat <= MAP_LAT_MAX; lat += GRATICULE_STEP, i++) {
    const target = lat === 0 ? major : minor;
    target.push(
      new THREE.Vector3(MAP_LON_MIN, lat, GRATICULE_Z),
      new THREE.Vector3(MAP_LON_MAX, lat, GRATICULE_Z),
    );
    if (!hasLabel(i)) continue;
    const sprite = makeLabelSprite(formatLat(lat), options, textures);
    // Mittig auf die äußere Randlinie (Westrand), nicht nach innen verschoben.
    sprite.position.set(MAP_LON_MIN, lat, LABEL_Z);
    group.add(sprite);
    labels.push(sprite);
  }

  const addLines = (points: THREE.Vector3[], color: number, opacity: number): void => {
    if (points.length === 0) return;
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity });
    group.add(new THREE.LineSegments(geometry, material));
  };
  addLines(minor, options.lineColor, 0.5);
  addLines(major, options.majorLineColor, 0.9);

  const updateLabels = (viewHeightWorldAt: (position: THREE.Vector3) => number): void => {
    for (const sprite of labels) {
      scaleLabelSprite(sprite, viewHeightWorldAt(sprite.position));
    }
  };

  const dispose = (): void => {
    for (const child of group.children) {
      if (child instanceof THREE.LineSegments) child.geometry.dispose();
      if (child instanceof THREE.Sprite) child.material.dispose();
    }
    for (const texture of textures) texture.dispose();
    group.clear();
  };

  return { group, updateLabels, dispose };
}

/** Komplette Ausdehnung der Karte – Basis für die „Ganze Karte“-Ansicht. */
export function worldBounds(): { min: THREE.Vector3; max: THREE.Vector3 } {
  return {
    min: new THREE.Vector3(MAP_LON_MIN, MAP_LAT_MIN, 0),
    max: new THREE.Vector3(MAP_LON_MAX, MAP_LAT_MAX, 0),
  };
}

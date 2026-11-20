import * as THREE from 'three';

/**
 * Kartengrundlage für die 3D-Vorschau.
 *
 * Die Bilddatei liegt in `public/` und wird von Vite unverändert nach `dist/`
 * kopiert; über `import.meta.env.BASE_URL` funktioniert der Pfad sowohl lokal
 * als auch auf GitHub Pages (`/Met3DCamPlaner/`).
 *
 * Verwendet wird eine equirektanguläre Weltenkarte (Natural Earth, Public
 * Domain, 3240 × 1620 px): Spalten = Längengrad −180…180, Zeilen = Breitengrad
 * 90…−90. Die Vorschau nutzt dieselben Achsen (x = lon, y = lat in Grad),
 * deshalb liegt die Karte ohne Verzerrung auf der Ebene: das 2:1-Seitenverhältnis
 * des Bildes ist genau das Verhältnis von 360° Länge zu 180° Breite.
 */

const BASEMAP_FILE = 'worldmap.jpg';
const LON_SPAN = 360;
const LAT_SPAN = 180;
/**
 * Abstand der Kartenebene unter z = 0. Muss größer als 0 sein, sonst zockt
 * (Z-Fighting) das bei z = 0 liegende Gitter mit der Textur.
 */
const BASEMAP_DEPTH = 1;

export interface BasemapHandle {
  group: THREE.Group;
  /** Lädt die Textur; die Ebene bleibt bis dahin unsichtbar. */
  load(renderer: THREE.WebGLRenderer): Promise<boolean>;
  /** Rand der Karte an die aktuelle Hell/Dunkel-Palette anpassen. */
  setPalette(color: number): void;
}

function borderGeometry(): THREE.BufferGeometry {
  const halfLon = LON_SPAN / 2;
  const halfLat = LAT_SPAN / 2;
  const corners = [
    new THREE.Vector3(-halfLon, -halfLat, 0),
    new THREE.Vector3(halfLon, -halfLat, 0),
    new THREE.Vector3(halfLon, halfLat, 0),
    new THREE.Vector3(-halfLon, halfLat, 0),
  ];
  return new THREE.BufferGeometry().setFromPoints(corners);
}

export function createBasemap(): BasemapHandle {
  const group = new THREE.Group();
  // Sichtbar erst, wenn die Textur da ist – sonst eine schwarze Fläche im Szenenbild.
  group.visible = false;

  const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(LON_SPAN, LAT_SPAN), material);
  plane.position.z = -BASEMAP_DEPTH;

  const borderMaterial = new THREE.LineBasicMaterial({ color: 0x8b93a1 });
  const border = new THREE.LineLoop(borderGeometry(), borderMaterial);
  border.position.z = -BASEMAP_DEPTH + 0.05;
  group.add(plane, border);

  async function load(renderer: THREE.WebGLRenderer): Promise<boolean> {
    const url = `${import.meta.env.BASE_URL}${BASEMAP_FILE}`;
    try {
      const texture = await new THREE.TextureLoader().loadAsync(url);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
      material.map = texture;
      material.needsUpdate = true;
      group.visible = true;
      return true;
    } catch {
      // Fehlende Karte darf die Vorschau nicht kaputtmachen: weiter mit Gitter.
      console.warn(`Kartengrundlage ${BASEMAP_FILE} konnte nicht geladen werden.`);
      return false;
    }
  }

  function setPalette(color: number): void {
    borderMaterial.color.set(color);
  }

  return { group, load, setPalette };
}

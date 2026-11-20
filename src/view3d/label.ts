import * as THREE from 'three';

/**
 * Gemeinsame Bausteine für alle Text-Beschriftungen der Vorschau
 * (Gradnetz-Zahlen und Achsenbeschriftungen).
 *
 * Warum eine gemeinsame Datei: beide Beschriftungsarten müssen in jeder
 * Zoomstufe exakt gleich groß wirken. Das gelingt nur, wenn sie dasselbe
 * Canvas-Format ( gleiches Seitenverhältnis, gleiche Schrift-Metrik) und
 * dasselbe Skalierungsprinzip nutzen – hier eine feste Bildschirmgröße als
 * Anteil der Viewport-Höhe, berechnet über die Entfernung von der Kamera zur
 * jeweiligen Sprite-Position.
 */

/** Canvas-Maße aller Beschriftungen; bestimmen das Seitenverhältnis der Sprites. */
const CANVAS_WIDTH = 320;
const CANVAS_HEIGHT = 96;

/** Schrift und Kontrastumrandung – identisch für Zahlen und Achsen. */
const FONT = 'bold 68px system-ui, sans-serif';
const HALO_LINE_WIDTH = 12;

/** Höhe einer Beschriftung als Anteil der Viewport-Höhe (bildschirmkonstant). */
export const LABEL_SCREEN_HEIGHT = 0.026;

/** Seitenverhältnis aller Beschriftungs-Sprites. */
export const LABEL_ASPECT = CANVAS_WIDTH / CANVAS_HEIGHT;

export interface LabelColors {
  textColor: string;
  /** Kontrastumrandung, damit die Texte auf der farbigen Weltkarte lesbar bleiben. */
  textHalo: string;
}

/**
 * Text als Sprite mit Kontrastumrandung. `textures` nimmt die erzeugte Textur
 * entgegen, wenn die Aufruferin sie selbst entsorgen will (Gradnetz); sonst
 * entsorgt der Besitzer des Sprites `material.map` (Achsen in preview.ts).
 */
export function makeLabelSprite(
  text: string,
  colors: LabelColors,
  textures?: THREE.CanvasTexture[],
): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.font = FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = HALO_LINE_WIDTH;
    ctx.strokeStyle = colors.textHalo;
    ctx.strokeText(text, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
    ctx.fillStyle = colors.textColor;
    ctx.fillText(text, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  if (textures) textures.push(texture);
  return new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
}

/**
 * Bildschirmkonstante Größe in Welteinheiten setzen. `viewHeightWorld` sind die
 * Welteinheiten, die an der Position des Sprites der Viewport-Höhe entsprechen –
 * für jedes Sprite einzeln, sonst unterscheiden sich weit voneinander entfernte
 * Beschriftungen in ihrer Bildschirmgröße.
 */
export function scaleLabelSprite(sprite: THREE.Sprite, viewHeightWorld: number): void {
  if (!(viewHeightWorld > 0)) {
    return;
  }
  const height = LABEL_SCREEN_HEIGHT * viewHeightWorld;
  sprite.scale.set(height * LABEL_ASPECT, height, 1);
}

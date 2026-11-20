import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { CommonParams, ParamRecord, PathType, SequenceKey } from '../core/types';

/**
 * 3D-Vorschau (AGENTS.md Abschnitt 6.3).
 *
 * Koordinaten: Z-up – x = Längengrad (Ost), y = Breitengrad (Nord), z = Höhe.
 * ANNAHME: lat/lon werden für die Vorschau wie rechtwinklige Kartekoordinaten
 * behandelt (entspricht der Kreisberechnung in core/paths/circle.ts).
 */

const COLOR_FOCUS = 0xff3366;
const COLOR_KEY = 0x2f7fd6;
const COLOR_KEY_FIRST = 0xff8c1a;
const COLOR_PATH = 0x2f7fd6;
const COLOR_ARROW = 0x2fa64f;

export interface PreviewHandle {
  update(common: CommonParams, path: PathType, pathParams: ParamRecord, keys: SequenceKey[]): void;
  resetView(): void;
}

interface Palette {
  grid: number;
  axis: number;
  text: string;
  background: number;
}

function readPalette(): Palette {
  const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  return dark
    ? { grid: 0x3a3f46, axis: 0x8b93a1, text: '#c8ced8', background: 0x16181d }
    : { grid: 0xc9ced6, axis: 0x6a7280, text: '#333a44', background: 0xf4f6f8 };
}

/**
 * Blickrichtung als 3D-Vektor aus yaw und pitch (AGENTS.md Abschnitt 4):
 * yaw = (360 − Kompasspeilung) mod 360, d.h. yaw wächst gegen den Uhrzeiger.
 * Kompasspeilung c ergibt den Vektor (sin c, cos c) in Kartekoordinaten
 * (x=lon/Ost, y=lat/Nord). Mit c = (360 − yaw) mod 360 folgt:
 * horizontale Richtung = (−sin yaw, cos yaw).
 * Probe über Referenzkey NO (lat 50, lon 50, yaw 135):
 * (−sin 135, cos 135) = (−0.71, −0.71) -> genau Richtung Fokus (0, 0).
 * ANNAHME: pitch = 90 ist horizontal, größere Neigungen blicken nach unten –
 * dieselbe Konvention wie computeAutoPitch in core/pitch.ts.
 */
function viewDirection(yawDeg: number, pitchDeg: number): THREE.Vector3 {
  const yaw = (yawDeg * Math.PI) / 180;
  // Elevationswinkel: 0 = horizontal, negativ = Blick nach unten.
  const elevation = ((90 - pitchDeg) * Math.PI) / 180;
  const horizontal = Math.cos(elevation);
  return new THREE.Vector3(
    -Math.sin(yaw) * horizontal,
    Math.cos(yaw) * horizontal,
    Math.sin(elevation),
  );
}

function makeTextSprite(text: string, palette: Palette): THREE.Sprite {
  const font = '600 48px system-ui, sans-serif';
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas-Kontext nicht verfügbar.');
  }
  ctx.font = font;
  const width = Math.ceil(ctx.measureText(text).width) + 24;
  canvas.width = width;
  canvas.height = 72;
  ctx.font = font;
  ctx.fillStyle = palette.text;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 12, 36);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true }),
  );
  sprite.userData.canvasWidth = width;
  return sprite;
}

/** Sprites skalieren, damit Text in allen Zoomstufen lesbar bleibt. */
function fitSprite(sprite: THREE.Sprite, sceneScale: number): void {
  const width = Number(sprite.userData.canvasWidth);
  const factor = sceneScale / 100;
  sprite.scale.set((width / 72) * factor, factor, 1);
}

function disposeObject(obj: THREE.Object3D): void {
  obj.traverse((child) => {
    if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
      child.geometry.dispose();
      const material = child.material;
      if (Array.isArray(material)) {
        material.forEach((m) => m.dispose());
      } else {
        material.dispose();
      }
    }
    if (child instanceof THREE.Sprite) {
      const material = child.material;
      material.map?.dispose();
      material.dispose();
    }
  });
}

export function setupPreview(container: HTMLElement): PreviewHandle {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  container.append(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 5000);
  camera.up.set(0, 0, 1); // Z-up, damit z der Höhe entspricht (Abschnitt 6.3)

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  const staticGroup = new THREE.Group();
  const dynamicGroup = new THREE.Group();
  scene.add(staticGroup, dynamicGroup);

  let palette = readPalette();
  let lastState:
    | { common: CommonParams; path: PathType; pathParams: ParamRecord; keys: SequenceKey[] }
    | undefined;
  let homePosition = new THREE.Vector3(120, 120, 120);
  let homeTarget = new THREE.Vector3(0, 0, 0);

  function rebuildStatic(bounds: { min: THREE.Vector3; max: THREE.Vector3 }): void {
    disposeObject(staticGroup);
    staticGroup.clear();
    palette = readPalette();
    scene.background = new THREE.Color(palette.background);

    const extent = Math.max(bounds.max.x - bounds.min.x, bounds.max.y - bounds.min.y, 10);
    const span = Math.max(bounds.max.z - bounds.min.z, extent * 0.2, 10);
    const step = niceStep(extent / 8);

    // Gitterfläche in der Kartenebene z=0 (x=lon, y=lat).
    const grid = new THREE.GridHelper(
      Math.ceil((extent + span) / step) * step,
      Math.max(1, Math.round((extent + span) / step)),
      palette.grid,
      palette.grid,
    );
    grid.rotation.x = Math.PI / 2; // GridHelper liegt in XY, wir brauchen XZ -> Z-up
    staticGroup.add(grid);

    // Achsen durch den Ursprung der Kartenebene.
    const half = Math.ceil((extent + span) / 2 / step) * step;
    addAxis(new THREE.Vector3(0, 0, 0), new THREE.Vector3(half, 0, 0), 'Lon (x)', palette);
    addAxis(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, half, 0), 'Lat (y)', palette);
    addAxis(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, Math.max(span, step)), 'z', palette);

    // Skalenmarken alle `step` Einheiten auf der Lon-Achse.
    for (let v = step; v <= half; v += step) {
      const label = makeTextSprite(String(Math.round(v * 100) / 100), palette);
      label.position.set(v, -step * 0.3, 0);
      fitSprite(label, extent);
      staticGroup.add(label);
    }
  }

  function addAxis(from: THREE.Vector3, to: THREE.Vector3, text: string, pal: Palette): void {
    const geometry = new THREE.BufferGeometry().setFromPoints([from, to]);
    const material = new THREE.LineBasicMaterial({ color: pal.axis });
    staticGroup.add(new THREE.Line(geometry, material));

    const dir = to.clone().sub(from);
    const len = dir.length();
    const head = new THREE.ConeGeometry(Math.max(len * 0.01, 0.5), Math.max(len * 0.04, 1.5), 12);
    const mesh = new THREE.Mesh(head, new THREE.MeshBasicMaterial({ color: pal.axis }));
    mesh.position.copy(to);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir.normalize());
    staticGroup.add(mesh);

    const label = makeTextSprite(text, pal);
    label.position.copy(to).addScaledVector(dir, len * 0.06);
    fitSprite(label, Math.max(len, 10));
    staticGroup.add(label);
  }

  function rebuildDynamic(
    common: CommonParams,
    path: PathType,
    pathParams: ParamRecord,
    keys: SequenceKey[],
  ): void {
    disposeObject(dynamicGroup);
    dynamicGroup.clear();
    if (keys.length === 0) {
      return;
    }
    const positions = keys.map((k) => new THREE.Vector3(k.lon, k.lat, k.z));
    const scale = averageSpacing(positions);

    // Fokuspunkt: auffälliger Marker + Lot auf die Kartenebene.
    const focus = new THREE.Vector3(common.focusLon, common.focusLat, common.focusZ);
    const focusMesh = new THREE.Mesh(
      new THREE.OctahedronGeometry(Math.max(scale * 0.12, 0.5)),
      new THREE.MeshBasicMaterial({ color: COLOR_FOCUS }),
    );
    focusMesh.position.copy(focus);
    dynamicGroup.add(focusMesh);
    const drop = new THREE.BufferGeometry().setFromPoints([
      focus,
      new THREE.Vector3(focus.x, focus.y, 0),
    ]);
    const dropLine = new THREE.Line(drop, new THREE.LineDashedMaterial({ color: COLOR_FOCUS }));
    dropLine.computeLineDistances(); // Pflicht, damit dashed-Material funktioniert
    dynamicGroup.add(dropLine);

    // Keyframes als nummerierte Punkte, erster Key hervorgehoben.
    keys.forEach((key, i) => {
      const isFirst = i === 0;
      const pos = positions[i] ?? new THREE.Vector3();
      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(Math.max(scale * 0.06, 0.35), 16, 12),
        new THREE.MeshBasicMaterial({ color: isFirst ? COLOR_KEY_FIRST : COLOR_KEY }),
      );
      sphere.position.copy(pos);
      dynamicGroup.add(sphere);

      const number = makeTextSprite(String(i + 1), palette);
      number.position.copy(pos).add(new THREE.Vector3(0, 0, Math.max(scale * 0.12, 0.6)));
      fitSprite(number, scale * 4);
      dynamicGroup.add(number);

      // Blickrichtung als kurzer Pfeil (yaw + pitch, zeigt bei autoPitch
      // räumlich auf den Fokuspunkt).
      const dir = viewDirection(key.yaw, key.pitch);
      const length = Math.max(scale * 0.4, 1);
      const arrow = new THREE.ArrowHelper(
        dir,
        pos,
        length,
        COLOR_ARROW,
        length * 0.3,
        length * 0.15,
      );
      dynamicGroup.add(arrow);
    });

    // Pfad als Catmull-Rom-Spline – nur Näherung der Met.3D-Interpolation.
    const closed = path.isClosed ? path.isClosed(common, pathParams as never) : false;
    if (positions.length >= 2) {
      const curve = new THREE.CatmullRomCurve3(positions, closed, 'centripetal');
      const samples = Math.max(positions.length * 24, 64);
      const points = curve.getPoints(samples);
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      dynamicGroup.add(new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: COLOR_PATH })));
    }
  }

  function computeBounds(
    common: CommonParams,
    keys: SequenceKey[],
  ): { min: THREE.Vector3; max: THREE.Vector3 } {
    const min = new THREE.Vector3(common.focusLon, common.focusLat, common.focusZ);
    const max = min.clone();
    for (const k of keys) {
      min.min(new THREE.Vector3(k.lon, k.lat, k.z));
      max.max(new THREE.Vector3(k.lon, k.lat, k.z));
    }
    return { min, max };
  }

  function frameCamera(bounds: { min: THREE.Vector3; max: THREE.Vector3 }): void {
    const center = bounds.min.clone().add(bounds.max).multiplyScalar(0.5);
    const extent = Math.max(bounds.max.x - bounds.min.x, bounds.max.y - bounds.min.y, 10);
    homeTarget = center;
    homePosition = center.clone().add(new THREE.Vector3(extent * 0.8, -extent * 1.1, extent * 0.9));
  }

  function update(
    common: CommonParams,
    path: PathType,
    pathParams: ParamRecord,
    keys: SequenceKey[],
  ): void {
    lastState = { common, path, pathParams, keys };
    const bounds = computeBounds(common, keys);
    rebuildStatic(bounds);
    rebuildDynamic(common, path, pathParams, keys);
    frameCamera(bounds);
  }

  function resetView(): void {
    if (lastState) {
      frameCamera(computeBounds(lastState.common, lastState.keys));
    }
    camera.position.copy(homePosition);
    controls.target.copy(homeTarget);
    controls.update();
  }

  function resize(): void {
    const width = container.clientWidth || 1;
    const height = container.clientHeight || 1;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  window.addEventListener('resize', resize);
  resize();
  resetView();

  const media = window.matchMedia('(prefers-color-scheme: dark)');
  media.addEventListener('change', () => {
    if (lastState) {
      update(lastState.common, lastState.path, lastState.pathParams, lastState.keys);
    }
  });

  renderer.setAnimationLoop(() => {
    controls.update();
    renderer.render(scene, camera);
  });

  return { update, resetView };
}

/** Schöne Schrittweite 1/2/5 * 10^n für Gitter und Achsen. */
function niceStep(raw: number): number {
  const pow = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 0.001))));
  const norm = raw / pow;
  if (norm <= 1) return pow;
  if (norm <= 2) return 2 * pow;
  if (norm <= 5) return 5 * pow;
  return 10 * pow;
}

function averageSpacing(points: THREE.Vector3[]): number {
  if (points.length < 2) return 10;
  let sum = 0;
  let prev = points[0] ?? new THREE.Vector3();
  for (const p of points.slice(1)) {
    sum += p.distanceTo(prev);
    prev = p;
  }
  return Math.max(sum / (points.length - 1), 1);
}

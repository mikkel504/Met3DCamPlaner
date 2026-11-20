import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createBasemap, GRATICULE_Z, MAP_LAT_MAX, MAP_LAT_MIN, MAP_LON_MAX, MAP_LON_MIN } from './basemap';
import { createGraticule, worldBounds } from './graticule';
import type { GraticuleHandle, GraticuleOptions } from './graticule';
import { makeLabelSprite, scaleLabelSprite } from './label';
import type { CommonParams, ParamRecord, PathType, SequenceKey } from '../core/types';

/**
 * 3D-Vorschau (AGENTS.md Abschnitt 6.3).
 *
 * Koordinaten: Z-up – x = Längengrad (Ost), y = Breitengrad (Nord), z = Höhe.
 * ANNAHME: lat/lon werden für die Vorschau wie rechtwinklige Kartekoordinaten
 * behandelt (entspricht der Kreisberechnung in core/paths/circle.ts).
 * Kartengrundlage: equirektanguläre Weltkarte in public/, siehe basemap.ts;
 * darüber liegt das 10°-Gradnetz mit Randbeschriftung aus graticule.ts. Alle
 * Texte der Szene (Gradnetz-Zahlen und Achsen) nutzen denselben Baustein aus
 * label.ts und sind dadurch in jeder Zoomstufe gleich groß.
 */

const COLOR_FOCUS = 0xff8c1a; // orange, hebt sich von dunkelrot ab
const COLOR_KEY = 0x8b0000; // dunkelrot (Keyframes)
const COLOR_PATH = 0x8b0000; // dunkelrot (Verbindungslinie)
const COLOR_ARROW = 0x003399; // dunkelblau (Blickrichtung)

/** z-Achse: 90 Grad (Welteinheiten) hoch. */
const AXIS_Z_HEIGHT = 90;

/** Abstand der Achsenbeschriftung über das Achsenende hinaus, in Welteinheiten. */
const AXIS_LABEL_OFFSET = 4;

/** Feste Blickrichtung der Automatik-Kamera (schräger Blick von Süd-Ost). */
const VIEW_DIRECTION = new THREE.Vector3(0.8, -1.1, 0.9).normalize();

/**
 * Orthografische Draufsicht: Höhe der Kamera über der Karte. Bei einer
 * Orthografiekamera bestimmt diese Höhe nur near/far und den Drehpunkt –
 * die Bildgröße bleibt unverändert.
 */
const ORTHO_CAMERA_HEIGHT = 500;

/** Zugabe auf die halbe Kartenausdehnung, damit die Randbeschriftung ganz sichtbar bleibt. */
const ORTHO_FIT_MARGIN = 1.06;

/** Zoomgrenzen der Draufsicht (OrbitControls ändern bei einer Orthografiekamera `camera.zoom`). */
const ORTHO_MIN_ZOOM = 0.4;
const ORTHO_MAX_ZOOM = 50;

export interface PreviewHandle {
  update(common: CommonParams, path: PathType, pathParams: ParamRecord, keys: SequenceKey[]): void;
  /** Rahmt die aktuelle Kamerafahrt (Perspektivkamera). */
  resetView(): void;
  /** Rahmt die ganze Weltkarte, dann sind alle Gradnetz-Werte am Rand sichtbar. */
  showWorld(): void;
  /** Orthografische Draufsicht auf die ganze Karte (Nord oben, ohne Fluchtpunkt). */
  showTopView(): void;
}

interface Palette extends GraticuleOptions {
  axis: number;
  background: number;
}

function readPalette(): Palette {
  const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  return dark
    ? {
        // Das Gradnetz liegt auf der farbigen Weltkarte, deshalb neutral und
        // kontrastreicher als die UI-Rahmenfarbe.
        lineColor: 0x5a626d,
        majorLineColor: 0xdfe6ef,
        textColor: '#e6e9ee',
        textHalo: 'rgba(18,20,25,0.85)',
        axis: 0x8b93a1,
        background: 0x16181d,
      }
    : {
        lineColor: 0x9aa3ae,
        majorLineColor: 0x1c2128,
        textColor: '#1c2128',
        textHalo: 'rgba(255,255,255,0.9)',
        axis: 0x6a7280,
        background: 0xf4f6f8,
      };
}

/**
 * Blickrichtung als 3D-Vektor aus yaw und pitch (AGENTS.md Abschnitt 4):
 * yaw = (360 − Kompasspeilung) mod 360, d.h. yaw wächst gegen den Uhrzeiger.
 * Kompasspeilung c ergibt den Vektor (sin c, cos c) in Kartekoordinaten
 * (x=lon/Ost, y=lat/Nord). Mit c = (360 − yaw) mod 360 folgt:
 * horizontale Richtung = (−sin yaw, cos yaw).
 * Probe über Referenzkey NO (lat 50, lon 50, yaw 135):
 * (−sin 135, cos 135) = (−0.71, −0.71) -> genau Richtung Fokus (0, 0).
 * In Met.3D verifiziert (Test-Import 2026-11-20): pitch = 90 horizontal,
 * > 90 blickt nach oben, < 90 nach unten – dieselbe Konvention wie
 * computeAutoPitch in core/pitch.ts.
 */
function viewDirection(yawDeg: number, pitchDeg: number): THREE.Vector3 {
  const yaw = (yawDeg * Math.PI) / 180;
  // Elevationswinkel: 0 = horizontal, positiv = Blick nach oben.
  const elevation = ((pitchDeg - 90) * Math.PI) / 180;
  const horizontal = Math.cos(elevation);
  return new THREE.Vector3(
    -Math.sin(yaw) * horizontal,
    Math.cos(yaw) * horizontal,
    Math.sin(elevation),
  );
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

  // Zweite Kamera für die orthografische Draufsicht: ohne Fluchtpunkt ist ein
  // Grad oben im Bild genauso groß wie unten, was beim Ablesen der Karte hilft.
  // up = y (Nord) zeigt nach Bildschirminhalt oben; von oben nach unten zu blicken
  // wäre mit up = z nicht möglich (Blickrichtung wäre parallel zu up).
  const orthoCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 5000);
  orthoCamera.up.set(0, 1, 0);

  let activeCamera: THREE.PerspectiveCamera | THREE.OrthographicCamera = camera;
  // OrbitControls merkt sich die up-Richtung der Kamera beim Erzeugen, deshalb
  // gehört zu jeder Kamera eigene Controls (beim Wechsel neu gebaut).
  let controls = createControls(activeCamera);

  function createControls(
    target: THREE.PerspectiveCamera | THREE.OrthographicCamera,
  ): OrbitControls {
    const instance = new OrbitControls(target, renderer.domElement);
    instance.enableDamping = true;
    if (target === orthoCamera) {
      instance.minZoom = ORTHO_MIN_ZOOM;
      instance.maxZoom = ORTHO_MAX_ZOOM;
    }
    return instance;
  }

  /** Zurück auf die Perspektivkamera (Ansichten „zurücksetzen"/„Ganze Karte"). */
  function usePerspectiveCamera(): void {
    if (activeCamera === camera) {
      return;
    }
    controls.dispose();
    activeCamera = camera;
    controls = createControls(camera);
  }

  const staticGroup = new THREE.Group();
  const dynamicGroup = new THREE.Group();
  // Eigene Gruppe: wird bei jedem rebuild von staticGroup verworfen, die
  // Kartentextur soll aber genau einmal geladen werden.
  const basemap = createBasemap();
  scene.add(staticGroup, dynamicGroup, basemap.group);
  void basemap.load(renderer);

  let palette = readPalette();
  // Das Gradnetz gehört nicht zu staticGroup: es liegt immer über der ganzen
  // Karte und würde bei jedem rebuild nur identisch entstehen.
  let graticule: GraticuleHandle = createGraticule(palette);
  scene.add(graticule.group);
  let darkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;

  let lastState:
    | { common: CommonParams; path: PathType; pathParams: ParamRecord; keys: SequenceKey[] }
    | undefined;
  let homePosition = new THREE.Vector3(120, 120, 120);
  let homeTarget = new THREE.Vector3(0, 0, 0);

  /**
   * Welteinheiten, die der Viewport-Höhe an der Position `position` entsprechen.
   * Bewusst je Beschriftung gerechnet (Entfernung Kamera -> Sprite), damit Texte
   * in unterschiedlicher Entfernung identisch groß auf dem Bildschirm erscheinen.
   * Bei der Orthografiekamera ist dieser Wert überall gleich.
   */
  function viewHeightWorldAt(position: THREE.Vector3): number {
    if (activeCamera === orthoCamera) {
      // Orthografisch gibt es keinen Fluchtpunkt: die Viewport-Höhe in
      // Welteinheiten ist in Bildtiefe gleich und hängt nur am zoom.
      return (orthoCamera.top - orthoCamera.bottom) / orthoCamera.zoom;
    }
    const distance = camera.position.distanceTo(position);
    return 2 * distance * Math.tan((camera.fov * Math.PI) / 360);
  }

  /** Alle Beschriftungen auf konstante Bildschirmgröße bringen (siehe label.ts). */
  function sizeLabels(): void {
    for (const group of [staticGroup, dynamicGroup]) {
      group.traverse((obj) => {
        if (obj instanceof THREE.Sprite) {
          scaleLabelSprite(obj, viewHeightWorldAt(obj.position));
        }
      });
    }
    graticule.updateLabels(viewHeightWorldAt);
  }

  /** Gradnetz in anderer Farbpalette bauen (Hell/Dunkel-Wechsel). */
  function rebuildGraticule(): void {
    graticule.dispose();
    scene.remove(graticule.group);
    graticule = createGraticule(palette);
    scene.add(graticule.group);
  }

  function rebuildStatic(): void {
    disposeObject(staticGroup);
    staticGroup.clear();
    const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (dark !== darkMode) {
      darkMode = dark;
      palette = readPalette();
      rebuildGraticule();
    }
    scene.background = new THREE.Color(palette.background);
    basemap.setPalette(palette.axis);

    // Achsen in voller Kartenausdehnung (Grad), Beschriftung am jeweiligen
    // Achsenende; das 10°-Gradnetz übernimmt das frühere, frei skalierte Gitter.
    addAxis(
      new THREE.Vector3(MAP_LON_MIN, 0, GRATICULE_Z),
      new THREE.Vector3(MAP_LON_MAX, 0, GRATICULE_Z),
      'Lon (x)',
      palette,
    );
    addAxis(
      new THREE.Vector3(0, MAP_LAT_MIN, GRATICULE_Z),
      new THREE.Vector3(0, MAP_LAT_MAX, GRATICULE_Z),
      'Lat (y)',
      palette,
    );
    addAxis(
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, AXIS_Z_HEIGHT),
      'z',
      palette,
    );
  }

  function addAxis(from: THREE.Vector3, to: THREE.Vector3, text: string, pal: Palette): void {
    const geometry = new THREE.BufferGeometry().setFromPoints([from, to]);
    const material = new THREE.LineBasicMaterial({ color: pal.axis });
    staticGroup.add(new THREE.Line(geometry, material));

    // Beschriftung ans Achsenende – ohne Kegel/Pfeilspitze, nur Linie + Text.
    const dir = to.clone().sub(from).normalize();
    const label = makeLabelSprite(text, pal);
    label.position.copy(to).addScaledVector(dir, AXIS_LABEL_OFFSET);
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

    // Keyframes als Punkte (dunkelrot), erster Key durch größere Kugel
    // hervorgehoben – ohne Nummerierung, gleiche Farbe wie die Verbindungslinie.
    const lastIndex = keys.length - 1;
    keys.forEach((key, i) => {
      const isFirst = i === 0;
      // Loop-Key: liegt exakt auf dem ersten Key -> halbtransparent, ohne
      // zweiten Blickrichtungs-Pfeil (wäre deckungsgleich) und ohne Beschriftung.
      const isLoopKey = i === lastIndex && i !== 0 && positions[i]?.equals(positions[0] ?? new THREE.Vector3());
      const pos = positions[i] ?? new THREE.Vector3();
      const material = new THREE.MeshBasicMaterial({ color: COLOR_KEY });
      if (isLoopKey) {
        material.transparent = true;
        material.opacity = 0.45;
      }
      const radius = Math.max(scale * 0.06, 0.35) * (isFirst ? 1.6 : 1);
      const sphere = new THREE.Mesh(new THREE.SphereGeometry(radius, 16, 12), material);
      sphere.position.copy(pos);
      dynamicGroup.add(sphere);

      if (isLoopKey) {
        return;
      }

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
    const isClosedPath = path.isClosed ? path.isClosed(common, pathParams as never) : false;
    // Loop-Option: Der letzte Key wiederholt den ersten. Der Spline schließt
    // sich dann von selbst; closed=true würde zusätzlich eine null-lange
    // Schleifensegment erzeugen (Singularität im centripetalen Catmull-Rom).
    const first = positions[0];
    const last = positions[positions.length - 1];
    const closesSelf =
      first !== undefined && last !== undefined && first.distanceTo(last) < 1e-6;
    const closed = isClosedPath && !closesSelf;
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

  /**
   * Kameraposition für eine Bounds berechnen. Die Blickrichtung ist fest, der
   * Abstand wird aus der projizierten Ausdehnung der Box ermittelt – so passt
   * sowohl eine kleine Kamerafahrt als auch die ganze Weltkarte.
   */
  function frameCamera(bounds: { min: THREE.Vector3; max: THREE.Vector3 }): void {
    const center = bounds.min.clone().add(bounds.max).multiplyScalar(0.5);
    const half = bounds.max.clone().sub(bounds.min).multiplyScalar(0.5);
    half.x = Math.max(half.x, 5);
    half.y = Math.max(half.y, 5);
    half.z = Math.max(half.z, 5);

    const dir = VIEW_DIRECTION;
    const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 0, 1), dir);
    if (right.lengthSq() < 1e-8) right.set(1, 0, 0);
    right.normalize();
    const up = new THREE.Vector3().crossVectors(dir, right).normalize();

    // Ausdehnung der Box entlang der Bildschirmachsen (Abschätzung über Beträge).
    const projected = (axis: THREE.Vector3): number =>
      Math.abs(axis.x) * half.x + Math.abs(axis.y) * half.y + Math.abs(axis.z) * half.z;
    const width = projected(right);
    const height = projected(up);
    const depth = projected(dir);

    const tanHalfFov = Math.tan((camera.fov * Math.PI) / 360);
    const distanceHeight = height / tanHalfFov;
    const distanceWidth = width / (tanHalfFov * Math.max(camera.aspect, 0.1));
    const distance = 1.1 * Math.max(distanceHeight, distanceWidth) + depth;

    homeTarget = center;
    homePosition = center.clone().addScaledVector(dir, distance);
  }

  function update(
    common: CommonParams,
    path: PathType,
    pathParams: ParamRecord,
    keys: SequenceKey[],
  ): void {
    lastState = { common, path, pathParams, keys };
    const bounds = computeBounds(common, keys);
    rebuildStatic();
    rebuildDynamic(common, path, pathParams, keys);
    frameCamera(bounds);
  }

  function resetView(): void {
    if (lastState) {
      frameCamera(computeBounds(lastState.common, lastState.keys));
    }
    usePerspectiveCamera();
    camera.position.copy(homePosition);
    controls.target.copy(homeTarget);
    controls.update();
  }

  function showWorld(): void {
    const bounds = worldBounds();
    bounds.max.z = AXIS_Z_HEIGHT; // damit die z-Achse mit Beschriftung im Bild bleibt
    frameCamera(bounds);
    usePerspectiveCamera();
    camera.position.copy(homePosition);
    controls.target.copy(homeTarget);
    controls.update();
  }

  /**
   * Orthografische Draufsicht auf die ganze Karte: Kamera direkt über der
   * Kartenmitte, Blick nach unten, Nord am oberen Rand. Anders als die beiden
   * anderen Ansichten bleibt diese Kamera senkrecht – gedreht wird trotzdem frei
   * über die Orbit-Controls.
   */
  function showTopView(): void {
    if (activeCamera !== orthoCamera) {
      controls.dispose();
      activeCamera = orthoCamera;
      controls = createControls(orthoCamera);
    }
    orthoCamera.zoom = 1;
    orthoCamera.position.set(0, 0, ORTHO_CAMERA_HEIGHT);
    controls.target.set(0, 0, GRATICULE_Z); // Drehpunkt auf dem Gradnetz
    fitOrthoToMap();
    controls.update();
  }

  /**
   * Siehbereich der Orthografiekamera aus der Kartenausdehnung und dem
   * Seitenverhältnis des Containers. Bewusst "cover": beide Richtungen müssen
   * passen, sonst wären die Gradzahlen am Rand abgeschnitten. Beim Ändern der
   * Fenstergröße neu berechnet, damit die Karte immer ganz zu sehen ist.
   */
  function fitOrthoToMap(): void {
    const halfLon = ((MAP_LON_MAX - MAP_LON_MIN) / 2) * ORTHO_FIT_MARGIN;
    const halfLat = ((MAP_LAT_MAX - MAP_LAT_MIN) / 2) * ORTHO_FIT_MARGIN;
    const aspect = (container.clientWidth || 1) / (container.clientHeight || 1);
    const halfHeight = halfLon / aspect > halfLat ? halfLon / aspect : halfLat;
    const halfWidth = halfHeight * aspect;
    orthoCamera.left = -halfWidth;
    orthoCamera.right = halfWidth;
    orthoCamera.top = halfHeight;
    orthoCamera.bottom = -halfHeight;
    orthoCamera.far = ORTHO_CAMERA_HEIGHT + 5000;
    orthoCamera.updateProjectionMatrix();
  }

  function resize(): void {
    const width = container.clientWidth || 1;
    const height = container.clientHeight || 1;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    fitOrthoToMap();
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
    sizeLabels();
    renderer.render(scene, activeCamera);
  });

  return { update, resetView, showWorld, showTopView };
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

# AGENTS.md – Met.3D Camera Sequence Generator

Anweisungen für Opencode (und andere Coding-Agenten) für dieses Repository.

## 0. Status & Arbeitsstand (Stand 2026-11-20)

Für einen Agenten, der ohne Gesprächskontext neu startet – hier steht, was bereits gilt:

- **Repository:** https://github.com/mikkel504/Met3DCamPlaner, Branch `main`
- **Live:** https://mikkel504.github.io/Met3DCamPlaner/ (Pages-Build-Source „GitHub Actions" ist aktiviert, Workflow läuft grün)
- **Vite `base`:** `/Met3DCamPlaner/` – muss exakt dem Repo-Namen entsprechen, sonst 404 auf Pages
- **Versionen (wegen lokale Node 18.13 gepinnt):** Vite ^5.4, Vitest ^2.1, three ^0.169,
  TypeScript ^5.5, ESLint ^9 + typescript-eslint ^8, `@types/node` ^20.
  `EBADENGINE`-Warnungen bei `npm install` sind harmlos; der CI-Workflow nutzt Node 20.
- **Grün:** 6 Testdateien / 56 Tests, `npm run lint`, `npm run build`
- **Umgesetzt:** Schritte 1–7 aus Abschnitt 11. **Offen:** Schritt 8
  (Halbkreis, Viertelkreis, Gerade – nur neue `PathType`-Dateien plus Registry-Eintrag).
- **Umgesetzt über die Ursprungsvorgabe hinaus:** Pitch wählbar automatisch/manuell
  (`autoPitch`, `src/core/pitch.ts`); Loop-Checkbox (`CommonParams.loop`, `src/core/loop.ts`
  hängt Kopie des ersten Keys an); UI-Default-Tension `0.05` (Referenzwert bleibt nur als
  `REFERENCE_TENSION_XML` für den Snapshot-Test); Typ-Erweiterungen
  `CommonParams.advanceTimestep`, `PathType.isClosed` / `validate` / `minKeyframes`,
  `ParamField.exclusiveMin`, `CommonField.kind: 'checkbox'` und `CommonField.disables`.
  Kartengrundlage in der 3D-Vorschau: `public/worldmap.jpg` (Natural Earth, equirektangulär,
  3240 × 1620 px, ~0,45 MB) als Ebene bei `z = 0`, immer an, ohne Einfluss auf die XML
  (`src/view3d/basemap.ts`). Das Original liegt als GeoTIFF außerhalb des Repos
  (`Desktop/HYP_LR_SR_W_DR/`, 393 MB) und ist auf die Web-Größe heruntergerechnet.
  Darüber 10°-Gradnetz über der ganzen Karte mit Randbeschriftung, die dauerhaft alle
  30° eine Gradzahl zeigt (`src/view3d/graticule.ts`; ersetzt GridHelper + Skalenmarken).
  Die Zahlen sitzen mittig auf der äußeren Randlinie (Breite am Westrand, Länge am Südrand)
  und tragen die Himmelsrichtungs-Endung (`30 N`, `30 S`, `30 E`, `30 W`; am 0° ohne Endung);
  die Ecke Süd-West trägt nur die Längenzahl, damit sich nichts überlagert.
  Achsen in Kartenausdehnung ohne Pfeilkegel, z-Achse 90 Einheiten hoch,
  Achsenbeschriftung am Achsenende. Alle Beschriftungen (Achsen wie Gradnetz) teilen sich
  den Baustein `src/view3d/label.ts` und sind damit in jeder Zoomstufe exakt gleich groß.
  `circle.ts` hat zwei Radien: `radius` (Halbachse Nord–Süd) und `radiusLon`
  (Halbachse Ost–West) – gleiche Werte = Kreis, verschiedene = Ellipse.
  Buttons „Ansicht zurücksetzen", „Ganze Karte" und „Orthografische Draufsicht" (zweite
  Kamera: Orthografie senkrecht über der Karte, Norden oben; die anderen beiden Buttons
  stellen die Perspektivkamera wieder her). Farben: Keyframes/Pfadlinie dunkelrot
  (ohne Nummerierung, keine Loop-Beschriftung), Blickrichtungspfeile dunkelblau,
  Fokuspunkt orange. UI-Schrift vergrößert (`html { font-size: 112.5% }`).
  Die Hilfetexte stehen **nicht** mehr dauerhaft unter den Feldern, sondern hinter einem
  (i)-Knopf an der Beschriftung: `buildLabelRow()` in `ui/form.ts` (einzige Stelle für
  Beschriftung + Knopf), CSS `.info-button` und `.field.help-open .help`.
  Die vier Bereiche (Fokuspunkt, Kamerafahrt, Kamera-Einstellungen, Export) sind
  **Klappgruppen** (`src/ui/collapsible.ts`, `<details>`/`<summary>`): standardmäßig zu,
  nur Export offen. Fehlerzahlen erscheinen als `.issue-badge` am Klappkopf (bleiben also
  sichtbar, wenn die Gruppe zu ist); die Statusmeldung des Exports sitzt ebenfalls im
  Klappkopf. Felder bleiben im DOM, Lesung/Validierung/Vorschau funktionieren unverändert.
- **Entfernt auf Wunsch (November 2026):** Checkbox „Längengrad-Verzerrung korrigieren"
  (`correctLonDistortion`) aus `circle.ts` – wurde nicht gebraucht. Nicht wieder einführen.
  Ebenso das **Fahrttyp-Dropdown** im Formular: mit nur einem aktiven Fahrttyp ist es eine
  Auswahl ohne Wahl. `ui/form.ts` baut das Menü jetzt nur noch, wenn die Registry zwei oder
  mehr aktive Typen enthält – für Schritt 8 muss daran nichts geändert werden.
- **In Met.3D verifiziert (Import-Test 2026-11-20):** `pitch = 90` = horizontal,
  `pitch > 90` blickt nach **oben**, `pitch < 90` nach **unten**. Die Auto-Pitch-Formel
  lautet deshalb `90 − atan2(Δz, Horizontaldistanz)` (Vorzeichen korrigiert).
- **Noch in Met.3D zu verifizieren** (siehe Abschnitt 4): yaw-Formel (Blick zum Fokuspunkt?).
  `reference/Base_Sequence.xml` wurde aus der Spezifikation rekonstruiert – exportierte
  Datei daher unbedingt einmal in Met.3D laden.
- **Lokal:** Dev-Server läuft auf 5173, ausnahmsweise 5174 wenn 5173 belegt ist;
  URL enthält immer den Basis-Pfad `/Met3DCamPlaner/`.

## 1. Projektziel

Eine statische Website, mit der Studierende **Kamerafahrten für Met.3D** konfigurieren, in einem **3D-Koordinatensystem** vorab ansehen und als **XML-Datei im Base_Sequence-Format** exportieren können.

- Läuft komplett im Browser (kein Backend), gehostet auf **GitHub Pages**.
- Zielgruppe: Studierende der Meteorologie, keine Webentwickler. UI muss selbsterklärend sein, Fehlermeldungen verständlich und auf **Deutsch**.
- **Version 1:** 360°-Kreisumrundung um einen Fokuspunkt.
- **Später:** Halbkreis, Viertelkreis, Gerade, ggf. Spirale. Die Architektur muss das ohne Umbau erlauben (siehe Abschnitt 5).

## 2. Rolle und Arbeitsweise

- Du agierst als Senior-Webentwickler: einfache, wartbare Lösungen vor cleveren.
- Arbeite in kleinen, einzeln nachvollziehbaren Schritten; nach jedem Schritt muss `npm run build` und `npm test` grün sein.
- Keine neuen Abhängigkeiten ohne kurze Begründung im PR/Commit.
- Keine Funktionen bauen, die nicht in diesem Dokument stehen (kein Login, keine Datenbank, kein Tracking).
- Bei Unklarheit zum Met.3D-Format: **nicht raten**, sondern die Annahmen in Abschnitt 4 prüfen und Rückfrage stellen.

## 3. Tech-Stack

| Bereich | Wahl |
|---|---|
| Build | Vite |
| Sprache | TypeScript (strict) |
| 3D-Vorschau | three.js (+ `OrbitControls`) |
| Tests | Vitest |
| UI | Vanilla TS + HTML/CSS (kein Framework) |
| Deployment | GitHub Actions → GitHub Pages |

Vite `base` muss auf den Repo-Namen gesetzt sein (`base: '/<repo-name>/'`), sonst laufen die Assets auf GitHub Pages nicht.

### Befehle

```bash
npm install
npm run dev       # lokaler Entwicklungsserver
npm run build     # Produktions-Build nach dist/
npm test          # Unit-Tests (Vitest)
npm run lint      # ESLint + tsc --noEmit
```

## 4. Ausgabeformat: Base_Sequence.xml (verbindlich)

Referenzdatei: `Base_Sequence.xml` (liegt im Repo unter `reference/Base_Sequence.xml`). Der Export muss **exakt dieser Struktur** folgen:

```xml
<!DOCTYPE CameraSequence>
<CameraSequence name="Sequence" tension="0.059999998658895493">
  <SequenceKey advanceTimestep="0" isOrthographic="0" label="" lat="50" lon="50" pitch="90" roll="0" transition="1" yaw="135" z="25"/>
  ...
</CameraSequence>
```

### Regeln

- Erste Zeile `<!DOCTYPE CameraSequence>` (kein `<?xml ...?>`-Header).
- Wurzelelement `CameraSequence` mit Attributen `name` und `tension`. UI-Default `tension="0.05"`, `name="Sequence"`; beides in der UI änderbar. Der Referenzwert `0.059999998658895493` steht nur noch als Konstante `REFERENCE_TENSION_XML` für den Snapshot-Test zur Verfügung.
- Pro Keyframe ein selbstschließendes `<SequenceKey .../>` mit **2 Leerzeichen Einrückung**.
- Attributreihenfolge **alphabetisch**, wie in der Referenz:
  `advanceTimestep, isOrthographic, label, lat, lon, pitch, roll, transition, yaw, z`
- Dateiende mit Zeilenumbruch, Encoding UTF-8, Dateiendung `.xml`.
- Zahlen: Punkt als Dezimaltrenner, auf max. 6 Nachkommastellen runden, keine wissenschaftliche Notation, ganze Zahlen ohne `.0` (`50`, nicht `50.0`; `-0` vermeiden).
- Attributwerte per XML-Escaping absichern (`&`, `<`, `>`, `"`), relevant für `label` und `name`.

### Bedeutung der Attribute

| Attribut | Bedeutung | Default |
|---|---|---|
| `lat`, `lon` | Kameraposition in Grad | berechnet |
| `z` | vertikale Kamerakoordinate (Einheit wie in Met.3D-Szene) | 25 |
| `yaw` | Blickrichtung horizontal, in Grad (0–360) | berechnet |
| `pitch` | Neigung der Kamera in Grad: 90 = horizontal, > 90 nach oben, < 90 nach unten (in Met.3D verifiziert) | 90 |
| `roll` | Rollwinkel | 0 |
| `transition` | Übergangsdauer zum nächsten Key | 1 |
| `advanceTimestep` | Zeitschritt-Vorlauf | 0 |
| `isOrthographic` | 0/1 | 0 |
| `label` | optionale Beschriftung | leer |

### Aus der Referenz abgeleitete Annahmen (müssen mit Met.3D verifiziert werden)

Die Referenzdatei hat 4 Keys auf einem Quadrat um (lat 0, lon 0) mit Kantenabstand 50° und jeweils Blick zur Mitte:

| Position | lat | lon | yaw |
|---|---|---|---|
| NO | 50 | 50 | 135 |
| SO | -50 | 50 | 45 |
| SW | -50 | -50 | 315 |
| NW | 50 | -50 | 225 |

Daraus folgt: **`yaw = (360 − Kompasspeilung zum Fokuspunkt) mod 360`** (Norden = 0°, Peilung im Uhrzeigersinn; yaw zählt also entgegen dem Uhrzeigersinn). Diese yaw-Formel gilt weiterhin als Annahme und ist beim Import zu prüfen.

**In Met.3D verifiziert (Import-Test 2026-11-20):** `pitch = 90` bedeutet „horizontal blickend", Werte > 90 blicken nach oben, Werte < 90 nach unten. Die Auto-Pitch-Berechnung lautet deshalb `pitch = 90 − atan2(cameraZ − focusZ, horizontale Distanz)`.

- Diese Formel und die Pitch-Bedeutung als **eine zentrale, getestete Funktion** (`computeYaw`) implementieren und im Code mit `// ANNAHME:` kommentieren.
- Ein Unit-Test muss die vier Referenz-Keys exakt reproduzieren.
- Im README einen Hinweis aufnehmen: „Exportierte Datei einmal in Met.3D laden und prüfen.“

## 5. Architektur

```
/
├─ AGENTS.md
├─ README.md
├─ reference/Base_Sequence.xml
├─ public/worldmap.jpg     # Kartengrundlage (Natural Earth, equirektangulär)
├─ index.html
├─ vite.config.ts
├─ .github/workflows/deploy.yml
└─ src/
   ├─ core/                 # reine Logik, KEIN DOM, KEIN three.js
   │  ├─ types.ts
   │  ├─ constants.ts       # Defaults (u. a. DEFAULT_TENSION_XML, DEFAULT_LOOP)
   │  ├─ fields.ts          # COMMON_FIELDS / COMMON_DEFAULTS (_basis für UI-Felder)
   │  ├─ paths/
   │  │  ├─ index.ts        # Registry aller Pfadtypen
   │  │  └─ circle.ts       # Voll-/Teilkreis, Kreis/Ellipse (radius + radiusLon)
   │  ├─ yaw.ts             # computeYaw
   │  ├─ pitch.ts           # computeAutoPitch
   │  ├─ loop.ts            # applyLoop (Option: Key am Ende wiederholt den ersten)
   │  ├─ xml.ts             # buildSequenceXml
   │  └─ validate.ts
   ├─ ui/                   # Formular, Download-Button, Fehleranzeige
   │  ├─ form.ts            # Felder aus core-Metadaten, (i)-Knöpfe, Fehler am Feld
   │  ├─ collapsible.ts     # <details>/<summary>-Abschnitt (Gruppen + Export)
   │  └─ export.ts          # XML-Vorschau, Download, Zwischenablage
   ├─ view3d/               # three.js-Szene, Achsen, Pfad, Keyframe-Marker
   │  ├─ preview.ts
   │  ├─ basemap.ts         # Weltkarte als Ebene bei z = 0
   │  ├─ graticule.ts       # 10°-Gradnetz (ganze Karte) + Gradzahlen auf der Randlinie
   │  └─ label.ts           # gemeinsamer Baustein für alle Text-Sprites (einheitliche Größe)
   └─ main.ts
```

**Grundregel:** `core/` ist rein funktional und vollständig getestet. `ui/` und `view3d/` konsumieren nur dessen Ausgabe.

### Kerntypen (Vorgabe)

```ts
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
  focusLat: number;   // Fokuspunkt, Grad
  focusLon: number;
  focusZ: number;
  cameraZ: number;    // Kamerahöhe
  keyframeCount: number;
  pitch: number;
  roll: number;
  transition: number;
  tension: number;
  name: string;
}

export interface PathType<P> {
  id: string;                         // z. B. "circle"
  label: string;                      // Anzeigename (Deutsch)
  paramSchema: ParamField[];          // beschreibt zusätzliche UI-Felder
  defaults: P;
  generate(common: CommonParams, params: P): SequenceKey[];
}
```

### Erweiterbarkeit (wichtig)

Neue Kamerafahrten (Halbkreis, Viertel, Gerade …) werden **ausschließlich** als neue `PathType`-Datei in `core/paths/` plus Eintrag in der Registry hinzugefügt. UI-Felder werden aus `paramSchema` generiert; **kein** Fahrtyp-spezifischer Code in `ui/` oder `view3d/`. Ein Halbkreis ist technisch ein Kreis mit `startAngle` und `sweepAngle`; deshalb `circle.ts` bereits mit diesen beiden Parametern implementieren (V1-Defaults: `startAngle = 0`, `sweepAngle = 360`).

## 6. Funktionale Anforderungen

### 6.1 Eingaben (V1)

- Fokuspunkt: Breitengrad, Längengrad, (optional) Höhe `focusZ`
- Radius (in Grad, siehe 6.2) – zwei Felder: `radius` (Halbachse Nord–Süd) und
  `radiusLon` (Halbachse Ost–West); gleiche Werte = Kreis, verschiedene = Ellipse
- Kamerahöhe `z`
- Anzahl der Keyframes
- Startwinkel, Umlaufrichtung (im / gegen den Uhrzeigersinn)
- `pitch`, `roll`, `transition`, `advanceTimestep`, `tension`, `name`
- `pitch` wahlweise automatisch aus dem Höhenunterschied zum Fokuspunkt berechnet
  (Checkbox „Pitch automatisch berechnen“, Default **aus** = ein manueller Wert für alle Keys);
  bei automatisch ist das Pitch-Feld deaktiviert
- Checkbox „Geschlossener Loop" (Default **aus**): hängt am Ende eine exakte Kopie des ersten
  Keyframes an, damit die Fahrt zum Start zurückkehrt. Wird zentral in `core/loop.ts` nach
  `path.generate()` angewendet, damit die PathTypes frei von Fahrttyp-unabhängiger Logik bleiben
- Auswahl der Kamerafahrt: Die Registry in `core/paths/` entscheidet. Mit nur einem aktiven
  Fahrttyp rendert `ui/form.ts` **kein** Dropdown (Auswahl ohne Wahl); erst ab zwei aktiven
  Typen erscheint das Menü automatisch

Alle Eingaben mit sinnvollen Defaults vorbelegen, sodass der Export ohne Änderung sofort funktioniert.

### 6.2 Kreisberechnung

- Winkel `θᵢ = startAngle + dir · i · sweep / N`
- Bei Vollkreis (`sweep = 360`) **ohne** doppelten Endpunkt: `N` Keys, Schrittweite `360 / N`. Bei Teilkreisen (`sweep < 360`) `N − 1` Intervalle, sodass Start- und Endpunkt enthalten sind.
- Position: `lat = focusLat + r · sin θ`, `lon = focusLon + r₂ · cos θ` (Radien in Grad in der Kartenebene wie in der Referenz; `r = radius`, `r₂ = radiusLon`, identische Werte ergeben einen Kreis).
  Eine `cos(lat)`-Korrektur des Längengrads wurde im November 2026 **entfernt** – Referenzdatei und
  Vorschau rechnen beide in Grad der Kartenebene, die Option wurde nicht gebraucht.
- `yaw` je Key über `computeYaw(Kameraposition → Fokuspunkt)`.
- Mindestens 3 Keyframes bei Vollkreis, mindestens 2 bei Teilkreis/Gerade.

### 6.3 3D-Vorschau

- three.js-Szene mit beschrifteten Achsen: **Lon (x), Lat (y), z (Höhe)**. Die Achsen
  spannen die Kartenausdehnung auf (nur Linien, keine Pfeilkegel), die z-Achse ist
  90 Einheiten hoch, jede Achsenbeschriftung sitzt am Ende der Achse. Alle Texte
  (Achsen wie Gradnetz) nutzen den gemeinsamen Baustein `view3d/label.ts` und sind damit
  in jeder Zoomstufe gleich groß. Das 10°-Gradnetz (`view3d/graticule.ts`)
  deckt die ganze Karte ab (`lon -180…180`, `lat -90…90`), Äquator und Null-Meridian
  stärker; die Gradzahl steht dauerhaft alle 30° mittig auf der äußeren Randlinie
  (Lon am Südrand, Lat am Westrand) mit Himmelsrichtungs-Endung (`30 N`, `30 S`,
  `150 E`, `120 W`, am 0° ohne Endung) – es ersetzt das frühere frei skalierte Gitter
  mit Skalenmarken.
- Darstellung: Fokuspunkt (orange Oktaeder), Keyframes (Punkte ohne Nummerierung,
  dunkelrot, erster Key mit größerer Kugel, Loop-Key halbtransparent ohne Beschriftung),
  interpolierter Pfad als Linie (dunkelrot), Blickrichtung je Key als kurzer Pfeil (dunkelblau).
- Pfadlinie über Catmull-Rom-Spline (`THREE.CatmullRomCurve3`, `centripetal`/`tension` passend), nur als Näherung der Met.3D-Interpolation; im UI mit Hinweis kennzeichnen.
- Orbit-Controls (drehen, zoomen, verschieben), Buttons „Ansicht zurücksetzen" (rahmt die
  Kamerafahrt), „Ganze Karte" (rahmt die ganze Weltkarte, damit alle Randwerte sichtbar sind)
  und „Orthografische Draufsicht" (zweite, orthografische Kamera senkrecht über der Karte,
  Norden oben, Siehbereich „cover“ auf die ganze Karte). Die beiden ersten Buttons schalten
  zurück auf die Perspektivkamera. `camera.up` ist pro Kamera unterschiedlich (Perspektive z,
  Orthografie y), deshalb werden die OrbitControls beim Kamerawechsel neu gebaut.
- Vorschau aktualisiert sich **live** bei jeder Eingabeänderung (Debounce ca. 100 ms).
- Ein Z-up-Koordinatensystem verwenden (`camera.up.set(0, 0, 1)`), damit z der Höhe entspricht.
- Kartengrundlage: equirektanguläre Weltkarte aus `public/` als Textur auf einer Ebene bei
  `z = 0` (immer an, rein visuell, kein Einfluss auf die XML; das Gradnetz liegt bei
  `GRATICULE_Z = 0.5` darüber). Die Karte spannt exakt
  `lon -180…180` / `lat -90…90` auf – bei unseren Grad-Achsen (360 × 180 Einheiten) ist das
  verzerrungsfrei. Implementiert in `view3d/basemap.ts`, bei Ladefehler bleibt die Vorschau
  ohne Karte funktionsfähig.

### 6.4 Export

- Button „XML herunterladen“ → Datei `<name>.xml` über `Blob` + `URL.createObjectURL`.
- Zusätzlich: Textfeld mit XML-Vorschau und Button „In Zwischenablage kopieren“.
- Dateiname bereinigen (nur `[A-Za-z0-9_-]`, sonst `_`).
- Export ist deaktiviert, solange Validierungsfehler bestehen.

### 6.5 Validierung (`core/validate.ts`)

- Breitengrad −90…90, Längengrad −180…180 (Hinweis, falls Kamerapositionen außerhalb liegen)
- Radius > 0, Keyframe-Anzahl ganzzahlig und im sinnvollen Bereich (z. B. 2–360)
- Alle Zahlenfelder endlich (kein `NaN`, kein leeres Feld)
- Fehlermeldungen direkt am Feld, deutsch, mit konkretem Hinweis („Breitengrad muss zwischen −90 und 90 liegen.“)

## 7. Tests (verpflichtend)

Mit Vitest in `src/core/**/*.test.ts`:

1. `computeYaw` reproduziert die vier Referenzwerte (135 / 45 / 315 / 225).
2. `circle.generate` erzeugt bei Vollkreis `N` Keys, ohne doppelten Start-/Endpunkt, alle Keys haben gleichen Abstand zum Fokuspunkt.
3. `buildSequenceXml` liefert für die Referenz-Keys einen **Byte-identischen** Output zu `reference/Base_Sequence.xml` (Snapshot-Test).
4. Zahlenformatierung (`50`, `-0` → `0`, `12.345678`).
5. XML-Escaping in `label` und `name`.
6. Validierung: jeder Fehlerfall mindestens ein Test.
7. Auto-Pitch: Kamera über dem Fokus ergibt `pitch < 90` (Blick nach unten), unter dem Fokus `> 90`.
8. `applyLoop`: mit Loop `N+1` Keys, letzter ist eine exakte Kopie des ersten; ohne Loop unverändert.
9. Ellipse: `radius` wirkt auf `lat`, `radiusLon` auf `lon`; bei ungleichen Radien liegen alle
   Keys auf der Ellipsengleichung, und die Validierung lehnt `radiusLon <= 0` ab.

## 8. UI/UX-Richtlinien

- Einspaltiges Formular links, 3D-Vorschau rechts (auf schmalen Bildschirmen untereinander).
- Gruppierung: „Fokuspunkt“, „Kamerafahrt“, „Kamera-Einstellungen“, „Export“. Alle vier
  Bereiche sind Klappgruppen (`src/ui/collapsible.ts`, `<details>`/`<summary>`): standardmäßig
  zugeklappt, nur „Export“ offen. Fehlerzahlen erscheinen als `span.issue-badge` am Klappkopf,
  damit sie bei zugeklappter Gruppe sichtbar bleiben; die Felder bleiben im DOM, Lesung und
  Validierung funktionieren daher unverändert.
- Jedes Feld mit Einheit und Erklärung; die Erklärung steckt hinter einem (i)-Knopf an der
  Beschriftung (ein-/ausklappbar, echtes `<button>` mit `aria-expanded`/`aria-controls`,
  `Esc` schließt) und steht **nicht** dauerhaft unter dem Feld – das hält das Formular kompakt.
- Beschriftungen und Hilfetexte auf Deutsch; Code, Variablen und Commit-Messages auf Englisch.
- Barrierefrei: `<label for>`, Tastaturbedienung, ausreichender Kontrast, Hell/Dunkel über `prefers-color-scheme`.

## 9. Code-Konventionen

- TypeScript `strict: true`, kein `any`.
- Winkel intern in **Grad** halten, Umrechnung in Radiant nur lokal in der Berechnung.
- Keine Magic Numbers; Konstanten (z. B. Default-Tension) in `core/constants.ts`.
- Funktionen klein halten, Seiteneffekte nur in `ui/` und `view3d/`.
- Kommentare erklären das *Warum*, nicht das *Was*.
- Commits nach Conventional Commits (`feat:`, `fix:`, `test:`, `docs:`).

## 10. Deployment (GitHub Pages)

- Workflow `.github/workflows/deploy.yml`: bei Push auf `main` → `npm ci` → `npm test` → `npm run build` → Upload `dist/` mit `actions/upload-pages-artifact` → `actions/deploy-pages`.
- Berechtigungen im Workflow: `pages: write`, `id-token: write`, `contents: read`.
- In den Repo-Einstellungen: *Settings → Pages → Source: GitHub Actions*.
- Keine externen CDNs zur Laufzeit; three.js wird über npm gebündelt (funktioniert dann auch offline nach dem ersten Laden).

## 11. Umsetzungsreihenfolge

1. Projekt-Setup (Vite, TS, Vitest, ESLint, Deploy-Workflow, leere Seite live auf Pages).
2. `core/`: Typen, `computeYaw`, `xml.ts`, Referenz-Snapshot-Test.
3. `core/paths/circle.ts` inkl. Tests und Registry.
4. UI-Formular mit Validierung und XML-Download.
5. `view3d/`: Achsen, Fokuspunkt, Keyframes, Pfad, Blickrichtungspfeile.
6. Live-Kopplung Formular → Vorschau/XML.
7. README (Bedienung, Hinweis zur Verifikation in Met.3D, Screenshots).
8. Erweiterung: Halbkreis, Viertelkreis, Gerade (nur neue `PathType`-Dateien).

## 12. Definition of Done (je Aufgabe)

- Build und Tests grün, Lint ohne Fehler.
- Exportierte XML-Datei stimmt formal mit `reference/Base_Sequence.xml` überein.
- Funktion auf der live geschalteten GitHub-Pages-URL geprüft.
- README/AGENTS.md aktualisiert, falls sich Verhalten oder Struktur geändert haben.

## 13. Nicht-Ziele

- Kein Import/Bearbeiten bestehender XML-Dateien (frühestens später als eigene Aufgabe).
- Keine Anbindung an Met.3D oder Wetterdaten.
- Keine serverseitige Logik.

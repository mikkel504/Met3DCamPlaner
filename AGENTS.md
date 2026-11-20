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
- **Grün:** 5 Testdateien / 47 Tests, `npm run lint`, `npm run build`
- **Umgesetzt:** Schritte 1–7 aus Abschnitt 11. **Offen:** Schritt 8
  (Halbkreis, Viertelkreis, Gerade – nur neue `PathType`-Dateien plus Registry-Eintrag).
- **Umgesetzt über die Ursprungsvorgabe hinaus:** Pitch wählbar automatisch/manuell
  (`autoPitch`, `src/core/pitch.ts`); Typ-Erweiterungen `CommonParams.advanceTimestep`,
  `PathType.isClosed` / `validate` / `minKeyframes`, `ParamField.exclusiveMin`,
  `CommonField.kind: 'checkbox'` und `CommonField.disables`.
- **Noch in Met.3D zu verifizieren** (siehe Abschnitt 4): yaw-Formel, Bedeutung von
  `pitch = 90`, Auto-Pitch-Formel `90 + atan2(Δz, Horizontaldistanz)`.
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
- Wurzelelement `CameraSequence` mit Attributen `name` und `tension`. Default `tension="0.059999998658895493"`, `name="Sequence"`; beides in der UI änderbar.
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
| `pitch` | Neigung der Kamera in Grad | 90 |
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

Daraus folgt: **`yaw = (360 − Kompasspeilung zum Fokuspunkt) mod 360`** (Norden = 0°, Peilung im Uhrzeigersinn; yaw zählt also entgegen dem Uhrzeigersinn). `pitch = 90` bedeutet in der Referenz vermutlich „horizontal blickend“.

- Diese Formel und die Pitch-Bedeutung als **eine zentrale, getestete Funktion** (`computeYaw`) implementieren und im Code mit `// ANNAHME:` kommentieren.
- Ein Unit-Test muss die vier Referenz-Keys exakt reproduzieren.
- Im README einen Hinweis aufnehmen: „Exportierte Datei einmal in Met.3D laden und prüfen.“

## 5. Architektur

```
/
├─ AGENTS.md
├─ README.md
├─ reference/Base_Sequence.xml
├─ index.html
├─ vite.config.ts
├─ .github/workflows/deploy.yml
└─ src/
   ├─ core/                 # reine Logik, KEIN DOM, KEIN three.js
   │  ├─ types.ts
   │  ├─ paths/
   │  │  ├─ index.ts        # Registry aller Pfadtypen
   │  │  └─ circle.ts       # V1: Vollkreis
   │  ├─ yaw.ts             # computeYaw
   │  ├─ xml.ts             # buildSequenceXml
   │  └─ validate.ts
   ├─ ui/                   # Formular, Download-Button, Fehleranzeige
   ├─ view3d/               # three.js-Szene, Achsen, Pfad, Keyframe-Marker
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
- Radius (in Grad, siehe 6.2)
- Kamerahöhe `z`
- Anzahl der Keyframes
- Startwinkel, Umlaufrichtung (im / gegen den Uhrzeigersinn)
- `pitch`, `roll`, `transition`, `advanceTimestep`, `tension`, `name`
- `pitch` wahlweise automatisch aus dem Höhenunterschied zum Fokuspunkt berechnet
  (Checkbox „Pitch automatisch berechnen“, Default **aus** = ein manueller Wert für alle Keys);
  bei automatisch ist das Pitch-Feld deaktiviert
- Auswahl der Kamerafahrt (Dropdown, V1 nur „360°-Kreis“, weitere ausgegraut mit Hinweis „folgt“)

Alle Eingaben mit sinnvollen Defaults vorbelegen, sodass der Export ohne Änderung sofort funktioniert.

### 6.2 Kreisberechnung

- Winkel `θᵢ = startAngle + dir · i · sweep / N`
- Bei Vollkreis (`sweep = 360`) **ohne** doppelten Endpunkt: `N` Keys, Schrittweite `360 / N`. Bei Teilkreisen (`sweep < 360`) `N − 1` Intervalle, sodass Start- und Endpunkt enthalten sind.
- Position: `lat = focusLat + r · sin θ`, `lon = focusLon + r · cos θ` (Radius in Grad in der Kartenebene wie in der Referenz).
- Optionale Checkbox „Längengrad-Verzerrung korrigieren“ (`lon`-Offset durch `cos(lat)` teilen), Default **aus**.
- `yaw` je Key über `computeYaw(Kameraposition → Fokuspunkt)`.
- Mindestens 3 Keyframes bei Vollkreis, mindestens 2 bei Teilkreis/Gerade.

### 6.3 3D-Vorschau

- three.js-Szene mit beschrifteten Achsen: **Lon (x), Lat (y), z (Höhe)**, Gitterfläche (Grid) und Skalenmarken.
- Darstellung: Fokuspunkt (auffälliger Marker), Keyframes (nummerierte Punkte, erster Key farblich hervorgehoben), interpolierter Pfad als Linie, Blickrichtung je Key als kurzer Pfeil.
- Pfadlinie über Catmull-Rom-Spline (`THREE.CatmullRomCurve3`, `centripetal`/`tension` passend), nur als Näherung der Met.3D-Interpolation; im UI mit Hinweis kennzeichnen.
- Orbit-Controls (drehen, zoomen, verschieben), Button „Ansicht zurücksetzen“.
- Vorschau aktualisiert sich **live** bei jeder Eingabeänderung (Debounce ca. 100 ms).
- Ein Z-up-Koordinatensystem verwenden (`camera.up.set(0, 0, 1)`), damit z der Höhe entspricht.

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

## 8. UI/UX-Richtlinien

- Einspaltiges Formular links, 3D-Vorschau rechts (auf schmalen Bildschirmen untereinander).
- Gruppierung: „Fokuspunkt“, „Kamerafahrt“, „Kamera-Einstellungen“, „Export“.
- Jedes Feld mit Einheit und Tooltip-Erklärung (z. B. „Anzahl Keyframes: Mehr Keyframes ergeben eine glattere Fahrt.“).
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

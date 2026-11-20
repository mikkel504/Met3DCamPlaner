# Met.3D Kamerafahrten – Generator

Statische Website, mit der **Kamerafahrten für [Met.3D](https://met3d.dkrz.de/)** konfiguriert, in einer
3D-Vorschau geprüft und als **XML-Datei im `Base_Sequence`-Format** exportiert werden können.

- **Live:** https://mikkel504.github.io/Met3DCamPlaner/ · Quellcode: https://github.com/mikkel504/Met3DCamPlaner
- Läuft komplett im Browser (kein Backend), gehostet auf GitHub Pages.
- Version 1: **360°-Kreisumrundung** um einen Fokuspunkt. Halbkreis/Viertelkreis sind über
  „Umlaufwinkel" bereits möglich; weitere Fahrttypen (Gerade …) folgen als eigene `PathType`-Dateien.

## Bedienung

1. **Fokuspunkt** – Breite (Lat), Länge (Lon) und Höhe des Punktes, um den die Kamera fliegt.
2. **Kamerafahrt** – Fahrttyp wählen, Radius (in Grad der Kartenebene), Startwinkel,
   Umlaufwinkel (360° = voller Kreis, 180° = Halbkreis), Umlaufrichtung, optional
   „Längengrad-Verzerrung korrigieren".
3. **Kamera-Einstellungen** – Kamerahöhe `z`, Anzahl Keyframes, „Geschlossener Loop",
   Pitch (automatisch oder manuell, siehe unten), Roll, Transition, `advanceTimestep`,
   Name und Tension der Kurve (Standard `0.05`).
   „Geschlossener Loop" hängt am Ende einen zusätzlichen Keyframe exakt auf dem ersten an,
   damit die Fahrt in Met.3D nahtlos zum Start zurückkehrt; die Anzahl Keyframes beschreibt
   nur die Punkte auf der Bahn, der Loop-Key kommt zusätzlich dazu.
   „Pitch automatisch berechnen" neigt die Kamera je Keyframe so, dass sie vom Höhenunterschied
   her genau auf den Fokuspunkt blickt; ohne Anhaken wird der manuell eingetragene Pitch für
   alle Keyframes verwendet.
4. **3D-Vorschau** (rechts) aktualisiert sich live: Kartengrundlage (Weltkarte), Fokuspunkt
   (pink), Keyframes (nummeriert, erster Key orange), Pfadlinie und Blickrichtungspfeile.
   Drehen/Zoomen mit der Maus, „Ansicht zurücksetzen" stellt die Ansicht wieder her, die die
   ganze Kamerafahrt zeigt (nicht die ganze Welt).
5. **Export** – „XML herunterladen" speichert `<name>.xml`; alternativ „In Zwischenablage
   kopieren". Die XML-Vorschau zeigt den exakten Dateiinhalt. Export ist deaktiviert,
   solange Validierungsfehler vorliegen.

Alle Felder sind mit sinnvollen Defaults vorbelegt – der Export funktioniert ohne Änderungen.

> **Wichtig:** Exportierte Datei einmal in Met.3D laden und prüfen.

## Format `Base_Sequence.xml`

Der Export folgt exakt der Referenzstruktur (`reference/Base_Sequence.xml`):

```xml
<!DOCTYPE CameraSequence>
<CameraSequence name="Sequence" tension="0.05">
  <SequenceKey advanceTimestep="0" isOrthographic="0" label="" lat="50" lon="50" pitch="90" roll="0" transition="1" yaw="135" z="25"/>
</CameraSequence>
```

- Attributreihenfolge alphabetisch, 2 Leerzeichen Einrückung, UTF-8, Dezimaltrenner Punkt.
- Ein Unit-Test vergleicht den Export der Referenz-Keys **Byte für Byte** mit der Referenzdatei.

### Annahmen und verifizierte Konventionen

- `yaw = (360 − Kompasspeilung zum Fokuspunkt) mod 360` (Norden = 0°), abgeleitet aus den vier
  Referenz-Keys (135 / 45 / 315 / 225). Implementiert in `src/core/yaw.ts` (`// ANNAHME:`).
  Beim Import der Testdatei bitte mitprüfen: die Blickrichtungspfeile in der Vorschau zeigen
  auf den Fokuspunkt.
- `pitch = 90` bedeutet „horizontal blickend"; **in Met.3D verifiziert (Import-Test
  November 2026)**: Werte > 90° blicken nach oben, Werte < 90° nach unten.
  Dieselbe Konvention verwendet die automatische Pitch-Berechnung
  (`pitch = 90 − atan2(cameraZ − focusZ, horizontale Distanz)`, `src/core/pitch.ts`) –
  die Kamera blickt vom Höhenunterschied her genau auf den Fokuspunkt.
- Radius wird wie in der Referenz in **Grad** der Kartenebene gerechnet
  (`lat = focus + r·sin θ`, `lon = focus + r·cos θ`); Startwinkel 0° = Osten.
- Die „Längengrad-Verzerrung korrigieren"-Option teilt den Lon-Abstand durch cos(Breite)
  (Standard: aus).
- Die Pfadlinie in der Vorschau ist eine Catmull-Rom-Näherung und kann von der
  Interpolation in Met.3D abweichen.
- Die Vorschau ist eine **ebene** Kartenebene (x = Lon, y = Lat in Grad), Met.3D zeigt die Erde
  als **Globus**. Für kleine Radii (einige Grad) ist das praktisch identisch; bei großen
  Radien (wie in der Referenzdatei mit 50°-Abständen) ist der ebene Kreis auf der Karte etwas
  anderes als die Bahn auf dem Globus – die Vorschau ist eine Kartendarstellung, keine
  Globus-Simulation.

## Kartengrundlage (Weltkarte)

Die 3D-Vorschau liegt dauerhaft auf einer equirektangulären Weltkarte:
`public/worldmap.jpg` (Natural Earth, *Cross Blended Hypso with Shaded Relief, Water, and
Drainages*, Public Domain, 3240 × 1620 px, ~0,45 MB). Eingebaut in `src/view3d/basemap.ts`,
unsichtbar bis die Textur geladen ist – ohne die Karte funktioniert die Vorschau weiter.

- Die Karte sitzt auf einer Ebene bei `z = −1` (damit Gitter und Achsen nie mit der Textur
  zocken) und spannt exakt `lon −180…180`, `lat −90…90` auf. Sie ist **nur visuell** und hat
  keinen Einfluss auf die exportierte XML.
- Warum das ohne Verzerrung passt: ein equirektangulaires Kartenbild ist 2:1 (360° zu 180°),
  und unsere Ebene ist in Grad gemessen ebenfalls 360 × 180 Einheiten. „2:1-Bild" und
  „1:1-Grad-Achse" sind also dieselbe Projektion – es muss nichts umgerechnet werden.
- Andere Karte verwenden: eigene (equirektanguläre!) Datei unter `public/` ablegen und
  `BASEMAP_FILE` in `src/view3d/basemap.ts` anpassen. Zeigt die PNG/TIF nur einen
  Ausschnitt, müssen `LON_SPAN`/`LAT_SPAN` (und die Lage der Ebene) entsprechend gesetzt
  werden. Als Dateiformat ist JPEG für Fotokarten deutlich kleiner als PNG.

## Entwicklung

```bash
npm install
npm run dev       # lokaler Entwicklungsserver
npm run build     # Produktions-Build nach dist/
npm test          # Unit-Tests (Vitest)
npm run lint      # ESLint + tsc --noEmit
```

**Struktur:** `src/core/` ist reine, vollständig getestete Logik (Typen, `computeYaw`,
Kreisgenerierung, XML-Aufbau, Validierung). `src/ui/` (Formular aus Feld-Metadaten) und
`src/view3d/` (three.js-Vorschau, Z-up: x=Lon, y=Lat, z=Höhe) konsumieren nur deren Ausgabe.
Neue Kamerafahrten werden ausschließlich als neue `PathType`-Datei in `src/core/paths/`
plus Registry-Eintrag ergänzt – ohne Änderungen in UI oder Vorschau.

## Deployment

GitHub Actions (`.github/workflows/deploy.yml`) baut bei Push auf `main` und veröffentlicht
`dist/` auf GitHub Pages. Vite-`base` muss dem Repo-Namen entsprechen (`/Met3DCamPlaner/`).

# Met.3D Kamerafahrten – Generator

Statische Website, mit der **Kamerafahrten für [Met.3D](https://met3d.dkrz.de/)** konfiguriert, in einer
3D-Vorschau geprüft und als **XML-Datei im `Base_Sequence`-Format** exportiert werden können.

- Läuft komplett im Browser (kein Backend), gehostet auf GitHub Pages.
- Version 1: **360°-Kreisumrundung** um einen Fokuspunkt. Halbkreis/Viertelkreis sind über
  „Umlaufwinkel" bereits möglich; weitere Fahrttypen (Gerade …) folgen als eigene `PathType`-Dateien.

## Bedienung

1. **Fokuspunkt** – Breite (Lat), Länge (Lon) und Höhe des Punktes, um den die Kamera fliegt.
2. **Kamerafahrt** – Fahrttyp wählen, Radius (in Grad der Kartenebene), Startwinkel,
   Umlaufwinkel (360° = voller Kreis, 180° = Halbkreis), Umlaufrichtung, optional
   „Längengrad-Verzerrung korrigieren".
3. **Kamera-Einstellungen** – Kamerahöhe `z`, Anzahl Keyframes, Pitch (automatisch oder
   manuell, siehe unten), Roll, Transition, `advanceTimestep`, Name und Tension der Kurve.
   „Pitch automatisch berechnen" neigt die Kamera je Keyframe so, dass sie vom Höhenunterschied
   her genau auf den Fokuspunkt blickt; ohne Anhaken wird der manuell eingetragene Pitch für
   alle Keyframes verwendet.
4. **3D-Vorschau** (rechts) aktualisiert sich live: Fokuspunkt (pink), Keyframes (nummeriert,
   erster Key orange), Pfadlinie und Blickrichtungspfeile. Drehen/Zoomen mit der Maus,
   „Ansicht zurücksetzen" stellt die Standardansicht wieder her.
5. **Export** – „XML herunterladen" speichert `<name>.xml`; alternativ „In Zwischenablage
   kopieren". Die XML-Vorschau zeigt den exakten Dateiinhalt. Export ist deaktiviert,
   solange Validierungsfehler vorliegen.

Alle Felder sind mit sinnvollen Defaults vorbelegt – der Export funktioniert ohne Änderungen.

> **Wichtig:** Exportierte Datei einmal in Met.3D laden und prüfen.

## Format `Base_Sequence.xml`

Der Export folgt exakt der Referenzstruktur (`reference/Base_Sequence.xml`):

```xml
<!DOCTYPE CameraSequence>
<CameraSequence name="Sequence" tension="0.059999998658895493">
  <SequenceKey advanceTimestep="0" isOrthographic="0" label="" lat="50" lon="50" pitch="90" roll="0" transition="1" yaw="135" z="25"/>
</CameraSequence>
```

- Attributreihenfolge alphabetisch, 2 Leerzeichen Einrückung, UTF-8, Dezimaltrenner Punkt.
- Ein Unit-Test vergleicht den Export der Referenz-Keys **Byte für Byte** mit der Referenzdatei.

### Getroffene Annahmen (mit Met.3D zu verifizieren)

- `yaw = (360 − Kompasspeilung zum Fokuspunkt) mod 360` (Norden = 0°), abgeleitet aus den vier
  Referenz-Keys (135 / 45 / 315 / 225). Implementiert in `src/core/yaw.ts` (`// ANNAHME:`).
- `pitch = 90` bedeutet „horizontal blickend". Größere Werte neigen nach unten, kleinere nach
  oben – dieselbe Konvention verwendet die automatische Pitch-Berechnung
  (`pitch = 90 + atan2(cameraZ − focusZ, horizontale Distanz)`, `src/core/pitch.ts`).
  Beim Testen in Met.3D ggf. das Vorzeichen prüfen.
- Radius wird wie in der Referenz in **Grad** der Kartenebene gerechnet
  (`lat = focus + r·sin θ`, `lon = focus + r·cos θ`); Startwinkel 0° = Osten.
- Die „Längengrad-Verzerrung korrigieren"-Option teilt den Lon-Abstand durch cos(Breite)
  (Standard: aus).
- Die Pfadlinie in der Vorschau ist eine Catmull-Rom-Näherung und kann von der
  Interpolation in Met.3D abweichen.

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

/**
 * Export-Bereich: XML-Vorschau, "In Zwischenablage kopieren" und
 * "XML herunterladen". Der Download ist deaktiviert, solange die
 * Validierung Fehler meldet (AGENTS.md Abschnitt 6.4).
 */

export interface ExportHandle {
  setXml(xml: string): void;
  setExportEnabled(enabled: boolean): void;
  setStatus(message: string): void;
}

/** Dateiname bereinigen: nur [A-Za-z0-9_-], sonst '_' (Abschnitt 6.4). */
export function sanitizeFileName(name: string): string {
  const cleaned = name.replace(/[^A-Za-z0-9_-]/g, '_');
  return cleaned === '' ? 'sequence' : cleaned;
}

export function setupExport(root: HTMLElement, getFileName: () => string): ExportHandle {
  const section = document.createElement('section');
  section.className = 'form-group export-group';

  const heading = document.createElement('h2');
  heading.textContent = 'Export';
  section.append(heading);

  const status = document.createElement('p');
  status.className = 'export-status';
  status.setAttribute('role', 'status');
  section.append(status);

  const preview = document.createElement('textarea');
  preview.className = 'xml-preview';
  preview.readOnly = true;
  preview.spellcheck = false;
  preview.setAttribute('aria-label', 'XML-Vorschau');
  section.append(preview);

  const buttons = document.createElement('div');
  buttons.className = 'export-buttons';

  const downloadBtn = document.createElement('button');
  downloadBtn.type = 'button';
  downloadBtn.className = 'primary';
  downloadBtn.textContent = 'XML herunterladen';
  downloadBtn.disabled = true;

  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.textContent = 'In Zwischenablage kopieren';

  buttons.append(downloadBtn, copyBtn);
  section.append(buttons);
  root.append(section);

  let currentXml = '';

  function setStatus(message: string): void {
    status.textContent = message;
  }

  downloadBtn.addEventListener('click', () => {
    if (downloadBtn.disabled || currentXml === '') {
      return;
    }
    const fileName = `${sanitizeFileName(getFileName())}.xml`;
    const blob = new Blob([currentXml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
    setStatus(`Datei "${fileName}" wurde heruntergeladen.`);
  });

  copyBtn.addEventListener('click', async () => {
    if (currentXml === '') {
      return;
    }
    try {
      await navigator.clipboard.writeText(currentXml);
      setStatus('XML in die Zwischenablage kopiert.');
    } catch {
      // Fallback für Browser ohne Clipboard API (z. B. über http ohne localhost).
      preview.select();
      const ok = document.execCommand('copy');
      setStatus(ok ? 'XML in die Zwischenablage kopiert.' : 'Kopieren fehlgeschlagen.');
    }
  });

  return {
    setXml(xml) {
      currentXml = xml;
      preview.value = xml;
    },
    setExportEnabled(enabled) {
      downloadBtn.disabled = !enabled || currentXml === '';
      copyBtn.disabled = !enabled || currentXml === '';
    },
    setStatus(message) {
      status.textContent = message;
    },
  };
}

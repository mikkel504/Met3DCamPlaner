/**
 * Export-Bereich: XML-Vorschau, "In Zwischenablage kopieren" und
 * "XML herunterladen". Der Download ist deaktiviert, solange die
 * Validierung Fehler meldet (AGENTS.md Abschnitt 6.4).
 */

import { buildCollapsibleSection } from './collapsible';

export interface ExportHandle {
  setXml(xml: string): void;
  setExportEnabled(enabled: boolean): void;
  /** tone='error' hebt die Meldung farbig hervor (Export ist gesperrt). */
  setStatus(message: string, tone?: 'info' | 'error'): void;
}

/** Dateiname bereinigen: nur [A-Za-z0-9_-], sonst '_' (Abschnitt 6.4). */
export function sanitizeFileName(name: string): string {
  const cleaned = name.replace(/[^A-Za-z0-9_-]/g, '_');
  return cleaned === '' ? 'sequence' : cleaned;
}

export function setupExport(root: HTMLElement, getFileName: () => string): ExportHandle {
  // Als einzige Gruppe standardmäßig offen: der Export ist das Ziel der Bedienung.
  const group = buildCollapsibleSection('Export', { open: true, className: 'export-group' });
  const section = group.details;

  // Statusmeldung im Klappkopf: sie warnt auch dann, wenn der Bereich zu ist.
  const status = document.createElement('p');
  status.className = 'export-status';
  status.setAttribute('role', 'status');
  group.summary.append(status);

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

  function showStatus(message: string, tone: 'info' | 'error' = 'info'): void {
    status.textContent = message;
    status.classList.toggle('error', tone === 'error');
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
    showStatus(`Datei "${fileName}" wurde heruntergeladen.`);
  });

  copyBtn.addEventListener('click', async () => {
    if (currentXml === '') {
      return;
    }
    try {
      await navigator.clipboard.writeText(currentXml);
      showStatus('XML in die Zwischenablage kopiert.');
    } catch {
      // Fallback für Browser ohne Clipboard API (z. B. über http ohne localhost).
      preview.select();
      const ok = document.execCommand('copy');
      showStatus(ok ? 'XML in die Zwischenablage kopiert.' : 'Kopieren fehlgeschlagen.');
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
    setStatus(message, tone) {
      showStatus(message, tone);
    },
  };
}

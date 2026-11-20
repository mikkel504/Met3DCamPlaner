import { buildForm } from './ui/form';
import { setupExport } from './ui/export';
import { setupPreview } from './view3d/preview';
import { getDefaultPathType, getPathType } from './core/paths';
import { buildSequenceXml } from './core/xml';
import { validateParams } from './core/validate';
import { DEFAULT_TENSION_XML } from './core/constants';
import { applyLoop } from './core/loop';

/**
 * Verdrahtung: Formular -> Validierung -> Keyframes -> 3D-Vorschau + XML.
 * Aktualisierung passiert live mit ~100 ms Debounce (Abschnitt 6.3).
 */

const formRoot = document.getElementById('form') as HTMLElement;
const previewRoot = document.getElementById('preview-canvas') as HTMLElement;
const exportRoot = document.getElementById('export') as HTMLElement;
const noticeRoot = document.getElementById('preview-notice') as HTMLElement;
const resetBtn = document.getElementById('reset-view') as HTMLButtonElement;
const worldBtn = document.getElementById('world-view') as HTMLButtonElement;

const preview = setupPreview(previewRoot);
const exportHandle = setupExport(exportRoot, () => form.rawValue('common.name'));
const form = buildForm(formRoot, scheduleUpdate);

resetBtn.addEventListener('click', () => preview.resetView());
worldBtn.addEventListener('click', () => preview.showWorld());

let debounceTimer: number | undefined;

function scheduleUpdate(): void {
  window.clearTimeout(debounceTimer);
  debounceTimer = window.setTimeout(update, 100);
}

function update(): void {
  const common = form.readCommon();
  const path = getPathType(form.readPathId()) ?? getDefaultPathType();
  const pathParams = form.readPathParams();

  const issues = validateParams(common, path, pathParams);
  form.applyIssues(issues);
  renderWarnings(issues.filter((i) => i.severity === 'warning'));

  const hasErrors = issues.some((i) => i.severity === 'error');
  if (hasErrors) {
    exportHandle.setExportEnabled(false);
    exportHandle.setStatus('Bitte fehlerhafte Felder korrigieren – Export ist deaktiviert.', 'error');
    return;
  }

  // Loop: optional ein zusätzlicher Key exakt auf dem ersten (core/loop.ts).
  const keys = applyLoop(path.generate(common, pathParams as never), common.loop);
  // Tension verbatim aus dem Feld, damit keine Rundungsartefakte entstehen
  // (float32-Präzision, siehe core/xml.ts).
  const rawTension = form.rawValue('common.tension').trim();
  const tensionOut = rawTension === '' ? DEFAULT_TENSION_XML : rawTension;
  const xml = buildSequenceXml(common.name, tensionOut, keys);
  exportHandle.setXml(xml);
  exportHandle.setExportEnabled(true);
  exportHandle.setStatus('');
  preview.update(common, path, pathParams, keys);
}

function renderWarnings(warnings: { message: string }[]): void {
  noticeRoot.textContent = '';
  for (const warning of warnings) {
    const p = document.createElement('p');
    p.className = 'warning';
    p.textContent = warning.message;
    noticeRoot.append(p);
  }
}

// Erstes Rendering direkt (kein Debounce), damit die Seite sofort gefüllt ist.
update();

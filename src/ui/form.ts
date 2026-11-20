import { COMMON_DEFAULTS, COMMON_FIELDS } from '../core/fields';
import { DEFAULT_TENSION_XML } from '../core/constants';
import { getDefaultPathType, listPathTypes } from '../core/paths';
import { buildCollapsibleSection } from './collapsible';
import type { CollapsibleSection } from './collapsible';
import type {
  CommonField,
  CommonParams,
  Issue,
  ParamField,
  ParamRecord,
  ParamValue,
  PathType,
} from '../core/types';

/**
 * Formular: baut alle Felder aus den Metadaten von core/ (COMMON_FIELDS und
 * paramSchema des gewählten Pfadtyps). Kein Fahrtyp-spezifischer Code hier.
 * Das Fahrttyp-Auswahlmenü erscheint erst, wenn die Registry mehr als einen
 * aktiven Fahrttyp enthält – mit nur einem Typ wäre es eine Auswahl ohne Wahl.
 * Die Erklärung eines Felds steht nicht unter dem Feld, sondern hinter einem
 * (i)-Knopf an der Beschriftung.
 */

/** Gruppen des Formulars; alle außer 'export' werden hier gebaut. */
type FieldGroup = 'focus' | 'path' | 'camera';

const GROUP_TITLES: Record<FieldGroup, string> = {
  focus: 'Fokuspunkt',
  path: 'Kamerafahrt',
  camera: 'Kamera-Einstellungen',
};

export interface FormHandle {
  readCommon(): CommonParams;
  readPathId(): string;
  readPathParams(): ParamRecord;
  /** Original-Text eines Felds (z. B. für Tension mit voller Präzision). */
  rawValue(fieldId: string): string;
  /** Meldet Validierungsprobleme an den zugehörigen Feldern. */
  applyIssues(issues: Issue[]): void;
}

const FIELD_PREFIX = {
  common: 'common',
  path: 'path',
} as const;

interface FieldRefs {
  input: HTMLInputElement | HTMLSelectElement;
  messages: HTMLElement;
  /** Zugehörige Formulargruppe – nötig, um die Fehlerzahl pro Klappe anzuzeigen. */
  group: FieldGroup;
}

/** Akzeptiert deutsches Komma als Dezimaltrenner; leer/ungültig -> NaN. */
export function parseNumber(raw: string): number {
  const normalized = raw.trim().replace(',', '.');
  if (normalized === '') {
    return Number.NaN;
  }
  return Number.parseFloat(normalized);
}

export function buildForm(root: HTMLElement, onChange: () => void): FormHandle {
  const refs = new Map<string, FieldRefs>();
  const sections = new Map<FieldGroup, CollapsibleSection>();
  const { select: pathSelect, container: pathParamsContainer } = buildPathSelector(onChange);

  // Alle Gruppen sind zunächst zugeklappt – das Formular ist sonst länger als
  // der Bildschirm. Fehlerzahlen erscheinen als Hinweis am Klappkopf.
  for (const group of ['focus', 'path', 'camera'] as const) {
    const section = buildCollapsibleSection(GROUP_TITLES[group]);
    sections.set(group, section);

    if (group === 'path') {
      if (pathSelect) {
        section.details.append(pathSelect);
      }
      section.details.append(pathParamsContainer);
    }

    for (const field of COMMON_FIELDS.filter((f) => f.group === group)) {
      section.details.append(buildCommonField(field, group, refs, onChange));
    }
    root.append(section.details);
  }

  // Checkboxen mit disables-Verknüpfung: abhängiges Feld graue stellen
  // (z. B. autoPitch => pitch) und beim Umschalten aktualisieren.
  for (const field of COMMON_FIELDS) {
    if (field.kind !== 'checkbox' || !field.disables) {
      continue;
    }
    const boxRef = refs.get(`${FIELD_PREFIX.common}.${String(field.key)}`);
    const depRef = refs.get(`${FIELD_PREFIX.common}.${String(field.disables)}`);
    if (!boxRef || !depRef) {
      continue;
    }
    const syncDisabled = () => {
      const on = (boxRef.input as HTMLInputElement).checked;
      depRef.input.disabled = on;
      depRef.messages.textContent = '';
    };
    boxRef.input.addEventListener('change', syncDisabled);
    syncDisabled();
  }

  // Pfadparameter initial füllen.
  renderPathParams(getPathById(selectedPathId(pathSelect)), pathParamsContainer, refs, onChange);

  function buildPathSelector(onChangeCb: () => void) {
    const container = document.createElement('div');
    container.className = 'path-params';
    // Nur wenn die Registry mehrere Fahrttypen anbietet, ergibt ein Auswahlmenü
    // Sinn – mit einem einzigen Typ wäre es ein Formularfeld ohne Auswahl.
    const enabled = listPathTypes().filter((entry) => entry.enabled);
    if (enabled.length < 2) {
      return { select: null, container };
    }
    const select = document.createElement('select');
    select.id = 'path-select';
    select.setAttribute('aria-label', 'Kamerafahrt auswählen');
    for (const entry of listPathTypes()) {
      const option = document.createElement('option');
      option.value = entry.path.id;
      option.textContent = entry.enabled ? entry.path.label : `${entry.path.label} (folgt)`;
      option.disabled = !entry.enabled;
      select.append(option);
    }
    select.value = enabled[0]!.path.id;
    select.addEventListener('change', () => {
      renderPathParams(getPathById(selectedPathId(select)), pathParamsContainer, refs, onChangeCb);
      onChangeCb();
    });
    return { select, container };
  }

  return {
    readCommon() {
      const common: Record<string, string | number | boolean> = {};
      for (const field of COMMON_FIELDS) {
        const ref = refs.get(`${FIELD_PREFIX.common}.${String(field.key)}`);
        const raw = ref ? ref.input.value : '';
        if (field.kind === 'number') {
          common[String(field.key)] = parseNumber(raw);
        } else if (field.kind === 'checkbox') {
          common[String(field.key)] = (ref?.input as HTMLInputElement | undefined)?.checked === true;
        } else {
          common[String(field.key)] = raw;
        }
      }
      return common as unknown as CommonParams;
    },
    readPathId() {
      return selectedPathId(pathSelect);
    },
    readPathParams() {
      const path = getPathById(selectedPathId(pathSelect));
      const values: ParamRecord = { ...path.defaults };
      for (const field of path.paramSchema) {
        const ref = refs.get(`${FIELD_PREFIX.path}.${field.key}`);
        if (!ref) {
          continue;
        }
        if (field.kind === 'number') {
          values[field.key] = parseNumber(ref.input.value);
        } else if (field.kind === 'checkbox') {
          values[field.key] = (ref.input as HTMLInputElement).checked;
        } else {
          const numeric = Number(ref.input.value);
          values[field.key] = Number.isNaN(numeric) ? ref.input.value : numeric;
        }
      }
      return values;
    },
    rawValue(fieldId) {
      return refs.get(fieldId)?.input.value ?? '';
    },
    applyIssues(issues) {
      for (const ref of refs.values()) {
        ref.messages.textContent = '';
        ref.messages.classList.remove('has-error', 'has-warning');
        ref.input.classList.remove('invalid');
        ref.input.removeAttribute('aria-invalid');
      }
      // Fehlerzahlen pro Klappe: steht die Gruppe zu, wäre die Meldung am Feld
      // sonst unsichtbar.
      const errorCounts = new Map<FieldGroup, number>();
      for (const issue of issues) {
        if (!issue.field) {
          continue;
        }
        const ref = refs.get(issue.field);
        if (!ref) {
          continue;
        }
        const line = document.createElement('p');
        line.className = `field-message ${issue.severity === 'error' ? 'error' : 'warning'}`;
        line.textContent = issue.message;
        ref.messages.append(line);
        if (issue.severity === 'error') {
          ref.input.classList.add('invalid');
          ref.input.setAttribute('aria-invalid', 'true');
          errorCounts.set(ref.group, (errorCounts.get(ref.group) ?? 0) + 1);
        }
      }
      for (const [group, section] of sections) {
        section.setIssueCount(errorCounts.get(group) ?? 0);
      }
    },
  };
}

function selectedPathId(select: HTMLSelectElement | null): string {
  return select?.value || getDefaultPathType().id;
}

function getPathById(id: string): PathType {
  const entry = listPathTypes().find((e) => e.path.id === id);
  const fallback = listPathTypes().find((e) => e.enabled)?.path;
  return entry?.path ?? fallback ?? listPathTypes()[0]!.path;
}

interface LabelRefs {
  row: HTMLElement;
  help: HTMLElement | null;
}

/**
 * Beschriftung mit (i)-Knopf: die Erklärung gehört nicht mehr dauerhaft unter
 * das Feld (macht das Formular lang), sondern wird über den Knopf ein- und
 * ausgeklappt. Der Knopf ist ein echtes <button>, damit er per Tastatur
 * erreichbar ist; aria-expanded/aria-controls beschreiben den Zustand für
 * Screenreader, das Feld selbst bleibt über aria-describedby verbunden.
 */
function buildLabelRow(
  wrap: HTMLElement,
  fieldId: string,
  labelText: string,
  help: string | undefined,
): LabelRefs {
  const row = document.createElement('div');
  row.className = 'label-row';

  const label = document.createElement('label');
  label.htmlFor = `input-${fieldId}`;
  label.textContent = labelText;
  row.append(label);

  if (!help) {
    return { row, help: null };
  }

  const helpText = document.createElement('p');
  helpText.className = 'help';
  helpText.id = `help-${fieldId}`;
  helpText.textContent = help;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'info-button';
  button.textContent = 'i';
  button.title = help;
  button.setAttribute('aria-label', `Erläuterung zu „${labelText}“ anzeigen`);
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-controls', helpText.id);

  const setOpen = (open: boolean) => {
    // aria-expanded trägt den Zustand, der Name bleibt gleich.
    button.setAttribute('aria-expanded', String(open));
    wrap.classList.toggle('help-open', open);
  };
  button.addEventListener('click', () => setOpen(button.getAttribute('aria-expanded') !== 'true'));
  button.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      setOpen(false);
    }
  });
  row.append(button);

  return { row, help: helpText };
}

function buildCommonField(
  field: CommonField,
  group: FieldGroup,
  refs: Map<string, FieldRefs>,
  onChange: () => void,
): HTMLElement {
  const fieldId = `${FIELD_PREFIX.common}.${String(field.key)}`;
  const wrap = document.createElement('div');
  wrap.className = 'field';

  const input = document.createElement('input');
  input.id = `input-${fieldId}`;
  if (field.kind === 'number') {
    input.type = 'number';
    if (field.min !== undefined) input.min = String(field.min);
    if (field.max !== undefined) input.max = String(field.max);
    if (field.step !== undefined) input.step = String(field.step);
  } else if (field.kind === 'checkbox') {
    input.type = 'checkbox';
  } else {
    input.type = 'text';
  }
  if (field.help) {
    input.setAttribute('aria-describedby', `help-${fieldId}`);
  }

  // Defaults vorbelegen, damit der Export ohne Änderung sofort funktioniert.
  const defaultValue = COMMON_DEFAULTS[field.key];
  if (field.kind === 'checkbox') {
    input.checked = defaultValue === true;
  } else {
    input.value =
      field.key === 'tension' ? DEFAULT_TENSION_XML : String(defaultValue ?? '');
  }

  const { row, help } = buildLabelRow(
    wrap,
    fieldId,
    field.label + (field.unit ? ` (${field.unit})` : ''),
    field.help,
  );
  if (field.kind === 'checkbox') {
    row.classList.add('field-inline');
    row.prepend(input);
    wrap.append(row);
  } else {
    wrap.append(row, input);
  }
  if (help) {
    wrap.append(help);
  }
  const messages = document.createElement('div');
  messages.className = 'messages';
  wrap.append(messages);

  input.addEventListener('input', onChange);
  refs.set(fieldId, { input, messages, group });
  return wrap;
}

function renderPathParams(
  path: PathType,
  container: HTMLElement,
  refs: Map<string, FieldRefs>,
  onChange: () => void,
): void {
  container.textContent = '';
  // Alte Pfadfelder aus den Refs entfernen.
  for (const key of [...refs.keys()]) {
    if (key.startsWith(`${FIELD_PREFIX.path}.`)) {
      refs.delete(key);
    }
  }
  for (const field of path.paramSchema) {
    container.append(buildParamField(field, path.defaults[field.key], refs, onChange));
  }
}

function buildParamField(
  field: ParamField,
  defaultValue: ParamValue | undefined,
  refs: Map<string, FieldRefs>,
  onChange: () => void,
): HTMLElement {
  const fieldId = `${FIELD_PREFIX.path}.${field.key}`;
  const wrap = document.createElement('div');
  wrap.className = 'field';

  let input: HTMLInputElement | HTMLSelectElement;
  if (field.kind === 'select' && field.options) {
    input = document.createElement('select');
    for (const option of field.options) {
      const el = document.createElement('option');
      el.value = String(option.value);
      el.textContent = option.label;
      input.append(el);
    }
  } else {
    input = document.createElement('input');
    if (field.kind === 'checkbox') {
      input.type = 'checkbox';
    } else {
      input.type = 'number';
      if (field.min !== undefined) input.min = String(field.min);
      if (field.max !== undefined) input.max = String(field.max);
      if (field.step !== undefined) input.step = String(field.step);
    }
  }
  input.id = `input-${fieldId}`;
  if (field.help) {
    input.setAttribute('aria-describedby', `help-${fieldId}`);
  }

  // Defaults des Pfadtyps vorbelegen.
  if (field.kind === 'checkbox') {
    (input as HTMLInputElement).checked = defaultValue === true;
  } else if (defaultValue !== undefined) {
    input.value = String(defaultValue);
  }

  const { row, help } = buildLabelRow(
    wrap,
    fieldId,
    field.label + (field.unit ? ` (${field.unit})` : ''),
    field.help,
  );
  if (field.kind === 'checkbox') {
    row.classList.add('field-inline');
    row.prepend(input);
    wrap.append(row);
  } else {
    wrap.append(row, input);
  }
  if (help) {
    wrap.append(help);
  }
  const messages = document.createElement('div');
  messages.className = 'messages';
  wrap.append(messages);

  input.addEventListener('input', onChange);
  input.addEventListener('change', onChange);
  refs.set(fieldId, { input, messages, group: 'path' });
  return wrap;
}

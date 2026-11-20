import { COMMON_DEFAULTS, COMMON_FIELDS } from '../core/fields';
import { DEFAULT_TENSION_XML } from '../core/constants';
import { getDefaultPathType, listPathTypes } from '../core/paths';
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
 */

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
  const { select: pathSelect, container: pathParamsContainer } = buildPathSelector(onChange);

  for (const group of ['focus', 'path', 'camera'] as const) {
    const section = document.createElement('section');
    section.className = 'form-group';
    const heading = document.createElement('h2');
    heading.textContent =
      group === 'focus' ? 'Fokuspunkt' : group === 'path' ? 'Kamerafahrt' : 'Kamera-Einstellungen';
    section.append(heading);

    if (group === 'path') {
      if (pathSelect) {
        section.append(pathSelect);
      }
      section.append(pathParamsContainer);
    }

    for (const field of COMMON_FIELDS.filter((f) => f.group === group)) {
      section.append(buildCommonField(field, refs, onChange));
    }
    root.append(section);
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
        }
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

function buildCommonField(
  field: CommonField,
  refs: Map<string, FieldRefs>,
  onChange: () => void,
): HTMLElement {
  const fieldId = `${FIELD_PREFIX.common}.${String(field.key)}`;
  const wrap = document.createElement('div');
  wrap.className = 'field';

  const label = document.createElement('label');
  label.htmlFor = `input-${fieldId}`;
  label.textContent = field.label + (field.unit ? ` (${field.unit})` : '');

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
    input.title = field.help;
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

  if (field.kind === 'checkbox') {
    const box = document.createElement('div');
    box.className = 'field-inline';
    box.append(input, label);
    wrap.append(box);
  } else {
    wrap.append(label, input);
  }
  if (field.help) {
    const help = document.createElement('p');
    help.className = 'help';
    help.id = `help-${fieldId}`;
    help.textContent = field.help;
    wrap.append(help);
  }
  const messages = document.createElement('div');
  messages.className = 'messages';
  wrap.append(messages);

  input.addEventListener('input', onChange);
  refs.set(fieldId, { input, messages });
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
    input.title = field.help;
    input.setAttribute('aria-describedby', `help-${fieldId}`);
  }

  // Defaults des Pfadtyps vorbelegen.
  if (field.kind === 'checkbox') {
    (input as HTMLInputElement).checked = defaultValue === true;
  } else if (defaultValue !== undefined) {
    input.value = String(defaultValue);
  }

  const label = document.createElement('label');
  label.htmlFor = input.id;
  label.textContent = field.label + (field.unit ? ` (${field.unit})` : '');

  if (field.kind === 'checkbox') {
    const box = document.createElement('div');
    box.className = 'field-inline';
    box.append(input, label);
    wrap.append(box);
  } else {
    wrap.append(label, input);
  }
  if (field.help) {
    const help = document.createElement('p');
    help.className = 'help';
    help.id = `help-${fieldId}`;
    help.textContent = field.help;
    wrap.append(help);
  }
  const messages = document.createElement('div');
  messages.className = 'messages';
  wrap.append(messages);

  input.addEventListener('input', onChange);
  input.addEventListener('change', onChange);
  refs.set(fieldId, { input, messages });
  return wrap;
}

/**
 * Einklappbarer Abschnitt (Formulargruppen und Export-Bereich).
 *
 * <details>/<summary> ist bewusst gewählt: Tastaturbedienung, Screenreader und
 * der Standard-Umgang mit Klappgruppen kommen ohne eigenen Zustand aus, und die
 * Felder bleiben im DOM – ausgelesene Werte und Validierung funktionieren also
 * auch im zugeklappten Zustand.
 */

export interface CollapsibleSection {
  details: HTMLDetailsElement;
  /** Kopfzeile der Klappe; hier können Inhalte sitzen, die immer sichtbar bleiben. */
  summary: HTMLElement;
  /** Zählt Fehler des Abschnitts; der Hinweis bleibt sichtbar, wenn er zu ist. */
  setIssueCount(count: number): void;
}

export function buildCollapsibleSection(
  title: string,
  options: { open?: boolean; className?: string } = {},
): CollapsibleSection {
  const details = document.createElement('details');
  details.className = options.className ? `form-group ${options.className}` : 'form-group';
  details.open = options.open === true;

  const summary = document.createElement('summary');
  const heading = document.createElement('h2');
  heading.textContent = title;
  const badge = document.createElement('span');
  badge.className = 'issue-badge';
  badge.hidden = true;
  heading.append(badge);
  summary.append(heading);
  details.append(summary);

  return {
    details,
    summary,
    setIssueCount(count) {
      badge.hidden = count === 0;
      badge.textContent = count === 1 ? '1 Fehler' : `${count} Fehler`;
    },
  };
}

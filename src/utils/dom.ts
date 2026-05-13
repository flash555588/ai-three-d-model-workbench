/**
 * Staged element creation helpers.
 *
 * These helpers create a detached staging `<div>`, call the Obsidian enhanced
 * helpers on it, then return the child. This keeps callers away from raw DOM
 * creation while still avoiding accidental appends to a live container.
 */

/**
 * Create an Obsidian-styled div without appending to the live DOM.
 *
 * @param cls Optional CSS class(es) to apply.
 */
export function createStagedDiv(cls?: string): HTMLDivElement {
  const s = createDiv();
  return s.createDiv(cls ? { cls } : undefined);
}

/**
 * Create an Obsidian-styled element of any tag without appending to the live DOM.
 *
 * @param tag HTML tag name (e.g. "button", "input", "canvas", "span").
 * @param cls Optional CSS class(es) to apply.
 */
export function createStagedEl<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls?: string,
): HTMLElementTagNameMap[K] {
  const s = createDiv();
  return s.createEl(tag, cls ? { cls } : undefined);
}

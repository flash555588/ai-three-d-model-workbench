/**
 * Staged element creation helpers.
 *
 * Calling `activeDocument.createDiv()` / `activeDocument.createEl()` triggers a
 * HierarchyRequestError because those Obsidian helpers try to append the new element
 * to the Document node (which already has `<html>` as its only child).
 *
 * These helpers create a detached staging `<div>`, call the Obsidian enhanced
 * helpers on it, then return the child — preserving Obsidian's runtime styling
 * without touching the Document root.
 */

/**
 * Create an Obsidian-styled div without appending to the live DOM.
 *
 * @param cls  Optional CSS class(es) to apply.
 */
export function createStagedDiv(cls?: string): HTMLDivElement {
  // eslint-disable-next-line obsidianmd/prefer-create-el -- staging container must use raw createElement to avoid HierarchyRequestError
  const s = activeDocument.createElement("div");
  return s.createDiv(cls ? { cls } : undefined);
}

/**
 * Create an Obsidian-styled element of any tag without appending to the live DOM.
 *
 * @param tag  HTML tag name (e.g. "button", "input", "canvas", "span").
 * @param cls  Optional CSS class(es) to apply.
 */
export function createStagedEl<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls?: string,
): HTMLElementTagNameMap[K] {
  // eslint-disable-next-line obsidianmd/prefer-create-el -- staging container must use raw createElement to avoid HierarchyRequestError
  const s = activeDocument.createElement("div");
  return s.createEl(tag, cls ? { cls } : undefined);
}

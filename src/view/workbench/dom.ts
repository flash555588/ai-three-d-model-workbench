/**
 * Minimal hyperscript helper (~60 lines).
 * Creates DOM elements from tag, props, and children.
 * Used by htm via h.ts.
 */

type Props = Record<string, any> | null;
type Child = Node | string | number | boolean | null | undefined;

export function createElement(
  tag: string | Function,
  props: Props,
  ...children: Child[]
): HTMLElement | Text {
  // Component function
  if (typeof tag === "function") {
    return tag({ ...props, children }) as HTMLElement;
  }

  const el = document.createElement(tag);

  if (props) {
    for (const [key, val] of Object.entries(props)) {
      if (key === "ref" && typeof val === "function") {
        val(el);
      } else if (key === "class" && typeof val === "string") {
        el.className = val;
      } else if (key === "style" && typeof val === "object") {
        Object.assign(el.style, val);
      } else if (key === "dangerouslySetInnerHTML" && val) {
        el.innerHTML = val.__html ?? "";
      } else if (key.startsWith("on") && typeof val === "function") {
        const event = key.slice(2).toLowerCase();
        el.addEventListener(event, val);
      } else if (key === "value" && "value" in el) {
        (el as HTMLInputElement).value = val;
      } else if (key === "checked" && "checked" in el) {
        (el as HTMLInputElement).checked = val;
      } else if (val === true) {
        el.setAttribute(key, "");
      } else if (val !== false && val != null) {
        el.setAttribute(key, String(val));
      }
    }
  }

  appendChildren(el, children);
  return el;
}

function appendChildren(parent: HTMLElement, children: Child[]) {
  for (const child of children) {
    if (child == null || child === false) continue;
    if (Array.isArray(child)) {
      appendChildren(parent, child);
    } else if (child instanceof Node) {
      parent.appendChild(child);
    } else {
      parent.appendChild(document.createTextNode(String(child)));
    }
  }
}

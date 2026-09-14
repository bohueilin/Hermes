// Small DOM helpers. Text enters only through textContent and attributes only through setAttribute (design R5).

/** Append children: strings and numbers become spans holding text, nodes are appended, null and false are skipped. */
function appendChildren(node, children) {
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    if (Array.isArray(child)) {
      appendChildren(node, child);
    } else if (typeof child === "string" || typeof child === "number") {
      const span = document.createElement("span");
      span.textContent = String(child);
      node.appendChild(span);
    } else {
      node.appendChild(child);
    }
  }
}

/**
 * Create an element. `attrs` values go through setAttribute (true gives an empty attribute; null, undefined and false
 * are skipped); `attrs.on` maps event names to listeners. `children` is a string or number (set as textContent), a
 * node, or an array of those.
 */
export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) {
    if (name === "on") {
      for (const [type, listener] of Object.entries(value)) node.addEventListener(type, listener);
      continue;
    }
    if (/^on/i.test(name)) throw new Error(`inline event attribute ${name} is not allowed; use attrs.on`);
    if (value === null || value === undefined || value === false) continue;
    node.setAttribute(name, value === true ? "" : String(value));
  }
  if (typeof children === "string" || typeof children === "number") {
    node.textContent = String(children);
  } else if (Array.isArray(children)) {
    appendChildren(node, children);
  } else if (children !== null && children !== undefined) {
    node.appendChild(children);
  }
  return node;
}

/** Remove every child of `node`. */
export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

/** Set a node's text, only when it differs (avoids needless screen reader and layout churn). */
export function setText(node, text) {
  const value = String(text);
  if (node.textContent !== value) node.textContent = value;
  return node;
}

const keyedNodes = new WeakMap();

/**
 * Keep `parent`'s children in step with `items`: `key(item)` names each item (unique strings), `create(item)` builds
 * a node for a new key, `update(node, item)` refreshes an existing one. Nodes for missing keys are removed and the
 * rest are placed in item order. `parent` should hold only children this function manages.
 */
export function keyedList(parent, items, { key, create, update = () => {} }) {
  const previous = keyedNodes.get(parent) ?? new Map();
  const next = new Map();
  for (const item of items) {
    const k = key(item);
    if (typeof k !== "string") throw new TypeError("keyedList keys must be strings");
    if (next.has(k)) throw new Error(`keyedList key ${k} is not unique`);
    let node = previous.get(k);
    if (node === undefined) node = create(item);
    else update(node, item);
    next.set(k, node);
  }
  for (const [k, node] of previous) {
    if (!next.has(k) && node.parentNode === parent) parent.removeChild(node);
  }
  let cursor = parent.firstChild;
  for (const node of next.values()) {
    if (node === cursor) cursor = cursor.nextSibling;
    else parent.insertBefore(node, cursor);
  }
  keyedNodes.set(parent, next);
  return parent;
}

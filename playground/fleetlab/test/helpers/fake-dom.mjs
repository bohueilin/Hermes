// A minimal fake DOM for interface tests under node --test. It models only what src/ui modules use, and it models it
// the way a browser does where that matters for a test (event phases, focus rules, selector matching, attribute
// reflection). Anything it does not model throws or is absent, so a module that reaches past it fails loudly.
//
// Rule R5 at runtime: reading or writing innerHTML or outerHTML, calling insertAdjacentHTML, document.write,
// document.writeln or touching document.cookie throws, and so do localStorage, sessionStorage and indexedDB on the
// fake window.
//
// Usage:
//   const uninstall = installFakeDom();            // defines document, window, Event classes and friends globally
//   const { document, frames, media } = uninstall.dom;
//   ...
//   uninstall();                                   // restores every global it replaced (uninstall in reverse order)
//
// createFakeDom(options) builds the same objects without touching globals. Options:
//   media: {query: boolean}    initial matchMedia results; any other query starts false
//   requestAnimationFrame, cancelAnimationFrame
//                              an injected frame scheduler; without it frames queue until frames.flush()
//   innerWidth, innerHeight    window size numbers (default 1280 by 800); nothing lays out against them
//
// Controls on the returned object:
//   frames.flush(timestamp?)   runs the frame callbacks queued so far (callbacks they queue wait for the next flush);
//                              the timestamp defaults to the previous one plus 16; returns how many ran
//   frames.pending             queued callback count
//   media.set(query, matches)  changes a query's result and fires `change` on every list for it when it differs
//   media.matches(query)       the current result
//   serialize(node)            HTML-like text for assertions
//
// Deliberate differences from a browser, each simpler for tests:
// - childNodes and children return a fresh array on each read, not a live NodeList.
// - A listener that throws does not stop the other listeners; dispatchEvent rethrows the first error afterwards.
// - A style object left empty removes the style attribute.
// - Focus follows attributes only (tabindex, hidden, inert, disabled, href); there is no CSS, so display: none
//   does not block focus. An active element that is removed, hidden or made inert reads back as document.body.
// - getBoundingClientRect always returns zeros; there is no layout.
// - A range input keeps the value it is given: it does not clamp to min and max or snap to step, where a browser
//   reads back "66600" after "66650" is set on a step of 300. Tests set on-step values only.
//
// Browser behaviour it keeps on purpose, because tests would otherwise pass where a browser fails:
// - hidden and inert are HTML-only properties. On an SVG element they read undefined and assigning one throws (a
//   browser stores an expando and never sets the attribute); use toggleAttribute and hasAttribute there.
// - click() exists on HTML elements only; on an SVG element it is undefined.

const HTML_NS = "http://www.w3.org/1999/xhtml";
const VOID_TAGS = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);
const FORM_CONTROLS = new Set(["button", "input", "select", "textarea", "fieldset", "optgroup", "option"]);
const NATIVE_FOCUSABLE = new Set(["button", "input", "select", "textarea"]);

const KIDS = Symbol("kids");
const ATTRS = Symbol("attrs");
const LISTENERS = Symbol("listeners");
const STOP = Symbol("stop");
const STOP_NOW = Symbol("stopImmediate");
const PASSIVE = Symbol("passive");
const DISPATCHING = Symbol("dispatching");
const PATH = Symbol("path");
const ACTIVE = Symbol("active");
const VALUE = Symbol("value");
const CHECKED = Symbol("checked");
const SELECTED = Symbol("selected");
const STYLE = Symbol("style");
const DATASET = Symbol("dataset");
const CLASSLIST = Symbol("classList");

function domError(message, name) {
  return new DOMException(message, name);
}

function r5(what) {
  return new Error(`rule R5: ${what} is not allowed; text enters through textContent and attributes through setAttribute`);
}

// ---------------------------------------------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------------------------------------------

export class FakeEvent {
  static NONE = 0;
  static CAPTURING_PHASE = 1;
  static AT_TARGET = 2;
  static BUBBLING_PHASE = 3;
  static DEFAULTS = {};

  constructor(type, init = {}) {
    if (arguments.length === 0) throw new TypeError("an event needs a type");
    this.type = String(type);
    this.bubbles = Boolean(init.bubbles);
    this.cancelable = Boolean(init.cancelable);
    this.composed = Boolean(init.composed);
    this.defaultPrevented = false;
    this.isTrusted = false;
    this.target = null;
    this.currentTarget = null;
    this.eventPhase = 0;
    this.timeStamp = 0;
    for (const [key, value] of Object.entries(this.constructor.DEFAULTS)) {
      this[key] = init[key] === undefined ? value : init[key];
    }
    this[STOP] = false;
    this[STOP_NOW] = false;
    this[PASSIVE] = false;
    this[DISPATCHING] = false;
    this[PATH] = [];
  }

  preventDefault() {
    if (this.cancelable && !this[PASSIVE]) this.defaultPrevented = true;
  }

  stopPropagation() {
    this[STOP] = true;
  }

  stopImmediatePropagation() {
    this[STOP] = true;
    this[STOP_NOW] = true;
  }

  composedPath() {
    return this[PATH].slice();
  }
}

const MODIFIERS = { ctrlKey: false, shiftKey: false, altKey: false, metaKey: false };

export class FakeCustomEvent extends FakeEvent {
  static DEFAULTS = { detail: null };
}

export class FakeUIEvent extends FakeEvent {
  static DEFAULTS = { detail: 0 };
}

export class FakeKeyboardEvent extends FakeUIEvent {
  static DEFAULTS = { detail: 0, key: "", code: "", location: 0, repeat: false, isComposing: false, ...MODIFIERS };
}

export class FakeMouseEvent extends FakeUIEvent {
  static DEFAULTS = {
    detail: 0, button: 0, buttons: 0, clientX: 0, clientY: 0, screenX: 0, screenY: 0, relatedTarget: null, ...MODIFIERS,
  };
}

export class FakePointerEvent extends FakeMouseEvent {
  static DEFAULTS = { ...FakeMouseEvent.DEFAULTS, pointerId: 0, pointerType: "", isPrimary: false, width: 1, height: 1, pressure: 0 };
}

export class FakeFocusEvent extends FakeUIEvent {
  static DEFAULTS = { detail: 0, relatedTarget: null };
}

export class FakeMediaQueryListEvent extends FakeEvent {
  static DEFAULTS = { matches: false, media: "" };
}

function listenerOptions(options) {
  if (typeof options === "boolean") return { capture: options, once: false, passive: false, signal: undefined };
  const o = options ?? {};
  return { capture: Boolean(o.capture), once: Boolean(o.once), passive: Boolean(o.passive), signal: o.signal };
}

export class FakeEventTarget {
  constructor() {
    this[LISTENERS] = new Map();
  }

  addEventListener(type, callback, options) {
    if (callback === null || callback === undefined) return;
    if (typeof callback !== "function" && typeof callback?.handleEvent !== "function") {
      throw new TypeError("a listener is a function or an object with handleEvent");
    }
    const { capture, once, passive, signal } = listenerOptions(options);
    if (signal?.aborted) return;
    const key = String(type);
    const list = this[LISTENERS].get(key) ?? [];
    if (list.some((r) => r.callback === callback && r.capture === capture)) return;
    const record = { callback, capture, once, passive, removed: false };
    list.push(record);
    this[LISTENERS].set(key, list);
    if (signal) signal.addEventListener("abort", () => this.removeEventListener(key, callback, { capture }), { once: true });
  }

  removeEventListener(type, callback, options) {
    const { capture } = listenerOptions(options);
    const key = String(type);
    const list = this[LISTENERS].get(key);
    if (!list) return;
    const index = list.findIndex((r) => r.callback === callback && r.capture === capture);
    if (index === -1) return;
    list[index].removed = true;
    list.splice(index, 1);
  }

  /** The propagation path above this target, nearest first. */
  eventParent() {
    return null;
  }

  dispatchEvent(event) {
    if (!(event instanceof FakeEvent)) {
      throw new TypeError("the fake DOM dispatches only events built with its Event classes (install it before building events)");
    }
    if (event[DISPATCHING]) throw domError("the event is already being dispatched", "InvalidStateError");
    event[DISPATCHING] = true;
    event.target = this;
    const path = [];
    for (let node = this; node; node = node.eventParent()) path.push(node);
    event[PATH] = path;
    const errors = [];
    const invoke = (node, phase, pass) => {
      event.currentTarget = node;
      event.eventPhase = phase;
      const list = (node[LISTENERS].get(event.type) ?? []).slice();
      for (const record of list) {
        if (record.removed) continue;
        if (pass === "capture" && !record.capture) continue;
        if (pass === "bubble" && record.capture) continue;
        if (record.once) node.removeEventListener(event.type, record.callback, { capture: record.capture });
        event[PASSIVE] = record.passive;
        try {
          if (typeof record.callback === "function") record.callback.call(node, event);
          else record.callback.handleEvent(event);
        } catch (error) {
          errors.push(error);
        }
        event[PASSIVE] = false;
        if (event[STOP_NOW]) return;
      }
    };
    for (let i = path.length - 1; i >= 1 && !event[STOP]; i -= 1) invoke(path[i], FakeEvent.CAPTURING_PHASE, "capture");
    if (!event[STOP]) invoke(this, FakeEvent.AT_TARGET, "capture");
    if (!event[STOP_NOW]) invoke(this, FakeEvent.AT_TARGET, "bubble");
    if (event.bubbles) {
      for (let i = 1; i < path.length && !event[STOP]; i += 1) invoke(path[i], FakeEvent.BUBBLING_PHASE, "bubble");
    }
    event.currentTarget = null;
    event.eventPhase = 0;
    event[PATH] = [];
    event[STOP] = false;
    event[STOP_NOW] = false;
    event[DISPATCHING] = false;
    if (errors.length > 0) throw errors[0];
    return !event.defaultPrevented;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Nodes
// ---------------------------------------------------------------------------------------------------------------

export class FakeNode extends FakeEventTarget {
  static ELEMENT_NODE = 1;
  static TEXT_NODE = 3;
  static DOCUMENT_NODE = 9;
  static DOCUMENT_FRAGMENT_NODE = 11;

  constructor(ownerDocument) {
    super();
    this.ownerDocument = ownerDocument;
    this.parentNode = null;
    this[KIDS] = [];
  }

  eventParent() {
    if (this.parentNode) return this.parentNode;
    return null;
  }

  get childNodes() {
    return this[KIDS].slice();
  }

  get children() {
    return this[KIDS].filter((node) => node instanceof FakeElement);
  }

  get firstChild() {
    return this[KIDS][0] ?? null;
  }

  get lastChild() {
    return this[KIDS][this[KIDS].length - 1] ?? null;
  }

  get firstElementChild() {
    return this.children[0] ?? null;
  }

  get lastElementChild() {
    const kids = this.children;
    return kids[kids.length - 1] ?? null;
  }

  get childElementCount() {
    return this.children.length;
  }

  get nextSibling() {
    if (!this.parentNode) return null;
    const kids = this.parentNode[KIDS];
    return kids[kids.indexOf(this) + 1] ?? null;
  }

  get previousSibling() {
    if (!this.parentNode) return null;
    const kids = this.parentNode[KIDS];
    return kids[kids.indexOf(this) - 1] ?? null;
  }

  get parentElement() {
    return this.parentNode instanceof FakeElement ? this.parentNode : null;
  }

  get isConnected() {
    return this.getRootNode() instanceof FakeDocument;
  }

  getRootNode() {
    let node = this;
    while (node.parentNode) node = node.parentNode;
    return node;
  }

  contains(other) {
    for (let node = other; node; node = node.parentNode) if (node === this) return true;
    return false;
  }

  hasChildNodes() {
    return this[KIDS].length > 0;
  }

  canHoldChildren() {
    return false;
  }

  appendChild(node) {
    return this.insertBefore(node, null);
  }

  insertBefore(node, reference) {
    if (!this.canHoldChildren()) throw domError(`${this.nodeName} cannot hold children`, "HierarchyRequestError");
    if (!(node instanceof FakeNode)) throw new TypeError("only fake DOM nodes can be inserted");
    if (node instanceof FakeDocument || node.contains(this)) {
      throw domError("a node cannot be inserted inside itself or its descendants", "HierarchyRequestError");
    }
    if (reference === undefined) reference = null;
    if (reference !== null && reference.parentNode !== this) {
      throw domError("the reference node is not a child of this node", "NotFoundError");
    }
    if (node instanceof FakeDocumentFragment) {
      for (const kid of node.childNodes) this.insertBefore(kid, reference);
      return node;
    }
    if (reference === node) reference = node.nextSibling;
    if (node.parentNode) node.parentNode.removeChild(node);
    const kids = this[KIDS];
    const index = reference === null ? kids.length : kids.indexOf(reference);
    kids.splice(index, 0, node);
    node.parentNode = this;
    return node;
  }

  removeChild(child) {
    if (!(child instanceof FakeNode) || child.parentNode !== this) {
      throw domError("the node to remove is not a child of this node", "NotFoundError");
    }
    this[KIDS].splice(this[KIDS].indexOf(child), 1);
    child.parentNode = null;
    return child;
  }

  replaceChildren(...nodes) {
    const doc = this.ownerDocument ?? this;
    const incoming = nodes.map((n) => (n instanceof FakeNode ? n : doc.createTextNode(String(n))));
    if (!this.canHoldChildren()) throw domError(`${this.nodeName} cannot hold children`, "HierarchyRequestError");
    for (const node of incoming) {
      if (node instanceof FakeDocument || node.contains(this)) {
        throw domError("a node cannot be inserted inside itself or its descendants", "HierarchyRequestError");
      }
    }
    for (const kid of this.childNodes) this.removeChild(kid);
    for (const node of incoming) this.appendChild(node);
  }

  append(...nodes) {
    const doc = this.ownerDocument ?? this;
    for (const n of nodes) this.appendChild(n instanceof FakeNode ? n : doc.createTextNode(String(n)));
  }

  remove() {
    if (this.parentNode) this.parentNode.removeChild(this);
  }

  get textContent() {
    let text = "";
    for (const kid of this[KIDS]) text += kid.textContent ?? "";
    return text;
  }

  set textContent(value) {
    for (const kid of this.childNodes) this.removeChild(kid);
    const text = value === null || value === undefined ? "" : String(value);
    if (text !== "") this.appendChild((this.ownerDocument ?? this).createTextNode(text));
  }

  *descendants() {
    for (const kid of this[KIDS]) {
      if (kid instanceof FakeElement) {
        yield kid;
        yield* kid.descendants();
      }
    }
  }

  querySelector(selector) {
    const list = parseSelector(selector);
    for (const node of this.descendants()) if (matchesList(node, list)) return node;
    return null;
  }

  querySelectorAll(selector) {
    const list = parseSelector(selector);
    return [...this.descendants()].filter((node) => matchesList(node, list));
  }
}

export class FakeText extends FakeNode {
  constructor(ownerDocument, data) {
    super(ownerDocument);
    this.data = String(data);
  }

  get nodeType() {
    return FakeNode.TEXT_NODE;
  }

  get nodeName() {
    return "#text";
  }

  get nodeValue() {
    return this.data;
  }

  set nodeValue(value) {
    this.data = String(value);
  }

  get textContent() {
    return this.data;
  }

  set textContent(value) {
    this.data = value === null || value === undefined ? "" : String(value);
  }
}

export class FakeDocumentFragment extends FakeNode {
  get nodeType() {
    return FakeNode.DOCUMENT_FRAGMENT_NODE;
  }

  get nodeName() {
    return "#document-fragment";
  }

  canHoldChildren() {
    return true;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Elements: attributes, classList, style, dataset, reflection, focus
// ---------------------------------------------------------------------------------------------------------------

function kebab(name) {
  if (name === "cssFloat") return "float";
  return name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
}

function parseStyle(text) {
  const map = new Map();
  for (const part of String(text).split(";")) {
    const colon = part.indexOf(":");
    if (colon === -1) continue;
    const raw = part.slice(0, colon).trim();
    const value = part.slice(colon + 1).trim();
    if (raw === "" || value === "") continue;
    map.set(raw.startsWith("--") ? raw : raw.toLowerCase(), value);
  }
  return map;
}

function styleText(map) {
  return [...map].map(([name, value]) => `${name}: ${value};`).join(" ");
}

function createStyle(element) {
  const read = () => parseStyle(element.getAttribute("style") ?? "");
  const write = (map) => {
    if (map.size === 0) element.removeAttribute("style");
    else element.setAttribute("style", styleText(map));
  };
  const methods = {
    setProperty(name, value) {
      const map = read();
      const key = String(name).startsWith("--") ? String(name) : String(name).toLowerCase();
      if (value === null || value === undefined || String(value) === "") map.delete(key);
      else map.set(key, String(value));
      write(map);
    },
    removeProperty(name) {
      const map = read();
      const key = String(name).startsWith("--") ? String(name) : String(name).toLowerCase();
      const old = map.get(key) ?? "";
      map.delete(key);
      write(map);
      return old;
    },
    getPropertyValue(name) {
      const key = String(name).startsWith("--") ? String(name) : String(name).toLowerCase();
      return read().get(key) ?? "";
    },
  };
  return new Proxy(Object.create(null), {
    get(_, prop) {
      if (typeof prop === "symbol") return undefined;
      if (Object.hasOwn(methods, prop)) return methods[prop];
      if (prop === "cssText") return styleText(read());
      if (prop === "length") return read().size;
      return read().get(kebab(prop)) ?? "";
    },
    set(_, prop, value) {
      if (typeof prop === "symbol") return false;
      if (prop === "cssText") write(parseStyle(value ?? ""));
      else methods.setProperty(kebab(prop), value);
      return true;
    },
    deleteProperty(_, prop) {
      if (typeof prop !== "symbol") methods.removeProperty(kebab(prop));
      return true;
    },
    has(_, prop) {
      return typeof prop === "string" && read().has(kebab(prop));
    },
  });
}

function datasetName(prop) {
  if (/-[a-z]/.test(prop)) throw domError(`${prop} is not a valid dataset name`, "SyntaxError");
  return `data-${prop.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;
}

function datasetKey(attribute) {
  return attribute.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

function createDataset(element) {
  return new Proxy(Object.create(null), {
    get(_, prop) {
      if (typeof prop === "symbol") return undefined;
      return element.getAttribute(datasetName(prop)) ?? undefined;
    },
    set(_, prop, value) {
      if (typeof prop === "symbol") return false;
      element.setAttribute(datasetName(prop), String(value));
      return true;
    },
    deleteProperty(_, prop) {
      if (typeof prop !== "symbol") element.removeAttribute(datasetName(prop));
      return true;
    },
    has(_, prop) {
      return typeof prop === "string" && element.hasAttribute(datasetName(prop));
    },
    ownKeys() {
      return element.getAttributeNames().filter((n) => n.startsWith("data-")).map(datasetKey);
    },
    getOwnPropertyDescriptor(_, prop) {
      if (typeof prop !== "string" || !element.hasAttribute(datasetName(prop))) return undefined;
      return { value: element.getAttribute(datasetName(prop)), writable: true, enumerable: true, configurable: true };
    },
  });
}

function checkToken(token) {
  const text = String(token);
  if (text === "") throw domError("a class token cannot be empty", "SyntaxError");
  if (/\s/.test(text)) throw domError(`the class token ${JSON.stringify(text)} holds whitespace`, "InvalidCharacterError");
  return text;
}

function createClassList(element) {
  const read = () => (element.getAttribute("class") ?? "").split(/\s+/).filter(Boolean);
  const write = (tokens) => element.setAttribute("class", [...new Set(tokens)].join(" "));
  return Object.freeze({
    add(...tokens) {
      const checked = tokens.map(checkToken);
      write([...read(), ...checked]);
    },
    remove(...tokens) {
      const checked = new Set(tokens.map(checkToken));
      if (element.hasAttribute("class")) write(read().filter((t) => !checked.has(t)));
    },
    toggle(token, force) {
      const t = checkToken(token);
      const has = read().includes(t);
      const want = force === undefined ? !has : Boolean(force);
      if (want && !has) write([...read(), t]);
      if (!want && has) write(read().filter((x) => x !== t));
      return want;
    },
    contains(token) {
      return read().includes(String(token));
    },
    get length() {
      return new Set(read()).size;
    },
    get value() {
      return element.getAttribute("class") ?? "";
    },
    [Symbol.iterator]() {
      return [...new Set(read())][Symbol.iterator]();
    },
  });
}

/**
 * The `hidden` and `inert` properties, which only HTML elements have. On an SVG element a browser has no such property:
 * reading gives undefined and assigning only sets an expando that never reaches the attribute, so CSS [hidden] never
 * matches. The fake reads undefined and throws on assignment, so a module that hides an SVG node that way fails loudly.
 */
function booleanReflection(name) {
  return {
    get() {
      return this.isHtml ? this.hasAttribute(name) : undefined;
    },
    set(value) {
      if (!this.isHtml) {
        throw new TypeError(`${this.localName} is not an HTML element: a browser keeps .${name} as an expando and never sets the attribute; use toggleAttribute`);
      }
      this.toggleAttribute(name, Boolean(value));
    },
    configurable: true,
  };
}

export class FakeElement extends FakeNode {
  constructor(ownerDocument, namespaceURI, qualifiedName) {
    super(ownerDocument);
    this.namespaceURI = namespaceURI;
    const html = namespaceURI === HTML_NS;
    this.localName = html ? qualifiedName.toLowerCase() : qualifiedName;
    this.tagName = html ? qualifiedName.toUpperCase() : qualifiedName;
    this[ATTRS] = new Map();
  }

  get nodeType() {
    return FakeNode.ELEMENT_NODE;
  }

  get nodeName() {
    return this.tagName;
  }

  get isHtml() {
    return this.namespaceURI === HTML_NS;
  }

  canHoldChildren() {
    return true;
  }

  attributeName(name) {
    const text = String(name);
    if (!/^[^\s"'>/=]+$/.test(text)) throw domError(`${JSON.stringify(text)} is not a valid attribute name`, "InvalidCharacterError");
    return this.isHtml ? text.toLowerCase() : text;
  }

  setAttribute(name, value) {
    this[ATTRS].set(this.attributeName(name), String(value));
  }

  setAttributeNS(namespace, name, value) {
    if (namespace !== null && namespace !== "") throw new Error("the fake DOM models attributes without a namespace only");
    this.setAttribute(name, value);
  }

  getAttribute(name) {
    const key = this.attributeName(name);
    return this[ATTRS].has(key) ? this[ATTRS].get(key) : null;
  }

  hasAttribute(name) {
    return this[ATTRS].has(this.attributeName(name));
  }

  removeAttribute(name) {
    this[ATTRS].delete(this.attributeName(name));
  }

  toggleAttribute(name, force) {
    const has = this.hasAttribute(name);
    const want = force === undefined ? !has : Boolean(force);
    if (want && !has) this.setAttribute(name, "");
    if (!want && has) this.removeAttribute(name);
    return want;
  }

  getAttributeNames() {
    return [...this[ATTRS].keys()];
  }

  get id() {
    return this.getAttribute("id") ?? "";
  }

  set id(value) {
    this.setAttribute("id", value);
  }

  get className() {
    return this.getAttribute("class") ?? "";
  }

  set className(value) {
    this.setAttribute("class", value);
  }

  get classList() {
    this[CLASSLIST] ??= createClassList(this);
    return this[CLASSLIST];
  }

  get style() {
    this[STYLE] ??= createStyle(this);
    return this[STYLE];
  }

  get dataset() {
    this[DATASET] ??= createDataset(this);
    return this[DATASET];
  }

  get tabIndex() {
    const raw = this.getAttribute("tabindex");
    if (raw !== null && /^\s*[-+]?\d+\s*$/.test(raw)) return Number.parseInt(raw, 10);
    return this.nativelyFocusable() ? 0 : -1;
  }

  set tabIndex(value) {
    this.setAttribute("tabindex", String(Math.trunc(Number(value)) || 0));
  }

  get disabled() {
    return this.hasAttribute("disabled");
  }

  set disabled(value) {
    this.toggleAttribute("disabled", Boolean(value));
  }

  nativelyFocusable() {
    if (NATIVE_FOCUSABLE.has(this.localName) && this.isHtml) return true;
    return this.isHtml && (this.localName === "a" || this.localName === "area") && this.hasAttribute("href");
  }

  /** True when this element or an ancestor carries hidden or inert. */
  inHiddenOrInert() {
    for (let node = this; node instanceof FakeElement; node = node.parentNode) {
      if (node.hasAttribute("hidden") || node.hasAttribute("inert")) return true;
    }
    return false;
  }

  isFocusable() {
    if (!this.isConnected || this.inHiddenOrInert()) return false;
    if (FORM_CONTROLS.has(this.localName) && this.hasAttribute("disabled")) return false;
    const raw = this.getAttribute("tabindex");
    if (raw !== null && /^\s*[-+]?\d+\s*$/.test(raw)) return true;
    return this.nativelyFocusable();
  }

  focus() {
    if (!this.isFocusable()) return;
    const doc = this.ownerDocument;
    const previous = doc.activeElement;
    if (previous === this) return;
    doc[ACTIVE] = null;
    if (previous !== doc.body) {
      previous.dispatchEvent(new FakeFocusEvent("blur", { relatedTarget: this }));
      previous.dispatchEvent(new FakeFocusEvent("focusout", { bubbles: true, relatedTarget: this }));
    }
    doc[ACTIVE] = this;
    const from = previous === doc.body ? null : previous;
    this.dispatchEvent(new FakeFocusEvent("focus", { relatedTarget: from }));
    this.dispatchEvent(new FakeFocusEvent("focusin", { bubbles: true, relatedTarget: from }));
  }

  blur() {
    const doc = this.ownerDocument;
    if (doc.activeElement !== this) return;
    doc[ACTIVE] = null;
    this.dispatchEvent(new FakeFocusEvent("blur"));
    this.dispatchEvent(new FakeFocusEvent("focusout", { bubbles: true }));
  }

  getBoundingClientRect() {
    return { x: 0, y: 0, width: 0, height: 0, top: 0, right: 0, bottom: 0, left: 0 };
  }

  scrollIntoView() {}

  matches(selector) {
    return matchesList(this, parseSelector(selector));
  }

  closest(selector) {
    const list = parseSelector(selector);
    for (let node = this; node instanceof FakeElement; node = node.parentNode) if (matchesList(node, list)) return node;
    return null;
  }

  // Form values: an input or textarea value starts from its value attribute (textarea from its text) until set;
  // a select's value is its selected option's value.
  get value() {
    if (this.localName === "select") return this.selectedOption()?.value ?? "";
    if (this.localName === "option") return this.getAttribute("value") ?? this.textContent;
    if (this[VALUE] !== undefined) return this[VALUE];
    if (this.localName === "textarea") return this.textContent;
    return this.getAttribute("value") ?? (this.localName === "input" && this.getAttribute("type") === "checkbox" ? "on" : "");
  }

  set value(value) {
    if (this.localName === "select") {
      const text = String(value);
      for (const option of this.querySelectorAll("option")) option[SELECTED] = option.value === text;
      return;
    }
    if (this.localName === "option") {
      this.setAttribute("value", value);
      return;
    }
    this[VALUE] = String(value);
  }

  get checked() {
    return this[CHECKED] ?? this.hasAttribute("checked");
  }

  set checked(value) {
    this[CHECKED] = Boolean(value);
  }

  get selected() {
    return this[SELECTED] ?? this.hasAttribute("selected");
  }

  set selected(value) {
    if (value && this.parentNode) {
      const select = this.closest("select");
      if (select) for (const option of select.querySelectorAll("option")) option[SELECTED] = false;
    }
    this[SELECTED] = Boolean(value);
  }

  get options() {
    return this.localName === "select" ? this.querySelectorAll("option") : undefined;
  }

  get selectedIndex() {
    if (this.localName !== "select") return undefined;
    const option = this.selectedOption();
    return option ? this.options.indexOf(option) : -1;
  }

  set selectedIndex(index) {
    this.options.forEach((option, i) => {
      option[SELECTED] = i === Number(index);
    });
  }

  selectedOption() {
    const options = this.querySelectorAll("option");
    return options.find((o) => o[SELECTED] === true) ??
      options.find((o) => o[SELECTED] === undefined && o.hasAttribute("selected")) ??
      options.find((o) => o[SELECTED] !== false) ?? null;
  }

  get innerHTML() {
    throw r5("reading innerHTML");
  }

  set innerHTML(_) {
    throw r5("innerHTML");
  }

  get outerHTML() {
    throw r5("reading outerHTML");
  }

  set outerHTML(_) {
    throw r5("outerHTML");
  }

  insertAdjacentHTML() {
    throw r5("insertAdjacentHTML");
  }
}

for (const name of ["hidden", "inert"]) Object.defineProperty(FakeElement.prototype, name, booleanReflection(name));

/** click() of an HTML element; a disabled form control ignores it. */
function htmlClick() {
  if (FORM_CONTROLS.has(this.localName) && this.hasAttribute("disabled")) return;
  this.dispatchEvent(new FakeMouseEvent("click", { bubbles: true, cancelable: true, composed: true, detail: 1 }));
}

// Only HTMLElement has click(); on an SVG element it is absent, so calling it throws a TypeError as in a browser.
Object.defineProperty(FakeElement.prototype, "click", {
  get() {
    return this.isHtml ? htmlClick : undefined;
  },
  configurable: true,
});

// ---------------------------------------------------------------------------------------------------------------
// Document and window
// ---------------------------------------------------------------------------------------------------------------

export class FakeDocument extends FakeNode {
  constructor(window) {
    super(null);
    this.defaultView = window;
    this[ACTIVE] = null;
    const html = this.createElement("html");
    html.appendChild(this.createElement("head"));
    html.appendChild(this.createElement("body"));
    this.appendChild(html);
  }

  get nodeType() {
    return FakeNode.DOCUMENT_NODE;
  }

  get nodeName() {
    return "#document";
  }

  canHoldChildren() {
    return true;
  }

  eventParent() {
    return this.defaultView ?? null;
  }

  get textContent() {
    return null;
  }

  set textContent(_) {}

  get documentElement() {
    return this.firstElementChild;
  }

  get head() {
    return this.documentElement?.querySelector("head") ?? null;
  }

  get body() {
    return this.documentElement?.querySelector("body") ?? null;
  }

  get activeElement() {
    const active = this[ACTIVE];
    if (active && active.ownerDocument === this && active.isConnected && !active.inHiddenOrInert()) return active;
    return this.body;
  }

  createElement(tag) {
    const name = String(tag);
    if (!/^[A-Za-z][^\s"'>/=]*$/.test(name)) throw domError(`${JSON.stringify(name)} is not a valid tag name`, "InvalidCharacterError");
    return new FakeElement(this, HTML_NS, name);
  }

  createElementNS(namespace, qualifiedName) {
    const name = String(qualifiedName);
    if (!/^[A-Za-z][^\s"'>/=]*$/.test(name)) throw domError(`${JSON.stringify(name)} is not a valid tag name`, "InvalidCharacterError");
    return new FakeElement(this, namespace === null ? null : String(namespace), name);
  }

  createTextNode(data) {
    return new FakeText(this, data);
  }

  createDocumentFragment() {
    return new FakeDocumentFragment(this);
  }

  getElementById(id) {
    const text = String(id);
    for (const node of this.descendants()) if (node.getAttribute("id") === text) return node;
    return null;
  }

  write() {
    throw r5("document.write");
  }

  writeln() {
    throw r5("document.writeln");
  }

  get cookie() {
    throw r5("document.cookie");
  }

  set cookie(_) {
    throw r5("document.cookie");
  }
}

function normalizeQuery(query) {
  return String(query).trim().replace(/\s+/g, " ");
}

export class FakeMediaQueryList extends FakeEventTarget {
  constructor(media, controller) {
    super();
    this.media = media;
    this.controller = controller;
    this.handler = null;
    this.handlerListener = null;
  }

  get matches() {
    return this.controller.matches(this.media);
  }

  /** Like a browser event handler property: it runs in the listener order of the moment it was first set. */
  get onchange() {
    return this.handler;
  }

  set onchange(callback) {
    if (typeof callback !== "function") {
      if (this.handlerListener) this.removeEventListener("change", this.handlerListener);
      this.handler = null;
      this.handlerListener = null;
      return;
    }
    this.handler = callback;
    if (!this.handlerListener) {
      this.handlerListener = (event) => this.handler?.call(this, event);
      this.addEventListener("change", this.handlerListener);
    }
  }

  addListener(callback) {
    this.addEventListener("change", callback);
  }

  removeListener(callback) {
    this.removeEventListener("change", callback);
  }
}

export class FakeWindow extends FakeEventTarget {
  get localStorage() {
    throw new Error("the interface keeps no storage (design D-11): localStorage is not allowed");
  }

  get sessionStorage() {
    throw new Error("the interface keeps no storage (design D-11): sessionStorage is not allowed");
  }

  get indexedDB() {
    throw new Error("the interface keeps no storage (design D-11): indexedDB is not allowed");
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------------------------------------------

const escapeText = (text) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escapeAttribute = (text) => text.replace(/&/g, "&amp;").replace(/"/g, "&quot;");

/** HTML-like text of a node for assertions: attributes in insertion order, text escaped, void elements unclosed. */
export function serialize(node) {
  if (node instanceof FakeText) return escapeText(node.data);
  if (node instanceof FakeElement) {
    const attrs = [...node[ATTRS]].map(([name, value]) => ` ${name}="${escapeAttribute(value)}"`).join("");
    const open = `<${node.localName}${attrs}>`;
    if (node.isHtml && VOID_TAGS.has(node.localName)) return open;
    return `${open}${node[KIDS].map(serialize).join("")}</${node.localName}>`;
  }
  if (node instanceof FakeNode) return node[KIDS].map(serialize).join("");
  throw new TypeError("serialize takes a fake DOM node");
}

// ---------------------------------------------------------------------------------------------------------------
// Selectors: tag, *, #id, .class, [attr], [attr=value], :not(list), descendant and child combinators, comma lists
// ---------------------------------------------------------------------------------------------------------------

const IDENT = /^-?[A-Za-z_\u00A0-\uFFFF][\w\u00A0-\uFFFF-]*|^-?\d[\w-]*/;

function selectorError(selector, why) {
  return domError(`${JSON.stringify(selector)} is not a selector the fake DOM supports: ${why}`, "SyntaxError");
}

const selectorCache = new Map();

function parseSelector(selector) {
  const text = String(selector);
  if (selectorCache.has(text)) return selectorCache.get(text);
  let i = 0;
  const skipSpace = () => {
    const start = i;
    while (i < text.length && /\s/.test(text[i])) i += 1;
    return i > start;
  };
  const ident = (what) => {
    const m = IDENT.exec(text.slice(i));
    if (!m) throw selectorError(text, `expected ${what} at position ${i}`);
    i += m[0].length;
    return m[0];
  };
  const quoted = () => {
    const quote = text[i];
    const end = text.indexOf(quote, i + 1);
    if (end === -1) throw selectorError(text, "an unclosed quote");
    const value = text.slice(i + 1, end);
    i = end + 1;
    return value;
  };

  function compound(stopAt) {
    const c = { tag: null, ids: [], classes: [], attrs: [], nots: [] };
    let parts = 0;
    if (text[i] === "*") {
      c.tag = "*";
      i += 1;
      parts += 1;
    } else if (IDENT.test(text.slice(i)) && !/^-?\d/.test(text.slice(i))) {
      c.tag = ident("a tag");
      parts += 1;
    }
    for (;;) {
      const ch = text[i];
      if (ch === "#") {
        i += 1;
        c.ids.push(ident("an id"));
      } else if (ch === ".") {
        i += 1;
        c.classes.push(ident("a class"));
      } else if (ch === "[") {
        i += 1;
        skipSpace();
        const name = ident("an attribute name");
        skipSpace();
        let value;
        if (text[i] === "=") {
          i += 1;
          skipSpace();
          value = text[i] === '"' || text[i] === "'" ? quoted() : ident("an attribute value");
          skipSpace();
        } else if (text[i] !== "]") {
          throw selectorError(text, `attribute operator ${JSON.stringify(text[i])} is not modelled; use [attr] or [attr=value]`);
        }
        if (text[i] !== "]") throw selectorError(text, "an unclosed attribute selector");
        i += 1;
        c.attrs.push({ name, value });
      } else if (ch === ":") {
        i += 1;
        const name = ident("a pseudo-class");
        if (name !== "not" || text[i] !== "(") throw selectorError(text, `:${name} is not modelled; only :not() is`);
        i += 1;
        c.nots.push(list(")"));
        if (text[i] !== ")") throw selectorError(text, "an unclosed :not(");
        i += 1;
      } else {
        break;
      }
      parts += 1;
    }
    if (parts === 0) throw selectorError(text, `expected a simple selector at position ${i}`);
    if (i < text.length && ![",", ">", stopAt].includes(text[i]) && !/\s/.test(text[i])) {
      throw selectorError(text, `${JSON.stringify(text[i])} at position ${i} is not modelled`);
    }
    return c;
  }

  function complex(stopAt) {
    const parts = [{ compound: compound(stopAt), combinator: null }];
    for (;;) {
      const spaced = skipSpace();
      const ch = text[i];
      if (i >= text.length || ch === "," || ch === stopAt) return parts;
      let combinator = " ";
      if (ch === ">") {
        combinator = ">";
        i += 1;
        skipSpace();
      } else if (!spaced) {
        throw selectorError(text, `${JSON.stringify(ch)} at position ${i} is not modelled`);
      }
      parts.push({ compound: compound(stopAt), combinator });
    }
  }

  function list(stopAt) {
    const out = [];
    for (;;) {
      skipSpace();
      out.push(complex(stopAt));
      if (text[i] !== ",") return out;
      i += 1;
    }
  }

  const parsed = list(undefined);
  if (i < text.length) throw selectorError(text, `unexpected ${JSON.stringify(text[i])} at position ${i}`);
  selectorCache.set(text, parsed);
  return parsed;
}

function matchesCompound(element, c) {
  if (c.tag !== null && c.tag !== "*") {
    if (element.isHtml ? element.localName !== c.tag.toLowerCase() : element.localName !== c.tag) return false;
  }
  for (const id of c.ids) if (element.getAttribute("id") !== id) return false;
  for (const name of c.classes) if (!element.classList.contains(name)) return false;
  for (const { name, value } of c.attrs) {
    const actual = element.getAttribute(name);
    if (actual === null || (value !== undefined && actual !== value)) return false;
  }
  for (const inner of c.nots) if (matchesList(element, inner)) return false;
  return true;
}

function matchesComplex(element, parts, index) {
  if (!matchesCompound(element, parts[index].compound)) return false;
  if (index === 0) return true;
  const { combinator } = parts[index];
  if (combinator === ">") {
    const parent = element.parentElement;
    return parent !== null && matchesComplex(parent, parts, index - 1);
  }
  for (let node = element.parentElement; node; node = node.parentElement) {
    if (matchesComplex(node, parts, index - 1)) return true;
  }
  return false;
}

function matchesList(element, list) {
  return list.some((parts) => matchesComplex(element, parts, parts.length - 1));
}

// ---------------------------------------------------------------------------------------------------------------
// Frames, media and installation
// ---------------------------------------------------------------------------------------------------------------

function createFrames(options) {
  const queue = new Map();
  let nextId = 1;
  let last = 0;
  const injected = typeof options.requestAnimationFrame === "function";
  return {
    request(callback) {
      if (typeof callback !== "function") throw new TypeError("requestAnimationFrame takes a function");
      if (injected) return options.requestAnimationFrame(callback);
      const id = nextId;
      nextId += 1;
      queue.set(id, callback);
      return id;
    },
    cancel(id) {
      if (typeof options.cancelAnimationFrame === "function") options.cancelAnimationFrame(id);
      else queue.delete(id);
    },
    flush(timestamp) {
      last = timestamp === undefined ? last + 16 : timestamp;
      const batch = [...queue];
      queue.clear();
      const errors = [];
      for (const [, callback] of batch) {
        try {
          callback(last);
        } catch (error) {
          errors.push(error);
        }
      }
      if (errors.length > 0) throw errors[0];
      return batch.length;
    },
    get pending() {
      return queue.size;
    },
  };
}

function createMedia(initial) {
  const results = new Map();
  const lists = new Map();
  for (const [query, matches] of Object.entries(initial ?? {})) results.set(normalizeQuery(query), Boolean(matches));
  const controller = {
    matches(query) {
      return results.get(normalizeQuery(query)) ?? false;
    },
    list(query) {
      const media = normalizeQuery(query);
      const mql = new FakeMediaQueryList(media, controller);
      if (!lists.has(media)) lists.set(media, []);
      lists.get(media).push(mql);
      return mql;
    },
    set(query, matches) {
      const media = normalizeQuery(query);
      const next = Boolean(matches);
      if (controller.matches(media) === next) return;
      results.set(media, next);
      for (const mql of lists.get(media) ?? []) mql.dispatchEvent(new FakeMediaQueryListEvent("change", { matches: next, media }));
    },
  };
  return controller;
}

/** Builds a fake document and window without touching globals; see the header for options and controls. */
export function createFakeDom(options = {}) {
  const frames = createFrames(options);
  const mediaController = createMedia(options.media);
  const window = new FakeWindow();
  const document = new FakeDocument(window);
  Object.assign(window, {
    document,
    innerWidth: options.innerWidth ?? 1280,
    innerHeight: options.innerHeight ?? 800,
    devicePixelRatio: 1,
    requestAnimationFrame: (callback) => frames.request(callback),
    cancelAnimationFrame: (id) => frames.cancel(id),
    matchMedia: (query) => mediaController.list(query),
  });
  window.window = window;
  window.self = window;
  const media = { set: mediaController.set, matches: mediaController.matches };
  return { document, window, frames, media, serialize };
}

/**
 * Installs a fresh fake DOM on `target` (default globalThis): document, window, requestAnimationFrame,
 * cancelAnimationFrame, matchMedia, the Event classes and the node classes. Returns an uninstall function that
 * restores every replaced property; its `dom` property holds the createFakeDom controls.
 */
export function installFakeDom(target = globalThis, options = {}) {
  const dom = createFakeDom(options);
  const values = {
    document: dom.document,
    window: dom.window,
    requestAnimationFrame: dom.window.requestAnimationFrame,
    cancelAnimationFrame: dom.window.cancelAnimationFrame,
    matchMedia: dom.window.matchMedia,
    Event: FakeEvent,
    CustomEvent: FakeCustomEvent,
    UIEvent: FakeUIEvent,
    KeyboardEvent: FakeKeyboardEvent,
    MouseEvent: FakeMouseEvent,
    PointerEvent: FakePointerEvent,
    FocusEvent: FakeFocusEvent,
    MediaQueryListEvent: FakeMediaQueryListEvent,
    Node: FakeNode,
    Element: FakeElement,
    HTMLElement: FakeElement,
    SVGElement: FakeElement,
    Text: FakeText,
    DocumentFragment: FakeDocumentFragment,
    Document: FakeDocument,
  };
  const saved = Object.keys(values).map((key) => [key, Object.getOwnPropertyDescriptor(target, key)]);
  for (const [key, value] of Object.entries(values)) {
    Object.defineProperty(target, key, { value, writable: true, configurable: true, enumerable: false });
  }
  let installed = true;
  const uninstall = () => {
    if (!installed) return;
    installed = false;
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(target, key, descriptor);
      else delete target[key];
    }
  };
  uninstall.dom = dom;
  return uninstall;
}

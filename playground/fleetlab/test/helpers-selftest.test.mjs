// Self-tests of the shared interface test helpers: test/helpers/fake-dom.mjs and test/helpers/model-payloads.mjs.

import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";

import { createFakeDom, installFakeDom, serialize } from "./helpers/fake-dom.mjs";
import {
  experimentDraft,
  experimentPayload,
  FAST_REPLICATIONS,
  forkCandidate,
  frozenExperiment,
  pairPayload,
  presetScenario,
  runThroughWorkerHandler,
  windowPayload,
} from "./helpers/model-payloads.mjs";
import { createDrivers } from "../src/runtime/protocol.js";
import { MODEL_API } from "../src/runtime/worker.js";
import { start } from "../src/ui/app.js";
import { keyedList } from "../src/ui/dom.js";

const SVG_NS = "http://www.w3.org/2000/svg";

/** A fresh fake DOM installed on globalThis for one test body. */
function withDom(body, options) {
  return async () => {
    const uninstall = installFakeDom(globalThis, options);
    try {
      await body(uninstall.dom);
    } finally {
      uninstall();
    }
  };
}

/** Parses a small tree: [tag, attrs, ...children] with strings as text. */
function build(doc, spec) {
  if (typeof spec === "string") return doc.createTextNode(spec);
  const [tag, attrs = {}, ...kids] = spec;
  const node = doc.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
  for (const kid of kids) node.appendChild(build(doc, kid));
  return node;
}

describe("fake DOM: installation", () => {
  test("installFakeDom defines the globals and uninstall restores or deletes them", () => {
    const target = { Event: "kept", unrelated: 1 };
    const uninstall = installFakeDom(target);
    assert.equal(typeof target.document.createElement, "function");
    assert.equal(target.window.document, target.document);
    assert.equal(typeof target.requestAnimationFrame, "function");
    assert.equal(typeof target.matchMedia, "function");
    assert.notEqual(target.Event, "kept");
    assert.equal(typeof target.dom, "undefined");
    uninstall();
    assert.equal(target.Event, "kept");
    assert.equal("document" in target, false);
    assert.equal("window" in target, false);
    assert.equal(target.unrelated, 1);
    uninstall();
    assert.equal(target.Event, "kept");
  });

  test("installing on globalThis replaces and then restores the native Event", () => {
    const NativeEvent = globalThis.Event;
    const hadDocument = "document" in globalThis;
    const uninstall = installFakeDom();
    assert.notEqual(globalThis.Event, NativeEvent);
    assert.equal(document, uninstall.dom.document);
    uninstall();
    assert.equal(globalThis.Event, NativeEvent);
    assert.equal("document" in globalThis, hadDocument);
  });

  test("createFakeDom builds independent documents without touching globals", () => {
    const a = createFakeDom();
    const b = createFakeDom();
    assert.notEqual(a.document, b.document);
    assert.equal(a.document.body.tagName, "BODY");
    assert.equal(a.document.head.tagName, "HEAD");
    assert.equal(a.document.documentElement.tagName, "HTML");
    assert.equal(a.document.activeElement, a.document.body);
  });
});

describe("fake DOM: nodes, attributes and text", () => {
  test("createElement, createElementNS and createTextNode", withDom(() => {
    const div = document.createElement("DIV");
    assert.equal(div.tagName, "DIV");
    assert.equal(div.localName, "div");
    assert.equal(div.nodeType, 1);
    const svg = document.createElementNS(SVG_NS, "linearGradient");
    assert.equal(svg.tagName, "linearGradient");
    assert.equal(svg.namespaceURI, SVG_NS);
    svg.setAttribute("viewBox", "0 0 10 10");
    assert.equal(svg.getAttribute("viewBox"), "0 0 10 10");
    assert.equal(svg.getAttribute("viewbox"), null);
    div.setAttribute("ARIA-Label", "x");
    assert.equal(div.getAttribute("aria-label"), "x");
    const text = document.createTextNode("hi");
    assert.equal(text.nodeType, 3);
    assert.equal(text.textContent, "hi");
    assert.throws(() => document.createElement("a b"), { name: "InvalidCharacterError" });
  }));

  test("setAttribute, getAttribute, removeAttribute, hasAttribute and toggleAttribute", withDom(() => {
    const el = document.createElement("div");
    el.setAttribute("data-x", 5);
    assert.equal(el.getAttribute("data-x"), "5");
    assert.equal(el.hasAttribute("data-x"), true);
    assert.equal(el.getAttribute("missing"), null);
    el.removeAttribute("data-x");
    assert.equal(el.hasAttribute("data-x"), false);
    assert.equal(el.toggleAttribute("hidden"), true);
    assert.equal(el.getAttribute("hidden"), "");
    assert.equal(el.toggleAttribute("hidden", true), true);
    assert.equal(el.toggleAttribute("hidden"), false);
    assert.equal(el.hasAttribute("hidden"), false);
    assert.throws(() => el.setAttribute("a b", "1"), { name: "InvalidCharacterError" });
  }));

  test("textContent concatenates descendant text and setting it replaces the children", withDom(() => {
    const root = build(document, ["div", {}, "a", ["span", {}, "b", ["em", {}, "c"]], "d"]);
    assert.equal(root.textContent, "abcd");
    const span = root.children[0];
    root.textContent = "plain";
    assert.equal(root.childNodes.length, 1);
    assert.equal(root.firstChild.nodeType, 3);
    assert.equal(span.parentNode, null);
    root.textContent = "";
    assert.equal(root.childNodes.length, 0);
    root.textContent = 42;
    assert.equal(root.textContent, "42");
  }));

  test("appendChild, insertBefore, removeChild, replaceChildren, remove and the sibling accessors", withDom(() => {
    const parent = document.createElement("ul");
    const [a, b, c] = ["a", "b", "c"].map((id) => {
      const li = document.createElement("li");
      li.setAttribute("id", id);
      return li;
    });
    assert.equal(parent.appendChild(a), a);
    parent.appendChild(c);
    parent.insertBefore(b, c);
    assert.deepEqual(parent.children.map((n) => n.id), ["a", "b", "c"]);
    assert.equal(parent.firstChild, a);
    assert.equal(parent.lastChild, c);
    assert.equal(a.nextSibling, b);
    assert.equal(c.nextSibling, null);
    assert.equal(b.previousSibling, a);
    assert.equal(b.parentNode, parent);
    parent.insertBefore(c, a);
    assert.deepEqual(parent.children.map((n) => n.id), ["c", "a", "b"]);
    parent.insertBefore(a, a);
    assert.deepEqual(parent.children.map((n) => n.id), ["c", "a", "b"]);
    parent.appendChild(c);
    assert.deepEqual(parent.children.map((n) => n.id), ["a", "b", "c"]);
    const other = document.createElement("ol");
    other.appendChild(b);
    assert.deepEqual(parent.children.map((n) => n.id), ["a", "c"]);
    assert.equal(b.parentNode, other);
    assert.throws(() => parent.removeChild(b), { name: "NotFoundError" });
    assert.throws(() => parent.insertBefore(b, other), { name: "NotFoundError" });
    assert.throws(() => a.appendChild(parent), { name: "HierarchyRequestError" });
    assert.throws(() => document.createTextNode("t").appendChild(a), { name: "HierarchyRequestError" });
    assert.equal(parent.removeChild(a), a);
    assert.equal(a.parentNode, null);
    c.remove();
    assert.equal(parent.childNodes.length, 0);
    parent.replaceChildren(a, "text", c);
    assert.equal(parent.childNodes.length, 3);
    assert.equal(parent.children.length, 2);
    assert.equal(parent.childNodes[1].textContent, "text");
    parent.replaceChildren();
    assert.equal(parent.firstChild, null);
    assert.equal(a.parentNode, null);
  }));

  test("a document fragment moves its children on insertion", withDom(() => {
    const fragment = document.createDocumentFragment();
    fragment.appendChild(document.createElement("i"));
    fragment.appendChild(document.createElement("b"));
    const host = document.createElement("p");
    host.appendChild(fragment);
    assert.equal(serialize(host), "<p><i></i><b></b></p>");
    assert.equal(fragment.childNodes.length, 0);
  }));

  test("classList add, remove, toggle and contains stay in step with the class attribute", withDom(() => {
    const el = document.createElement("div");
    el.classList.add("fl-a", "fl-b", "fl-a");
    assert.equal(el.getAttribute("class"), "fl-a fl-b");
    assert.equal(el.classList.contains("fl-b"), true);
    el.classList.remove("fl-a");
    assert.equal(el.className, "fl-b");
    assert.equal(el.classList.toggle("fl-c"), true);
    assert.equal(el.classList.toggle("fl-c"), false);
    assert.equal(el.classList.toggle("fl-b", true), true);
    assert.equal(el.classList.toggle("fl-d", false), false);
    assert.equal(el.getAttribute("class"), "fl-b");
    el.setAttribute("class", "  x   y ");
    assert.equal(el.classList.contains("y"), true);
    assert.equal(el.classList.length, 2);
    assert.throws(() => el.classList.add(""), { name: "SyntaxError" });
    assert.throws(() => el.classList.add("a b"), { name: "InvalidCharacterError" });
  }));

  test("style setProperty, removeProperty and property assignment reflect to the style attribute", withDom(() => {
    const el = document.createElement("div");
    el.style.setProperty("--fl-x", "12px");
    el.style.transform = "translateX(4px)";
    el.style.backgroundColor = "red";
    assert.equal(el.getAttribute("style"), "--fl-x: 12px; transform: translateX(4px); background-color: red;");
    assert.equal(el.style.getPropertyValue("--fl-x"), "12px");
    assert.equal(el.style.backgroundColor, "red");
    assert.equal(el.style.opacity, "");
    assert.equal(el.style.removeProperty("transform"), "translateX(4px)");
    el.style.backgroundColor = "";
    assert.equal(el.getAttribute("style"), "--fl-x: 12px;");
    el.style.removeProperty("--fl-x");
    assert.equal(el.hasAttribute("style"), false);
    el.setAttribute("style", "opacity: 0.5; margin-top: 2px");
    assert.equal(el.style.marginTop, "2px");
    assert.equal(el.style.length, 2);
  }));

  test("dataset reads and writes data attributes", withDom(() => {
    const el = document.createElement("div");
    el.dataset.phoneGroup = "now";
    assert.equal(el.getAttribute("data-phone-group"), "now");
    el.setAttribute("data-open", "false");
    assert.equal(el.dataset.open, "false");
    assert.equal(el.dataset.missing, undefined);
    assert.deepEqual(Object.keys(el.dataset), ["phoneGroup", "open"]);
    assert.equal("open" in el.dataset, true);
    delete el.dataset.open;
    assert.equal(el.hasAttribute("data-open"), false);
  }));

  test("tabIndex, hidden, inert, disabled, id and className reflect to attributes", withDom(() => {
    const div = document.createElement("div");
    assert.equal(div.tabIndex, -1);
    assert.equal(document.createElement("button").tabIndex, 0);
    div.tabIndex = 0;
    assert.equal(div.getAttribute("tabindex"), "0");
    div.tabIndex = -1;
    assert.equal(div.tabIndex, -1);
    for (const name of ["hidden", "inert", "disabled"]) {
      div[name] = true;
      assert.equal(div.getAttribute(name), "", name);
      assert.equal(div[name], true, name);
      div[name] = false;
      assert.equal(div.hasAttribute(name), false, name);
    }
    div.id = "x";
    div.className = "fl-a";
    assert.equal(serialize(div), '<div tabindex="-1" id="x" class="fl-a"></div>');
  }));

  test("hidden, inert and click() are HTML-only, as in a browser: an SVG node has none of them", withDom(() => {
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    for (const name of ["hidden", "inert"]) {
      assert.equal(g[name], undefined, name);
      assert.throws(() => { g[name] = true; }, TypeError, name);
      assert.equal(g.hasAttribute(name), false, `${name} never reaches the attribute`);
    }
    g.toggleAttribute("hidden", true);
    assert.equal(g.hasAttribute("hidden"), true, "toggleAttribute is how an SVG node is hidden");
    assert.equal(g.click, undefined);
    assert.throws(() => g.click(), TypeError);
    assert.equal(typeof document.createElement("button").click, "function");
  }));

  test("input, checkbox and select values", withDom(() => {
    const input = build(document, ["input", { value: "3" }]);
    assert.equal(input.value, "3");
    input.value = 7;
    assert.equal(input.value, "7");
    assert.equal(input.getAttribute("value"), "3");
    const box = build(document, ["input", { type: "checkbox", checked: "" }]);
    assert.equal(box.checked, true);
    box.checked = false;
    assert.equal(box.checked, false);
    const select = build(document, ["select", {}, ["option", { value: "a" }, "A"], ["option", { value: "b", selected: "" }, "B"], ["option", {}, "c"]]);
    assert.equal(select.value, "b");
    assert.equal(select.selectedIndex, 1);
    select.value = "c";
    assert.equal(select.value, "c");
    assert.equal(select.selectedIndex, 2);
    select.options[0].selected = true;
    assert.equal(select.value, "a");
  }));

  test("getBoundingClientRect returns zeros", withDom(() => {
    const rect = document.createElement("div").getBoundingClientRect();
    assert.deepEqual(rect, { x: 0, y: 0, width: 0, height: 0, top: 0, right: 0, bottom: 0, left: 0 });
  }));
});

describe("fake DOM: events", () => {
  test("capture, target and bubble phases run in browser order", withDom(() => {
    const outer = document.createElement("div");
    const inner = document.createElement("button");
    outer.appendChild(inner);
    document.body.appendChild(outer);
    const seen = [];
    const log = (name) => (event) => seen.push(`${name}:${event.eventPhase}:${event.currentTarget === event.target}`);
    window.addEventListener("click", log("window-capture"), true);
    window.addEventListener("click", log("window-bubble"));
    document.addEventListener("click", log("doc-capture"), { capture: true });
    outer.addEventListener("click", log("outer-bubble"));
    outer.addEventListener("click", log("outer-capture"), true);
    inner.addEventListener("click", log("inner-bubble"));
    inner.addEventListener("click", log("inner-capture"), true);
    const result = inner.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    assert.equal(result, true);
    assert.deepEqual(seen, [
      "window-capture:1:false",
      "doc-capture:1:false",
      "outer-capture:1:false",
      "inner-capture:2:true",
      "inner-bubble:2:true",
      "outer-bubble:3:false",
      "window-bubble:3:false",
    ]);
  }));

  test("a non-bubbling event skips the bubble phase; the event resets after dispatch", withDom(() => {
    const outer = document.createElement("div");
    const inner = document.createElement("span");
    outer.appendChild(inner);
    const seen = [];
    outer.addEventListener("ping", () => seen.push("outer-bubble"));
    outer.addEventListener("ping", () => seen.push("outer-capture"), true);
    inner.addEventListener("ping", (event) => seen.push(event.composedPath().length));
    const event = new Event("ping");
    inner.dispatchEvent(event);
    assert.deepEqual(seen, ["outer-capture", 2]);
    assert.equal(event.eventPhase, 0);
    assert.equal(event.currentTarget, null);
    assert.equal(event.target, inner);
    assert.deepEqual(event.composedPath(), []);
  }));

  test("stopPropagation and stopImmediatePropagation", withDom(() => {
    const outer = document.createElement("div");
    const inner = document.createElement("span");
    outer.appendChild(inner);
    const seen = [];
    inner.addEventListener("x", (event) => {
      seen.push("first");
      event.stopPropagation();
    });
    inner.addEventListener("x", () => seen.push("second"));
    outer.addEventListener("x", () => seen.push("outer"));
    inner.dispatchEvent(new Event("x", { bubbles: true }));
    assert.deepEqual(seen, ["first", "second"]);
    seen.length = 0;
    const other = document.createElement("span");
    outer.appendChild(other);
    other.addEventListener("x", (event) => {
      seen.push("first");
      event.stopImmediatePropagation();
    });
    other.addEventListener("x", () => seen.push("second"));
    other.dispatchEvent(new Event("x", { bubbles: true }));
    assert.deepEqual(seen, ["first"]);
  }));

  test("preventDefault honours cancelable and passive listeners", withDom(() => {
    const el = document.createElement("div");
    const prevent = (event) => event.preventDefault();
    el.addEventListener("keydown", prevent);
    assert.equal(el.dispatchEvent(new KeyboardEvent("keydown", { cancelable: true, key: " " })), false);
    assert.equal(el.dispatchEvent(new KeyboardEvent("keydown", { key: " " })), true);
    el.removeEventListener("keydown", prevent);
    el.addEventListener("keydown", prevent, { passive: true });
    const event = new KeyboardEvent("keydown", { cancelable: true, key: "ArrowLeft", shiftKey: true });
    assert.equal(el.dispatchEvent(event), true);
    assert.equal(event.defaultPrevented, false);
    assert.equal(event.key, "ArrowLeft");
    assert.equal(event.shiftKey, true);
    assert.equal(event.altKey, false);
  }));

  test("once, duplicates, removal, handleEvent objects, signals and removal during dispatch", withDom(() => {
    const el = document.createElement("div");
    let count = 0;
    const listener = () => {
      count += 1;
    };
    el.addEventListener("x", listener);
    el.addEventListener("x", listener);
    el.dispatchEvent(new Event("x"));
    assert.equal(count, 1);
    el.removeEventListener("x", listener, true);
    el.dispatchEvent(new Event("x"));
    assert.equal(count, 2);
    el.removeEventListener("x", listener);
    el.dispatchEvent(new Event("x"));
    assert.equal(count, 2);

    el.addEventListener("y", listener, { once: true });
    el.dispatchEvent(new Event("y"));
    el.dispatchEvent(new Event("y"));
    assert.equal(count, 3);

    const handler = { calls: 0, handleEvent(event) { this.calls += event.detail; } };
    el.addEventListener("z", handler);
    el.dispatchEvent(new CustomEvent("z", { detail: 5 }));
    assert.equal(handler.calls, 5);

    const controller = new AbortController();
    el.addEventListener("w", listener, { signal: controller.signal });
    controller.abort();
    el.dispatchEvent(new Event("w"));
    assert.equal(count, 3);

    const later = () => assert.fail("a listener removed during dispatch must not run");
    el.addEventListener("v", () => el.removeEventListener("v", later));
    el.addEventListener("v", later);
    el.dispatchEvent(new Event("v"));
  }));

  test("a throwing listener does not stop the others and its error is rethrown after dispatch", withDom(() => {
    const el = document.createElement("div");
    const seen = [];
    el.addEventListener("x", () => {
      throw new Error("boom");
    });
    el.addEventListener("x", () => seen.push("after"));
    assert.throws(() => el.dispatchEvent(new Event("x")), /boom/);
    assert.deepEqual(seen, ["after"]);
  }));

  test("dispatchEvent refuses native events and events already in dispatch", withDom(() => {
    const el = document.createElement("div");
    assert.throws(() => el.dispatchEvent({ type: "x" }), TypeError);
    const event = new Event("x");
    el.addEventListener("x", () => assert.throws(() => el.dispatchEvent(event), { name: "InvalidStateError" }));
    el.dispatchEvent(event);
  }));

  test("click dispatches a bubbling click and does nothing on a disabled control", withDom(() => {
    const form = document.createElement("div");
    const button = document.createElement("button");
    form.appendChild(button);
    let clicks = 0;
    form.addEventListener("click", (event) => {
      clicks += 1;
      assert.equal(event.target, button);
      assert.ok(event instanceof MouseEvent);
    });
    button.click();
    button.disabled = true;
    button.click();
    assert.equal(clicks, 1);
  }));
});

describe("fake DOM: focus", () => {
  test("focus and blur move document.activeElement and fire focus events in order", withDom(() => {
    const panel = build(document, ["div", {}, ["button", { id: "a" }], ["div", { id: "b", tabindex: "-1" }], ["div", { id: "plain" }]]);
    document.body.appendChild(panel);
    const [a, b, plain] = ["a", "b", "plain"].map((id) => document.getElementById(id));
    const seen = [];
    for (const type of ["focus", "blur", "focusin", "focusout"]) {
      panel.addEventListener(type, (event) => seen.push(`${type}:${event.target.id}:${document.activeElement.id || "body"}`));
    }
    a.focus();
    assert.equal(document.activeElement, a);
    b.focus();
    assert.equal(document.activeElement, b);
    plain.focus();
    assert.equal(document.activeElement, b);
    b.blur();
    assert.equal(document.activeElement, document.body);
    a.blur();
    assert.deepEqual(seen, ["focusin:a:a", "focusout:a:body", "focusin:b:b", "focusout:b:body"]);
  }));

  test("focus reaches the target's own focus and blur listeners", withDom(() => {
    const a = build(document, ["button", {}]);
    document.body.appendChild(a);
    const seen = [];
    a.addEventListener("focus", () => seen.push("focus"));
    a.addEventListener("blur", () => seen.push("blur"));
    a.focus();
    a.focus();
    a.blur();
    assert.deepEqual(seen, ["focus", "blur"]);
  }));

  test("detached, hidden, inert and disabled elements do not take focus", withDom(() => {
    const detached = document.createElement("button");
    detached.focus();
    assert.equal(document.activeElement, document.body);
    const drawer = build(document, ["aside", { inert: "" }, ["button", { id: "in-inert" }]]);
    const hidden = build(document, ["div", { hidden: "" }, ["button", { id: "in-hidden" }]]);
    const disabled = build(document, ["button", { id: "disabled", disabled: "" }]);
    document.body.replaceChildren(drawer, hidden, disabled);
    for (const id of ["in-inert", "in-hidden", "disabled"]) {
      document.getElementById(id).focus();
      assert.equal(document.activeElement, document.body, id);
    }
    drawer.inert = false;
    const button = document.getElementById("in-inert");
    button.focus();
    assert.equal(document.activeElement, button);
    drawer.inert = true;
    assert.equal(document.activeElement, document.body);
    drawer.inert = false;
    button.focus();
    button.remove();
    assert.equal(document.activeElement, document.body);
  }));
});

describe("fake DOM: selectors", () => {
  function tree() {
    const root = build(document, [
      "main", { id: "root", class: "fl-app" },
      ["section", { id: "now", class: "fl-now fl-panel", "data-open": "true" },
        ["div", { class: "fl-now__row", "data-kind": "wait" }, ["span", { class: "fl-chip-replay" }, "this replay"]],
        ["div", { class: "fl-now__row" }, ["span", { class: "fl-absent" }, "absent"]]],
      ["aside", { id: "inspector", class: "fl-drawer", hidden: "" }, ["span", { class: "fl-chip-replay" }, "x"]],
    ]);
    document.body.appendChild(root);
    return root;
  }

  test("tag, id, class, attribute, :not and combinators", withDom(() => {
    const root = tree();
    const ids = (list) => list.map((n) => n.id || n.className);
    assert.equal(document.querySelector("#now").id, "now");
    assert.equal(root.querySelector("SECTION").id, "now");
    assert.deepEqual(ids(root.querySelectorAll(".fl-chip-replay")), ["fl-chip-replay", "fl-chip-replay"]);
    assert.deepEqual(ids(root.querySelectorAll("section .fl-chip-replay")), ["fl-chip-replay"]);
    assert.deepEqual(ids(root.querySelectorAll("#root > .fl-now > div")), ["fl-now__row", "fl-now__row"]);
    assert.equal(root.querySelectorAll("#root > div").length, 0);
    assert.equal(root.querySelectorAll("[hidden]").length, 1);
    assert.equal(root.querySelectorAll('[data-open="true"]').length, 1);
    assert.equal(root.querySelectorAll("[data-open='true']").length, 1);
    assert.equal(root.querySelectorAll("[data-open=false]").length, 0);
    assert.equal(root.querySelectorAll("[data-kind=wait]").length, 1);
    assert.equal(root.querySelectorAll(".fl-now__row:not([data-kind])").length, 1);
    assert.deepEqual(ids(root.querySelectorAll(":not(section) > .fl-chip-replay")), ["fl-chip-replay", "fl-chip-replay"]);
    assert.equal(root.querySelectorAll("span:not(.fl-absent, [hidden] span)").length, 1);
    assert.equal(root.querySelectorAll(".fl-now.fl-panel").length, 1);
    assert.equal(root.querySelectorAll("*").length, 7);
    assert.deepEqual(ids(root.querySelectorAll("aside, section")), ["now", "inspector"]);
    assert.equal(root.querySelector(".nothing"), null);
    assert.equal(document.querySelectorAll("body main").length, 1);
    assert.equal(document.getElementById("inspector").matches("aside[hidden].fl-drawer"), true);
    assert.equal(root.querySelector(".fl-absent").closest("section").id, "now");
    assert.equal(root.querySelector(".fl-absent").closest("aside"), null);
  }));

  test("SVG type selectors match case-sensitively; HTML ones do not", withDom(() => {
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.appendChild(document.createElementNS(SVG_NS, "linearGradient"));
    document.body.appendChild(svg);
    assert.equal(document.querySelectorAll("linearGradient").length, 1);
    assert.equal(document.querySelectorAll("lineargradient").length, 0);
    assert.equal(document.querySelectorAll("BODY svg").length, 1);
  }));

  test("unsupported selectors throw a SyntaxError", withDom(() => {
    const root = tree();
    for (const selector of ["", "div + span", "div ~ span", "[a^=b]", "a:hover", "::before", "div >", "[a", ".", "a,"]) {
      assert.throws(() => root.querySelectorAll(selector), { name: "SyntaxError" }, selector);
    }
  }));
});

describe("fake DOM: frames, media, serialization and rule R5", () => {
  test("requestAnimationFrame queues until flush; cancelAnimationFrame removes", withDom(({ frames }) => {
    const seen = [];
    requestAnimationFrame((t) => {
      seen.push(["a", t]);
      requestAnimationFrame((t2) => seen.push(["later", t2]));
    });
    const id = requestAnimationFrame(() => seen.push(["cancelled"]));
    cancelAnimationFrame(id);
    assert.equal(frames.pending, 1);
    assert.equal(frames.flush(), 1);
    assert.deepEqual(seen, [["a", 16]]);
    assert.equal(frames.flush(100), 1);
    assert.deepEqual(seen, [["a", 16], ["later", 100]]);
    assert.equal(frames.flush(), 0);
  }));

  test("an injected frame scheduler replaces the queue", async () => {
    const requested = [];
    const cancelled = [];
    const uninstall = installFakeDom(globalThis, {
      requestAnimationFrame: (callback) => requested.push(callback),
      cancelAnimationFrame: (id) => cancelled.push(id),
    });
    try {
      const fn = () => {};
      assert.equal(requestAnimationFrame(fn), 1);
      cancelAnimationFrame(7);
      assert.deepEqual(requested, [fn]);
      assert.deepEqual(cancelled, [7]);
      assert.equal(uninstall.dom.frames.pending, 0);
    } finally {
      uninstall();
    }
  });

  test("matchMedia results are controllable and fire change listeners", withDom(({ media }) => {
    const query = "(prefers-reduced-motion: reduce)";
    const list = matchMedia(query);
    assert.equal(list.matches, true);
    assert.equal(list.media, query);
    const seen = [];
    list.addEventListener("change", (event) => seen.push(["listener", event.matches, event.media]));
    list.onchange = (event) => seen.push(["onchange", event.matches]);
    const legacy = (event) => seen.push(["legacy", event.matches]);
    list.addListener(legacy);
    media.set(query, true);
    assert.deepEqual(seen, []);
    media.set("(prefers-reduced-motion:   reduce)", false);
    assert.equal(list.matches, false);
    assert.equal(matchMedia(query).matches, false);
    assert.deepEqual(seen, [["listener", false, query], ["onchange", false], ["legacy", false]]);
    list.removeListener(legacy);
    media.set(query, true);
    assert.equal(seen.length, 5);
    assert.equal(matchMedia("(min-width: 900px)").matches, false);
    assert.equal(media.matches(query), true);
  }, { media: { "(prefers-reduced-motion: reduce)": true } }));

  test("serialize escapes text and attributes and leaves void elements unclosed", withDom(() => {
    const el = build(document, ["p", { title: 'a "b" & c' }, "1 < 2 & 3 > 2", ["input", { type: "range" }], ["br"]]);
    assert.equal(serialize(el), '<p title="a &quot;b&quot; &amp; c">1 &lt; 2 &amp; 3 &gt; 2<input type="range"><br></p>');
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 1 1");
    assert.equal(serialize(svg), '<svg viewBox="0 0 1 1"></svg>');
    assert.equal(serialize(document.createTextNode("<b>")), "&lt;b&gt;");
    assert.match(serialize(document), /^<html><head><\/head><body><\/body><\/html>$/);
  }));

  test("innerHTML, outerHTML, insertAdjacentHTML, document.write, cookies and storage throw", withDom(() => {
    const el = document.createElement("div");
    assert.throws(() => el.innerHTML, /rule R5/);
    assert.throws(() => {
      el.innerHTML = "<b>x</b>";
    }, /rule R5/);
    assert.throws(() => el.outerHTML, /rule R5/);
    assert.throws(() => {
      el.outerHTML = "";
    }, /rule R5/);
    assert.throws(() => el.insertAdjacentHTML("beforeend", "<b>"), /rule R5/);
    assert.throws(() => document.write("x"), /rule R5/);
    assert.throws(() => document.cookie, /rule R5/);
    assert.throws(() => window.localStorage, /storage/);
    assert.throws(() => window.sessionStorage, /storage/);
    assert.throws(() => window.indexedDB, /storage/);
    assert.equal(el.childNodes.length, 0);
  }));

  test("the interface shell starts on the fake DOM through dom.js", withDom(async () => {
    const root = build(document, ["div", { id: "fleetlab-root" }, ["div", { id: "fleetlab-teaching-strip" }]]);
    document.body.appendChild(root);
    const { strip, regions } = start({ createWorker: () => null });
    assert.equal(root.getAttribute("class"), "fl-app");
    assert.equal(strip.parentNode, root);
    assert.equal(regions.inspector.hidden, true);
    assert.equal(document.querySelectorAll(".fl-app > .fl-side > section").length, 2);
    const toggle = strip.querySelector("button[aria-controls]");
    const popover = document.getElementById(toggle.getAttribute("aria-controls"));
    assert.equal(popover.hidden, true);
    toggle.click();
    assert.equal(popover.hidden, false);
    assert.equal(toggle.getAttribute("aria-expanded"), "true");
    const list = document.createElement("ul");
    const create = (item) => {
      const li = document.createElement("li");
      li.textContent = item;
      return li;
    };
    keyedList(list, ["a", "b", "c"], { key: (x) => x, create });
    const b = list.children[1];
    keyedList(list, ["c", "b"], { key: (x) => x, create });
    assert.equal(list.textContent, "cb");
    assert.equal(list.children[1], b);
  }));
});

// ---------------------------------------------------------------------------------------------------------------
// Model payloads
// ---------------------------------------------------------------------------------------------------------------

const RUN_KEYS = ["seed", "world_digest", "metrics", "series", "invariant_violations"];
const LOG_KEYS = ["seed", "events", "intervals", "visits", "requests", "cars", "depots", "snapshots", "drain_end_s"];
const HEX64 = /^[0-9a-f]{64}$/;

function assertMetricMap(metrics, what) {
  const entries = Object.entries(metrics);
  assert.ok(entries.length > 0, `${what} has metrics`);
  for (const [key, entry] of entries) {
    const keys = Object.keys(entry);
    assert.equal(keys.length, 1, `${what} ${key} has exactly one of value or absent`);
    if (keys[0] === "value") assert.equal(typeof entry.value, "number", `${what} ${key}`);
    else assert.equal(typeof entry.absent, "string", `${what} ${key}`);
  }
}

function assertLog(log, seed) {
  assert.deepEqual(Object.keys(log), LOG_KEYS);
  assert.equal(log.seed, seed);
  assert.ok(Array.isArray(log.events) && log.events.length > 0);
  assert.equal(typeof log.intervals, "object");
  assert.ok(Array.isArray(log.snapshots) && log.snapshots.length > 0);
  assert.equal(typeof log.drain_end_s, "number");
}

describe("model payloads", () => {
  let window2;
  before(async () => {
    window2 = await windowPayload();
  });

  test("windowPayload defaults to the default preset, two seeds and a log for the first", async () => {
    assert.deepEqual(Object.keys(window2), ["runs", "log"]);
    assert.deepEqual(window2.runs.map((r) => r.seed), [1001, 1002]);
    for (const run of window2.runs) {
      assert.deepEqual(Object.keys(run), RUN_KEYS);
      assert.match(run.world_digest, HEX64);
      assertMetricMap(run.metrics, `seed ${run.seed}`);
      assert.ok(Array.isArray(run.series.fleet_state.starts_s));
      assert.deepEqual(run.invariant_violations, []);
    }
    assertLog(window2.log, 1001);
  });

  test("payloads are cached per argument set and deep-frozen", async () => {
    assert.equal(await windowPayload(), window2);
    assert.equal(await windowPayload({ presetId: "bay_teaching_map", seeds: [1001, 1002], logSeed: 1001 }), window2);
    assert.ok(Object.isFrozen(window2.runs[0].metrics));
    assert.throws(() => {
      window2.runs[0].metrics.extra = 1;
    }, TypeError);
  });

  test("windowPayload leaves out the log when logSeed is not a replayed seed", async () => {
    const payload = await windowPayload({ seeds: [1001], logSeed: 9999 });
    assert.deepEqual(Object.keys(payload), ["runs"]);
    assert.equal(payload.runs[0].world_digest, window2.runs[0].world_digest);
  });

  test("the handler posts ready, progress and a result, and the payload equals the direct run generator", async () => {
    const scenario = presetScenario();
    const { payload, messages } = await runThroughWorkerHandler({ type: "run_window", scenario, seeds: [1002], logSeed: 1002 });
    assert.equal(messages[0].type, "ready");
    assert.equal(messages.at(-1).type, "result");
    assert.ok(messages.some((m) => m.type === "progress"));
    assert.equal(messages.some((m) => m.type === "error"), false);
    const gen = createDrivers(MODEL_API).run_window({ type: "run_window", scenario, seeds: [1002], logSeed: 1002 });
    let step = gen.next();
    while (!step.done) step = gen.next();
    assert.deepEqual(payload, step.value);
    assert.deepEqual(payload.runs[0], window2.runs[1]);
  });

  test("runThroughWorkerHandler surfaces a handler error", async () => {
    await assert.rejects(runThroughWorkerHandler({ type: "run_window", scenario: presetScenario(), seeds: [] }), /seeds must be a non-empty array/);
  });

  test("pairPayload runs both arms on one world with logs", async () => {
    const payload = await pairPayload();
    assert.deepEqual(Object.keys(payload), ["world_digest", "baseline", "candidate"]);
    assert.match(payload.world_digest, HEX64);
    for (const arm of ["baseline", "candidate"]) {
      assert.deepEqual(Object.keys(payload[arm]), ["metrics", "series", "log"]);
      assertMetricMap(payload[arm].metrics, arm);
      assertLog(payload[arm].log, 1001);
    }
    assert.equal(payload.baseline.log.cars.length - payload.candidate.log.cars.length, 8);
    const baseline = presetScenario();
    assert.equal(await pairPayload({ baselineScenario: baseline, candidateScenario: forkCandidate(baseline), seed: 1001 }), payload);
    assert.throws(() => presetScenario("no-such-preset"), /no preset/);
  });

  test("experimentPayload runs a preset draft with 10 seeds and matches its frozen spec", async () => {
    const payload = await experimentPayload();
    assert.deepEqual(Object.keys(payload), ["verdict", "digest", "label", "lambdaMaxPermille", "per_seed"]);
    const frozen = frozenExperiment();
    assert.equal(payload.digest, frozen.digest);
    assert.match(payload.digest, HEX64);
    assert.equal(payload.label, `playground-spec:${payload.digest.slice(0, 8)}`);
    assert.equal(frozen.spec.seeds.length, FAST_REPLICATIONS);
    assert.deepEqual(payload.per_seed.map((s) => s.seed), frozen.spec.seeds);
    for (const row of payload.per_seed) {
      assert.deepEqual(Object.keys(row), ["seed", "baseline_metrics", "candidate_metrics"]);
      assertMetricMap(row.baseline_metrics, `baseline ${row.seed}`);
      assertMetricMap(row.candidate_metrics, `candidate ${row.seed}`);
    }
    assert.equal(typeof payload.verdict.validity, "string");
    assert.equal(typeof payload.verdict.outcome, "string");
    assert.deepEqual(Object.keys(payload.lambdaMaxPermille), ["SF", "PEN", "SJ", "EB"]);
    const draft = experimentDraft({ seedSet: 2, replications: 12 });
    assert.deepEqual([draft.seeds[0], draft.seeds.length, draft.seed_set], [2001, 12, 2]);
    assert.throws(() => experimentDraft({ presetId: "bay_teaching_map" }), /has no experiment/);
  });
});

after(() => {
  assert.equal(globalThis.document, undefined, "every test uninstalled its fake DOM");
});

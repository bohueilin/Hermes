// Boots the packed single-file page on the fake DOM inside a vm sandbox, the one setup every packed-page test shares,
// so that a Web API the page starts using is added here once instead of drifting between tests.
import vm from "node:vm";
import { installFakeDom } from "./fake-dom.mjs";

export async function mountPackedPage(html) {
  const context = vm.createContext({ console, performance, setTimeout, clearTimeout, URL, URLSearchParams, Blob, TextEncoder, TextDecoder, btoa, atob });
  // Keep cloned JSON in the VM realm, as the real browser does: the Bay contract rejects objects of another realm.
  context.structuredClone = new vm.Script("value => JSON.parse(JSON.stringify(value))").runInContext(context);
  const uninstall = installFakeDom(context);
  const document = uninstall.dom.document;
  const shell = document.createElement("div");
  shell.id = "fleetlab-root";
  const strip = document.createElement("div");
  strip.id = "fleetlab-teaching-strip";
  shell.append(strip);
  document.body.append(shell);
  context.Worker = class {
    constructor() { queueMicrotask(() => this.onmessage?.({ data: { type: "ready" } })); }
    postMessage() {}
    terminate() {}
  };
  let app;
  const close = () => { app?.destroy(); uninstall(); };
  try {
    app = new vm.Script(/<script>\n([\s\S]*)\n<\/script>/.exec(html)[1]).runInContext(context);
    await app.host.ready;
  } catch (error) {
    close();
    throw error;
  }
  return { app, document, close };
}

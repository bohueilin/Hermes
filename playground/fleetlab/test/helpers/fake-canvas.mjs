// A fake CanvasRenderingContext2D for interface tests under node --test: it records every call the isometric view
// makes, with the fill or stroke style in force and the path built since the last beginPath, so a test can hold the
// drawing to the model (a body's fill polygon sits where the projection puts it) without a browser. Nothing is
// rasterised. Anything the view does not use is absent, so a call the fake does not model fails loudly.
//
// Usage:
//   const ctx = createFakeContext();
//   createMap({ view: "iso", isoView: createIsoView, context2d: () => ctx, ... });
//   ctx.calls                     every call in order: {name, args, fillStyle, strokeStyle, lineWidth, path}
//   ctx.reset()                   forgets the calls (the styles stay, as on a real context)
//   fillsOf(ctx) / strokesOf(ctx) the fill and stroke calls only

const PATH_CALLS = new Set(["moveTo", "lineTo", "arc", "ellipse", "rect"]);

/** A recording 2D context. */
export function createFakeContext() {
  const calls = [];
  let path = [];
  const ctx = {
    fillStyle: "#000000",
    strokeStyle: "#000000",
    lineWidth: 1,
    lineJoin: "miter",
    lineCap: "butt",
    calls,
    reset() {
      calls.length = 0;
    },
  };
  const record = (name, args) => {
    const call = { name, args, fillStyle: ctx.fillStyle, strokeStyle: ctx.strokeStyle, lineWidth: ctx.lineWidth };
    if (name === "fill" || name === "stroke") call.path = path.slice();
    calls.push(call);
  };
  for (const name of ["setTransform", "fillRect", "clearRect", "save", "restore", "fill", "stroke", "closePath", "fillText", "strokeText", "clip", "translate", "scale", "rotate"]) {
    ctx[name] = (...args) => record(name, args);
  }
  ctx.beginPath = () => {
    path = [];
    record("beginPath", []);
  };
  for (const name of PATH_CALLS) {
    ctx[name] = (...args) => {
      // The point a path call adds: its first two arguments for moveTo, lineTo and rect; the centre for an arc or ellipse.
      path.push([args[0], args[1]]);
      record(name, args);
    };
  }
  ctx.getImageData = () => ({ data: new Uint8ClampedArray(4) });
  return ctx;
}

/** The fill calls recorded so far. */
export const fillsOf = (ctx) => ctx.calls.filter((c) => c.name === "fill");

/** The stroke calls recorded so far. */
export const strokesOf = (ctx) => ctx.calls.filter((c) => c.name === "stroke");

/** The calls as comparable text: name, arguments and the styles in force (paths are implied by the path calls). */
export const callText = (ctx) => JSON.stringify(ctx.calls.map((c) => [c.name, c.args, c.fillStyle, c.strokeStyle, c.lineWidth]));

/** A canvas element of the fake DOM whose getContext hands back `ctx`; width and height reflect as numbers. */
export function contextFor(ctx) {
  return () => ctx;
}

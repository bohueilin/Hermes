import assert from "node:assert/strict";
import { test } from "node:test";
import vm from "node:vm";
import * as pack from "../tools/pack.mjs";

function strip(source) {
  assert.equal(typeof pack.stripFullLineComments, "function", "offline comment stripper is available");
  return pack.stripFullLineComments(source, "fixture");
}

// These fixtures catch partial-block removal, literal corruption, and accidental ASI changes.
const fixtures = [
  ["full-line comments and JSDoc", '// heading\n/**\n * docs\n */\nconst x = 1;\n', '\n\n\n\nconst x = 1;\n'],
  ["block starts after code", 'const x = 1; /* start\n middle\n */\n', 'const x = 1; /* start\n middle\n */\n'],
  ["block ends before code", '/* start\n end */ const x = 1;\n', '/* start\n end */ const x = 1;\n'],
  ["quoted markers and URLs", `const x = ['//', "/*", 'https://example.test/a'];\n// remove\n`, `const x = ['//', "/*", 'https://example.test/a'];\n\n`],
  ["nested templates", 'const x = `// ${ {a: `/* ${"//"} */`}.a } /*`;\n// remove\n', 'const x = `// ${ {a: `/* ${"//"} */`}.a } /*`;\n\n'],
  ["multiline template raw lines", 'const x = `a\n// keep\n/* keep */\n`;\n// remove\n', 'const x = `a\n// keep\n/* keep */\n`;\n\n'],
  ["regex markers and control parentheses", 'if (true) /[/*]/.test("/");\nconst x = /https?:\\/\\//;\n// remove\n', 'if (true) /[/*]/.test("/");\nconst x = /https?:\\/\\//;\n\n'],
  ["division after calls and objects", 'const x = Math.abs(4) / 2; const y = ({n: 4}).n / 2;\n// remove\n', 'const x = Math.abs(4) / 2; const y = ({n: 4}).n / 2;\n\n'],
  ["EOF without newline", 'const x = 1;\n// remove', 'const x = 1;\n'],
  ["CRLF", '// remove\r\n/* doc\r\n */\r\nconst x = 1;\r\n', '\r\n\r\n\r\nconst x = 1;\r\n'],
  ["Unicode line separators", '// remove\u2028/* doc\u2029 */\u2028const x = 1;', '\u2028\u2029\u2028const x = 1;'],
  ["protected comments and directive", '/*! license MIT */\n// @preserve me\n//# sourceMappingURL=x.map\n//# sourceURL=x.js\n"use strict";\n// remove\n', '/*! license MIT */\n// @preserve me\n//# sourceMappingURL=x.map\n//# sourceURL=x.js\n"use strict";\n\n'],
  ["neighboring inline comments", '/* full */ /* full */\nconst x = 1; /* inline */\n', ' \nconst x = 1; /* inline */\n'],
];
for (const [name, source, expected] of fixtures) {
  test(`offline comment stripping: ${name}`, () => assert.equal(strip(source), expected));
}

for (const source of [
  '(function () { return\n// remove\n42; })()',
  '(function () { let x = 1, y = 2; x\n// remove\n++y; return [x,y]; })()',
  '(function () { const async = 3; async\n// remove\nfunction f() {} return async; })()',
]) {
  test(`offline comment stripping preserves ASI: ${source.split("\n")[0]}`, () => {
    assert.deepEqual(structuredClone(vm.runInNewContext(strip(source))), structuredClone(vm.runInNewContext(source)));
  });
}

test("verification rejects token, literal, boundary, and ASI changes that can still compile", () => {
  assert.equal(typeof pack.assertSameTokens, "function");
  for (const [before, after] of [
    ['const x = "one";', 'const x = "two";'],
    ['const x = 1 + +2;', 'const x = 1 ++ 2;'],
    ['function f() { return\n1; }', 'function f() { return 1; }'],
    ['const x = /a/;', 'const x = /b/;'],
    ['const x = `a${1}`;', 'const x = `a${2}`;'],
  ]) assert.throws(() => pack.assertSameTokens(before, after, "negative-fixture"), /negative-fixture/);
});

const { tokenize } = await import("../tools/comment-strip.mjs");
for (const source of [
  'async function f() {} /[/*]/.test("/");',
  'const x = true && {} / 2;',
  'const x = {if() { return 1; }}; x.if() / 2;',
  'function f() { if (true) {} /[/*]/.test("/"); }',
  'const f = function() {}; const x = f() / 2;',
  'const f = () => {}; const x = f() / 2;',
  'const x = /[/*]/; const t = `${ /[/*]/.test("/") ? `// ${1}` : "/*" }`;',
]) {
  test(`lexical slash goal: ${source}`, () => {
    new vm.Script(source);
    const result = tokenize(source, "slash-fixture");
    assert.equal(result.comments.length, 0, "no comment exists in this input");
    assert.equal(result.tokens.filter((t) => t.kind === "regex").length, source.startsWith('const x = /') ? 1 : source.includes('/[/*]/') ? 1 : 0);
    assert.equal(strip(source), source);
  });
}

for (const source of [
  'class C { static { if (true) /[/*]/.test("/"); } } /[/*]/.test("/");',
  'function* g() { yield /[/*]/; } /[/*]/.test("/");',
  'const g = async function* () { yield /[/*]/; }; g() / 2;',
]) {
  test(`function and class bodies retain lexical contents: ${source}`, () => {
    assert.equal(strip(source), source);
  });
}

test("unsupported Unicode-set regex mode fails closed with a module label", () => {
  assert.throws(() => strip('const x = /[[a]--[b]]/v;'), /fixture: unsupported.*Unicode.*regular expression/);
});

test("unterminated literals and comments fail closed", () => {
  for (const source of ['/* never closes', 'const x = "never closes', 'const x = `never closes', 'const x = /never closes']) {
    assert.throws(() => strip(source), /fixture: unterminated/);
  }
});

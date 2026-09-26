// Build-time only. This lexer preserves raw tokens and line terminators, not a minified spelling.
// It deliberately keeps all template-literal contents (including substitution comments) intact.
import vm from "node:vm";

const LINE = /[\r\n\u2028\u2029]/;
const ID_START = /[\p{ID_Start}$_]/u;
const ID_PART = /[\p{ID_Continue}$\u200c\u200d]/u;
const PREFIX = new Set(["return", "throw", "case", "delete", "void", "typeof", "new", "in", "instanceof", "of", "yield", "await", "else", "do"]);
const CONTROL = new Set(["if", "while", "for", "with", "switch", "catch"]);
const PUNCTUATORS = [">>>=", "===", "!==", "**=", "&&=", "||=", "??=", ">>>", "<<=", ">>=", "...", "=>", "==", "!=", "<=", ">=", "++", "--", "&&", "||", "??", "?.", "**", "<<", ">>", "+=", "-=", "*=", "/=", "%=", "&=", "|=", "^="];
const PROTECTED = /\blicen[cs]e\b|@preserve\b|sourceMappingURL\b|sourceURL\b|^\/\*!/i;

function fail(label, message, offset) {
  throw new Error(`${label}: ${message}${offset === undefined ? "" : ` at offset ${offset}`}`);
}

/** Exact lexical tokens and complete comments; not an ECMAScript parser. Unsupported input fails closed. */
export function tokenize(source, label = "module") {
  let i = 0;
  const comments = [];
  const point = () => String.fromCodePoint(source.codePointAt(i));
  const quoted = (quote) => {
    const start = i++;
    while (i < source.length) {
      if (source[i] === quote) { i += 1; return; }
      if (source[i] === "\\") {
        i += 1;
        if (source[i] === "\r" && source[i + 1] === "\n") i += 1;
        i += 1;
      } else {
        if (LINE.test(source[i])) fail(label, "unterminated string", start);
        i += 1;
      }
    }
    fail(label, "unterminated string", start);
  };
  const regex = () => {
    const start = i++;
    let inClass = false;
    while (i < source.length) {
      const c = source[i++];
      if (LINE.test(c)) fail(label, "unterminated regular expression", start);
      if (c === "\\") { i += 1; continue; }
      if (c === "[") inClass = true;
      else if (c === "]") inClass = false;
      else if (c === "/" && !inClass) {
        const flagsStart = i;
        while (i < source.length && ID_PART.test(point())) i += point().length;
        if (source.slice(flagsStart, i).includes("v")) fail(label, "unsupported Unicode-set regular expression", start);
        return;
      }
    }
    fail(label, "unterminated regular expression", start);
  };
  const template = () => {
    const start = i++;
    while (i < source.length) {
      if (source[i] === "\\") { i += 2; continue; }
      if (source[i] === "`") { i += 1; return; }
      if (source[i] === "$" && source[i + 1] === "{") {
        i += 2;
        code(true);
      } else i += 1;
    }
    fail(label, "unterminated template", start);
  };
  const code = (inTemplate = false) => {
    const tokens = [];
    const stack = [];
    let expression = true;
    let previous = "";
    let previousEnd = i;
    let functionKind = null;
    let classKind = null;
    let bodyKind = null;
    while (i < source.length) {
      const c = source[i];
      if (/\s/u.test(c)) { i += 1; continue; }
      if (c === "/" && (source[i + 1] === "/" || source[i + 1] === "*")) {
        const start = i;
        if (source[i + 1] === "/") {
          i += 2;
          while (i < source.length && !LINE.test(source[i])) i += 1;
        } else {
          const end = source.indexOf("*/", i + 2);
          if (end < 0) fail(label, "unterminated block comment", i);
          i = end + 2;
        }
        if (!inTemplate) comments.push({ start, end: i, protected: PROTECTED.test(source.slice(start, i)) });
        continue;
      }
      if (inTemplate && c === "}" && stack.length === 0) { i += 1; return tokens; }
      const start = i;
      let kind = "punctuator";
      let word = "";
      if (c === "'" || c === '"') { quoted(c); kind = "string"; }
      else if (c === "`") { template(); kind = "template"; }
      else if (c === "/" && expression) { regex(); kind = "regex"; }
      else if (ID_START.test(point()) || c === "\\") {
        kind = "identifier";
        while (i < source.length) {
          if (source[i] === "\\") {
            const escaped = /^\\u(?:\{[0-9a-fA-F]+\}|[0-9a-fA-F]{4})/.exec(source.slice(i));
            if (!escaped) fail(label, "unsupported identifier escape", i);
            i += escaped[0].length;
          } else if (ID_PART.test(point())) i += point().length;
          else break;
        }
        word = source.slice(start, i);
      } else if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(source[i + 1] ?? ""))) {
        const number = /^(?:0[xX][\da-fA-F_]+n?|0[bB][01_]+n?|0[oO][0-7_]+n?|(?:\d[\d_]*(?:\.[\d_]*)?|\.\d[\d_]*)(?:[eE][+-]?[\d_]+)?n?)/.exec(source.slice(i));
        if (!number) fail(label, "unsupported number", i);
        i += number[0].length;
        kind = "number";
      } else {
        const punctuator = PUNCTUATORS.find((p) => source.startsWith(p, i));
        if (punctuator) i += punctuator.length;
        else if ("{}()[].;,<>+-*%&|^!~?:=/#".includes(c)) i += 1;
        else fail(label, "unsupported lexical character", i);
      }
      const raw = source.slice(start, i);
      const lineBefore = LINE.test(source.slice(previousEnd, start));
      tokens.push({ kind, raw, start, end: i, lineBefore });
      if (kind === "identifier") {
        const property = previous === "." || previous === "?.";
        const beforeFunction = previous === "async" ? (tokens.at(-3)?.raw ?? "") : previous;
        if (!property && word === "function") functionKind = ["", ";", "{", "}"].includes(beforeFunction) ? "block" : "value";
        if (!property && word === "class") classKind = previous === "" || previous === ";" || previous === "{" || previous === "}" ? "block" : "value";
        expression = !property && PREFIX.has(word);
      } else if (kind !== "punctuator") expression = false;
      else if (raw === "(") {
        const control = CONTROL.has(previous) && ![".", "?."].includes(tokens.at(-3)?.raw);
        stack.push({ close: ")", control, functionKind });
        functionKind = null;
        expression = true;
      } else if (raw === "[") { stack.push({ close: "]" }); expression = true; }
      else if (raw === "{") {
        const braceKind = bodyKind ?? classKind ?? (previous === "=>" ? "value" :
          (expression && !["", ";", "{", "}", ")", "else", "do"].includes(previous) && !(previous === "return" && lineBefore)) || (inTemplate && previous === "") ? "value" : "block");
        stack.push({ close: "}", braceKind });
        bodyKind = null;
        classKind = null;
        expression = true;
      } else if ([")", "]", "}"].includes(raw)) {
        const frame = stack.pop();
        if (!frame || frame.close !== raw) fail(label, "unbalanced delimiter", start);
        expression = raw === ")" ? Boolean(frame.control) : raw === "}" && frame.braceKind === "block";
        if (frame.functionKind) bodyKind = frame.functionKind;
      } else expression = ![".", "?.", "++", "--"].includes(raw);
      previous = raw;
      previousEnd = i;
    }
    if (inTemplate || stack.length) fail(label, "unclosed delimiter", i);
    return tokens;
  };
  return { tokens: code(), comments };
}

/** Include ASI-relevant trivia: equal raw tokens alone do not establish equivalent JavaScript. */
export function assertSameTokens(before, after, label = "module") {
  const a = tokenize(before, label).tokens;
  const b = tokenize(after, label).tokens;
  if (a.length !== b.length) fail(label, "comment removal changed token count");
  for (let j = 0; j < a.length; j += 1) {
    if (a[j].kind !== b[j].kind || a[j].raw !== b[j].raw || a[j].lineBefore !== b[j].lineBefore) {
      fail(label, `comment removal changed token or line boundary ${j}`, a[j].start);
    }
  }
  if ((before.match(/[\r\n\u2028\u2029]/g) ?? []).join("") !== (after.match(/[\r\n\u2028\u2029]/g) ?? []).join("")) {
    fail(label, "comment removal changed line terminators");
  }
}

/** Strip only entire comments whose boundary lines contain no code; preserve every line terminator. */
export function stripFullLineComments(source, label = "module") {
  const { tokens, comments } = tokenize(source, label);
  const lineAt = new Uint32Array(source.length + 1);
  let line = 0;
  for (let j = 0; j < source.length; j += 1) {
    lineAt[j] = line;
    if (LINE.test(source[j])) line += 1;
  }
  lineAt[source.length] = line;
  const codeLines = new Set();
  for (const token of tokens) {
    for (let j = lineAt[token.start]; j <= lineAt[token.end - 1]; j += 1) codeLines.add(j);
  }
  let result = "";
  let at = 0;
  for (const comment of comments) {
    if (comment.protected || codeLines.has(lineAt[comment.start]) || codeLines.has(lineAt[comment.end - 1])) continue;
    result += source.slice(at, comment.start) + source.slice(comment.start, comment.end).replace(/[^\r\n\u2028\u2029]/g, "");
    at = comment.end;
  }
  result += source.slice(at);
  assertSameTokens(source, result, label);
  // A small lexical verifier cannot validate all JavaScript grammar. Compile both module wrappers independently;
  // neither is executed. Compilation alone is insufficient because losing code can still produce valid syntax.
  for (const [kind, text] of [["original", source], ["stripped", result]]) {
    try { new vm.Script(text, { filename: `${label}.js` }); }
    catch (error) { fail(label, `${kind} rendered module does not compile: ${error.message}`); }
  }
  return result;
}

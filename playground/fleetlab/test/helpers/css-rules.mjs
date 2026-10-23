/** Rules of the `@media (min-width: <width>px)` block that styles `selector`, comments removed, as [{selectors, body}]. */
export function mediaBlockRules(css, width, selector) {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const open of text.matchAll(new RegExp(`@media\\s*\\(min-width:\\s*${width}px\\)\\s*\\{`, 'g'))) {
    const start = open.index + open[0].length;
    let depth = 1, end = start;
    while (depth && end < text.length) depth += {'{': 1, '}': -1}[text[end++]] ?? 0;
    const rules = [...text.slice(start, end - 1).matchAll(/([^{}]+)\{([^{}]*)\}/g)]
      .map(([, list, body]) => ({selectors: list.split(',').map(s => s.trim()), body}));
    if (rules.some(rule => rule.selectors.includes(selector))) return rules;
  }
  return [];
}

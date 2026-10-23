// One deterministic development-to-hosted shell transform, shared by packing and source validation.
export const SITE_CONTENT_SECURITY_POLICY =
  "default-src 'none'; script-src 'self'; worker-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self'; " +
  "connect-src 'none'; form-action 'none'; base-uri 'none'";

export function renderSitePage(source, name, stylesheets) {
  let html=source.replace(/<script\b[\s\S]*?<\/script>\s*/gi, "").replace(/<link\b[^>]*>\s*/gi, "");
  const head=/<head\b[^>]*>/i.exec(html);
  if (!head || !/<\/head>/i.test(html) || !/<\/body>/i.test(html)) throw new Error(`${name} needs <head>, </head> and </body>`);
  if (/Content-Security-Policy/i.test(html)) throw new Error(`${name} already declares a policy`);
  const at=head.index+head[0].length;
  html=html.slice(0,at)+`<meta http-equiv="Content-Security-Policy" content="${SITE_CONTENT_SECURITY_POLICY}">`+html.slice(at);
  html=html.replace(/<\/head>/i,()=>stylesheets.map(path=>`<link rel="stylesheet" href="${path}">`).join("\n")+"\n</head>");
  return html.replace(/<\/body>/i,()=>'<script type="module" src="./boot.js"></script>\n</body>');
}

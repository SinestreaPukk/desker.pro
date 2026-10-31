// Email bodies: one warm, table-based layout (inline styles, so it survives Gmail, Outlook and Apple Mail) plus a plain-text twin.
// content: { title, lines: [paragraphs], button?: { label, url }, note? }
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const INK = '#2b2140', SOFT = '#5d4780', CREAM = '#f6efe3', PAPER = '#fffaf0', ACCENT = '#e8704f', ACCENT_EDGE = '#b4503a'
const MONO = "'Courier New', Courier, monospace"
const SANS = "-apple-system, 'Segoe UI', Helvetica, Arial, sans-serif"

export function mailHtml({ title, lines, button, note }, origin = process.env.BETTER_AUTH_URL || '') {
  const p = (t, extra = '') => `<p style="margin:0 0 16px;font:16px/1.6 ${SANS};color:${SOFT};${extra}">${esc(t)}</p>`
  return `<!doctype html><html lang="en"><body style="margin:0;padding:0;background:${CREAM};">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(lines[0])}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CREAM};"><tr><td align="center" style="padding:28px 12px;">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;">
<tr><td style="padding:0 0 14px;font:bold 22px ${MONO};color:${INK};letter-spacing:1px;">Desker</td></tr>
<tr><td style="border:2px solid ${INK};border-bottom-width:5px;background:${PAPER};">
<img src="${esc(origin)}/pixel/email-banner.png" width="556" alt="A cosy city at dusk, windows glowing" style="display:block;width:100%;height:auto;border:0;image-rendering:pixelated;">
<div style="padding:28px 32px 30px;">
<h1 style="margin:0 0 16px;font:bold 24px/1.25 ${MONO};color:${INK};">${esc(title)}</h1>
${lines.map((l) => p(l)).join('\n')}
${button ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 22px;"><tr><td style="background:${ACCENT};border-bottom:4px solid ${ACCENT_EDGE};">
<a href="${esc(button.url)}" style="display:inline-block;padding:14px 28px;font:bold 17px ${MONO};color:#ffffff;text-decoration:none;">${esc(button.label)}</a></td></tr></table>
<p style="margin:0 0 16px;font:13px/1.5 ${SANS};color:#8a7a9c;">Button not working? Paste this link into your browser:<br><a href="${esc(button.url)}" style="color:${SOFT};word-break:break-all;">${esc(button.url)}</a></p>` : ''}
${note ? p(note, 'font-size:14px;color:#8a7a9c;') : ''}
</div></td></tr>
<tr><td style="padding:16px 4px 0;font:12px/1.5 ${SANS};color:#8a7a9c;">You got this email because this address was used on Desker. If that was not you, you can ignore it.<br>Desker: a cosy place for your tasks, goals and deadlines.</td></tr>
</table></td></tr></table></body></html>`
}

export const mailText = ({ title, lines, button, note }) =>
  [title, '', ...lines.flatMap((l) => [l, '']), ...(button ? [`${button.label}: ${button.url}`, ''] : []), ...(note ? [note, ''] : []), '- Desker'].join('\n')

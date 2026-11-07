/**
 * The look of every ShiftAM email. Same design as the website's
 * src/lib/email-template.ts; keep the two in step.
 */

export const esc = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);


const SITE = 'https://shiftam.xyz';
const DISCORD = 'https://discord.gg/uMyVQHXRFv';
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const TONES = {
  ok: { bg: '#e8f8ef', fg: '#137a43', dot: '#22c55e' },
  pending: { bg: '#fff5e5', fg: '#9a5b00', dot: '#f59e0b' },
  muted: { bg: '#eef0f5', fg: '#4b5368', dot: '#8a93a8' },
};

export function renderEmail(p) {
  const tone = TONES[p.status.tone];
  const rows = p.rows
    .map(([k, v]) => `<tr>
        <td style="padding:10px 0;border-bottom:1px solid #eceef4;font:14px/1.4 ${FONT};color:#6b7287">${esc(k)}</td>
        <td align="right" style="padding:10px 0;border-bottom:1px solid #eceef4;font:600 14px/1.4 ${FONT};color:#16182a;word-break:break-word">${esc(v)}</td>
      </tr>`,
    )
    .join('');
  const total = p.total
    ? `<tr>
        <td style="padding:14px 0 0;font:700 15px/1.4 ${FONT};color:#16182a">${esc(p.total[0])}</td>
        <td align="right" style="padding:14px 0 0;font:800 18px/1.4 ${FONT};color:#16182a">${esc(p.total[1])}</td>
      </tr>`
    : '';
  const keyBox = p.licenseKey
    ? `<tr><td style="padding:8px 32px 4px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;background:#f4f2ff;border:1px solid #d9d2ff;border-radius:14px">
          <tr><td style="padding:16px 18px 6px;font:700 11px/1 ${FONT};letter-spacing:1.4px;text-transform:uppercase;color:#6a4fd8">Your license key</td></tr>
          <tr><td style="padding:4px 18px 16px;font:700 19px/1.5 'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;letter-spacing:1px;color:#1b1640;word-break:break-all">${esc(p.licenseKey)}</td></tr>
        </table>
      </td></tr>`
    : '';
  const button = p.button
    ? `<tr><td align="center" style="padding:24px 32px 6px">
        <a href="${esc(p.button.href)}" style="display:inline-block;padding:14px 28px;border-radius:12px;background:#5b4cf0;background-image:linear-gradient(135deg,#7c3aed,#4f6bf5);color:#ffffff;font:700 15px/1 ${FONT};text-decoration:none">${esc(p.button.label)}</a>
      </td></tr>`
    : '';
  const note = p.note ? `<tr><td align="center" style="padding:10px 40px 0;font:13px/1.5 ${FONT};color:#7b8196">${esc(p.note)}</td></tr>` : '';

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><title>${esc(p.title)}</title></head>
<body style="margin:0;padding:0;background:#eef0f6">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(p.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef0f6">
<tr><td align="center" style="padding:32px 12px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;border-collapse:separate">
    <tr><td style="border-radius:20px 20px 0 0;background:#130e2b;background-image:linear-gradient(135deg,#1d1245 0%,#130e2b 55%,#0f1a3d 100%);padding:28px 32px 30px">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td style="padding-right:10px"><img src="${SITE}/email-logo.png" width="34" height="34" alt="" style="display:block;border-radius:9px"></td>
        <td style="font:800 20px/1 ${FONT};color:#ffffff">Shift<span style="color:#7a88ff">AM</span></td>
      </tr></table>
      <div style="height:22px"></div>
      <span style="display:inline-block;padding:6px 12px;border-radius:999px;background:${tone.bg};color:${tone.fg};font:700 12px/1 ${FONT}"><span style="color:${tone.dot}">&#9679;</span>&nbsp; ${esc(p.status.label)}</span>
      <h1 style="margin:14px 0 6px;font:800 26px/1.25 ${FONT};color:#ffffff">${esc(p.title)}</h1>
      <p style="margin:0;font:15px/1.55 ${FONT};color:#c4c2e0">${esc(p.intro)}</p>
    </td></tr>
    <tr><td style="background:#ffffff;border-radius:0 0 20px 20px;padding:0 0 30px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="padding:22px 32px 6px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}${total}</table>
        </td></tr>
        ${keyBox}${button}${note}
      </table>
    </td></tr>
    <tr><td align="center" style="padding:22px 24px 0;font:13px/1.6 ${FONT};color:#8a90a5">
      <a href="${SITE}/account" style="color:#5b4cf0;text-decoration:none;font-weight:600">Dashboard</a> &nbsp;·&nbsp;
      <a href="${SITE}/download" style="color:#5b4cf0;text-decoration:none;font-weight:600">Download</a> &nbsp;·&nbsp;
      <a href="${DISCORD}" style="color:#5b4cf0;text-decoration:none;font-weight:600">Discord support</a><br>
      ShiftAM · shiftam.xyz · You're getting this because of a purchase made with this email.
    </td></tr>
  </table>
</td></tr>
</table>
</body></html>`;

  const text = [
    `ShiftAM — ${p.status.label}`,
    '',
    p.title,
    p.intro,
    '',
    ...p.rows.map(([k, v]) => `${k}: ${v}`),
    ...(p.total ? [`${p.total[0]}: ${p.total[1]}`] : []),
    ...(p.licenseKey ? ['', `Your license key: ${p.licenseKey}`] : []),
    ...(p.button ? ['', `${p.button.label}: ${p.button.href}`] : []),
    ...(p.note ? ['', p.note] : []),
    '',
    `Dashboard: ${SITE}/account`,
    `Download: ${SITE}/download`,
    `Discord support: ${DISCORD}`,
  ].join('\n');

  return { html, text };
}

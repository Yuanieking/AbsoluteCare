export function escapeHtml(value, maxLength = 2_000) {
  return String(value ?? "")
    .slice(0, maxLength)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function button({ href, label }) {
  const url = escapeHtml(href, 4_000);
  const text = escapeHtml(label, 120);
  return `<!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${url}" style="height:48px;v-text-anchor:middle;width:260px;" arcsize="17%" fillcolor="#0F3D3A" strokecolor="#0F3D3A"><w:anchorlock/><center style="color:#ffffff;font-family:Arial,sans-serif;font-size:16px;font-weight:bold;">${text}</center></v:roundrect><![endif]--><!--[if !mso]><!--><table role="presentation" border="0" cellspacing="0" cellpadding="0"><tr><td style="border-radius:8px;background:#0F3D3A;"><a href="${url}" style="display:inline-block;min-height:20px;padding:14px 28px;border-radius:8px;background:#0F3D3A;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:bold;line-height:20px;text-align:center;text-decoration:none;">${text}</a></td></tr></table><!--<![endif]-->`;
}

export function callout({ children, tone = "info" }) {
  const colors = {
    info: ["#E8F2EE", "#0F3D3A"],
    warning: ["#FFF7E6", "#7A4B00"],
    danger: ["#FDECEC", "#8F1D2C"],
  };
  const [background, color] = colors[tone] || colors.info;
  return `<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0"><tr><td style="padding:16px;background:${background};border-left:4px solid ${color};color:${color};font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;">${children}</td></tr></table>`;
}

export function details(rows = []) {
  return `<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background:#F5F9F7;border:1px solid #DCE8E2;border-radius:8px;"><tr><td style="padding:4px 16px;">${rows
    .filter((row) => row?.value)
    .map(
      ({ label, value }) =>
        `<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0"><tr><td style="padding:10px 0;color:#64748B;font-family:Arial,Helvetica,sans-serif;font-size:13px;">${escapeHtml(label)}</td><td align="right" style="padding:10px 0;color:#0F3D3A;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;">${escapeHtml(value)}</td></tr></table>`,
    )
    .join("")}</td></tr></table>`;
}

export function codeBox(code) {
  return `<div style="padding:18px 12px;border:1px solid #B8CAC1;border-radius:8px;color:#0F3D3A;font-family:'Courier New',monospace;font-size:32px;font-weight:bold;letter-spacing:8px;text-align:center;user-select:all;">${escapeHtml(code, 20)}</div>`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { name, organisation, email, summary, items } = req.body;

  if (!name || !email) return res.status(400).json({ error: 'Name and email required' });

  const itemRows = (items || []).map(item =>
    `<tr>
      <td style="padding:8px 12px;border:1px solid #e8e8e8;font-size:13px;color:#555;font-weight:600;background:#f9f9f9;width:160px">${item.category}</td>
      <td style="padding:8px 12px;border:1px solid #e8e8e8;font-size:13px">${item.hoursPerWeek} hrs/week — pain ${item.pain}/5</td>
    </tr>`
  ).join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/>
<style>
  body{font-family:Arial,sans-serif;color:#222;margin:0;padding:0;background:#f5f5f5}
  .wrapper{max-width:580px;margin:32px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)}
  .header{background:#161A1D;color:#ECE8DE;padding:24px 32px}
  .header h1{margin:0;font-size:18px;font-weight:700}
  .header p{margin:4px 0 0;font-size:12px;opacity:.5}
  .body{padding:24px 32px}
  table{border-collapse:collapse;width:100%;margin-bottom:20px}
  .summary{background:#f9f9f9;border-left:4px solid #C99A4A;padding:14px 18px;border-radius:4px;font-size:13px;line-height:1.6;color:#333;white-space:pre-wrap;margin-bottom:20px}
  .footer{font-size:11px;color:#aaa;margin-top:16px}
</style>
</head>
<body>
<div class="wrapper">
  <div class="header">
    <h1>New charity audit lead</h1>
    <p>${new Date().toUTCString()}</p>
  </div>
  <div class="body">
    <table>
      <tr><td style="padding:8px 12px;border:1px solid #e8e8e8;font-size:13px;color:#555;font-weight:600;background:#f9f9f9;width:120px">Name</td><td style="padding:8px 12px;border:1px solid #e8e8e8;font-size:13px">${name}</td></tr>
      <tr><td style="padding:8px 12px;border:1px solid #e8e8e8;font-size:13px;color:#555;font-weight:600;background:#f9f9f9">Organisation</td><td style="padding:8px 12px;border:1px solid #e8e8e8;font-size:13px">${organisation || 'Not provided'}</td></tr>
      <tr><td style="padding:8px 12px;border:1px solid #e8e8e8;font-size:13px;color:#555;font-weight:600;background:#f9f9f9">Email</td><td style="padding:8px 12px;border:1px solid #e8e8e8;font-size:13px"><a href="mailto:${email}" style="color:#C99A4A">${email}</a></td></tr>
    </table>

    <p style="font-size:12px;color:#888;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px">Their audit results</p>
    <table>${itemRows}</table>

    ${summary ? `<p style="font-size:12px;color:#888;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px">AI summary</p><div class="summary">${summary}</div>` : ''}

    <div class="footer">Sent by Fabric Tech Charity AI Audit</div>
  </div>
</div>
</body></html>`;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: 'Fabric Tech <leads@vaughanai.co>',
      to: process.env.NOTIFICATION_EMAIL,
      replyTo: email,
      subject: `New charity audit — ${organisation || name}`,
      html,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error('[contact] resend error:', err);
    return res.status(500).json({ error: 'Email failed' });
  }

  return res.status(200).json({ ok: true });
}

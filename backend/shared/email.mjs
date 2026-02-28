import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';

const ses = new SESv2Client({});
const FROM_EMAIL = process.env.SES_FROM_EMAIL || 'noreply@codersatelier.com';

export async function sendEmail({ to, subject, html, text }) {
  await ses.send(new SendEmailCommand({
    FromEmailAddress: FROM_EMAIL,
    Destination: { ToAddresses: [to] },
    Content: {
      Simple: {
        Subject: { Data: subject, Charset: 'UTF-8' },
        Body: {
          Html: { Data: html, Charset: 'UTF-8' },
          ...(text ? { Text: { Data: text, Charset: 'UTF-8' } } : {}),
        },
      },
    },
  }));
}

export async function sendOtpEmail(to, code, eventTitle) {
  const subject = `${code} — Tu codigo de verificacion`;
  const html = `
    <div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <h2 style="color:#111827;font-family:Outfit,sans-serif">EventAlbum</h2>
      <p style="color:#6B7280;font-size:14px">Tu codigo de verificacion para <strong>${eventTitle}</strong>:</p>
      <div style="background:#F9FAFB;border-radius:8px;padding:24px;text-align:center;margin:24px 0">
        <span style="font-family:Outfit,monospace;font-size:32px;font-weight:700;letter-spacing:8px;color:#111827">${code}</span>
      </div>
      <p style="color:#9CA3AF;font-size:12px">Este codigo expira en 5 minutos. No compartas este codigo con nadie.</p>
    </div>
  `;
  await sendEmail({ to, subject, html });
}

export async function sendHostOtpEmail(to, code) {
  const subject = `${code} — Inicia sesion en EventAlbum`;
  const html = `
    <div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <h2 style="color:#111827;font-family:Outfit,sans-serif">EventAlbum</h2>
      <p style="color:#6B7280;font-size:14px">Tu codigo de inicio de sesion:</p>
      <div style="background:#F9FAFB;border-radius:8px;padding:24px;text-align:center;margin:24px 0">
        <span style="font-family:Outfit,monospace;font-size:32px;font-weight:700;letter-spacing:8px;color:#111827">${code}</span>
      </div>
      <p style="color:#9CA3AF;font-size:12px">Este codigo expira en 10 minutos. Si no solicitaste este codigo, ignora este correo.</p>
    </div>
  `;
  await sendEmail({ to, subject, html });
}

export async function sendEventCreatedEmail(to, { eventId, title, qrUrl, tier }) {
  const subject = `Tu evento "${title}" fue creado`;
  const html = `
    <div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <h2 style="color:#111827;font-family:Outfit,sans-serif">EventAlbum</h2>
      <p style="color:#6B7280">Tu evento <strong>${title}</strong> fue creado exitosamente.</p>
      <div style="background:#DCFCE7;border-radius:8px;padding:16px;margin:16px 0">
        <p style="margin:0;color:#16A34A;font-size:14px"><strong>Tier:</strong> ${tier}</p>
        <p style="margin:4px 0 0;color:#16A34A;font-size:14px"><strong>Link QR:</strong> ${qrUrl}</p>
      </div>
      <p style="color:#6B7280;font-size:14px">Comparte el codigo QR con tus invitados para que suban fotos.</p>
      <a href="https://eventalbum.codersatelier.com/e/${eventId}/admin" style="display:inline-block;background:#22C55E;color:#fff;padding:12px 24px;border-radius:9999px;text-decoration:none;font-weight:600;margin-top:16px">Ir al panel de administracion</a>
    </div>
  `;
  await sendEmail({ to, subject, html });
}

import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';

const ses = new SESv2Client({});
const FROM_EMAIL = process.env.SES_FROM_EMAIL || 'noreply@snapnshare.app';

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
      <h2 style="color:#111827;font-family:Outfit,sans-serif">snapNshare</h2>
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
  const subject = `${code} — Inicia sesion en snapNshare`;
  const html = `
    <div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <h2 style="color:#111827;font-family:Outfit,sans-serif">snapNshare</h2>
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
      <h2 style="color:#111827;font-family:Outfit,sans-serif">snapNshare</h2>
      <p style="color:#6B7280">Tu evento <strong>${title}</strong> fue creado exitosamente.</p>
      <div style="background:#DCFCE7;border-radius:8px;padding:16px;margin:16px 0">
        <p style="margin:0;color:#16A34A;font-size:14px"><strong>Tier:</strong> ${tier}</p>
        <p style="margin:4px 0 0;color:#16A34A;font-size:14px"><strong>Link QR:</strong> ${qrUrl}</p>
      </div>
      <p style="color:#6B7280;font-size:14px">Comparte el codigo QR con tus invitados para que suban fotos.</p>
      <a href="https://snapnshare.app/e/${eventId}/admin" style="display:inline-block;background:#22C55E;color:#fff;padding:12px 24px;border-radius:9999px;text-decoration:none;font-weight:600;margin-top:16px">Ir al panel de administracion</a>
    </div>
  `;
  await sendEmail({ to, subject, html });
}

export async function sendReceiptEmail(to, { eventId, title, tier, amount, currency, paymentDate, paymentMethod }) {
  const tierNames = { basic: 'Básico', paid: 'Estándar', premium: 'Premium' };
  const formattedAmount = currency === 'USD'
    ? `$${(amount / 100).toFixed(2)} USD`
    : `Q${(amount / 100).toFixed(2)} GTQ`;
  const subject = `Recibo de pago — ${title}`;
  const html = `
    <div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <h2 style="color:#111827;font-family:Outfit,sans-serif">snapNshare</h2>
      <p style="color:#6B7280">Gracias por tu pago. Aqui tienes tu recibo:</p>
      <div style="background:#F9FAFB;border-radius:8px;padding:16px;margin:16px 0">
        <p style="margin:0;font-size:14px;color:#111827"><strong>Evento:</strong> ${title}</p>
        <p style="margin:4px 0 0;font-size:14px;color:#111827"><strong>Plan:</strong> ${tierNames[tier] || tier}</p>
        <p style="margin:4px 0 0;font-size:14px;color:#111827"><strong>Monto:</strong> ${formattedAmount}</p>
        <p style="margin:4px 0 0;font-size:14px;color:#111827"><strong>Fecha:</strong> ${new Date(paymentDate).toLocaleDateString('es-GT')}</p>
        ${paymentMethod ? `<p style="margin:4px 0 0;font-size:14px;color:#111827"><strong>Metodo:</strong> ${paymentMethod}</p>` : ''}
      </div>
      <p style="color:#9CA3AF;font-size:12px">Si tienes preguntas sobre este cargo, contactanos.</p>
    </div>
  `;
  await sendEmail({ to, subject, html });
}

export async function sendModerationAlertEmail(to, { eventId, title, uploaderName, reason, time }) {
  const subject = `Contenido marcado en "${title}"`;
  const html = `
    <div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <h2 style="color:#111827;font-family:Outfit,sans-serif">snapNshare</h2>
      <p style="color:#6B7280">Se detecto contenido potencialmente inapropiado en tu evento.</p>
      <div style="background:#FEF2F2;border-radius:8px;padding:16px;margin:16px 0">
        <p style="margin:0;font-size:14px;color:#991B1B"><strong>Evento:</strong> ${title}</p>
        <p style="margin:4px 0 0;font-size:14px;color:#991B1B"><strong>Subido por:</strong> ${uploaderName}</p>
        <p style="margin:4px 0 0;font-size:14px;color:#991B1B"><strong>Razon:</strong> ${reason}</p>
        <p style="margin:4px 0 0;font-size:14px;color:#991B1B"><strong>Hora:</strong> ${new Date(time).toLocaleString('es-GT')}</p>
      </div>
      <p style="color:#6B7280;font-size:14px">La foto fue ocultada automaticamente. Puedes revisarla en el panel de moderacion.</p>
    </div>
  `;
  await sendEmail({ to, subject, html });
}

export async function sendEventSummaryEmail(to, { eventId, title, totalPhotos, totalVideos, totalGuests, downloadUrl, storageDays }) {
  const subject = `Resumen de tu evento "${title}"`;
  const html = `
    <div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <h2 style="color:#111827;font-family:Outfit,sans-serif">snapNshare</h2>
      <p style="color:#6B7280">Tu evento <strong>${title}</strong> ha terminado. Aqui tienes un resumen:</p>
      <div style="background:#F0FDF4;border-radius:8px;padding:16px;margin:16px 0">
        <p style="margin:0;font-size:14px;color:#16A34A"><strong>Fotos:</strong> ${totalPhotos}</p>
        <p style="margin:4px 0 0;font-size:14px;color:#16A34A"><strong>Videos:</strong> ${totalVideos}</p>
        <p style="margin:4px 0 0;font-size:14px;color:#16A34A"><strong>Invitados:</strong> ${totalGuests}</p>
        <p style="margin:4px 0 0;font-size:14px;color:#16A34A"><strong>Album disponible por:</strong> ${storageDays} dias</p>
      </div>
      ${downloadUrl ? `<a href="${downloadUrl}" style="display:inline-block;background:#22C55E;color:#fff;padding:12px 24px;border-radius:9999px;text-decoration:none;font-weight:600;margin-top:16px">Descargar album</a>` : ''}
      <p style="margin:20px 0 0;font-size:13px;color:#6B7280;text-align:center;line-height:1.5">Gracias por elegir snapNshare para tu evento especial.</p>
    </div>
  `;
  await sendEmail({ to, subject, html });
}

import nodemailer from 'nodemailer';

// Même transport que portail-filme/lib/mailer.js (Gmail SMTP + SMTP_USER/SMTP_PASS).
// Remplacez par le fournisseur de votre choix si besoin (Resend, Sendgrid...).
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

function wrapper(title, bodyHtml) {
  return `
    <div style="font-family:'Open Sans',Arial,sans-serif;max-width:480px;margin:0 auto;background:#f6f8f8;padding:40px 24px;">
      <div style="background:#ffffff;border:1px solid rgba(20,2,2,0.12);border-radius:8px;padding:40px;">
        <div style="margin-bottom:28px;">
          <img src="https://www.filme.fr/cdn/shop/files/Filme-Logo-sd.svg?v=1707646401&width=120"
               alt="Filme" height="22" style="display:block;" />
        </div>
        <p style="font-size:18px;font-weight:700;color:#140202;margin:0 0 8px;">${title}</p>
        ${bodyHtml}
      </div>
      <p style="font-size:11px;color:#8C8F90;text-align:center;margin-top:20px;">
        Filme — Location de matériel audiovisuel &middot; <a href="https://www.filme.fr" style="color:#8C8F90;">www.filme.fr</a>
      </p>
    </div>
  `;
}

export async function sendWorkshopConfirmation(to, name, topic, dateLabel, placesLeft) {
  const html = wrapper(
    'Inscription confirmée',
    `
      <p style="font-size:14px;color:#8C8F90;margin:0 0 20px;line-height:1.6;">
        Bonjour ${name || ''},<br><br>
        Votre inscription au workshop <strong style="color:#140202;">${topic.title}</strong>
        du <strong style="color:#140202;">${dateLabel}</strong> est confirmée.<br><br>
        ${placesLeft > 0
          ? `Il reste <strong style="color:#140202;">${placesLeft} place(s)</strong> sur cette session — elle sera validée dès que 6 personnes seront inscrites. Vous recevrez un email de confirmation finale dès que ce sera le cas.`
          : `La session est complète, elle est validée !`}
      </p>
      <p style="font-size:13px;color:#8C8F90;">Rendez-vous chez Filme — Montreuil, 9h00 à 18h00. Tarif : 149 € HT.</p>
    `
  );
  await transporter.sendMail({
    from: `"Filme — Workshops" <${process.env.SMTP_USER}>`,
    to,
    subject: `Inscription confirmée — ${topic.title}`,
    html,
  });
}

export async function sendWorkshopValidated(registrants, topic, dateLabel) {
  const html = wrapper(
    'Formation validée 🎉',
    `
      <p style="font-size:14px;color:#8C8F90;margin:0 0 20px;line-height:1.6;">
        Bonne nouvelle : le workshop <strong style="color:#140202;">${topic.title}</strong>
        du <strong style="color:#140202;">${dateLabel}</strong> vient d'atteindre 6 participants.
        La session est <strong style="color:#00AD6F;">validée</strong> !
      </p>
      <p style="font-size:13px;color:#8C8F90;">Rendez-vous chez Filme — Montreuil, de 9h00 à 18h00. À très vite !</p>
    `
  );

  await Promise.all(
    registrants.map((r) =>
      transporter.sendMail({
        from: `"Filme — Workshops" <${process.env.SMTP_USER}>`,
        to: r.email,
        subject: `Formation validée — ${topic.title}`,
        html,
      })
    )
  );

  if (process.env.ADMIN_EMAILS) {
    const admins = process.env.ADMIN_EMAILS.split(',').map((e) => e.trim()).filter(Boolean);
    if (admins.length) {
      await transporter.sendMail({
        from: `"Filme — Workshops" <${process.env.SMTP_USER}>`,
        to: admins.join(','),
        subject: `[Workshop validé] ${topic.title} — ${dateLabel}`,
        html: wrapper(
          'Workshop validé',
          `<p style="font-size:14px;color:#8C8F90;">${topic.title} — ${dateLabel} — 6/6 inscrits : ${registrants.map((r) => r.email).join(', ')}</p>`
        ),
      });
    }
  }
}

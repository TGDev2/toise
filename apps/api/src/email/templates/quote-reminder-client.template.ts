export interface QuoteReminderClientEmailData {
  quoteNumber: string;
  totalTtc: number;
  daysSinceSent: 7 | 14;
  companyName: string | null;
  contractorEmail: string | null;
  contractorPhone: string | null;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatEuros(amount: number): string {
  return `${amount.toFixed(2).replace('.', ',')} €`;
}

export function buildQuoteReminderClientEmail(
  data: QuoteReminderClientEmailData,
): RenderedEmail {
  const artisanLabel = data.companyName
    ? escapeHtml(data.companyName)
    : 'votre artisan';
  const subject = `Votre devis ${data.quoteNumber} est toujours en attente`;

  const contactLines: string[] = [];
  if (data.contractorEmail) contactLines.push(escapeHtml(data.contractorEmail));
  if (data.contractorPhone) contactLines.push(escapeHtml(data.contractorPhone));
  const contactHtml = contactLines.length
    ? `<p style="font-size:14px;color:#57534e;">Vous pouvez contacter ${artisanLabel} directement : ${contactLines.join(' · ')}</p>`
    : '';
  const contactText = contactLines.length
    ? `Vous pouvez contacter ${data.companyName ?? 'votre artisan'} directement : ${contactLines.join(' · ')}`
    : '';

  const html = `<!DOCTYPE html>
<html lang="fr"><body style="font-family:Arial,sans-serif;background:#f7f5f2;padding:24px;color:#292524;margin:0;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px;">
    <h1 style="font-size:20px;margin:0 0 8px;">Votre devis n°${escapeHtml(data.quoteNumber)}</h1>
    <p style="font-size:14px;color:#57534e;">
      ${artisanLabel} vous a envoyé un devis d'un montant de
      <strong>${formatEuros(data.totalTtc)} TTC</strong> il y a ${data.daysSinceSent} jours,
      resté sans réponse à ce jour.
    </p>
    <p style="font-size:14px;color:#57534e;">
      Si vous avez des questions ou souhaitez donner suite, n'hésitez pas à en discuter.
    </p>
    ${contactHtml}
    <p style="font-size:12px;color:#a8a29e;margin-top:32px;">
      Vous recevez cet e-mail suite à un devis établi via Chiffréo. Pour toute question, contactez-nous à privacy@chiffreo.fr.
    </p>
  </div>
</body></html>`;

  const text = [
    `Votre devis n°${data.quoteNumber}`,
    '',
    `${data.companyName ?? 'Votre artisan'} vous a envoyé un devis d'un montant de ${formatEuros(data.totalTtc)} TTC il y a ${data.daysSinceSent} jours, resté sans réponse à ce jour.`,
    '',
    "Si vous avez des questions ou souhaitez donner suite, n'hésitez pas à en discuter.",
    ...(contactText ? ['', contactText] : []),
    '',
    'Vous recevez cet e-mail suite à un devis établi via Chiffréo.',
  ].join('\n');

  return { subject, html, text };
}

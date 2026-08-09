export interface QuoteReminderContractorEmailData {
  quoteNumber: string;
  totalTtc: number;
  daysSinceSent: 7 | 14;
  clientName: string | null;
  quoteUrl: string;
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

export function buildQuoteReminderContractorEmail(
  data: QuoteReminderContractorEmailData,
): RenderedEmail {
  const clientLabel = data.clientName
    ? escapeHtml(data.clientName)
    : 'Le client';
  const subject = `Devis ${data.quoteNumber} sans réponse depuis ${data.daysSinceSent} jours`;

  const html = `<!DOCTYPE html>
<html lang="fr"><body style="font-family:Arial,sans-serif;background:#f7f5f2;padding:24px;color:#292524;margin:0;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px;">
    <h1 style="font-size:20px;margin:0 0 8px;">Devis n°${escapeHtml(data.quoteNumber)} toujours sans réponse</h1>
    <p style="font-size:14px;color:#57534e;">
      ${clientLabel} n'a pas encore répondu à votre devis de
      <strong>${formatEuros(data.totalTtc)} TTC</strong>, envoyé il y a ${data.daysSinceSent} jours.
      Un e-mail de relance automatique vient de lui être envoyé.
    </p>
    <p style="font-size:14px;">
      <a href="${data.quoteUrl}" style="color:#0369a1;">Voir le devis</a>
    </p>
    <p style="font-size:12px;color:#a8a29e;margin-top:32px;">
      Relance automatique Chiffréo (relances devis, palier Chiffréo Pro).
    </p>
  </div>
</body></html>`;

  const text = [
    `Devis n°${data.quoteNumber} toujours sans réponse`,
    '',
    `${data.clientName ?? 'Le client'} n'a pas encore répondu à votre devis de ${formatEuros(data.totalTtc)} TTC, envoyé il y a ${data.daysSinceSent} jours.`,
    'Un e-mail de relance automatique vient de lui être envoyé.',
    '',
    `Voir le devis : ${data.quoteUrl}`,
  ].join('\n');

  return { subject, html, text };
}

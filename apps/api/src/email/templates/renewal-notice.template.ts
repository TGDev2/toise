export interface RenewalNoticeEmailData {
  /** Jours restants avant le prélèvement. */
  daysRemaining: number;
  /** Date de reconduction, déjà formatée en français. */
  renewalDate: string;
  priceEuros: number;
  /** « par an ». */
  billingPeriodLabel: string;
  manageSubscriptionUrl: string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

function formatEuros(amount: number): string {
  return `${amount.toFixed(2).replace('.', ',')} €`;
}

/**
 * Préavis de reconduction annuelle (E3-3).
 *
 * Il annonce un montant et une date, et il dit comment ne pas payer. C'est
 * volontaire : un préavis qui se contenterait de remercier serait une publicité
 * déguisée en information. Sur un prélèvement unique de 279 €, la reconduction
 * tacite non annoncée est la première cause de demande de remboursement — et,
 * à défaut, de contestation bancaire, qui coûte davantage que le remboursement
 * qu'elle remplace.
 */
export function buildRenewalNoticeEmail(
  data: RenewalNoticeEmailData,
): RenderedEmail {
  const priceLabel = formatEuros(data.priceEuros);
  const dayLabel =
    data.daysRemaining === 1 ? '1 jour' : `${data.daysRemaining} jours`;
  const subject = `Votre abonnement Toisé se reconduit dans ${dayLabel}`;

  const html = `<!DOCTYPE html>
<html lang="fr"><body style="font-family:Arial,sans-serif;background:#f7f5f2;padding:24px;color:#292524;margin:0;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px;">
    <h1 style="font-size:20px;margin:0 0 8px;">Votre abonnement se reconduit le ${data.renewalDate}</h1>
    <p style="font-size:14px;color:#57534e;">
      Sauf résiliation de votre part, votre abonnement Toisé sera reconduit
      pour un an le <strong>${data.renewalDate}</strong>, et votre carte sera
      débitée de <strong>${priceLabel} HT ${data.billingPeriodLabel}</strong>.
    </p>
    <p style="font-size:14px;color:#57534e;">
      Vous n'avez rien à faire pour continuer. Pour arrêter, il suffit de
      résilier avant cette date : vos devis et vos factures déjà émis restent
      consultables et exportables, et le chiffrage reste gratuit et illimité.
    </p>
    <p style="font-size:14px;">
      <a href="${data.manageSubscriptionUrl}" style="color:#0369a1;">Gérer mon abonnement</a>
    </p>
    <p style="font-size:12px;color:#a8a29e;margin-top:32px;">
      Vous recevez cet e-mail parce que votre abonnement Toisé arrive à échéance. Pour toute question, écrivez-nous à privacy@toise.fr.
    </p>
  </div>
</body></html>`;

  const text = [
    `Votre abonnement se reconduit le ${data.renewalDate}`,
    '',
    `Sauf résiliation de votre part, votre abonnement Toisé sera reconduit pour un an le ${data.renewalDate}, et votre carte sera débitée de ${priceLabel} HT ${data.billingPeriodLabel}.`,
    '',
    "Vous n'avez rien à faire pour continuer. Pour arrêter, il suffit de résilier avant cette date : vos devis et vos factures déjà émis restent consultables et exportables, et le chiffrage reste gratuit et illimité.",
    '',
    `Gérer mon abonnement : ${data.manageSubscriptionUrl}`,
    '',
    'Vous recevez cet e-mail parce que votre abonnement Toisé arrive à échéance.',
  ].join('\n');

  return { subject, html, text };
}

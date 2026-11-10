export interface TrialEndingSoonEmailData {
  daysRemaining: number;
  priceEuros: number;
  /**
   * Périodicité, en toutes lettres — « par an ».
   *
   * Le modèle écrivait `/mois` en dur. Le jour où l'offre est passée à 279 €
   * par an (E3-3), il aurait annoncé 279 € par mois à quelqu'un sur le point
   * d'être prélevé : un montant juste, une périodicité fausse, et le pire
   * moment pour se tromper. La périodicité vient donc de `PLANS`, comme le
   * montant.
   */
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

export function buildTrialEndingSoonEmail(
  data: TrialEndingSoonEmailData,
): RenderedEmail {
  const priceLabel = formatEuros(data.priceEuros);
  const dayLabel =
    data.daysRemaining === 1 ? '1 jour' : `${data.daysRemaining} jours`;
  const subject = `Votre essai Toisé se termine dans ${dayLabel}`;

  const html = `<!DOCTYPE html>
<html lang="fr"><body style="font-family:Arial,sans-serif;background:#f7f5f2;padding:24px;color:#292524;margin:0;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px;">
    <h1 style="font-size:20px;margin:0 0 8px;">Votre essai Toisé se termine dans ${dayLabel}</h1>
    <p style="font-size:14px;color:#57534e;">
      Passé ce délai, votre abonnement sera automatiquement facturé
      <strong>${priceLabel} ${data.billingPeriodLabel}</strong>. Vous pouvez gérer ou annuler votre
      abonnement à tout moment avant la fin de l'essai.
    </p>
    <p style="font-size:14px;">
      <a href="${data.manageSubscriptionUrl}" style="color:#0369a1;">Gérer mon abonnement</a>
    </p>
    <p style="font-size:12px;color:#a8a29e;margin-top:32px;">
      Vous recevez cet e-mail car votre essai Toisé arrive à échéance. Pour toute question, contactez-nous à privacy@toise.fr.
    </p>
  </div>
</body></html>`;

  const text = [
    `Votre essai Toisé se termine dans ${dayLabel}`,
    '',
    `Passé ce délai, votre abonnement sera automatiquement facturé ${priceLabel} ${data.billingPeriodLabel}. Vous pouvez gérer ou annuler votre abonnement à tout moment avant la fin de l'essai.`,
    '',
    `Gérer mon abonnement : ${data.manageSubscriptionUrl}`,
    '',
    'Vous recevez cet e-mail car votre essai Toisé arrive à échéance.',
  ].join('\n');

  return { subject, html, text };
}

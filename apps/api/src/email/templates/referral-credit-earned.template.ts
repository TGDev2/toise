export interface ReferralCreditEarnedEmailData {
  amountEuros: number;
  referralsUrl: string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

function formatEuros(amount: number): string {
  return `${amount.toFixed(2).replace('.', ',')} €`;
}

export function buildReferralCreditEarnedEmail(
  data: ReferralCreditEarnedEmailData,
): RenderedEmail {
  const amountLabel = formatEuros(data.amountEuros);
  const subject = `Vous avez gagné ${amountLabel} grâce à votre parrainage`;

  const html = `<!DOCTYPE html>
<html lang="fr"><body style="font-family:Arial,sans-serif;background:#f7f5f2;padding:24px;color:#292524;margin:0;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px;">
    <h1 style="font-size:20px;margin:0 0 8px;">Un filleul vient de s’abonner 🎉</h1>
    <p style="font-size:14px;color:#57534e;">
      Un utilisateur que vous avez parrainé vient de souscrire un abonnement Chiffréo.
      En remerciement, <strong>${amountLabel}</strong> ont été crédités sur votre compte
      et seront automatiquement déduits de votre prochaine facture.
    </p>
    <p style="font-size:14px;">
      <a href="${data.referralsUrl}" style="color:#0369a1;">Voir mes parrainages</a>
    </p>
    <p style="font-size:12px;color:#a8a29e;margin-top:32px;">
      Programme de parrainage Chiffréo.
    </p>
  </div>
</body></html>`;

  const text = [
    `Un filleul vient de s’abonner`,
    '',
    `Un utilisateur que vous avez parrainé vient de souscrire un abonnement Chiffréo. En remerciement, ${amountLabel} ont été crédités sur votre compte et seront automatiquement déduits de votre prochaine facture.`,
    '',
    `Voir mes parrainages : ${data.referralsUrl}`,
  ].join('\n');

  return { subject, html, text };
}

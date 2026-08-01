export interface OnboardingD1EmailData {
  dashboardUrl: string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export function buildOnboardingD1Email(
  data: OnboardingD1EmailData,
): RenderedEmail {
  const subject = 'Bienvenue sur Chiffréo — par où commencer ?';

  const html = `<!DOCTYPE html>
<html lang="fr"><body style="font-family:Arial,sans-serif;background:#f7f5f2;padding:24px;color:#292524;margin:0;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px;">
    <h1 style="font-size:20px;margin:0 0 8px;">Bienvenue sur Chiffréo</h1>
    <p style="font-size:14px;color:#57534e;">
      Trois étapes suffisent pour obtenir votre première estimation chiffrée :
      créez un projet, prenez quelques photos de la pièce (ou saisissez les
      dimensions à la main), et laissez Chiffréo calculer les quantités de
      matériaux et le budget.
    </p>
    <p style="font-size:14px;">
      <a href="${data.dashboardUrl}" style="color:#0369a1;">Créer mon premier projet</a>
    </p>
    <p style="font-size:12px;color:#a8a29e;margin-top:32px;">
      Vous recevez cet e-mail suite à votre inscription sur Chiffréo. Pour toute question, contactez-nous à privacy@chiffreo.fr.
    </p>
  </div>
</body></html>`;

  const text = [
    'Bienvenue sur Chiffréo',
    '',
    'Trois étapes suffisent pour obtenir votre première estimation chiffrée : créez un projet, prenez quelques photos de la pièce (ou saisissez les dimensions à la main), et laissez Chiffréo calculer les quantités de matériaux et le budget.',
    '',
    `Créer mon premier projet : ${data.dashboardUrl}`,
    '',
    'Vous recevez cet e-mail suite à votre inscription sur Chiffréo.',
  ].join('\n');

  return { subject, html, text };
}

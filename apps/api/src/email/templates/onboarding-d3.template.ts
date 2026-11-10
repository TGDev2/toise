export interface OnboardingD3EmailData {
  dashboardUrl: string;
  hasProject: boolean;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export function buildOnboardingD3Email(
  data: OnboardingD3EmailData,
): RenderedEmail {
  const subject = data.hasProject
    ? 'Votre projet Toisé vous attend'
    : "Vous n'avez pas encore lancé de projet ?";

  const bodyText = data.hasProject
    ? "Vous avez commencé un projet sur Toisé. Ajoutez vos travaux et générez la liste d'achats pour voir votre base de commande — quantités et prix, pièce par pièce."
    : "Vous vous êtes inscrit il y a 3 jours mais n'avez pas encore créé de projet. Ça prend moins de 2 minutes : quelques dimensions ou une photo suffisent pour obtenir une première estimation chiffrée.";

  const ctaLabel = data.hasProject
    ? 'Reprendre mon projet'
    : 'Créer mon premier projet';

  const html = `<!DOCTYPE html>
<html lang="fr"><body style="font-family:Arial,sans-serif;background:#f7f5f2;padding:24px;color:#292524;margin:0;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px;">
    <h1 style="font-size:20px;margin:0 0 8px;">${data.hasProject ? 'Votre projet vous attend' : 'Pas encore commencé ?'}</h1>
    <p style="font-size:14px;color:#57534e;">${bodyText}</p>
    <p style="font-size:14px;">
      <a href="${data.dashboardUrl}" style="color:#0369a1;">${ctaLabel}</a>
    </p>
    <p style="font-size:12px;color:#a8a29e;margin-top:32px;">
      Vous recevez cet e-mail suite à votre inscription sur Toisé. Pour toute question, contactez-nous à privacy@toise.fr.
    </p>
  </div>
</body></html>`;

  const text = [
    data.hasProject ? 'Votre projet vous attend' : 'Pas encore commencé ?',
    '',
    bodyText,
    '',
    `${ctaLabel} : ${data.dashboardUrl}`,
    '',
    'Vous recevez cet e-mail suite à votre inscription sur Toisé.',
  ].join('\n');

  return { subject, html, text };
}

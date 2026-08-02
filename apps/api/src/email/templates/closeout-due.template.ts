export interface CloseoutDueEmailData {
  projectName: string;
  closeoutUrl: string;
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

/**
 * BACKLOG DATA-5 : relance de clôture de chantier.
 *
 * L'hypothèse fragile de la fonctionnalité est que l'utilisateur rouvre
 * l'application après les travaux — le bricolage est épisodique et rien ne
 * justifie d'ouvrir l'app pendant le chantier. Cet e-mail est la seule chose
 * qui transforme « si l'utilisateur repasse » en « il est prévenu ».
 *
 * Aucun montant n'est annoncé, et c'est délibéré : le montant récupérable se
 * déduit de ce que l'utilisateur déclare, donc il n'existe pas encore au
 * moment de l'envoi. Promettre « 150 € à récupérer » avant de savoir ce qu'il
 * a acheté serait une accroche inventée — exactement ce que le reste du lot
 * s'interdit sur les délais de reprise.
 */
export function buildCloseoutDueEmail(
  data: CloseoutDueEmailData,
): RenderedEmail {
  const projectLabel = escapeHtml(data.projectName);
  const subject = `Qu'avez-vous réellement acheté pour « ${data.projectName} » ?`;

  const html = `<!DOCTYPE html>
<html lang="fr"><body style="font-family:Arial,sans-serif;background:#f7f5f2;padding:24px;color:#292524;margin:0;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px;">
    <h1 style="font-size:20px;margin:0 0 8px;">Le chantier « ${projectLabel} » est-il terminé ?</h1>
    <p style="font-size:14px;color:#57534e;">
      Une correction par ligne — combien vous en avez acheté — et nous vous
      disons ce qu'il vous reste sur les bras, ce qui est encore reprenable
      chez votre enseigne, et où notre estimation s'est trompée.
    </p>
    <p style="font-size:14px;color:#57534e;">
      Comptez trente secondes. Aucun prix n'est nécessaire.
    </p>
    <p style="font-size:14px;">
      <a href="${data.closeoutUrl}" style="color:#0369a1;">Clôturer « ${projectLabel} »</a>
    </p>
    <p style="font-size:12px;color:#a8a29e;margin-top:32px;">
      Vous recevez cet e-mail car ce chantier a été estimé sur Chiffréo sans être clôturé. Pour toute question, contactez-nous à privacy@chiffreo.fr.
    </p>
  </div>
</body></html>`;

  const text = [
    `Le chantier « ${data.projectName} » est-il terminé ?`,
    '',
    "Une correction par ligne — combien vous en avez acheté — et nous vous disons ce qu'il vous reste sur les bras, ce qui est encore reprenable chez votre enseigne, et où notre estimation s'est trompée.",
    '',
    'Comptez trente secondes. Aucun prix n’est nécessaire.',
    '',
    `Clôturer « ${data.projectName} » : ${data.closeoutUrl}`,
    '',
    'Vous recevez cet e-mail car ce chantier a été estimé sur Chiffréo sans être clôturé.',
  ].join('\n');

  return { subject, html, text };
}

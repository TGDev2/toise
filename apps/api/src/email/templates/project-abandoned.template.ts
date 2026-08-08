export interface ProjectAbandonedEmailData {
  projectName: string;
  projectUrl: string;
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

export function buildProjectAbandonedEmail(
  data: ProjectAbandonedEmailData,
): RenderedEmail {
  const projectLabel = escapeHtml(data.projectName);
  const subject = `Votre projet « ${data.projectName} » est resté en cours`;

  const html = `<!DOCTYPE html>
<html lang="fr"><body style="font-family:Arial,sans-serif;background:#f7f5f2;padding:24px;color:#292524;margin:0;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px;">
    <h1 style="font-size:20px;margin:0 0 8px;">Votre projet « ${projectLabel} » vous attend</h1>
    <p style="font-size:14px;color:#57534e;">
      Vous avez renseigné des dimensions pour ce projet, mais n'êtes pas allé
      jusqu'à l'estimation. Il ne reste qu'une étape pour obtenir les
      quantités de matériaux et le budget estimé.
    </p>
    <p style="font-size:14px;">
      <a href="${data.projectUrl}" style="color:#0369a1;">Reprendre « ${projectLabel} »</a>
    </p>
    <p style="font-size:12px;color:#a8a29e;margin-top:32px;">
      Vous recevez cet e-mail car ce projet est resté inactif sur Chiffréo. Pour toute question, contactez-nous à privacy@chiffreo.fr.
    </p>
  </div>
</body></html>`;

  const text = [
    `Votre projet « ${data.projectName} » vous attend`,
    '',
    "Vous avez renseigné des dimensions pour ce projet, mais n'êtes pas allé jusqu'à l'estimation. Il ne reste qu'une étape pour obtenir les quantités de matériaux et le budget estimé.",
    '',
    `Reprendre « ${data.projectName} » : ${data.projectUrl}`,
    '',
    'Vous recevez cet e-mail car ce projet est resté inactif sur Chiffréo.',
  ].join('\n');

  return { subject, html, text };
}

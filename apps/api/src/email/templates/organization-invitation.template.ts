export interface OrganizationInvitationEmailData {
  organizationName: string;
  inviterEmail: string | null;
  acceptUrl: string;
  expiresAt: Date;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

/**
 * Le nom de l'organisation et l'e-mail de l'invitant sont saisis par un
 * utilisateur et partent vers un tiers : ils sont échappés avant interpolation.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function buildOrganizationInvitationEmail(
  data: OrganizationInvitationEmailData,
): RenderedEmail {
  const orgName = escapeHtml(data.organizationName);
  const inviter = data.inviterEmail ? escapeHtml(data.inviterEmail) : null;
  const expiry = formatDate(data.expiresAt);
  const subject = `Rejoignez ${data.organizationName} sur Chiffréo`;

  const html = `<!DOCTYPE html>
<html lang="fr"><body style="font-family:Arial,sans-serif;background:#f7f5f2;padding:24px;color:#292524;margin:0;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px;">
    <h1 style="font-size:20px;margin:0 0 8px;">Invitation à rejoindre ${orgName}</h1>
    <p style="font-size:14px;color:#57534e;">
      ${inviter ? `${inviter} vous invite` : 'Vous êtes invité'} à rejoindre
      <strong>${orgName}</strong> sur Chiffréo. Vous aurez accès aux projets,
      clients et devis de l'organisation.
    </p>
    <p style="font-size:14px;">
      <a href="${data.acceptUrl}" style="display:inline-block;background:#0369a1;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;">Accepter l'invitation</a>
    </p>
    <p style="font-size:12px;color:#a8a29e;margin-top:32px;">
      Cette invitation expire le ${expiry}. Si vous ne connaissez pas cette
      organisation, ignorez simplement ce message.
    </p>
  </div>
</body></html>`;

  const text = [
    `Invitation à rejoindre ${data.organizationName}`,
    '',
    `${data.inviterEmail ? `${data.inviterEmail} vous invite` : 'Vous êtes invité'} à rejoindre ${data.organizationName} sur Chiffréo. Vous aurez accès aux projets, clients et devis de l'organisation.`,
    '',
    `Accepter l'invitation : ${data.acceptUrl}`,
    '',
    `Cette invitation expire le ${expiry}.`,
  ].join('\n');

  return { subject, html, text };
}

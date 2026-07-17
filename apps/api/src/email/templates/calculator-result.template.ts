import { EstimationLineItem } from '../../estimations/entities/estimation-result.entity';

export interface CalculatorResultEmailData {
  workTypeLabel: string;
  items: EstimationLineItem[];
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

export function buildCalculatorResultEmail(
  data: CalculatorResultEmailData,
): RenderedEmail {
  const subject = `Votre estimation EstiMate — ${data.workTypeLabel}`;

  const rows = data.items
    .map(
      (item) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e7e2da;">${escapeHtml(item.material_name)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e7e2da;text-align:right;">${item.units_needed} × ${escapeHtml(item.packaging_label)}</td>
      </tr>`,
    )
    .join('');

  const html = `<!DOCTYPE html>
<html lang="fr"><body style="font-family:Arial,sans-serif;background:#f7f5f2;padding:24px;color:#292524;margin:0;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px;">
    <h1 style="font-size:20px;margin:0 0 8px;">Votre estimation — ${escapeHtml(data.workTypeLabel)}</h1>
    <p style="font-size:14px;color:#57534e;">Voici les quantités de matériaux estimées pour votre projet (hors prix).</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:16px;">
      <thead><tr><th style="text-align:left;padding:8px 12px;">Matériau</th><th style="text-align:right;padding:8px 12px;">Quantité</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="font-size:12px;color:#a8a29e;margin-top:32px;">
      Vous recevez cet e-mail suite à votre demande sur EstiMate. Pour toute question ou pour ne plus recevoir nos e-mails, contactez-nous à privacy@estimate.app.
    </p>
  </div>
</body></html>`;

  const text = [
    `Votre estimation — ${data.workTypeLabel}`,
    '',
    ...data.items.map(
      (i) => `- ${i.material_name} : ${i.units_needed} × ${i.packaging_label}`,
    ),
    '',
    'Vous recevez cet e-mail suite à votre demande sur EstiMate.',
    'Pour ne plus recevoir nos e-mails, contactez-nous à privacy@estimate.app.',
  ].join('\n');

  return { subject, html, text };
}

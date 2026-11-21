/**
 * Template mínimo, inline (sem lib de e-mail — MJML/React Email seriam
 * dependência nova sem necessidade real pra um único layout simples), no
 * padrão visual da marca (`#194382`, `docs/design/design-system.md`).
 */
/** Escapa texto para HTML: corpo e título podem conter dado digitado por visitante (formulário público). */
export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** Só http(s) ou caminho relativo no botão; qualquer outra coisa vira o site. */
function safeHref(url: string): string {
  return /^(https?:\/\/|\/)/i.test(url) ? escapeHtml(url) : "https://wjbassessoriacontabil.com.br";
}

export function renderNotificationEmail({
  title,
  body,
  ctaLabel,
  ctaUrl,
}: {
  title: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
}): string {
  const t = escapeHtml(title);
  const b = escapeHtml(body);
  const label = escapeHtml(ctaLabel);
  const href = safeHref(ctaUrl);
  return `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;padding:0;background:#f5f7fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:6px;border:1px solid #dde3ec;overflow:hidden;">
            <tr>
              <td style="background:#194382;padding:20px 28px;">
                <span style="color:#ffffff;font-weight:700;font-size:16px;">WJB Assessoria Contábil</span>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;">
                <h1 style="margin:0 0 12px;font-size:18px;color:#131d2b;">${t}</h1>
                <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#5c6b7f;">${b}</p>
                <a href="${href}" style="display:inline-block;background:#194382;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:10px 20px;border-radius:6px;">${label}</a>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 28px;border-top:1px solid #dde3ec;">
                <p style="margin:0;font-size:12px;color:#8794a6;">Este é um e-mail automático da Plataforma WJB. Não é possível responder diretamente a ele.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

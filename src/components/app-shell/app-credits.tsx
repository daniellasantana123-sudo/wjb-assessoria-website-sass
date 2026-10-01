import { siteConfig } from "@/config/site";

/**
 * Versão da plataforma e assinatura de quem a desenvolveu (2026-10-01,
 * pedido do usuário), no rodapé da barra lateral do Portal e do Admin e no
 * menu do celular. Os valores de versão vêm do build (`next.config.mjs`).
 */
export function AppCredits() {
  const version = process.env.NEXT_PUBLIC_APP_VERSION;
  const commit = process.env.NEXT_PUBLIC_APP_COMMIT;
  const buildDate = process.env.NEXT_PUBLIC_APP_BUILD_DATE;
  const armelx = siteConfig.partners.armelx;

  return (
    <div className="text-muted-foreground flex flex-col gap-0.5 px-1 text-[11px] leading-snug">
      <p>
        Plataforma WJB{version ? ` v${version}` : ""}
        {commit || buildDate ? (
          <span title={commit ? `Build ${commit}` : undefined}>
            {" · "}
            {[commit && `build ${commit}`, buildDate].filter(Boolean).join(" · ")}
          </span>
        ) : null}
      </p>
      <p>
        Desenvolvido por{" "}
        <a
          href={armelx.website}
          target="_blank"
          rel="noopener"
          className="text-foreground hover:text-primary focus-visible:ring-primary rounded-sm font-medium underline underline-offset-2 focus-visible:ring-2 focus-visible:outline-none"
        >
          {armelx.name}
        </a>
      </p>
    </div>
  );
}

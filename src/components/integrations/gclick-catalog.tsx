import { getOmieGClickAdapter } from "@/integrations/omie-gclick";
import type { ExternalCatalogItem } from "@/integrations/omie-gclick";
import { isFeatureEnabled } from "@/lib/feature-flags";

/**
 * Grupos e visibilidades da conta no G-Click (2026-09-24).
 *
 * Existe por um motivo concreto: `GCLICK_VISIBILIDADE_IDS` e
 * `GCLICK_GRUPO_IDS` são variáveis de ambiente que exigem o **id** de um
 * cadastro que só vive no G-Click. Para descobri-los na configuração
 * inicial foi preciso escrever um script de diagnóstico descartável - e
 * qualquer mudança futura exigiria o mesmo. Esta tela mostra os ids
 * direto.
 *
 * Só leitura, staff-only (a página que a renderiza já exige sessão de
 * equipe). Falha silenciosa: se o G-Click não responder, o bloco explica
 * em uma linha em vez de derrubar a página de integrações inteira.
 */
function CatalogList({
  title,
  envVar,
  items,
}: {
  title: string;
  envVar: string;
  items: ExternalCatalogItem[] | null;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-foreground text-sm font-medium">{title}</h3>
        <code className="text-muted-foreground text-xs">{envVar}</code>
      </div>

      {items === null ? (
        <p className="text-muted-foreground mt-2 text-xs">
          Não foi possível consultar no momento.
        </p>
      ) : items.length === 0 ? (
        <p className="text-muted-foreground mt-2 text-xs">Nenhum cadastrado na conta.</p>
      ) : (
        <ul className="border-border divide-border mt-2 divide-y rounded-md border">
          {items.map((item) => (
            <li
              key={item.externalId}
              className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
            >
              <span className="text-foreground min-w-0 truncate">{item.name}</span>
              <code className="text-muted-foreground shrink-0 text-xs">
                id {item.externalId}
              </code>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export async function GClickCatalog() {
  if (!(await isFeatureEnabled("omie_gclick"))) return null;

  const adapter = getOmieGClickAdapter();
  const [groups, visibilities] = await Promise.all([
    adapter.catalog.groups(),
    adapter.catalog.visibilities(),
  ]);

  // Ambas falharam: provavelmente a integração está desligada ou sem
  // credencial - a própria página já informa isso acima, não repetir aqui.
  if (!groups.ok && !visibilities.ok) return null;

  return (
    <div className="border-border mt-4 rounded-md border p-4">
      <p className="text-muted-foreground text-xs">
        Cadastros da conta no G-Click, para preencher as variáveis de ambiente da
        integração.
      </p>
      <div className="mt-4 grid gap-5 sm:grid-cols-2">
        <CatalogList
          title="Visibilidades"
          envVar="GCLICK_VISIBILIDADE_IDS"
          items={visibilities.ok ? visibilities.data : null}
        />
        <CatalogList
          title="Grupos"
          envVar="GCLICK_GRUPO_IDS"
          items={groups.ok ? groups.data : null}
        />
      </div>
    </div>
  );
}

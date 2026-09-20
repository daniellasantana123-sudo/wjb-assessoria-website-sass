import { Search } from "lucide-react";

import { deleteDocument } from "@/actions/documents";
import { Input } from "@/components/ui/input";
import { listTenantDocuments, formatFileSize } from "@/lib/documents";
import type { DocumentCategory } from "@/types/database";

/**
 * `searchAction`/`query` (Fase 3 do wjb-saas-mvp, 2026-09-20) — busca por
 * nome de arquivo. Segue o mesmo padrão já usado em
 * `/portal/calendario` (formulário GET pra query string, sem JS de
 * cliente) em vez de um campo client-side com `onChange` — `searchAction`
 * é o caminho da própria página (ex.: `/portal/documentos`), pra onde o
 * `<form method="get">` submete `?q=`.
 */
export async function DocumentsList({
  tenantId,
  category,
  canDelete = false,
  emptyMessage = "Nenhum documento enviado ainda.",
  query,
  searchAction,
}: {
  tenantId: string;
  category?: DocumentCategory;
  canDelete?: boolean;
  emptyMessage?: string;
  query?: string;
  searchAction?: string;
}) {
  const documents = await listTenantDocuments(tenantId, category, query);

  return (
    <div className="flex flex-col gap-4">
      {searchAction && (
        <form method="get" action={searchAction} className="flex max-w-sm items-center gap-2">
          <div className="relative flex-1">
            <Search
              aria-hidden="true"
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
            />
            <Input
              type="search"
              name="q"
              defaultValue={query}
              placeholder="Buscar por nome do arquivo"
              className="pl-9"
            />
          </div>
        </form>
      )}

      {documents.length === 0 ? (
        <p className="text-muted-foreground p-6 text-center text-sm">
          {query ? "Nenhum documento encontrado para essa busca." : emptyMessage}
        </p>
      ) : (
        <div className="border-border divide-border divide-y rounded-md border">
          {documents.map((document) => (
            <div key={document.id} className="flex items-center justify-between gap-4 p-4">
              <div className="min-w-0">
                <a
                  href={`/api/documents/${document.id}/download`}
                  className="text-foreground hover:text-primary focus-visible:ring-primary truncate font-medium underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  {document.fileName}
                </a>
                <p className="text-muted-foreground text-sm">
                  {new Date(document.createdAt).toLocaleDateString("pt-BR")}
                  {document.uploadedByName ? ` · ${document.uploadedByName}` : ""}
                  {document.sizeBytes ? ` · ${formatFileSize(document.sizeBytes)}` : ""}
                </p>
              </div>

              {canDelete && (
                <form
                  action={async () => {
                    "use server";
                    await deleteDocument(document.id);
                  }}
                >
                  <button
                    type="submit"
                    className="text-danger hover:text-danger focus-visible:ring-primary shrink-0 rounded-md text-sm underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                  >
                    Apagar
                  </button>
                </form>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

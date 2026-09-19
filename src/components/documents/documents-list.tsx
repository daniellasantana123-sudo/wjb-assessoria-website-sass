import { deleteDocument } from "@/actions/documents";
import { listTenantDocuments, formatFileSize } from "@/lib/documents";
import type { DocumentCategory } from "@/types/database";

export async function DocumentsList({
  tenantId,
  category,
  canDelete = false,
  emptyMessage = "Nenhum documento enviado ainda.",
}: {
  tenantId: string;
  category?: DocumentCategory;
  canDelete?: boolean;
  emptyMessage?: string;
}) {
  const documents = await listTenantDocuments(tenantId, category);

  if (documents.length === 0) {
    return <p className="text-muted-foreground p-6 text-center text-sm">{emptyMessage}</p>;
  }

  return (
    <div className="border-border divide-border divide-y rounded-md border">
      {documents.map((document) => (
        <div key={document.id} className="flex items-center justify-between gap-4 p-4">
          <div className="min-w-0">
            {document.signedUrl ? (
              <a
                href={document.signedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground hover:text-primary focus-visible:ring-primary truncate font-medium underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                {document.fileName}
              </a>
            ) : (
              <span className="text-foreground font-medium">{document.fileName}</span>
            )}
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
  );
}

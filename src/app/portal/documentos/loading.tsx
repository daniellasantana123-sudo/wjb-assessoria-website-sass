import { Container } from "@/components/layout/container";

/**
 * Estado de loading (Fase 3 do wjb-saas-mvp, 2026-09-20) — Next.js usa este
 * arquivo como fallback de Suspense automático enquanto `page.tsx` (Server
 * Component assíncrono) resolve. Fica só no conteúdo da rota - a sidebar
 * do Portal (`portal/layout.tsx`) continua renderizada normalmente.
 */
export default function LoadingDocumentos() {
  return (
    <Container className="flex flex-1 flex-col gap-8 py-16">
      <div className="bg-muted h-8 w-40 animate-pulse rounded-md" />
      <div className="bg-muted h-24 w-full animate-pulse rounded-md" />
      <div className="flex flex-col gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="bg-muted h-16 w-full animate-pulse rounded-md" />
        ))}
      </div>
    </Container>
  );
}

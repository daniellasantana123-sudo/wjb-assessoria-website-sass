"use client";

import { Container } from "@/components/layout/container";
import { PortalErrorState } from "@/components/shared/portal-error-state";

export default function ErrorDocumentos({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <Container className="flex flex-1 flex-col gap-8 py-16">
      <PortalErrorState
        error={error}
        retry={retry}
        message="Não conseguimos carregar seus documentos agora. Tente novamente em alguns instantes."
      />
    </Container>
  );
}

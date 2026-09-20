"use client";

import { useState, useTransition } from "react";

import { testOmieConnection, type OmieActionState } from "@/actions/omie-gclick";
import { Button } from "@/components/ui/button";

export function OmieConnectionTest() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<OmieActionState>(undefined);

  function handleClick() {
    startTransition(async () => {
      setResult(await testOmieConnection());
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <Button type="button" variant="outline" onClick={handleClick} disabled={pending} className="self-start">
        {pending ? "Testando..." : "Testar conexão"}
      </Button>
      {result && "error" in result && (
        <p role="alert" className="text-danger text-sm">
          {result.error}
        </p>
      )}
      {result && "success" in result && (
        <p role="status" className="text-brand-green-700 text-sm">
          {result.success}
        </p>
      )}
    </div>
  );
}

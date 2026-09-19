import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export function PortalStatCard({
  icon: Icon,
  label,
  value,
  note,
  noteTone = "neutral",
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  note?: string;
  noteTone?: "neutral" | "danger" | "success";
}) {
  return (
    <div className="border-border bg-background rounded-md border p-4">
      <div className="flex items-center gap-2">
        <span className="bg-primary/10 text-primary flex h-7 w-7 shrink-0 items-center justify-center rounded-md">
          <Icon aria-hidden="true" className="h-3.5 w-3.5" />
        </span>
        <span className="text-muted-foreground text-sm">{label}</span>
      </div>
      <p className="text-foreground mt-3 text-2xl font-semibold tabular-nums">{value}</p>
      {note && (
        <p
          className={cn(
            "mt-1 text-xs font-medium",
            noteTone === "danger" && "text-danger",
            noteTone === "success" && "text-success",
            noteTone === "neutral" && "text-muted-foreground",
          )}
        >
          {note}
        </p>
      )}
    </div>
  );
}

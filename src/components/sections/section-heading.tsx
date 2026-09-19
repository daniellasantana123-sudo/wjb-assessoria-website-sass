import { type ReactNode } from "react";

import { cn } from "@/lib/utils";

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "center",
  className,
  titleClassName,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  align?: "left" | "center";
  className?: string;
  titleClassName?: string;
}) {
  return (
    <div
      className={cn(
        "mx-auto max-w-2xl",
        align === "center" ? "text-center" : "text-left",
        align === "left" && "mx-0",
        className,
      )}
    >
      {eyebrow ? (
        <p className="text-primary mb-3 text-sm font-medium tracking-wide uppercase">
          {eyebrow}
        </p>
      ) : null}
      <h2 className={cn("text-2xl font-bold tracking-tight sm:text-3xl", titleClassName)}>
        {title}
      </h2>
      {description ? (
        <p className="text-muted-foreground mt-3 text-base">{description}</p>
      ) : null}
    </div>
  );
}

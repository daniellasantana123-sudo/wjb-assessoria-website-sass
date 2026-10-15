import { type ReactNode } from "react";

import { cn } from "@/lib/utils";

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "center",
  className,
  titleClassName,
  as: Heading = "h2",
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  align?: "left" | "center";
  className?: string;
  titleClassName?: string;
  /** "h1" quando o heading é o título da página (ex.: /duvidas reaproveita o FAQ da Home). */
  as?: "h1" | "h2";
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
      <Heading className={cn("text-2xl font-bold tracking-tight sm:text-3xl", titleClassName)}>
        {title}
      </Heading>
      {description ? (
        <p className="text-muted-foreground mt-3 text-base">{description}</p>
      ) : null}
    </div>
  );
}

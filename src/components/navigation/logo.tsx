import Image from "next/image";
import Link from "next/link";

import { cn } from "@/lib/utils";
import { siteConfig } from "@/config/site";

export function Logo({
  className,
  href = "/",
}: {
  className?: string;
  href?: string;
}) {
  return (
    <Link
      href={href}
      className="focus-visible:ring-primary flex shrink-0 items-center rounded-md focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
      aria-label={`${siteConfig.name} - página inicial`}
    >
      <Image
        src="/brand/logos/logo-wjb-color.png"
        alt={siteConfig.name}
        width={241}
        height={137}
        priority
        className={cn("h-[60px] w-auto shrink-0", className)}
      />
    </Link>
  );
}

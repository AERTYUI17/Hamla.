import { Link } from "@tanstack/react-router";

import logoAsset from "@/assets/hamla-logo.png.asset.json";
import { cn } from "@/lib/utils";

export function HamlaMark({ className }: { className?: string }) {
  return (
    <img
      src={logoAsset.url}
      alt="حملة HAMLA"
      className={cn("h-9 w-auto object-contain", className)}
    />
  );
}

export function HamlaLogo({
  className,
  withWordmark = true,
}: {
  className?: string;
  withWordmark?: boolean;
}) {
  return (
    <Link to="/" className={cn("flex items-center gap-2", className)} aria-label="HAMLA">
      <HamlaMark />
      {withWordmark ? (
        <span className="hidden text-lg font-semibold tracking-tight text-foreground sm:inline">
          HAMLA
        </span>
      ) : null}
    </Link>
  );
}

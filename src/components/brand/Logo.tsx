import Link from "next/link";
import { cn } from "@/lib/cn";

type LogoProps = {
  compact?: boolean;
  className?: string;
  href?: string;
  subtitle?: string;
};

export function Logo({
  compact = false,
  className,
  href = "/app",
  subtitle = "Site Yönetimi",
}: LogoProps) {
  return (
    <Link
      href={href}
      className={cn("flex items-center gap-2.5 text-ink no-underline", className)}
      aria-label={`Woontegra ${subtitle}`}
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-accent text-white">
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden>
          <path
            fill="currentColor"
            d="M4 20V9.5L12 4l8 5.5V20h-6v-6H10v6H4Zm2-2h2v-6h8v6h2V10.4L12 6.1 6 10.4V18Z"
          />
        </svg>
      </span>
      {compact ? null : (
        <span className="min-w-0 leading-tight">
          <span className="block text-[13px] font-medium">Woontegra</span>
          <span className="block text-[11px] font-normal text-muted">{subtitle}</span>
        </span>
      )}
    </Link>
  );
}

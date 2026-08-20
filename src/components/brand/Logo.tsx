import Link from "next/link";
import { cn } from "@/lib/cn";

type LogoProps = {
  compact?: boolean;
  className?: string;
};

export function Logo({ compact = false, className }: LogoProps) {
  return (
    <Link
      href="/app"
      className={cn("flex items-center gap-2 text-ink no-underline", className)}
      aria-label="Site Yönetim ana sayfa"
    >
      <span className="flex size-8 items-center justify-center rounded-md bg-brand text-white">
        <svg viewBox="0 0 24 24" className="size-4.5 h-[18px] w-[18px]" aria-hidden>
          <path
            fill="currentColor"
            d="M4 20V9.5L12 4l8 5.5V20h-6v-6H10v6H4Zm2-2h2v-6h8v6h2V10.4L12 6.1 6 10.4V18Z"
          />
        </svg>
      </span>
      {compact ? null : (
        <span className="text-[15px] font-semibold tracking-tight">Site Yönetim</span>
      )}
    </Link>
  );
}

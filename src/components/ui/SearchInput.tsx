import type { InputHTMLAttributes } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/cn";
import { Input } from "@/components/ui/Input";

type SearchInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

export function SearchInput({ className, ...props }: SearchInputProps) {
  return (
    <label className="relative block w-full min-w-0">
      <Search
        className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted"
        aria-hidden
      />
      <Input className={cn("h-10 pl-8", className)} type="search" {...props} />
    </label>
  );
}

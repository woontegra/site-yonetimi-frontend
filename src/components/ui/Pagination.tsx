import { Button } from "@/components/ui/Button";

type PaginationProps = {
  page: number;
  perPage: number;
  total: number;
  onPageChange: (page: number) => void;
};

export function Pagination({ page, perPage, total, onPageChange }: PaginationProps) {
  if (total === 0) return null;

  const start = (page - 1) * perPage + 1;
  const end = Math.min(page * perPage, total);
  const lastPage = Math.max(1, Math.ceil(total / perPage));

  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
      <p className="text-sm text-muted">
        {start}–{end} / {total} kayıt
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Önceki
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={page >= lastPage}
          onClick={() => onPageChange(page + 1)}
        >
          Sonraki
        </Button>
      </div>
    </div>
  );
}

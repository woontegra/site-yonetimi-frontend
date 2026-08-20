import { Plus } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { SearchInput } from "@/components/ui/SearchInput";
import { Table } from "@/components/ui/Table";
import { TableEmptyState } from "@/components/ui/TableEmptyState";

type ModulePlaceholderProps = {
  title: string;
  actionLabel?: string;
  searchPlaceholder?: string;
  emptyDescription?: string;
};

export function ModulePlaceholder({
  title,
  actionLabel,
  searchPlaceholder = "Ara...",
  emptyDescription = "Kayıtlar eklendiğinde bu tabloda listelenecek.",
}: ModulePlaceholderProps) {
  return (
    <PageContainer>
      <PageHeader
        title={title}
        search={<SearchInput placeholder={searchPlaceholder} aria-label={`${title} içinde ara`} />}
        actions={
          actionLabel ? (
            <Button>
              <Plus className="size-4" aria-hidden />
              {actionLabel}
            </Button>
          ) : undefined
        }
      />
      <Table>
        <TableEmptyState description={emptyDescription} />
      </Table>
    </PageContainer>
  );
}

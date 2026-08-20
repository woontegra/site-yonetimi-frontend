import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";

export default function AyarlarPage() {
  return (
    <PageContainer>
      <PageHeader title="Ayarlar" />
      <div className="rounded-md border border-line bg-white px-5 py-10 shadow-panel">
        <p className="text-sm text-ink">Henüz ayar kaydı bulunmuyor.</p>
        <p className="mt-1 text-sm text-muted">
          Site bilgileri, roller ve tercih ekranları sonraki fazda eklenecek.
        </p>
      </div>
    </PageContainer>
  );
}

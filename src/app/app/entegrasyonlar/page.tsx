import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";

const upcoming = [
  { name: "WhatsApp", note: "Toplu bilgilendirme için ayrıldı." },
  { name: "SMS", note: "Borç hatırlatmaları için ayrıldı." },
  { name: "Banka", note: "Hesap hareketi eşleştirme için ayrıldı." },
  { name: "E-posta", note: "Duyuru ve belge gönderimi için ayrıldı." },
];

export default function EntegrasyonlarPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Entegrasyonlar"
        description="Dış servis bağlantıları sonraki fazlarda buradan yönetilecek."
      />
      <div className="overflow-hidden rounded-md border border-line bg-white shadow-panel">
        <ul className="divide-y divide-line">
          {upcoming.map((item) => (
            <li key={item.name} className="flex items-center justify-between gap-4 px-5 py-3.5">
              <div>
                <p className="text-sm font-medium text-ink">{item.name}</p>
                <p className="text-sm text-muted">{item.note}</p>
              </div>
              <Badge>Bağlı değil</Badge>
            </li>
          ))}
        </ul>
      </div>
    </PageContainer>
  );
}

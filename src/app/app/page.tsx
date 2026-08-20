import { PageContainer } from "@/components/layout/PageContainer";

export default function AppHomePage() {
  return (
    <PageContainer>
      <h1 className="text-[24px] font-semibold text-ink">Hoş geldiniz</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
        Üst menüden yönetmek istediğiniz bölüme geçebilirsiniz. Kayıtlar sonraki adımlarda bu
        ekranlara eklenecek.
      </p>
    </PageContainer>
  );
}

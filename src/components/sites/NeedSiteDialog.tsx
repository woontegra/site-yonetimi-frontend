"use client";

import { useRouter } from "next/navigation";
import { MapPinned } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

type NeedSiteDialogProps = {
  open: boolean;
  onClose: () => void;
};

export function NeedSiteDialog({ open, onClose }: NeedSiteDialogProps) {
  const router = useRouter();

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Site gerekli"
      description="Bu işlemi yapabilmek için önce bir site oluşturmalısınız."
      icon={MapPinned}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Kapat
          </Button>
          <Button
            onClick={() => {
              onClose();
              router.push("/app/siteler");
            }}
          >
            Site Oluştur
          </Button>
        </>
      }
    >
      <p className="text-sm text-muted">
        Siteler sayfasından yeni bir site ekledikten sonra bu işlemi tekrar deneyebilirsiniz.
      </p>
    </Modal>
  );
}

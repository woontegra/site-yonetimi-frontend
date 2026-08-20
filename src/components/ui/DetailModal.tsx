"use client";

import { Modal, type ModalProps } from "@/components/ui/Modal";

type DetailModalProps = Omit<ModalProps, "variant" | "size"> & {
  size?: ModalProps["size"];
};

export function DetailModal({ size = "md", ...props }: DetailModalProps) {
  return <Modal variant="detail" size={size} {...props} />;
}

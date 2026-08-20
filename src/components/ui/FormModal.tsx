"use client";

import { Modal, type ModalProps } from "@/components/ui/Modal";

type FormModalProps = Omit<ModalProps, "variant" | "size"> & {
  size?: ModalProps["size"];
};

export function FormModal({ size = "lg", ...props }: FormModalProps) {
  return <Modal variant="form" size={size} {...props} />;
}

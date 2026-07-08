"use client";

import * as React from "react";
import { type ToastInput, useToast } from "@/components/ui/toast";

type ServerFormAction = (formData: FormData) => void | Promise<void>;

type ActionFormProps = Omit<
  React.FormHTMLAttributes<HTMLFormElement>,
  "action"
> & {
  action: ServerFormAction;
  successToast?: ToastInput;
};

export function ActionForm({
  action,
  children,
  successToast,
  ...props
}: ActionFormProps) {
  const { showToast } = useToast();

  async function formAction(formData: FormData) {
    await action(formData);

    if (successToast) {
      showToast({
        variant: "success",
        ...successToast,
      });
    }
  }

  return (
    <form {...props} action={formAction}>
      {children}
    </form>
  );
}

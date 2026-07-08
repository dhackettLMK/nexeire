"use client";

import * as React from "react";
import { useFormStatus, type FormStatusPending } from "react-dom";
import { LoaderCircle } from "lucide-react";
import {
  buttonClasses,
  type ButtonVariants,
} from "@/components/ui/button";
import { cn } from "@/lib/utils";

type FormAction = FormStatusPending["action"];

type LoadingIconProps = {
  icon?: React.ReactNode;
  isLoading: boolean;
};

function LoadingIcon({ icon, isLoading }: LoadingIconProps) {
  if (!icon && !isLoading) {
    return null;
  }

  return (
    <span className="grid size-4 shrink-0 place-items-center" aria-hidden="true">
      {isLoading ? <LoaderCircle className="size-4 animate-spin" /> : icon}
    </span>
  );
}

type SubmitButtonProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "type"
> &
  ButtonVariants & {
    icon?: React.ReactNode;
    pendingAction?: FormAction;
  };

export function SubmitButton({
  children,
  className,
  disabled,
  icon,
  pendingAction,
  size,
  variant,
  formAction,
  ...props
}: SubmitButtonProps) {
  const status = useFormStatus();
  const buttonAction = (formAction ?? pendingAction) as FormAction | undefined;
  const isLoading =
    status.pending && (buttonAction ? status.action === buttonAction : true);

  return (
    <button
      {...props}
      type="submit"
      formAction={formAction}
      disabled={disabled || isLoading}
      aria-busy={isLoading}
      className={cn(buttonClasses({ variant, size }), className)}
    >
      <LoadingIcon icon={icon} isLoading={isLoading} />
      {children}
    </button>
  );
}

type AsyncButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  ButtonVariants & {
    icon?: React.ReactNode;
    isLoading: boolean;
  };

export function AsyncButton({
  children,
  className,
  disabled,
  icon,
  isLoading,
  size,
  variant,
  type = "button",
  ...props
}: AsyncButtonProps) {
  return (
    <button
      {...props}
      type={type}
      disabled={disabled || isLoading}
      aria-busy={isLoading}
      className={cn(buttonClasses({ variant, size }), className)}
    >
      <LoadingIcon icon={icon} isLoading={isLoading} />
      {children}
    </button>
  );
}

import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/components/polyhedge/cn";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "ghost" | "danger" | "toggle";
  active?: boolean;
}

export function Button({
  className,
  variant = "primary",
  active,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "ph-btn",
        variant === "ghost" && "ph-btn-ghost",
        variant === "danger" && "ph-btn-danger",
        variant === "toggle" && "ph-btn-toggle",
        active && "ph-active",
        className,
      )}
      {...props}
    />
  );
}

import type { InputHTMLAttributes } from "react";
import { cn } from "@/components/polyhedge/cn";

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn("ph-input", className)} {...props} />;
}

import type {
  HTMLAttributes,
  TdHTMLAttributes,
  ThHTMLAttributes,
  ReactNode,
} from "react";
import { cn } from "@/components/polyhedge/cn";

export function Table({
  className,
  ...props
}: HTMLAttributes<HTMLTableElement>) {
  return <table className={cn("ph-table", className)} {...props} />;
}

export function THead(props: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead {...props} />;
}

export function TBody(props: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody {...props} />;
}

export function Tr({
  className,
  ...props
}: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn(className)} {...props} />;
}

export function Th({
  className,
  ...props
}: ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={cn(className)} {...props} />;
}

export function Td({
  className,
  ...props
}: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn(className)} {...props} />;
}

export function EmptyRow({
  colSpan,
  children,
}: {
  colSpan: number;
  children: ReactNode;
}) {
  return (
    <tr>
      <td colSpan={colSpan} className="ph-empty">
        {children}
      </td>
    </tr>
  );
}

import type { ReactNode, ThHTMLAttributes } from "react";
import { cn } from "@/components/polyhedge/cn";
import type { SortBindResult } from "@/lib/polyhedge/useTableSort";

interface Props
  extends Omit<ThHTMLAttributes<HTMLTableCellElement>, "onClick">,
    SortBindResult {
  children?: ReactNode;
}

/**
 * Drop-in replacement for <Th> on sortable columns.
 * Spread the result of `bind('columnKey')` from useTableSort onto it:
 *
 *   <SortHeader {...sort.bind('label')}>Label</SortHeader>
 */
export function SortHeader({
  children,
  className,
  "data-sort": dataSort,
  onClick,
  ...rest
}: Props) {
  return (
    <th
      {...rest}
      className={cn("ph-th-sortable", className)}
      data-sort={dataSort}
      onClick={onClick}
    >
      {children}
    </th>
  );
}

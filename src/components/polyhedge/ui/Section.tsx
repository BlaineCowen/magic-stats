"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/components/polyhedge/cn";

interface Props {
  title: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  variant?: "default" | "manual" | "weather" | "rt" | "backtest";
  defaultCollapsed?: boolean;
  collapsible?: boolean;
}

export function Section({
  title,
  right,
  children,
  variant = "default",
  defaultCollapsed = false,
  collapsible = true,
}: Props) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  return (
    <section
      className={cn(
        "ph-section",
        variant === "manual" && "ph-section-manual",
        variant === "weather" && "ph-section-weather",
        variant === "rt" && "ph-section-rt",
        variant === "backtest" && "ph-section-backtest",
      )}
    >
      <header
        className="ph-section-header"
        onClick={() => collapsible && setCollapsed((c) => !c)}
      >
        <span style={{ width: 10 }}>{collapsed ? "▶" : "▼"}</span>
        <span>{title}</span>
        {right && <span className="ph-section-runat">{right}</span>}
      </header>
      {/*
       * Intentionally NO overflow wrapper here. Per CSS spec, an ancestor
       * with `overflow: auto` (any axis) becomes the containing block for
       * sticky descendants — which would bind our sticky <thead> to a
       * non-scrolling box and break sticky-to-viewport. Wide tables that
       * exceed viewport width cause page-level horizontal scroll instead;
       * acceptable trade-off so the thead actually pins under the chrome.
       */}
      {!collapsed && children}
    </section>
  );
}

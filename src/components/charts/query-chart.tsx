"use client";

import {
  Component,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import toast from "react-hot-toast";
import {
  CHART_TYPES,
  chartTitle,
  classifyColumns,
  humanize,
  inferSpecOfType,
  plotRows,
  validateSpec,
  type ChartRow,
  type ChartSpec,
  type ChartType,
  type TeamColors,
} from "@/lib/nfl/chart-spec";
import { cn } from "@/lib/utils";
import { BarPlot } from "./bar-plot";
import { downloadSvgAsPng, type PlotProps } from "./chart-kit";
import { LinePlot } from "./line-plot";
import { ScatterPlot } from "./scatter-plot";

const TYPE_LABEL: Record<ChartType, string> = {
  scatter: "Scatter",
  line: "Line",
  bar: "Bar",
};

const PLOTS: Record<ChartType, ComponentType<PlotProps>> = {
  scatter: ScatterPlot,
  line: LinePlot,
  bar: BarPlot,
};

class ChartBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? (
      <p className="rounded bg-gray-50 p-4 text-sm text-gray-600">
        Couldn&apos;t draw this chart. The table below still has the results.
      </p>
    ) : (
      this.props.children
    );
  }
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "chart";

const button =
  "rounded border border-gray-300 bg-white px-2.5 py-1 text-sm text-gray-700 hover:bg-gray-50";

type QueryChartProps = {
  rows: ChartRow[];
  columns: string[];
  initial: ChartSpec;
  teamColors: TeamColors;
  subtitle: string;
  onHide: () => void;
};

/**
 * A chart of query rows with controls to re-pick its type and columns. Every
 * change redraws from the rows already loaded. Remount (new `key`) to reset.
 */
function QueryChartBody({
  rows,
  columns,
  initial,
  teamColors,
  subtitle,
  onHide,
}: QueryChartProps) {
  const [spec, setSpec] = useState(initial);
  const [showLabels, setShowLabels] = useState(true);
  const svgRef = useRef<SVGSVGElement>(null);
  const cols = useMemo(() => classifyColumns(rows, columns), [rows, columns]);
  const visible = cols.map((c) => c.name);
  const numeric = cols.filter((c) => c.numeric).map((c) => c.name);
  const seriesCols = cols.filter((c) => c.text || c.time).map((c) => c.name);

  // Keep the current columns when switching type if they fit; else infer.
  // Changing any field drops the model's title, which may no longer apply.
  const forType = (t: ChartType) =>
    validateSpec({ ...spec, type: t, title: "" }, rows, columns) ??
    inferSpecOfType(t, "", rows, columns);
  const withField = (field: "x" | "y" | "series", value: string) =>
    validateSpec(
      field === "x"
        ? { ...spec, x: value, title: "" }
        : field === "y"
          ? { ...spec, y: value, title: "" }
          : { ...spec, series: value, title: "" },
      rows,
      columns,
    );

  const title = chartTitle(spec);
  const { rows: plotted, notes } = plotRows(spec, rows);
  const footnote = ["Data: nflverse", ...notes].join(" · ");
  const Plot = PLOTS[spec.type];

  const download = async () => {
    if (!svgRef.current) return;
    try {
      await downloadSvgAsPng(svgRef.current, `${slug(title)}.png`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "PNG export failed");
    }
  };

  const columnSelect = (
    label: string,
    field: "x" | "y" | "series",
    options: string[],
    allowNone = false,
  ) => (
    <label className="flex items-center gap-1.5 text-sm text-gray-600">
      {label}
      <select
        className="rounded border border-gray-300 bg-white px-2 py-1 text-sm"
        value={spec[field]}
        onChange={(e) => {
          const next = withField(field, e.target.value);
          if (next) setSpec(next);
        }}
      >
        {allowNone && (
          <option
            value=""
            disabled={spec[field] !== "" && !withField(field, "")}
          >
            (none)
          </option>
        )}
        {options.map((c) => (
          <option
            key={c}
            value={c}
            disabled={c !== spec[field] && !withField(field, c)}
          >
            {humanize(c)}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="mb-4">
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <div className="flex overflow-hidden rounded border border-gray-300">
          {CHART_TYPES.map((t) => {
            const next = t === spec.type ? spec : forType(t);
            return (
              <button
                key={t}
                type="button"
                disabled={!next}
                onClick={() => next && setSpec(next)}
                className={cn(
                  "px-2.5 py-1 text-sm",
                  t === spec.type
                    ? "bg-blue-600 text-white"
                    : "bg-white text-gray-700 hover:bg-gray-50 disabled:text-gray-300 disabled:hover:bg-white",
                )}
              >
                {TYPE_LABEL[t]}
              </button>
            );
          })}
        </div>
        {spec.type !== "bar" && columnSelect("X", "x", numeric)}
        {columnSelect("Y", "y", numeric)}
        {spec.type === "line" &&
          columnSelect("Series", "series", seriesCols, true)}
        {spec.type !== "bar" && (
          <label className="flex items-center gap-1.5 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={showLabels}
              onChange={(e) => setShowLabels(e.target.checked)}
            />
            Labels
          </label>
        )}
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={() => void download()}
            className={button}
          >
            Download PNG
          </button>
          <button type="button" onClick={onHide} className={button}>
            Hide chart
          </button>
        </div>
      </div>
      <ChartBoundary key={JSON.stringify(spec)}>
        <Plot
          rows={plotted}
          columns={visible}
          spec={spec}
          teamColors={teamColors}
          title={title}
          subtitle={subtitle}
          footnote={footnote}
          showLabels={showLabels}
          svgRef={svgRef}
        />
      </ChartBoundary>
    </div>
  );
}

/**
 * Wraps the whole chart — controls and derivations included, not just the
 * plot — in a boundary, so a throw anywhere in QueryChartBody (e.g. from
 * classifyColumns, chartTitle or plotRows) falls back to the table instead
 * of crashing the Results card.
 */
export function QueryChart(props: QueryChartProps) {
  return (
    <ChartBoundary>
      <QueryChartBody {...props} />
    </ChartBoundary>
  );
}

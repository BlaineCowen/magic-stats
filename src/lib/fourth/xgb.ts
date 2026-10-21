import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

/**
 * Minimal xgboost tree-ensemble evaluator for the compact JSON written by
 * scripts/fourth-down/export.py. Matches xgboost's float32 split comparisons.
 */

type Tree = { f: number[]; t: number[]; l: number[]; r: number[]; d: number[] };

export type XgbModel = {
  features: string[];
  nclass: number;
  base: number[];
  treeClass: number[];
  trees: Tree[];
};

const MODEL_DIR = path.join(process.cwd(), "src/lib/fourth/models");

// keyed by mtime so re-exported models are picked up without a restart; the engine calls this
// hundreds of times per decision, so the file is only re-checked every few seconds
const cache = new Map<
  string,
  { mtime: number; checked: number; value: unknown }
>();
const RECHECK_MS = 5000;

/** Read a model file once (".json", or ".json.gz" for the bootstrap replicates). */
export function loadJson<T>(name: string): T {
  const hit = cache.get(name);
  const now = Date.now();
  if (hit && now - hit.checked < RECHECK_MS) return hit.value as T;
  const file = path.join(MODEL_DIR, name);
  const mtime = fs.statSync(file).mtimeMs;
  if (hit?.mtime === mtime) {
    hit.checked = now;
    return hit.value as T;
  }
  const raw = fs.readFileSync(file);
  const text = name.endsWith(".gz")
    ? zlib.gunzipSync(raw).toString("utf8")
    : raw.toString("utf8");
  const value = JSON.parse(text) as T;
  cache.set(name, { mtime, checked: now, value });
  return value;
}

/** Raw margins (one per class) for a feature row; null/NaN means missing. */
export function margins(model: XgbModel, row: (number | null)[]): number[] {
  const x = row.map((v) =>
    v == null || Number.isNaN(v) ? NaN : Math.fround(v),
  );
  const out = model.base.slice();
  for (let i = 0; i < model.trees.length; i++) {
    const tree = model.trees[i]!;
    let n = 0;
    while (tree.f[n] !== -1) {
      const v = x[tree.f[n]!]!;
      if (Number.isNaN(v)) n = tree.d[n] ? tree.l[n]! : tree.r[n]!;
      else n = v < tree.t[n]! ? tree.l[n]! : tree.r[n]!;
    }
    out[model.treeClass[i]!]! += tree.t[n]!;
  }
  return out;
}

export function predictBinary(model: XgbModel, row: (number | null)[]): number {
  return 1 / (1 + Math.exp(-margins(model, row)[0]!));
}

export function predictSoftmax(
  model: XgbModel,
  row: (number | null)[],
): number[] {
  const m = margins(model, row);
  const max = Math.max(...m);
  const e = m.map((v) => Math.exp(v - max));
  const s = e.reduce((a, b) => a + b, 0);
  return e.map((v) => v / s);
}

/** Build a feature row in the model's column order from a name → value record. */
export function rowFor(
  model: XgbModel,
  values: Record<string, number | null>,
): (number | null)[] {
  return model.features.map((f) => {
    if (!(f in values)) throw new Error(`missing feature ${f}`);
    return values[f]!;
  });
}

/** True if a model file exists (the bootstrap replicates are optional). */
export function hasModel(name: string): boolean {
  return fs.existsSync(path.join(MODEL_DIR, name));
}

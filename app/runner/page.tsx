"use client";
import { useRef, useState } from "react";
import { pickRun, pool, runFresh, type Mode, type PsiRun, type Strategy } from "@/lib/psi";

type Row = {
  url: string;
  strategy: Strategy;
  runs: PsiRun[];
  failed: number;
  picked: PsiRun | null;
};

const COLOR = {
  green: "text-green-400",
  orange: "text-orange-400",
  red: "text-red-400",
} as const;

const color = (r?: string | null) =>
  r === "green" || r === "orange" || r === "red" ? COLOR[r] : "";

export default function RunnerPage() {
  const [urlsText, setUrlsText] = useState("https://glendaleschool.org/in/");
  const [runCount, setRunCount] = useState(3);
  const [mode, setMode] = useState<Mode>("before");
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const seenRef = useRef<Map<number, Set<string>>>(new Map());

  async function start() {
    const urls = urlsText.split("\n").map((s) => s.trim()).filter(Boolean);
    const strategies: Strategy[] = ["mobile", "desktop"];
    const initial: Row[] = urls.flatMap((url) =>
      strategies.map((strategy) => ({ url, strategy, runs: [], failed: 0, picked: null }))
    );
    setRows(initial);
    setBusy(true);
    seenRef.current = new Map();

    // Spread each URL's runs apart: round 1 for every row, then round 2, ...
    const tasks = Array.from({ length: runCount }, () => initial.map((_, idx) => idx)).flat();

    await pool(tasks, 4, async (idx) => {
      const { url, strategy } = initial[idx];
      let run: PsiRun | null = null;
      try {
        const seen = seenRef.current.get(idx) ?? new Set<string>();
        seenRef.current.set(idx, seen);
        run = await runFresh(url, strategy, seen);
      } catch {}
      setRows((prev) =>
        prev.map((r, i) => {
          if (i !== idx) return r;
          const runs = run ? [...r.runs, run] : r.runs;
          return {
            ...r,
            runs,
            failed: run ? r.failed : r.failed + 1,
            picked: pickRun(runs, mode),
          };
        })
      );
    });
    setBusy(false);
  }

  return (
    <main className="w-full px-4 py-8 md:px-[120px]">
      <h1 className="text-xl font-semibold">Runner (Phase 3 test)</h1>

      <textarea
        value={urlsText}
        onChange={(e) => setUrlsText(e.target.value)}
        rows={5}
        placeholder="One URL per line"
        className="mt-4 w-full rounded-lg border bg-transparent px-3 py-2 text-sm"
      />

      <div className="mt-3 flex flex-wrap items-center gap-4">
        <label className="text-sm">
          Runs per test:{" "}
          <select
            value={runCount}
            onChange={(e) => setRunCount(Number(e.target.value))}
            className="rounded border bg-transparent px-2 py-1"
          >
            {[3, 4, 5].map((n) => (
              <option key={n} value={n} className="text-black">
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Mode:{" "}
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as Mode)}
            className="rounded border bg-transparent px-2 py-1"
          >
            <option value="before" className="text-black">
              Before (lowest score)
            </option>
            <option value="after" className="text-black">
              After (highest score)
            </option>
          </select>
        </label>
        <button
          onClick={start}
          disabled={busy}
          className="rounded-lg bg-black px-4 py-2 text-white disabled:opacity-40"
        >
          {busy ? "Running..." : "Start"}
        </button>
      </div>
      {busy && (
        <p className="mt-2 text-sm text-gray-400">Keep this tab open until it finishes.</p>
      )}

      <table className="mt-6 w-full text-left text-sm">
        <thead>
          <tr className="border-b">
            <th className="py-2">URL</th>
            <th>Device</th>
            <th>Progress</th>
            <th>All scores</th>
            <th>Picked</th>
            <th>FCP</th>
            <th>LCP</th>
            <th>CLS</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const p = r.picked;
            return (
              <tr key={i} className="border-b align-top">
                <td className="max-w-[220px] truncate py-2">{r.url}</td>
                <td>{r.strategy}</td>
                <td>
                  {r.runs.length + r.failed}/{runCount}
                  {r.failed > 0 && ` (${r.failed} failed)`}
                </td>
                <td>{r.runs.map((x) => x.score).join(", ")}</td>
                <td className={color(p?.scoreRating)}>{p?.score ?? "-"}</td>
                <td className={color(p?.fcp.rating)}>{p?.fcp.display ?? "-"}</td>
                <td className={color(p?.lcp.rating)}>{p?.lcp.display ?? "-"}</td>
                <td className={color(p?.cls.rating)}>{p?.cls.display ?? "-"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </main>
  );
}
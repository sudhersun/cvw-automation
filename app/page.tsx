"use client";
import { useRef, useState } from "react";
import { pickRun, pool, runFresh, type Mode, type PsiRun, type Strategy } from "@/lib/psi";
import type { SheetRow } from "@/lib/mapping";

type RowState = {
  rowNumber: number;
  url: string;
  device: Strategy;
  runs: PsiRun[];
  failed: number;
  picked: PsiRun | null;
  status: "testing" | "written" | "error";
  error?: string;
};

const COLOR = {
  green: "text-green-400",
  orange: "text-orange-400",
  red: "text-red-400",
} as const;

const color = (r?: string | null) =>
  r === "green" || r === "orange" || r === "red" ? COLOR[r] : "";

const SHEET_RE = /spreadsheets\/d\/[a-zA-Z0-9-_]+/;

export default function Home() {
  const [link, setLink] = useState("");
  const [runCount, setRunCount] = useState(3);
  const [rows, setRows] = useState<RowState[]>([]);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<Mode | null>(null);
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(0);
  const [message, setMessage] = useState("");
  const seenRef = useRef<Map<number, Set<string>>>(new Map());

  const validLink = SHEET_RE.test(link);

  const post = (path: string, body: unknown) =>
    fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

  const patch = (idx: number, p: Partial<RowState>) =>
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...p } : r)));

  async function start(m: Mode) {
    setMessage("");
    setRows([]);
    setDone(0);
    setTotal(0);
    setMode(m);
    setBusy(true);

    try {
      // 1. Read the sheet
      const readRes = await post("/api/sheet/read", { sheetUrl: link });
      const data = await readRes.json();
      if (!readRes.ok) {
        setMessage(data.error ?? "Could not read the sheet.");
        return;
      }
      const sheetRows = data.rows as SheetRow[];
      if (!sheetRows.length) {
        setMessage("No Mobile/Desktop rows found in the sheet.");
        return;
      }

      // 2. Ask before overwriting existing values
      if (
        data.filled?.[m] &&
        !window.confirm(`The ${m.toUpperCase()} columns already have values. Overwrite them?`)
      ) {
        return;
      }

      // 3. Set up the run
      const initial: RowState[] = sheetRows.map((r) => ({
        rowNumber: r.rowNumber,
        url: r.url,
        device: r.device,
        runs: [],
        failed: 0,
        picked: null,
        status: "testing",
      }));
      setRows(initial);
      seenRef.current = new Map();

      const finished: number[] = initial.map(() => 0);
      const collected: PsiRun[][] = initial.map(() => []);
      let written = 0;
      let problems = 0;

      // Round 1 for every row, then round 2, ... (spreads each URL's runs apart)
      const tasks = Array.from({ length: runCount }, () => initial.map((_, i) => i)).flat();
      setTotal(tasks.length);

      await pool(tasks, 4, async (idx) => {
        const row = initial[idx];
        let run: PsiRun | null = null;
        try {
          const seen = seenRef.current.get(idx) ?? new Set<string>();
          seenRef.current.set(idx, seen);
          run = await runFresh(row.url, row.device, seen);
        } catch {}

        if (run) collected[idx].push(run);
        finished[idx]++;
        setDone((d) => d + 1);

        const picked = pickRun(collected[idx], m);
        patch(idx, {
          runs: [...collected[idx]],
          failed: finished[idx] - collected[idx].length,
          picked,
        });

        if (finished[idx] < runCount) return;

        // All runs for this row are finished: write the picked run to the sheet
        if (!picked) {
          problems++;
          patch(idx, { status: "error", error: "All runs failed" });
          return;
        }
        try {
          const w = await post("/api/sheet/write", {
            sheetUrl: link,
            mode: m,
            results: [{ rowNumber: row.rowNumber, run: picked }],
          });
          if (w.ok) {
            written++;
            patch(idx, { status: "written" });
          } else {
            problems++;
            patch(idx, { status: "error", error: (await w.json()).error ?? "Write failed" });
          }
        } catch {
          problems++;
          patch(idx, { status: "error", error: "Write failed" });
        }
      });

      setMessage(
        `Finished. ${written} of ${initial.length} rows written to the sheet` +
          (problems ? `, ${problems} need attention.` : ".")
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="w-full px-4 py-8 md:px-[120px]">
      <h1 className="text-2xl font-semibold">CWV Automation</h1>
      <p className="mt-1 text-sm text-gray-400">
        Paste the client's Google Sheet link, then run Before or After.
      </p>

      <input
        value={link}
        onChange={(e) => setLink(e.target.value)}
        placeholder="https://docs.google.com/spreadsheets/d/..."
        disabled={busy}
        className="mt-6 w-full rounded-lg border bg-transparent px-3 py-2"
      />
      {link && !validLink && (
        <p className="mt-1 text-sm text-red-400">That doesn't look like a Google Sheet link.</p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <label className="text-sm">
          Runs per test:{" "}
          <select
            value={runCount}
            onChange={(e) => setRunCount(Number(e.target.value))}
            disabled={busy}
            className="rounded border bg-transparent px-2 py-1"
          >
            {[3, 4, 5].map((n) => (
              <option key={n} value={n} className="text-black">
                {n}
              </option>
            ))}
          </select>
        </label>
        <button
          onClick={() => start("before")}
          disabled={!validLink || busy}
          className="rounded-lg bg-orange-600 px-5 py-2 text-white disabled:opacity-40"
        >
          Run Before
        </button>
        <button
          onClick={() => start("after")}
          disabled={!validLink || busy}
          className="rounded-lg bg-green-600 px-5 py-2 text-white disabled:opacity-40"
        >
          Run After
        </button>
        {validLink && (
          <a href={link} target="_blank" rel="noreferrer" className="text-sm underline">
            Open sheet
          </a>
        )}
      </div>

      {busy && (
        <div className="mt-4 text-sm text-gray-400">
          <p>
            Running <b>{mode}</b> tests: {done} / {total || "..."} done. Keep this tab open until
            it finishes.
          </p>
          {total > 0 && (
            <div className="mt-2 h-2 w-full overflow-hidden rounded bg-gray-700">
              <div
                className="h-full bg-green-500 transition-all"
                style={{ width: `${(done / total) * 100}%` }}
              />
            </div>
          )}
        </div>
      )}
      {message && <p className="mt-4 text-sm">{message}</p>}

      {rows.length > 0 && (
        <table className="mt-6 w-full text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="py-2">Row</th>
              <th>URL</th>
              <th>Device</th>
              <th>Progress</th>
              <th>All scores</th>
              <th>Picked</th>
              <th>FCP</th>
              <th>LCP</th>
              <th>CLS</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const p = r.picked;
              return (
                <tr key={i} className="border-b align-top">
                  <td className="py-2">{r.rowNumber}</td>
                  <td className="max-w-[260px] truncate">{r.url}</td>
                  <td>{r.device}</td>
                  <td>
                    {r.runs.length + r.failed}/{runCount}
                    {r.failed > 0 && ` (${r.failed} failed)`}
                  </td>
                  <td>{r.runs.map((x) => x.score).join(", ")}</td>
                  <td className={color(p?.scoreRating)}>{p?.score ?? "-"}</td>
                  <td className={color(p?.fcp.rating)}>{p?.fcp.display ?? "-"}</td>
                  <td className={color(p?.lcp.rating)}>{p?.lcp.display ?? "-"}</td>
                  <td className={color(p?.cls.rating)}>{p?.cls.display ?? "-"}</td>
                  <td>
                    {r.status === "written" && <span className="text-green-400">Written</span>}
                    {r.status === "error" && (
                      <span className="text-red-400">{r.error ?? "Error"}</span>
                    )}
                    {r.status === "testing" && <span className="text-gray-400">Testing...</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </main>
  );
}
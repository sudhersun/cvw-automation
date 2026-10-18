"use client";
import { useState } from "react";
import type { PsiRun } from "@/lib/psi";
import type { SheetRow } from "@/lib/mapping";

// Fake results that cycle green -> orange -> red
function fakeRun(row: SheetRow, i: number): PsiRun {
  const tier = (["green", "orange", "red"] as const)[i % 3];
  const score = { green: 96, orange: 68, red: 32 }[tier];
  const m = (display: string) => ({ value: 0, display, rating: tier });
  return {
    url: row.url,
    strategy: row.device,
    score,
    scoreRating: tier,
    fcp: m("1.5 s"),
    lcp: m("3.2 s"),
    cls: m("0.02"),
    si: m("4.2 s"),
    tbt: m("50 ms"),
    tti: m("4.5 s"),
    reportLink: `https://pagespeed.web.dev/analysis?url=${encodeURIComponent(row.url)}&form_factor=${row.device}`,
    testedAt: null,
  };
}

export default function WriteTest() {
  const [link, setLink] = useState("");
  const [mode, setMode] = useState<"before" | "after">("before");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function go() {
    setBusy(true);
    setMsg("");
    const post = (path: string, body: unknown) =>
      fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

    const read = await post("/api/sheet/read", { sheetUrl: link });
    const data = await read.json();
    if (!read.ok) {
      setMsg(data.error);
      setBusy(false);
      return;
    }

    const results = (data.rows as SheetRow[]).map((row, i) => ({
      rowNumber: row.rowNumber,
      run: fakeRun(row, i),
    }));
    const write = await post("/api/sheet/write", { sheetUrl: link, mode, results });
    const out = await write.json();
    setMsg(write.ok ? `Done. ${out.written} cells written.` : out.error);
    setBusy(false);
  }

  return (
    <main className="w-full px-4 py-8 md:px-[120px]">
      <h1 className="text-xl font-semibold">Write test (Phase 5)</h1>
      <p className="mt-1 text-sm text-gray-400">Writes FAKE sample data. Use your test sheet only.</p>
      <input
        value={link}
        onChange={(e) => setLink(e.target.value)}
        placeholder="https://docs.google.com/spreadsheets/d/..."
        className="mt-4 w-full rounded-lg border bg-transparent px-3 py-2 text-sm"
      />
      <div className="mt-3 flex items-center gap-4">
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as "before" | "after")}
          className="rounded border bg-transparent px-2 py-1 text-sm"
        >
          <option value="before" className="text-black">Before columns</option>
          <option value="after" className="text-black">After columns</option>
        </select>
        <button
          onClick={go}
          disabled={busy || !link}
          className="rounded-lg bg-black px-4 py-2 text-white disabled:opacity-40"
        >
          {busy ? "Writing..." : "Write sample data"}
        </button>
      </div>
      {msg && <p className="mt-4 text-sm">{msg}</p>}
    </main>
  );
}
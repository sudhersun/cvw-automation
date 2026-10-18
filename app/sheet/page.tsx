"use client";
import { useState } from "react";
import { colLetter, type Mapping, type SheetRow } from "@/lib/mapping";

type ReadResult = {
  spreadsheetTitle: string;
  tabTitle: string;
  headers: string[];
  mapping: Mapping;
  rows: SheetRow[];
};

function roleOf(m: Mapping, i: number): string {
  if (m.urlCol === i) return "Page URL";
  if (m.deviceCol === i) return "Device";
  for (const ph of ["before", "after"] as const) {
    for (const [key, col] of Object.entries(m.metrics[ph])) {
      if (col === i) return `${ph} · ${key.toUpperCase()}${key === "inp" ? " (skipped)" : ""}`;
    }
    if (m.link[ph] === i) return `${ph} · report link`;
    if (m.screenshot[ph] === i) return `${ph} · screenshot (manual)`;
  }
  return "not used";
}

export default function SheetPage() {
  const [link, setLink] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<ReadResult | null>(null);

  async function read() {
    setLoading(true);
    setError("");
    setData(null);
    const res = await fetch("/api/sheet/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sheetUrl: link }),
    });
    const json = await res.json();
    if (!res.ok) setError(json.error ?? "Something went wrong");
    else setData(json);
    setLoading(false);
  }

  const warnings: string[] = [];
  if (data) {
    const m = data.mapping;
    if (m.urlCol === null) warnings.push("No 'Page URL' column found.");
    if (m.deviceCol === null) warnings.push("No 'Device' column found.");
    if (!Object.keys(m.metrics.before).length) warnings.push("No Before metric columns found.");
    if (!Object.keys(m.metrics.after).length) warnings.push("No 'After ...' metric columns found.");
    if (!data.rows.length) warnings.push("No Mobile/Desktop rows found.");
  }

  return (
    <main className="w-full px-4 py-8 md:px-[120px]">
      <h1 className="text-xl font-semibold">Sheet reader (Phase 4 test)</h1>

      <input
        value={link}
        onChange={(e) => setLink(e.target.value)}
        placeholder="https://docs.google.com/spreadsheets/d/..."
        className="mt-4 w-full rounded-lg border bg-transparent px-3 py-2 text-sm"
      />
      <button
        onClick={read}
        disabled={loading || !link}
        className="mt-3 rounded-lg bg-black px-4 py-2 text-white disabled:opacity-40"
      >
        {loading ? "Reading..." : "Read sheet"}
      </button>

      {error && <p className="mt-4 text-red-400">{error}</p>}

      {data && (
        <div className="mt-6 space-y-6 text-sm">
          <p>
            <b>{data.spreadsheetTitle}</b> · tab <b>{data.tabTitle}</b> · found{" "}
            <b>{data.rows.length}</b> test rows (
            {new Set(data.rows.map((r) => r.url)).size} URLs)
          </p>

          {warnings.length > 0 && (
            <ul className="rounded-lg border border-orange-500 p-3 text-orange-400">
              {warnings.map((w) => <li key={w}>• {w}</li>)}
            </ul>
          )}

          <div>
            <h2 className="mb-2 font-semibold">Column mapping</h2>
            <table className="w-full text-left">
              <thead>
                <tr className="border-b"><th className="py-1">Col</th><th>Header</th><th>Used as</th></tr>
              </thead>
              <tbody>
                {data.headers.map((h, i) => h && (
                  <tr key={i} className="border-b">
                    <td className="py-1">{colLetter(i)}</td>
                    <td>{h}</td>
                    <td>{roleOf(data.mapping, i)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <h2 className="mb-2 font-semibold">Rows to test</h2>
            <table className="w-full text-left">
              <thead>
                <tr className="border-b"><th className="py-1">Row</th><th>Device</th><th>URL</th></tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.rowNumber} className="border-b">
                    <td className="py-1">{r.rowNumber}</td>
                    <td>{r.device}</td>
                    <td>{r.url}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  );
}
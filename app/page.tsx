"use client";
import { useState } from "react";

const SHEET_RE = /spreadsheets\/d\/([a-zA-Z0-9-_]+)/;

export default function Home() {
  const [link, setLink] = useState("");
  const sheetId = link.match(SHEET_RE)?.[1];

  return (
    <main className="mx-auto max-w-4xl p-8">
      <h1 className="text-2xl font-semibold">CWV Automation</h1>
      <p className="mt-1 text-sm text-gray-500">
        Paste the client's Google Sheet link, then run Before or After.
      </p>

      <input
        value={link}
        onChange={(e) => setLink(e.target.value)}
        placeholder="https://docs.google.com/spreadsheets/d/..."
        className="mt-6 w-full rounded-lg border px-3 py-2"
      />
      {link && !sheetId && (
        <p className="mt-1 text-sm text-red-600">That doesn't look like a Google Sheet link.</p>
      )}

      <div className="mt-4 flex gap-3">
        <button disabled={!sheetId}
          className="rounded-lg bg-orange-600 px-5 py-2 text-white disabled:opacity-40">
          Run Before
        </button>
        <button disabled={!sheetId}
          className="rounded-lg bg-green-600 px-5 py-2 text-white disabled:opacity-40">
          Run After
        </button>
      </div>

      <table className="mt-8 w-full text-left text-sm">
        <thead>
          <tr className="border-b">
            <th className="py-2">URL</th><th>Device</th><th>Status</th>
          </tr>
        </thead>
        <tbody>
          <tr><td colSpan={3} className="py-6 text-gray-400">
            Results will appear here once the tests run.
          </td></tr>
        </tbody>
      </table>
    </main>
  );
}
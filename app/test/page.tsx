"use client";
import { useState } from "react";

export default function TestPage() {
  const [url, setUrl] = useState("https://glendaleschool.org/in/");
  const [loading, setLoading] = useState(false);
  const [out, setOut] = useState("");

  async function run(strategy: "mobile" | "desktop") {
    setLoading(true);
    setOut("");
    const t = Date.now();
    const res = await fetch("/api/psi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, strategy }),
    });
    const json = await res.json();
    setOut(`${((Date.now() - t) / 1000).toFixed(0)}s\n` + JSON.stringify(json, null, 2));
    setLoading(false);
  }

  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-xl font-semibold">PSI test</h1>
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        className="mt-4 w-full rounded-lg border px-3 py-2"
      />
      <div className="mt-3 flex gap-3">
        <button onClick={() => run("mobile")} disabled={loading}
          className="rounded-lg bg-black px-4 py-2 text-white disabled:opacity-40">Mobile</button>
        <button onClick={() => run("desktop")} disabled={loading}
          className="rounded-lg bg-black px-4 py-2 text-white disabled:opacity-40">Desktop</button>
      </div>
      {loading && <p className="mt-4 text-gray-500">Running... 20-40 seconds</p>}
      <pre className="mt-4 overflow-auto rounded-lg bg-[#333] p-4 text-xs">{out}</pre>
    </main>
  );
}
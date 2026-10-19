import type { Metadata } from "next";
import { readReport } from "@/lib/report";
import ReportView from "./ReportView";

export const metadata: Metadata = {
  title: "Core Web Vitals report",
  robots: { index: false, follow: false },
};

export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string; s?: string; t?: string }>;
}) {
  const { d, s, t } = await searchParams;
  const r = readReport(d, s);

  if (!r || (!r.mobile && !r.desktop)) {
    return (
      <main className="min-h-screen w-full bg-gray-50 px-4 py-8 text-gray-900 md:px-[120px]">
        <div className="mx-auto max-w-xl rounded-xl border border-gray-200 bg-white p-6">
          <h1 className="text-lg font-semibold">Report not available</h1>
          <p className="mt-2 text-sm text-gray-600">
            This report link is invalid or has been changed.
          </p>
        </div>
      </main>
    );
  }

  const initial =
    t === "desktop" && r.desktop ? "desktop" : t === "mobile" && r.mobile ? "mobile" : r.mobile ? "mobile" : "desktop";

  return (
    <main className="min-h-screen w-full bg-gray-50 px-4 py-8 text-gray-900 md:px-[120px]">
      <ReportView data={r} initial={initial} />
    </main>
  );
}
import { NextRequest, NextResponse } from "next/server";

// Let this function run up to 60s (a PSI test takes 15-40s)
export const maxDuration = 60;

const AUDITS = {
  fcp: "first-contentful-paint",
  lcp: "largest-contentful-paint",
  cls: "cumulative-layout-shift",
  si: "speed-index",
  tbt: "total-blocking-time",
  tti: "interactive",
} as const;

// Same bands PSI uses: 0.9+ green, 0.5-0.89 orange, below 0.5 red
function rating(score: number | null | undefined) {
  if (score == null) return null;
  return score >= 0.9 ? "green" : score >= 0.5 ? "orange" : "red";
}

export async function POST(req: NextRequest) {
  const { url, strategy } = await req.json();

  if (!url || !["mobile", "desktop"].includes(strategy)) {
    return NextResponse.json(
      { error: "Send { url, strategy: 'mobile' | 'desktop' }" },
      { status: 400 }
    );
  }

  const api = new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
  api.searchParams.set("url", url);
  api.searchParams.set("strategy", strategy);
  api.searchParams.set("category", "performance");
  api.searchParams.set("key", process.env.PAGESPEED_API_KEY!);

  try {
    const res = await fetch(api, {
      cache: "no-store",
      signal: AbortSignal.timeout(55000),
    });
    const data = await res.json();

    if (!res.ok) {
      const raw: string = data?.error?.message ?? "";
      const friendly =
        res.status === 429
          ? "PageSpeed rate limit reached. Wait a minute and retry."
          : /FAILED_DOCUMENT_REQUEST|ERRORED_DOCUMENT_REQUEST|DNS_FAILURE/.test(raw)
            ? "PageSpeed could not load this page (down, blocked, or not public)."
            : raw || "PageSpeed request failed";
      return NextResponse.json({ error: friendly }, { status: res.status });
    }

    const lh = data.lighthouseResult;
    const perf = lh?.categories?.performance?.score; // 0 to 1

    const metric = (id: string) => {
      const a = lh?.audits?.[id];
      return {
        value: a?.numericValue ?? null, // ms (CLS has no unit)
        display: a?.displayValue ?? null, // e.g. "1.2 s"
        rating: rating(a?.score),
      };
    };

    return NextResponse.json({
      url,
      strategy,
      score: perf == null ? null : Math.round(perf * 100),
      scoreRating: rating(perf),
      fcp: metric(AUDITS.fcp),
      lcp: metric(AUDITS.lcp),
      cls: metric(AUDITS.cls),
      si: metric(AUDITS.si),
      tbt: metric(AUDITS.tbt),
      tti: metric(AUDITS.tti),
      reportLink: `https://pagespeed.web.dev/analysis?url=${encodeURIComponent(
        url
      )}&form_factor=${strategy}`,
      testedAt: data.analysisUTCTimestamp ?? null,
    });
  } catch (e) {
    return NextResponse.json(
      { error: "Test timed out or failed. Try again." },
      { status: 504 }
    );
  }
}
import { NextRequest, NextResponse } from "next/server";
import type { sheets_v4 } from "googleapis";
import { getSheets, parseSheetUrl } from "@/lib/sheets";
import { mapHeaders, type Phase } from "@/lib/mapping";
import type { PsiRun } from "@/lib/psi";

// "fill" colours the cell background, "text" colours the number itself
// Font colours, the same ones PSI uses for its numbers
const TEXT = { green: "#018642", orange: "#E67700", red: "#C7221F" };

const WRITE_KEYS = ["score", "fcp", "lcp", "cls", "si", "tbt", "tti"] as const;

type Rating = PsiRun["scoreRating"];

function rgb(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return { red: ((n >> 16) & 255) / 255, green: ((n >> 8) & 255) / 255, blue: (n & 255) / 255 };
}

function range(sheetId: number, row: number, col: number) {
  return {
    sheetId,
    startRowIndex: row,
    endRowIndex: row + 1,
    startColumnIndex: col,
    endColumnIndex: col + 1,
  };
}

function valueCell(
  sheetId: number,
  row: number,
  col: number,
  value: sheets_v4.Schema$ExtendedValue,
  rating: Rating
): sheets_v4.Schema$Request {
  return {
    updateCells: {
      range: range(sheetId, row, col),
      rows: [
        {
          values: [
            {
              userEnteredValue: value,
              userEnteredFormat: {
                textFormat: {
                  foregroundColor: rgb(rating ? TEXT[rating] : "#000000"),
                },
              },
            },
          ],
        },
      ],
      // Only the font colour is touched, so your own font, size and fill stay as they are
      fields: "userEnteredValue,userEnteredFormat.textFormat.foregroundColor",
    },
  };
}

function linkCell(sheetId: number, row: number, col: number, url: string): sheets_v4.Schema$Request {
  return {
    updateCells: {
      range: range(sheetId, row, col),
      rows: [
        {
          values: [
            {
              userEnteredValue: { stringValue: url },
              userEnteredFormat: {
                textFormat: { link: { uri: url }, underline: true, foregroundColor: rgb("#1155CC") },
              },
            },
          ],
        },
      ],
      fields: "userEnteredValue,userEnteredFormat.textFormat",
    },
  };
}

export async function POST(req: NextRequest) {
  const { sheetUrl, mode, results } = (await req.json()) as {
    sheetUrl: string;
    mode: Phase;
    results: { rowNumber: number; run: PsiRun }[];
  };
  const { id, gid } = parseSheetUrl(sheetUrl ?? "");
  if (!id || (mode !== "before" && mode !== "after") || !Array.isArray(results)) {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  try {
    const sheets = getSheets();
    const meta = await sheets.spreadsheets.get({
      spreadsheetId: id,
      fields: "sheets.properties(sheetId,title)",
    });
    const tabs = meta.data.sheets ?? [];
    const tab =
      (gid !== null ? tabs.find((t) => t.properties?.sheetId === gid) : undefined) ?? tabs[0];
    const tabTitle = tab?.properties?.title ?? "Sheet1";
    const tabId = tab?.properties?.sheetId ?? 0;

    const head = await sheets.spreadsheets.values.get({
      spreadsheetId: id,
      range: `'${tabTitle.replace(/'/g, "''")}'!1:1`,
    });
    const mapping = mapHeaders((head.data.values?.[0] ?? []).map(String));
    const cols = mapping.metrics[mode];
    const linkCol = mapping.link[mode];

    const requests: sheets_v4.Schema$Request[] = [];
    for (const { rowNumber, run } of results) {
      const r = rowNumber - 1;
      for (const key of WRITE_KEYS) {
        const col = cols[key];
        if (col === undefined) continue;

        let value: string | number | null;
        let rating: Rating;
        if (key === "score") {
          value = run.score;
          rating = run.scoreRating;
        } else {
          value = run[key].display;
          rating = run[key].rating;
        }
        if (value === null || value === undefined) continue;

        requests.push(
          valueCell(
            tabId,
            r,
            col,
            typeof value === "number" ? { numberValue: value } : { stringValue: value },
            rating
          )
        );
      }
      if (linkCol !== null && run.reportLink) {
        requests.push(linkCell(tabId, r, linkCol, run.reportLink));
      }
    }

    if (!requests.length) {
      return NextResponse.json({ error: "Nothing to write." }, { status: 400 });
    }

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: id,
      requestBody: { requests },
    });
    return NextResponse.json({ written: requests.length });
  } catch (e) {
    const code = (e as { code?: number }).code;
    if (code === 403 || code === 404) {
      return NextResponse.json(
        {
          error: `Can't edit this sheet. Share it with ${process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL} as Editor.`,
        },
        { status: 403 }
      );
    }
    return NextResponse.json({ error: "Could not write to the sheet." }, { status: 500 });
  }
}
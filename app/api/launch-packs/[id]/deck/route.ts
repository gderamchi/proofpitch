import { readFile } from "node:fs/promises";

import { NextResponse } from "next/server";

import { renderedPitchDeckPdfPath } from "@/lib/release-paths";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params;

  if (!/^[a-zA-Z0-9-]+$/.test(id)) {
    return NextResponse.json({ error: "Invalid launch pack id." }, { status: 400 });
  }

  try {
    const pdf = await readFile(renderedPitchDeckPdfPath(id));
    const disposition = new URL(request.url).searchParams.get("download") === "1" ? "attachment" : "inline";

    return new Response(new Uint8Array(pdf), {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": `${disposition}; filename="pitch-deck.pdf"`,
        "Content-Length": String(pdf.byteLength),
        "Content-Type": "application/pdf",
      },
    });
  } catch {
    return NextResponse.json({ error: "Pitch deck PDF is not rendered yet." }, { status: 404 });
  }
}

import { NextResponse } from "next/server";
import { ZodError, z } from "zod";

import { createProject, listProjects } from "@/lib/pitch-pack-service";
import { CreateProjectRequestSchema } from "@/lib/schemas";

export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json(await listProjects());
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error.";

    return NextResponse.json({ error: "Unable to list projects.", detail }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = CreateProjectRequestSchema.parse(body);

    return NextResponse.json(await createProject(input), { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Invalid request body.", details: z.treeifyError(error) }, { status: 400 });
    }

    const detail = error instanceof Error ? error.message : "Unknown error.";

    return NextResponse.json({ error: "Unable to create project.", detail }, { status: 500 });
  }
}

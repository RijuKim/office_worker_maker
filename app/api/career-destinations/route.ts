import { NextResponse } from "next/server";

import { prisma } from "@/lib/server/prisma";

export async function GET() {
  const destinations = await prisma.careerDestination.findMany({
    orderBy: { displayName: "asc" },
  });

  return NextResponse.json({ destinations });
}
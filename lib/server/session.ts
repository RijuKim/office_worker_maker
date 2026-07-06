import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/server/auth-options";

export async function getCurrentUserId() {
  const session = await getServerSession(authOptions);

  return session?.user?.id ?? null;
}

export async function requireCurrentUserId() {
  const userId = await getCurrentUserId();

  if (!userId) {
    return null;
  }

  return userId;
}

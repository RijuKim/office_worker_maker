import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const start = performance.now();

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  response.headers.set("x-request-id", requestId);

  const method = request.method;
  const path = request.nextUrl.pathname;
  const duration = (performance.now() - start).toFixed(1);

  if (process.env.NODE_ENV === "production") {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "info",
      message: `${method} ${path}`,
      requestId,
      method,
      path,
      durationMs: Number(duration),
    }));
  } else {
    console.log(`[${new Date().toISOString()} INFO ${requestId}] ${method} ${path} (${duration}ms)`);
  }

  return response;
}

export const config = {
  matcher: "/api/:path*",
};

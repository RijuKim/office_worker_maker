import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const start = performance.now();

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);

  const response = request.method === "OPTIONS"
    ? new NextResponse(null, { status: 204 })
    : NextResponse.next({ request: { headers: requestHeaders } });

  response.headers.set("x-request-id", requestId);
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Request-Id");
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");

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

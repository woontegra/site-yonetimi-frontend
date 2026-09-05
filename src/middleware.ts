import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE } from "@/lib/auth-cookie";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get(AUTH_COOKIE)?.value);

  if (pathname.startsWith("/aktivasyon")) {
    const response = NextResponse.next();
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  }

  if (pathname.startsWith("/app") && !hasSession) {
    const login = request.nextUrl.clone();
    login.pathname = "/giris";
    login.search = "";
    const from = pathname; // query taşıma — token sızmasın
    if (from.startsWith("/app")) {
      login.searchParams.set("next", from);
    }
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*", "/aktivasyon", "/aktivasyon/:path*"],
};

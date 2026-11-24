import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { defaultLocale, locales } from "@/i18n/config";

// Every page lives under /[lang]. Short links such as /p/P-0042 (printed on
// QR plaques) have no prefix, so we redirect them to the default locale.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasLocale = locales.some(
    (l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`),
  );
  if (hasLocale) return;

  const url = request.nextUrl.clone();
  url.pathname = `/${defaultLocale}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Skip API routes, Next internals, generated icons and anything with a
  // file extension.
  matcher: ["/((?!api|_next|icon|apple-icon|.*\\..*).*)"],
};

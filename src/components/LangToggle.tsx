"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Same page, other language. */
export default function LangToggle({ lang, label }: { lang: string; label: string }) {
  const pathname = usePathname();
  const other = lang === "ar" ? "en" : "ar";
  const href = pathname.replace(/^\/(ar|en)(?=\/|$)/, `/${other}`);
  return (
    <Link
      href={href}
      lang={other}
      hrefLang={other}
      className="rounded-full border border-line px-4 py-2 text-sm font-medium"
    >
      {label}
    </Link>
  );
}

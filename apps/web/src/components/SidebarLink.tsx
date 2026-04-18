"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function SidebarLink({ href, children }: { href: string; children: ReactNode }) {
  const pathname = usePathname();
  const active = pathname === href || pathname?.startsWith(href + "/");
  return (
    <Link
      href={href}
      className={
        "block rounded-md px-3 py-1.5 text-sm transition-colors " +
        (active
          ? "bg-brand-50 text-brand font-semibold"
          : "text-slate-700 hover:bg-slate-100")
      }
    >
      {children}
    </Link>
  );
}

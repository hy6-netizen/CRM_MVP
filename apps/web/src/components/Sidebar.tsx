"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV: { href: string; label: string; group?: string }[] = [
  { href: "/dashboard", label: "오늘 보드", group: "운영" },
  { href: "/reservations", label: "예약 보드", group: "운영" },
  { href: "/conversations", label: "상담 인박스", group: "운영" },
  { href: "/reviews", label: "리뷰 인박스", group: "운영" },
  { href: "/templates", label: "템플릿 관리", group: "설정" },
  { href: "/settings/compliance", label: "컴플라이언스 규칙", group: "설정" },
  { href: "/settings/integrations", label: "연동 설정", group: "설정" },
  { href: "/logs", label: "감사 로그", group: "설정" },
];

export function Sidebar() {
  const pathname = usePathname();
  const groups = Array.from(new Set(NAV.map((n) => n.group ?? "")));

  return (
    <aside className="w-60 bg-white border-r border-slate-200 px-3 py-4 hidden md:flex md:flex-col">
      <Link href="/" className="px-3 mb-4">
        <div className="text-base font-bold text-brand">Hospital Ops Hub</div>
      </Link>
      <nav className="flex-1 space-y-4">
        {groups.map((g) => (
          <div key={g}>
            <div className="text-[10px] font-semibold text-slate-400 uppercase px-3 mb-1">{g}</div>
            <ul className="space-y-0.5">
              {NAV.filter((n) => n.group === g).map((n) => {
                const active = pathname === n.href || pathname?.startsWith(n.href + "/");
                return (
                  <li key={n.href}>
                    <Link
                      href={n.href}
                      className={
                        "block rounded-md px-3 py-1.5 text-sm transition-colors " +
                        (active
                          ? "bg-brand-50 text-brand font-semibold"
                          : "text-slate-700 hover:bg-slate-100")
                      }
                    >
                      {n.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="px-3 pt-4 mt-auto text-[11px] text-slate-400 border-t border-slate-100">
        © 의성한방병원 · 데모
      </div>
    </aside>
  );
}

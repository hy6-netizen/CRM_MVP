import "./globals.css";
import type { ReactNode } from "react";
import { Sidebar } from "../src/components/Sidebar";

export const metadata = {
  title: "Hospital Ops Hub",
  description: "병원 예약·상담·리뷰 통합 운영 허브 (MVP)",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen">
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="flex-1 flex flex-col">
            <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-brand text-white flex items-center justify-center text-sm font-bold">
                  H
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-900">Hospital Ops Hub</div>
                  <div className="text-xs text-slate-500">의성한방병원 운영 콘솔</div>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="badge-neutral">MVP · v0.1</span>
                <span>관리자 데모 모드</span>
              </div>
            </header>
            <main className="flex-1 p-6">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}

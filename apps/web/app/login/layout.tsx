// /login 에는 Sidebar/헤더 없이 children 만 렌더.
import type { ReactNode } from "react";
export default function LoginLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

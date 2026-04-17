import "./globals.css";
import type { ReactNode } from "react";

export default function RootLayout({ children }: { children: ReactNode }) {
return (
<html lang="ko">
<body>
<header style={{ padding: 16, borderBottom: "1px solid #ddd", background: "white" }}>
<strong>Hospital Ops Hub</strong>
</header>
{children}
</body>
</html>
);
}

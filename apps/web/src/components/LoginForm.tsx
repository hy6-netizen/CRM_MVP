"use client";

import { signIn } from "next-auth/react";
import { useState, useTransition } from "react";

export function LoginForm({ callbackUrl, initialError }: { callbackUrl?: string; initialError?: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(initialError ? "로그인 실패" : null);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: true,
        redirectTo: callbackUrl || "/dashboard",
      });
      if (res?.error) setError("이메일 또는 비밀번호가 올바르지 않습니다.");
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label className="label">이메일</label>
        <input
          type="email"
          required
          autoComplete="email"
          className="input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="admin@uskmh.kr"
        />
      </div>
      <div>
        <label className="label">비밀번호</label>
        <input
          type="password"
          required
          autoComplete="current-password"
          className="input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      {error && <div className="text-xs text-red-600">{error}</div>}
      <button type="submit" className="btn-primary w-full" disabled={pending}>
        {pending ? "로그인 중..." : "로그인"}
      </button>
      <p className="text-[11px] text-slate-400 text-center leading-relaxed">
        seed 기본 계정: admin@uskmh.kr / admin1234 (운영 배포 전 반드시 변경)
      </p>
    </form>
  );
}

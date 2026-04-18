import { LoginForm } from "../../src/components/LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage(props: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const params = await props.searchParams;
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm card">
        <div className="mb-6 text-center">
          <div className="w-12 h-12 rounded-xl bg-brand text-white flex items-center justify-center text-lg font-bold mx-auto mb-2">
            H
          </div>
          <h1 className="text-lg font-bold text-slate-900">Hospital Ops Hub</h1>
          <p className="text-xs text-slate-500 mt-1">의성한방병원 운영 콘솔</p>
        </div>
        <LoginForm callbackUrl={params.callbackUrl} initialError={params.error} />
      </div>
    </div>
  );
}

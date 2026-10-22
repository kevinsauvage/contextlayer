import { AuthForm } from "@/components/auth-form";

export default function Page() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-6 px-4">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <AuthForm mode="sign-in" />
    </main>
  );
}

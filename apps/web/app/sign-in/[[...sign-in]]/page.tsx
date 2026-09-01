import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <main className="irbis-auth-page">
      <SignIn />
    </main>
  );
}

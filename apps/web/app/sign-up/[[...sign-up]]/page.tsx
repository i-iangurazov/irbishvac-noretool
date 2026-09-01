import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <main className="irbis-auth-page">
      <SignUp />
    </main>
  );
}

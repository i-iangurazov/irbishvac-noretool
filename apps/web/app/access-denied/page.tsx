import { UserButton } from "@clerk/nextjs";

export default function AccessDeniedPage() {
  return (
    <main className="irbis-auth-page">
      <section
        className="irbis-access-denied"
        aria-labelledby="access-denied-title"
      >
        <h1 id="access-denied-title">IRBIS account required</h1>
        <p>
          This dashboard is available only to verified @irbishvac.com accounts.
          Sign out and continue with your IRBIS work email.
        </p>
        <UserButton showName />
      </section>
    </main>
  );
}

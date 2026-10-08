import Link from "next/link";
export default function NotFound() {
  return (
    <main className="empty-state">
      <h1>Nothing on the radar here.</h1>
      <p>This page does not exist or is unavailable.</p>
      <Link href="/" className="button button-primary">
        Back to PainRadar
      </Link>
    </main>
  );
}

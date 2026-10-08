import Link from "next/link";
import { Brand } from "./brand";
import { Button } from "./ui/button";
export function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="public-header">
        <Brand />
        <nav>
          <Link href="/#how-it-works">How it works</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/app/trending">Explore</Link>
        </nav>
        <div className="header-actions">
          <Link href="/login">Log in</Link>
          <Button asChild size="sm">
            <Link href="/signup">Start free ↗</Link>
          </Button>
        </div>
      </header>
      {children}
      <footer>
        <Brand />
        <p>Evidence first. AI second.</p>
        <div>
          <Link href="/pricing">Pricing</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </div>
        <span>© {new Date().getFullYear()} PainRadar</span>
      </footer>
    </>
  );
}

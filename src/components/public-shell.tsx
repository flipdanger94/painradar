import { Text, LanguageSwitcher } from "@/components/language-provider";
import Link from "next/link";
import { Brand } from "./brand";
import { Button } from "./ui/button";
export function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="public-header">
        <Brand />
        <nav>
          <Link href="/#how-it-works">
            <Text value={"How it works"} />
          </Link>
          <Link href="/pricing">
            <Text value={"Pricing"} />
          </Link>
          <Link href="/app/trending">
            <Text value={"Explore"} />
          </Link>
        </nav>
        <div className="header-actions">
          <LanguageSwitcher />
          <Link href="/login">
            <Text value={"Log in"} />
          </Link>
          <Button asChild size="sm">
            <Link href="/signup">
              <Text value={"Start free ↗"} />
            </Link>
          </Button>
        </div>
      </header>
      {children}
      <footer>
        <Brand />
        <p>
          <Text value={"Evidence first. AI second."} />
        </p>
        <div>
          <Link href="/pricing">
            <Text value={"Pricing"} />
          </Link>
          <Link href="/privacy">
            <Text value={"Privacy"} />
          </Link>
          <Link href="/terms">
            <Text value={"Terms"} />
          </Link>
        </div>
        <span>© {new Date().getFullYear()} PainRadar</span>
      </footer>
    </>
  );
}

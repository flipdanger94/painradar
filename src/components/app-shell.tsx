"use client";
import {
  Text,
  LanguageSwitcher,
  useTranslation,
} from "@/components/language-provider";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  TrendingUp,
  Bookmark,
  ScanLine,
  FileText,
  Bell,
  Settings,
  Radio,
  Search,
  Menu,
  X,
  ArrowUpRight,
  LogOut,
  Shield,
} from "lucide-react";
import { Brand } from "./brand";
import { Button } from "./ui/button";
import { authClient } from "@/lib/auth-client";
const links = [
  ["/app", "Overview", LayoutDashboard],
  ["/app/signals", "Signals", Radio],
  ["/app/trending", "Trending", TrendingUp],
  ["/app/watchlist", "Watchlist", Bookmark],
  ["/app/radars", "My radars", ScanLine],
  ["/app/reports", "Reports", FileText],
  ["/app/teams", "Teams & clients", Shield],
  ["/app/notifications", "Notifications", Bell],
  ["/app/sources", "Data sources", Radio],
  ["/app/settings", "Settings", Settings],
] as const;
function subscribeMobile(change: () => void) {
  const media = window.matchMedia("(max-width: 768px)");
  media.addEventListener("change", change);
  return () => media.removeEventListener("change", change);
}
const mobileSnapshot = () => window.matchMedia("(max-width: 768px)").matches;
const serverSnapshot = () => false;
export function AppShell({
  children,
  user,
  admin,
  configured,
}: {
  children: React.ReactNode;
  user: string | null;
  admin: boolean;
  configured: boolean;
}) {
  const t = useTranslation();
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");
  const sidebar = useRef<HTMLElement>(null);
  const mobile = useSyncExternalStore(
    subscribeMobile,
    mobileSnapshot,
    serverSnapshot,
  );
  const drawerOpen = mobile && open;
  useEffect(() => {
    if (!drawerOpen || !sidebar.current) return;
    const panel = sidebar.current;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const controls = () =>
      Array.from(
        panel.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),input:not([disabled]),[tabindex="0"]',
        ),
      ).filter((element) => element.getClientRects().length > 0);
    (controls()[0] || panel).focus();
    function keydown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
      }
      if (event.key === "Tab") {
        const items = controls();
        const first = items[0];
        const last = items.at(-1);
        if (!first || !last) {
          event.preventDefault();
          panel.focus();
        } else if (
          event.shiftKey &&
          (document.activeElement === first ||
            !panel.contains(document.activeElement))
        ) {
          event.preventDefault();
          last.focus();
        } else if (
          !event.shiftKey &&
          (document.activeElement === last ||
            !panel.contains(document.activeElement))
        ) {
          event.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("keydown", keydown);
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected)
        previousFocus.focus();
    };
  }, [drawerOpen]);
  return (
    <div className="shell">
      <button
        aria-label="Dismiss navigation backdrop"
        tabIndex={-1}
        aria-hidden="true"
        className={`drawer-overlay ${drawerOpen ? "visible" : ""}`}
        onClick={() => setOpen(false)}
      />
      <aside
        id="workspace-navigation"
        ref={sidebar}
        className={`sidebar ${drawerOpen ? "open" : ""}`}
        inert={mobile && !drawerOpen}
        role={drawerOpen ? "dialog" : undefined}
        aria-modal={drawerOpen || undefined}
        aria-label="Workspace navigation"
        tabIndex={-1}
        onClick={(event) => {
          if (
            event.target instanceof Element &&
            event.target.closest("a[href]")
          )
            setOpen(false);
        }}
      >
        <button
          className="drawer-close"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        >
          <X size={20} />
        </button>
        <Brand />
        <div className="nav-label">
          <Text value={"WORKSPACE"} />
        </div>
        {links.map(([href, title, Icon]) => (
          <Link
            className={`side-link ${path === href ? "active" : ""}`}
            key={href}
            href={href}
            onClick={() => setOpen(false)}
          >
            <Icon />
            <Text value={title} />
          </Link>
        ))}
        {admin && (
          <Link
            className="side-link"
            href="/admin"
            onClick={() => setOpen(false)}
          >
            <Shield />
            <Text value={"Administration"} />
          </Link>
        )}
        <div className="side-bottom">
          <div className="plan-box">
            <strong>
              <Text value={"Go deeper. Build smarter."} />
            </strong>
            <p>
              <Text
                value={
                  "More radars, longer history, and actionable intelligence."
                }
              />
            </p>
            <Button asChild size="sm">
              <Link href="/pricing">
                <Text value={"Explore plans"} />
                <ArrowUpRight size={13} />
              </Link>
            </Button>
          </div>
          {user ? (
            <>
              <div className="text-small muted wrap">{user}</div>
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  const r = await authClient.signOut();
                  if (r.error)
                    setError(r.error.message || "Unable to sign out");
                  else {
                    router.push("/");
                    router.refresh();
                  }
                }}
              >
                <LogOut size={13} />
                <Text value={"Log out"} />
              </Button>
              {error && (
                <p role="alert" className="error-message">
                  {error}
                </p>
              )}
            </>
          ) : (
            <Button asChild variant="outline" size="sm">
              <Link href="/login">
                <Text value={"Log in to your workspace"} />
              </Link>
            </Button>
          )}
        </div>
      </aside>
      <div className="workspace" inert={drawerOpen}>
        <header className="workspace-header">
          <LanguageSwitcher />
          <button
            className="mobile-menu"
            aria-label={t(open ? "Close navigation" : "Open navigation")}
            aria-expanded={drawerOpen}
            aria-controls="workspace-navigation"
            onClick={() => setOpen(!open)}
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
          <form
            className="header-search"
            onSubmit={(e) => {
              e.preventDefault();
              router.push("/app/trending?q=" + encodeURIComponent(q));
            }}
          >
            <Search size={17} className="muted" />
            <input
              aria-label={t("Search opportunities")}
              placeholder={t("Search problems, industries, audiences…")}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              maxLength={200}
            />
          </form>
          <div className="header-status">
            <span className="dot" />
            {t(configured ? "Evidence-first workspace" : "Setup required")}
          </div>
          <Link href="/app/notifications" aria-label={t("Notifications")}>
            <Bell size={17} className="muted" />
          </Link>
        </header>
        <main className="workspace-content">
          {!configured && (
            <div className="notice">
              <Text
                value={
                  "Data services are not connected yet. This workspace contains no simulated opportunities. Connect PostgreSQL and configure source collection to start."
                }
              />
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}

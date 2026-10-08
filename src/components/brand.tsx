import Link from "next/link";
export function Brand() {
  return (
    <Link className="brand" href="/">
      <span className="brand-icon">
        <span />
        <span />
        <span />
      </span>
      PainRadar<span className="brand-beta">BETA</span>
    </Link>
  );
}

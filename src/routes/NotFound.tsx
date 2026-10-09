import { Link } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { LogoMark } from "@/components/layout/Logo";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <LogoMark />
      <p className="text-sm font-medium text-accent">404</p>
      <h1 className="text-3xl font-semibold">This page wandered off</h1>
      <p className="max-w-sm text-muted">The link may be broken, or the page may have moved.</p>
      <Link to="/dashboard"><Button>Back to dashboard</Button></Link>
    </div>
  );
}

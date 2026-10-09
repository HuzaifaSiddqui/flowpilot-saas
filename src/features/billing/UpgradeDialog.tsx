import { useNavigate } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { useWorkspace } from "@/features/workspaces/WorkspaceProvider";
import { can, PLANS } from "@/lib/config";

/** Shown when the server (or the entitlement check) says a plan limit has been hit. */
export function UpgradeDialog({ open, onClose, reason }: { open: boolean; onClose: () => void; reason: "projects" | "seats" }) {
  const nav = useNavigate();
  const { role } = useWorkspace();
  const owner = can.manageBilling(role);
  const copy = reason === "projects"
    ? { title: "Project limit reached", body: `The Free plan includes ${PLANS.free.maxProjects} active projects. Upgrade to Pro for unlimited projects, or archive a finished project to free a slot.` }
    : { title: "No seats left", body: "Your plan's seats are all in use. Upgrade to invite more teammates." };
  return (
    <Dialog open={open} onClose={onClose} title={copy.title}>
      <div className="mb-5 flex gap-3 rounded-xl bg-accent-soft p-4 text-sm text-ink-2">
        <Sparkles className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
        <p>{copy.body}</p>
      </div>
      {!owner && <p className="mb-5 text-sm text-muted">Only the workspace owner can change the plan — ask them to upgrade.</p>}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Not now</Button>
        {owner && <Button variant="accent" onClick={() => { onClose(); nav("/billing"); }}>See plans</Button>}
      </div>
    </Dialog>
  );
}

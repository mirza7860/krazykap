"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, TriangleAlert } from "lucide-react";

/**
 * One destructive-confirmation dialog, shared by every delete in the app so the
 * wording and the "are you sure" beat stay identical across the dashboard.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Delete",
  keepLabel = "Cancel",
  busy = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  keepLabel?: string;
  /** While a delete is in flight the dialog cannot be dismissed by accident. */
  busy?: boolean;
  onConfirm: () => void;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!busy) onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-lg font-extrabold">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-destructive/10 text-destructive">
              <TriangleAlert className="size-4" />
            </span>
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
            {keepLabel}
          </Button>
          <Button variant="destructive" disabled={busy} onClick={onConfirm}>
            {busy && <Loader2 className="size-4 animate-spin" />} {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

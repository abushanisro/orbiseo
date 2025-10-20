"use client";

import { AuthDialog } from "@/components/auth-dialog";

export function LoginPromptDialog({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
  // This component now acts as a wrapper around the main AuthDialog
  return (
    <AuthDialog
      open={open}
      onOpenChange={onOpenChange}
      showPrompt={true}
    />
  );
}

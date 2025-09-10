import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useUser } from "@clerk/clerk-react";
import { UserProfile as ClerkUserProfile } from '@clerk/clerk-react';

interface UserProfileProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function UserProfile({ open, onOpenChange }: UserProfileProps) {
  const { user } = useUser();
  const avatarUrl = (user as any)?.profileImageUrl || (user as any)?.imageUrl || (user as any)?.image?.url;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="min-w-4xl p-2 bg-transparent border-transparent shadow-none">
        <ClerkUserProfile />
      </DialogContent>
    </Dialog>
  );
}

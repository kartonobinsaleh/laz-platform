"use client";

import { ProfileCard } from "./ProfileCard";
import { SecurityCard } from "./SecurityCard";
import { NotificationsCard } from "./NotificationsCard";

interface SettingsFormProps {
  user: {
    id: string;
    name: string | null;
    email: string;
    phoneNumber: string | null;
    avatarUrl?: string | null;
    avatarPublicId?: string | null;
    emailNotifications: boolean;
    waNotifications: boolean;
  };
}

export function SettingsForm({ user }: SettingsFormProps) {
  return (
    <div className="space-y-8 max-w-4xl">
      <ProfileCard user={user} />
      <SecurityCard />
      <NotificationsCard user={user} />
    </div>
  );
}

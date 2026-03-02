"use client";
import { useEffect } from "react";
import posthog from "posthog-js";

interface Props {
  userId: string;
  userEmail: string;
  userName: string;
}

export function PostHogIdentify({ userId, userEmail, userName }: Props) {
  useEffect(() => {
    if (userId) {
      posthog.identify(userId, { email: userEmail, name: userName });
    }
  }, [userId, userEmail, userName]);

  return null;
}

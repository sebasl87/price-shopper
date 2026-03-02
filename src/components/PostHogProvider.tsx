"use client";
import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";

if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: "/api/ph",
    ui_host: "https://us.posthog.com",
    person_profiles: "identified_only",
    capture_pageview: false, // Disable automatic pageview capture, as we capture manually
    loaded: (ph) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      console.log("PostHog loaded. API Host:", (ph as any).config.api_host);
    },
  });

  // Force update config to ensure api_host is correct even if cached
  posthog.set_config({ api_host: "/api/ph" });
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  return <PHProvider client={posthog}>{children}</PHProvider>;
}

"use client";
import { useEffect, useState } from "react";
import { useConfigCat } from "@/components/ConfigCatProvider";
import type { IConfigCatClient } from "configcat-js-ssr";

export function useFeatureFlag(key: string, userId?: string): boolean | undefined {
  const client: IConfigCatClient | null = useConfigCat();
  const [value, setValue] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    if (!client) return;
    const user = userId ? { identifier: userId, custom: {} } : undefined;
    client.getValueAsync(key, false, user).then(setValue);
  }, [client, key, userId]);

  return value;
}
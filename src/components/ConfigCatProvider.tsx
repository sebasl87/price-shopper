"use client";
import { createContext, useContext, useEffect, useState } from "react";
import * as configcat from "configcat-js-ssr";

type Client = configcat.IConfigCatClient | null;

const ConfigCatContext = createContext<Client>(null);

export function ConfigCatProvider({ children }: { children: React.ReactNode }) {
  const [client, setClient] = useState<Client>(null);

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_CONFIGCAT_KEY;
    if (!key) return;
    const c = configcat.getClient(key, configcat.PollingMode.AutoPoll, {
      pollIntervalSeconds: 60,
    });
    setClient(c);
    return () => c.dispose();
  }, []);

  return (
    <ConfigCatContext.Provider value={client}>
      {children}
    </ConfigCatContext.Provider>
  );
}

export function useConfigCat() {
  return useContext(ConfigCatContext);
}

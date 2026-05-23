"use client";

import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { useState, useEffect, ReactNode } from "react";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 5, // 5 minutes
        gcTime: 1000 * 60 * 60 * 24, // 24 hours
      },
    },
  });
}

export default function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => makeQueryClient());
  const [persister, setPersister] = useState<ReturnType<typeof createSyncStoragePersister> | null>(null);

  useEffect(() => {
    // Only create persister on client side
    const storagePersister = createSyncStoragePersister({
      storage: window.localStorage,
      key: "job-tracker-cache",
    });
    setPersister(storagePersister);
  }, []);

  // Render without persistence until client-side persister is ready
  if (!persister) {
    return null;
  }

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}

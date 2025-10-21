'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useState } from 'react';

type Props = {
  children: ReactNode;
};

const defaultOptions = {
  queries: {
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true
  }
};

export function ReactQueryProvider({ children }: Props) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions
      })
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

import { QueryClient, QueryCache, MutationCache } from '@tanstack/react-query';
import { logError } from '@/lib/logger';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      cacheTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
      networkMode: 'online',
    },
    mutations: {
      retry: 1,
      retryDelay: 1000,
      networkMode: 'online',
    },
  },
  queryCache: new QueryCache({
    onError: (error, query) => {
      logError(error, { 
        source: 'react-query',
        queryKey: query.queryKey,
      });
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      logError(error, { 
        source: 'react-query',
        mutationKey: mutation.options.mutationKey,
      });
    },
  }),
});

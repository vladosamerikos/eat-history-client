import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface Capabilities {
  ai: boolean;
  voice: boolean;
  googleAuth: boolean;
  push: boolean;
  email: boolean;
}

const DEFAULTS: Capabilities = {
  ai: false,
  voice: false,
  googleAuth: false,
  push: false,
  email: false,
};

export function useCapabilities() {
  const query = useQuery<Capabilities>({
    queryKey: ['capabilities'],
    queryFn: () => api<Capabilities>('/capabilities', { method: 'GET', auth: false }),
    staleTime: 5 * 60 * 1000,
  });
  return { capabilities: query.data ?? DEFAULTS, isLoading: query.isLoading };
}

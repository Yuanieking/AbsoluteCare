import { QueryClient } from '@tanstack/react-query'
import axios from 'axios'

const isClientError = (error: unknown) =>
  axios.isAxiosError(error) && !!error.response && error.response.status < 500

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => !isClientError(error) && failureCount < 1,
    },
  },
})

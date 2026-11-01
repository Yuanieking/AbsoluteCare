import { toast, type ExternalToast } from 'sonner'

const genericError = 'Something went wrong. Please try again.'

type ErrorLike = { response?: { data?: { message?: unknown } } } | null | undefined

export const getToastError = (error: unknown, fallback = genericError): string => {
  const message = (error as ErrorLike)?.response?.data?.message
  return typeof message === 'string' && message.trim() ? message : fallback
}

export const showSuccess = (message: string, options?: ExternalToast) =>
  toast.success(message, { duration: 4000, ...options })

export const showError = (message: string | undefined, options?: ExternalToast) =>
  toast.error(message || genericError, { duration: 6000, ...options })

export const showInfo = (message: string, options?: ExternalToast) =>
  toast(message, { duration: 4000, ...options })

export const showLoading = (message: string, options?: ExternalToast) =>
  toast.loading(message, options)

type PromiseMessages = {
  loading?: string
  success?: string
  error?: string
}

export const showPromise = (promise: Promise<unknown>, messages: PromiseMessages) =>
  toast.promise(promise, {
    loading: messages.loading || 'Working on it...',
    success: messages.success || 'Done.',
    error: (error: unknown) => getToastError(error, messages.error || genericError),
  })

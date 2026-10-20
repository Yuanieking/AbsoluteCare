import { toast } from "sonner";

const genericError = "Something went wrong. Please try again.";

export const getToastError = (error, fallback = genericError) => {
  const message = error?.response?.data?.message;
  return typeof message === "string" && message.trim() ? message : fallback;
};

export const showSuccess = (message, options) =>
  toast.success(message, { duration: 4000, ...options });

export const showError = (message, options) =>
  toast.error(message || genericError, { duration: 6000, ...options });

export const showInfo = (message, options) =>
  toast(message, { duration: 4000, ...options });

export const showLoading = (message, options) =>
  toast.loading(message, options);

export const showPromise = (promise, messages) =>
  toast.promise(promise, {
    loading: messages.loading || "Working on it...",
    success: messages.success || "Done.",
    error: (error) => getToastError(error, messages.error || genericError),
  });

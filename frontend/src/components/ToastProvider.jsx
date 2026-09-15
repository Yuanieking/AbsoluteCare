import { Toaster } from "sonner";

function ToastProvider() {
  return (
    <Toaster
      position="bottom-right"
      richColors
      closeButton
      expand={false}
      visibleToasts={4}
    />
  );
}

export default ToastProvider;

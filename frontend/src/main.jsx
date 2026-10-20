import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/index.css";
import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { SidebarProvider } from "./context/SidebarContext.jsx";
import ToastProvider from "./components/ToastProvider.jsx";
import { NotificationsProvider } from "./context/NotificationsContext.jsx";
import { SettingsProvider } from "./context/SettingsContext.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <SettingsProvider>
      <AuthProvider>
        <NotificationsProvider>
          <SidebarProvider>
            <App />
          </SidebarProvider>
        </NotificationsProvider>
        <ToastProvider />
      </AuthProvider>
    </SettingsProvider>
  </StrictMode>,
);

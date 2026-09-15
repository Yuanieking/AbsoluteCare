import { useContext } from "react";
import SidebarContext from "./sidebarContext";

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used inside a SidebarProvider");
  }
  return context;
}

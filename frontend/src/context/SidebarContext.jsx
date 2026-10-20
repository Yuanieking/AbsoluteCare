import { useEffect, useMemo, useState } from "react";
import SidebarContext from "./sidebarContext";
const COLLAPSE_STORAGE_KEY = "absolutecare.sidebar-collapsed";
const MOBILE_QUERY = "(max-width: 700px)";
const TABLET_QUERY = "(max-width: 1100px)";
const SIDEBAR_INSET = "12px";

function getMediaMatch(query) {
  return typeof window !== "undefined" && window.matchMedia(query).matches;
}

function getInitialCollapsed() {
  try {
    const savedState = window.localStorage.getItem(COLLAPSE_STORAGE_KEY);
    if (savedState !== null) return savedState === "true";
  } catch {
    // Use the responsive default when storage is unavailable.
  }
  return getMediaMatch(TABLET_QUERY);
}

export function SidebarProvider({ children }) {
  const [collapsed, setCollapsed] = useState(getInitialCollapsed);
  const [isMobile, setIsMobile] = useState(() => getMediaMatch(MOBILE_QUERY));

  useEffect(() => {
    try {
      window.localStorage.setItem(COLLAPSE_STORAGE_KEY, String(collapsed));
    } catch {
      // Persistence is optional when browser storage is unavailable.
    }
  }, [collapsed]);

  useEffect(() => {
    function handleResize() {
      setIsMobile(getMediaMatch(MOBILE_QUERY));
    }

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const value = useMemo(
    () => ({
      collapsed,
      setCollapsed,
      toggleCollapsed: () => setCollapsed((value) => !value),
      isMobile,
      sidebarInset: SIDEBAR_INSET,
      sidebarWidth: isMobile ? "0px" : collapsed ? "80px" : "264px",
      sidebarOffset: isMobile ? "0px" : collapsed ? "92px" : "276px",
    }),
    [collapsed, isMobile],
  );

  return (
    <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>
  );
}

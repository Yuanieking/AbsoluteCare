import axiosInstance from "./axiosInstance";

export const getPublicSettings = () => axiosInstance.get("/settings/public");
export const getAdminSettings = () => axiosInstance.get("/admin/settings");
export const updateSettingsSection = (section, data) =>
  axiosInstance.patch(`/admin/settings/${section}`, data);
export const getSettingsAudit = (params) =>
  axiosInstance.get("/admin/settings/audit", { params });
export const getSettingsImpact = (change) =>
  axiosInstance.get("/admin/settings/impact", { params: { change } });
export const sendSettingsTestEmail = () =>
  axiosInstance.post("/admin/settings/test-email");
export const getIntegrationHealth = () =>
  axiosInstance.get("/admin/settings/integrations/health");
export const getIntegrations = () =>
  axiosInstance.get("/admin/settings/integrations");
export const updateIntegration = (key, data) =>
  axiosInstance.patch(`/admin/settings/integrations/${key}`, data);
export const testIntegration = (key) =>
  axiosInstance.post(`/admin/settings/integrations/${key}/test`);
export const requestSettingsVerification = (action) =>
  axiosInstance.post("/admin/settings/verification", { action });
export const confirmSettingsVerification = (action, code) =>
  axiosInstance.post("/admin/settings/verification/confirm", { action, code });

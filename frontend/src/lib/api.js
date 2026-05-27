import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API, timeout: 8000 });

export const getLive = () => api.get("/live").then((r) => r.data);
export const getHistory = (range) => api.get(`/history?range=${range}`).then((r) => r.data);
export const getToday = () => api.get("/today").then((r) => r.data);
export const getConfig = () => api.get("/config").then((r) => r.data);
export const putConfig = (payload) => api.put("/config", payload).then((r) => r.data);
export const controlHoymiles = (action, value) => api.post("/control/hoymiles", { action, value }).then((r) => r.data);
export const controlTrucki = (action, value) => api.post("/control/trucki", { action, value }).then((r) => r.data);
export const getIntegrationsStatus = () => api.get("/integrations/status").then((r) => r.data);

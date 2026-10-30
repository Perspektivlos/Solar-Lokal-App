import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API, timeout: 15000 });

export const getLive = () => api.get("/live").then((r) => r.data);
export const getHistory = (range) => api.get(`/history?range=${range}`).then((r) => r.data);
export const getToday = (dayOffset = 0) => api.get("/today", { params: { day_offset: dayOffset } }).then((r) => r.data);
export const getConfig = () => api.get("/config").then((r) => r.data);
export const putConfig = (payload) => api.put("/config", payload).then((r) => r.data);
export const controlHoymiles = (action, value) => api.post("/control/hoymiles", { action, value }).then((r) => r.data);
export const controlTrucki = (action, value) => api.post("/control/trucki", { action, value }).then((r) => r.data);
export const getIntegrationsStatus = () => api.get("/integrations/status").then((r) => r.data);
export const getAlarms = () => api.get("/alarms").then((r) => r.data);
export const getAlarmHistory = (limit = 50) => api.get("/alarms/history", { params: { limit } }).then((r) => r.data);
export const getEnergyBalance = (period = "day", limit = 14) => api.get("/energy/balance", { params: { period, limit } }).then((r) => r.data);
export const getDeviceInfo = () => api.get("/devices/info").then((r) => r.data);
export const getRoadmap = () => api.get("/roadmap").then((r) => r.data);
export const putRoadmap = (items) => api.put("/roadmap", { items }).then((r) => r.data);
export const discoverDevice = (key) => api.post(`/devices/${key}/discover`).then((r) => r.data);
export const discoverAll = () => api.post("/devices/discover-all").then((r) => r.data);

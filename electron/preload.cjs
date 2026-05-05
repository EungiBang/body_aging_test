const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getApiKey: () => ipcRenderer.invoke('get-api-key'),
  setApiKey: (apiKey) => ipcRenderer.invoke('set-api-key', apiKey),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  
  // Auth Token (Branch Certification)
  saveAuthToken: (token) => ipcRenderer.invoke('save-auth-token', token),
  loadAuthToken: () => ipcRenderer.invoke('load-auth-token'),
  clearAuthToken: () => ipcRenderer.invoke('clear-auth-token'),
  
  // Local DB
  saveMemberRecord: (record) => ipcRenderer.invoke('save-member-record', record),
  getMemberRecords: () => ipcRenderer.invoke('get-member-records'),
  deleteMemberRecord: (id) => ipcRenderer.invoke('delete-member-record', id),
  importV3Database: () => ipcRenderer.invoke('import-v3-database'),
  
  // Feedback DB (Few-Shot 학습 데이터)
  saveFeedbackRecords: (records) => ipcRenderer.invoke('save-feedback-records', records),
  getFeedbackRecords: () => ipcRenderer.invoke('get-feedback-records'),
  
  // Hardware Info
  getSystemMemory: () => ipcRenderer.invoke('get-system-memory'),
  getSystemCpuCores: () => ipcRenderer.invoke('get-system-cpu-cores'),
  getHardwareId: () => ipcRenderer.invoke('get-hardware-id'),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  // Auto Updater
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  onUpdaterMessage: (callback) => {
    ipcRenderer.removeAllListeners('updater-message');
    ipcRenderer.on('updater-message', (_event, value) => callback(value));
  },
  onUpdaterProgress: (callback) => {
    ipcRenderer.removeAllListeners('updater-download-progress');
    ipcRenderer.on('updater-download-progress', (_event, value) => callback(value));
  },
  
  isElectron: true,
});

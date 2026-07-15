const { app, BrowserWindow, session, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { autoUpdater } = require('electron-updater');

// Environment detection
const isDev = !app.isPackaged;

// 듀얼 GPU(Optimus 등) 노트북에서 내장 그래픽 대신 외장 고성능 GPU(NVIDIA 등)를 강제 사용
app.commandLine.appendSwitch('force_high_performance_gpu');

// Config file path for API key persistence
const getConfigPath = () => {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'config.json');
};

const loadConfig = () => {
  try {
    const configPath = getConfigPath();
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
  } catch (e) {
    console.error('Config load error:', e);
  }
  return {};
};

const saveConfig = (config) => {
  try {
    const configPath = getConfigPath();
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
  } catch (e) {
    console.error('Config save error:', e);
  }
};

function serveDist() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let filePath = path.join(__dirname, '..', 'dist', req.url === '/' ? 'index.html' : req.url.split('?')[0]);
      
      const extname = String(path.extname(filePath)).toLowerCase();
      const mimeTypes = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpg',
        '.svg': 'image/svg+xml'
      };

      const contentType = mimeTypes[extname] || 'application/octet-stream';

      fs.readFile(filePath, (error, content) => {
        if (error) {
          if(error.code == 'ENOENT') {
            fs.readFile(path.join(__dirname, '..', 'dist', 'index.html'), (err, content) => {
              res.writeHead(200, { 'Content-Type': 'text/html' });
              res.end(content, 'utf-8');
            });
          } else {
            res.writeHead(500);
            res.end('Sorry, check with the site admin for error: '+error.code+' ..\n');
          }
        } else {
          res.writeHead(200, { 'Content-Type': contentType });
          res.end(content, 'utf-8');
        }
      });
    });

    server.listen(0, '127.0.0.1', () => {
      resolve(server.address().port);
    });
  });
}

let mainWindow;

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    title: 'BTC 3바디 AI분석기',
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    autoHideMenuBar: true,
    backgroundColor: '#f8fafc',
  });

  // Grant camera permission automatically
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowedPermissions = ['media', 'mediaKeySystem', 'geolocation'];
    if (allowedPermissions.includes(permission)) {
      callback(true);
    } else {
      callback(false);
    }
  });

  session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
    return ['media', 'mediaKeySystem'].includes(permission);
  });

  // 패키징 빌드(file:// 렌더러)에서 원격 라이트 API를 cross-origin으로 부를 때의 CORS 우회.
  // 이 앱은 Bearer 토큰 인증(쿠키 아님)이라 CORS는 보안 경계가 아니라 장애물일 뿐 — 실제 방어는
  // 서버의 인증 관문(_auth.ts)이 한다. 그래서 서버 _cors.ts는 엄격히 둔 채, 앱이 자기 API 응답에만
  // Access-Control-Allow-Origin을 주입해 렌더러 fetch(및 프리플라이트)를 통과시킨다.
  // VITE_API_BASE가 test/real 어느 라이트 서버를 가리켜도 동일하게 동작한다.
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    if (/^https?:\/\//i.test(details.url) && details.url.includes('/api/')) {
      const headers = details.responseHeaders || {};
      for (const k of Object.keys(headers)) {
        if (k.toLowerCase() === 'access-control-allow-origin') delete headers[k];
      }
      headers['Access-Control-Allow-Origin'] = ['*'];
      callback({ responseHeaders: headers });
      return;
    }
    callback({ responseHeaders: details.responseHeaders });
  });

  // Handle window.open (popup) cleanly for Firebase Auth
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // We can allow new window so Firebase popups work naturally
    return {
      action: 'allow',
      overrideBrowserWindowOptions: {
        autoHideMenuBar: true,
      }
    };
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:3001');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    // Production: file:// 방식으로 직접 로드 (localStorage origin 고정)
    // Firebase Auth를 제거했으므로 CORS 문제 없음
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

const { execSync } = require('child_process');

// Hardware ID Generator (Motherboard UUID + MAC Address) for Security Binding
function getHardwareId() {
  const config = loadConfig();
  // 1. 이미 발급된 고유 기기 ID가 설정 파일에 있다면 그것을 최우선으로 사용
  if (config.hardwareId) {
    return config.hardwareId;
  }

  let baseId = '';
  const crypto = require('crypto');

  try {
    // 2. 메인보드 고유 UUID 기반 생성 (기본 하드웨어 식별)
    if (process.platform === 'win32') {
      const output = execSync('wmic csproduct get UUID', { encoding: 'utf8' });
      const lines = output.split('\n').map(line => line.trim()).filter(line => line.length > 0);
      if (lines.length >= 2 && lines[1] !== 'FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF') {
         baseId += lines[1];
      }
    }
  } catch (e) {
    console.warn("Failed to get Motherboard UUID:", e);
  }

  try {
    // 3. 네트워크 MAC 주소 결합 (복제된 윈도우 OS/메인보드 충돌 방지)
    const os = require('os');
    const interfaces = os.networkInterfaces();
    let macs = [];
    for (const name of Object.keys(interfaces)) {
      for (const net of interfaces[name]) {
        // 내부 루프백 가상 주소가 아닌 실제 물리적 MAC 주소 수집
        if (net.mac && net.mac !== '00:00:00:00:00:00' && !net.internal) {
          macs.push(net.mac);
        }
      }
    }
    if (macs.length > 0) {
      // MAC 주소를 정렬하여 일관성 유지
      baseId += '_' + macs.sort().join(',');
    }
  } catch (e) {
    console.warn("Failed to get MAC addresses:", e);
  }

  // 4. UUID와 MAC을 모두 가져오지 못한 예외 상황의 경우 레지스트리 머신 ID 사용
  if (!baseId) {
    try {
      const { machineIdSync } = require('node-machine-id');
      baseId = machineIdSync();
    } catch (e) {
      const os = require('os');
      baseId = 'fallback-' + os.hostname() + '-' + Date.now();
    }
  }

  // 5. 최종 해시 생성 (보안 처리)
  const finalId = crypto.createHash('sha256').update(baseId).digest('hex');
  
  // 6. 생성된 ID를 config에 영구 저장하여 추후 네트워크 카드가 변경되더라도 ID가 유지되도록 함
  config.hardwareId = finalId;
  saveConfig(config);
  
  return finalId;
}

ipcMain.handle('get-hardware-id', () => {
  return getHardwareId();
});

ipcMain.handle('get-system-memory', () => {
  return require('os').totalmem();
});

ipcMain.handle('get-system-cpu-cores', () => {
  return require('os').cpus().length;
});

// IPC handlers for API key management
ipcMain.handle('get-api-key', () => {
  const config = loadConfig();
  return config.apiKey || '';
});

ipcMain.handle('set-api-key', (event, apiKey) => {
  const config = loadConfig();
  config.apiKey = apiKey;
  saveConfig(config);
  return true;
});

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('open-external', (event, url) => {
  shell.openExternal(url);
  return true;
});

// ─── Auth Token: 별도 파일(auth.json)에 영구 저장 ───────────────────────────
// localStorage는 HTTP 서버 포트가 매 실행마다 달라져 사용 불가 → 파일 기반으로만 처리
const getAuthPath = () => path.join(app.getPath('userData'), 'auth.json');

const loadAuth = () => {
  try {
    const authPath = getAuthPath();
    if (fs.existsSync(authPath)) {
      const raw = fs.readFileSync(authPath, 'utf8');
      const parsed = JSON.parse(raw);
      return parsed;
    }
  } catch (e) {
    console.error('[Auth] Load error:', e);
  }
  return null;
};

const saveAuth = (tokenData) => {
  try {
    const authPath = getAuthPath();
    fs.writeFileSync(authPath, JSON.stringify(tokenData, null, 2), 'utf8');
    // 저장 후 즉시 검증
    const verify = fs.readFileSync(authPath, 'utf8');
    JSON.parse(verify);
    console.log('[Auth] Saved and verified at:', authPath);
    return true;
  } catch (e) {
    console.error('[Auth] Save error:', e);
    return false;
  }
};

ipcMain.handle('save-auth-token', (event, tokenData) => {
  // config.json에도 백업 저장
  const config = loadConfig();
  config.authToken = tokenData;
  saveConfig(config);
  // 전용 auth.json에 저장 (메인)
  return saveAuth(tokenData);
});

ipcMain.handle('load-auth-token', () => {
  // 전용 auth.json 우선
  const fromAuth = loadAuth();
  if (fromAuth) return fromAuth;
  // 없으면 config.json 백업에서 복구
  const config = loadConfig();
  if (config.authToken) {
    // 복구된 데이터를 auth.json에 다시 저장
    saveAuth(config.authToken);
    return config.authToken;
  }
  return null;
});

ipcMain.handle('clear-auth-token', () => {
  try {
    const authPath = getAuthPath();
    if (fs.existsSync(authPath)) fs.unlinkSync(authPath);
  } catch (e) {
    console.error('[Auth] Clear error:', e);
  }
  const config = loadConfig();
  delete config.authToken;
  saveConfig(config);
  return true;
});

// Local database path for storing member records
const getDbPath = () => {
  return path.join(app.getPath('userData'), 'members-db-v4.json');
};

const readLocalDb = () => {
  try {
    const dbPath = getDbPath();
    if (fs.existsSync(dbPath)) {
      return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    }
  } catch (e) {
    console.error('Local DB load error:', e);
  }
  return []; // Array of records
};

const saveLocalDb = (data) => {
  try {
    const dbPath = getDbPath();
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error('Local DB save error:', e);
  }
};

ipcMain.handle('save-member-record', (event, record) => {
  const db = readLocalDb();
  // Update or insert
  const existingIdx = db.findIndex(r => r.id === record.id);
  if (existingIdx !== -1) {
    db[existingIdx] = record;
  } else {
    db.unshift(record); // Add to beginning
  }
  saveLocalDb(db);
  return true;
});

ipcMain.handle('get-member-records', () => {
  return readLocalDb();
});

ipcMain.handle('delete-member-record', (event, id) => {
  let db = readLocalDb();
  db = db.filter(r => r.id !== id);
  saveLocalDb(db);
  return true;
});

// Import V3 DB records
ipcMain.handle('import-v3-database', () => {
  try {
    const v3Path = path.join(app.getPath('userData'), 'members-db.json');
    if (fs.existsSync(v3Path)) {
      const records = JSON.parse(fs.readFileSync(v3Path, 'utf8'));
      return records;
    }
  } catch (e) {
    console.error('V3 DB import error:', e);
  }
  return [];
});

// ─── Feedback DB (Few-Shot 학습 데이터) ──────────────────────────────────────
const getFeedbackDbPath = () => {
  return path.join(app.getPath('userData'), 'feedback-db.json');
};

const readFeedbackDb = () => {
  try {
    const dbPath = getFeedbackDbPath();
    if (fs.existsSync(dbPath)) {
      return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    }
  } catch (e) {
    console.error('Feedback DB load error:', e);
  }
  return [];
};

const saveFeedbackDb = (data) => {
  try {
    const dbPath = getFeedbackDbPath();
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error('Feedback DB save error:', e);
  }
};

ipcMain.handle('get-feedback-records', () => {
  return readFeedbackDb();
});

ipcMain.handle('save-feedback-records', (event, records) => {
  saveFeedbackDb(records);
  return true;
});


// ─── Auto Updater 설정 ──────────────────────────────────────────────
autoUpdater.autoDownload = false; // 사용자 승인 후 다운로드
autoUpdater.autoInstallOnAppQuit = true;

autoUpdater.on('checking-for-update', () => {
  if (mainWindow) mainWindow.webContents.send('updater-message', { status: 'checking' });
});
autoUpdater.on('update-available', (info) => {
  if (mainWindow) mainWindow.webContents.send('updater-message', { status: 'available', version: info.version });
});
autoUpdater.on('update-not-available', (info) => {
  if (mainWindow) mainWindow.webContents.send('updater-message', { status: 'not-available' });
});
autoUpdater.on('error', (err) => {
  if (mainWindow) mainWindow.webContents.send('updater-message', { status: 'error', error: err.message });
});
autoUpdater.on('download-progress', (progressObj) => {
  if (mainWindow) {
    mainWindow.webContents.send('updater-download-progress', {
      percent: progressObj.percent,
      transferred: progressObj.transferred,
      total: progressObj.total,
      bytesPerSecond: progressObj.bytesPerSecond
    });
  }
});
autoUpdater.on('update-downloaded', (info) => {
  if (mainWindow) mainWindow.webContents.send('updater-message', { status: 'downloaded', version: info.version });
});

ipcMain.handle('check-for-updates', () => {
  if (isDev) return null; // 개발 환경에서는 무시
  autoUpdater.checkForUpdates();
  return true;
});

ipcMain.handle('download-update', () => {
  autoUpdater.downloadUpdate();
  return true;
});

ipcMain.handle('install-update', () => {
  autoUpdater.quitAndInstall();
  return true;
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

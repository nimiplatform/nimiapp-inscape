import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  protocol,
  session,
  webContents,
} from 'electron';
import { configureNimiElectronAppHostProfile } from '@nimiplatform/kit/shell/electron/host-profile';

let hostProfile;
try {
  hostProfile = configureNimiElectronAppHostProfile(app);
} catch (error) {
  process.stderr.write(`[nimi-app-host-profile] ${error instanceof Error ? error.message : String(error)}\n`);
  app.exit(78);
  throw error;
}

const {
  createNimiElectronStandardApplicationMenuTemplate,
  isAllowedElectronRendererUrl,
  registerNimiElectronAppAssetProtocolScheme,
  registerNimiElectronAppBridge,
} = await import('@nimiplatform/kit/shell/electron/main');
import { clearInscapeSpace, loadInscapeSpaceReply, saveInscapeSpace } from './persistence.js';
import { resolveDevelopmentRendererUrl } from './renderer-url.js';

const APP_ID = 'nimi.inscape';
let productLocale = 'zh';
declare const __NIMI_ELECTRON_PRODUCTION__: boolean;
const IS_PRODUCTION_BUNDLE =
  typeof __NIMI_ELECTRON_PRODUCTION__ !== 'undefined' && __NIMI_ELECTRON_PRODUCTION__;
// Product storage is App-owned; Electron's technical profile stays Desktop-owned.
// Each development registration has its own durable, disposable product space.
const dataRoot = IS_PRODUCTION_BUNDLE
  ? path.join(app.getPath('appData'), APP_ID)
  : path.join(app.getPath('appData'), APP_ID, 'development',
    createHash('sha256').update(hostProfile.profileRoot).digest('hex'));
let resettingRenderer = false;
let quitting = false;
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(currentDir, '..');
const preloadPath = path.join(currentDir, 'preload.cjs');
const rendererDistUrl = pathToFileURL(path.join(appRoot, 'dist', 'index.html')).toString();
const rendererUrl = resolveDevelopmentRendererUrl(process.argv,
  process.env.NIMI_INSCAPE_ELECTRON_RENDERER_URL ?? '', IS_PRODUCTION_BUNDLE);

app.setName('心相 Inscape');
app.setAppUserModelId('ai.nimi.apps.nimi.inscape');
Menu.setApplicationMenu(
  Menu.buildFromTemplate(
    createNimiElectronStandardApplicationMenuTemplate({ appName: app.getName() }),
  ),
);
app.commandLine.appendSwitch('disable-background-networking');
registerNimiElectronAppAssetProtocolScheme(protocol);

void app.whenReady().then(async () => {
  registerNimiElectronAppBridge({
    appId: APP_ID,
    allowedRendererUrls: allowedRendererUrls(),
    assetMediaPlatform: { protocol, webRequest: session.defaultSession.webRequest, webContents },
    ipcMain,
    onSessionInvalidated: resetAccountScopedRenderer,
    appCommandHandlers: {
      inscape_space_load: () => {
        const reply = loadInscapeSpaceReply(dataRoot);
        if (reply.kind !== 'schema_incompatible' && reply.snapshotJson) productLocale = JSON.parse(reply.snapshotJson).settings.locale;
        return reply;
      },
      inscape_space_save: ({ payload }) => {
        saveInscapeSpace(
          dataRoot,
          requiredString(payload.snapshotJson, 'snapshotJson'),
          payload.attestedAdult === true,
          { confirmedQuarantine: payload.confirmedQuarantine === true },
        );
        productLocale = JSON.parse(String(payload.snapshotJson)).settings.locale;
      },
      inscape_space_clear: () => clearInscapeSpace(dataRoot),
      inscape_log_renderer_event: ({ payload }) => {
        process.stdout.write(`${JSON.stringify({ source: 'inscape-renderer', ...payload })}\n`);
      },
    },
  });
  await createMainWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) void createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && !resettingRenderer && BrowserWindow.getAllWindows().length === 0) app.quit();
});
app.on('before-quit', () => { quitting = true; });

function resetAccountScopedRenderer(): void {
  const windows = BrowserWindow.getAllWindows();
  if (quitting || windows.length === 0) return;
  resettingRenderer = true;
  try {
    for (const window of windows) window.destroy();
    void createMainWindow().catch((error: unknown) => {
      process.stderr.write(`[nimi-app-session-reset] ${error instanceof Error ? error.message : String(error)}\n`);
    });
  } finally { resettingRenderer = false; }
}

async function createMainWindow(): Promise<BrowserWindow> {
  const window = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 360,
    minHeight: 640,
    title: '心相 Inscape',
    backgroundColor: '#f7f3ec',
    autoHideMenuBar: true,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  window.setMenuBarVisibility(false);
  window.webContents.on('will-prevent-unload', (event) => {
    const en = productLocale === 'en';
    const choice = dialog.showMessageBoxSync(window, {
      type: 'question',
      title: en ? 'Unsaved content' : '还有未保存的内容',
      message: en
        ? 'Keep editing to save your content, or discard it and leave.'
        : '可以回到页面保存内容，或舍弃未保存的内容后离开。',
      buttons: en ? ['Keep editing', 'Discard and leave'] : ['继续编辑', '舍弃并离开'],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
    });
    if (choice === 1) event.preventDefault();
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => {
    if (!isAllowedElectronRendererUrl(url, allowedRendererUrls())) event.preventDefault();
  });
  try {
    await window.loadURL(rendererUrl || rendererDistUrl);
  } catch (error) {
    if (!window.isDestroyed()) throw error;
  }
  return window;
}

function allowedRendererUrls(): string[] {
  if (IS_PRODUCTION_BUNDLE) return [rendererDistUrl];
  return [rendererUrl || rendererDistUrl];
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value) throw new Error(`${field} is required`);
  return value;
}

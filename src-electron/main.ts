import path from 'node:path';
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
import {
  createNimiElectronStandardApplicationMenuTemplate,
  isAllowedElectronRendererUrl,
  registerNimiElectronAppAssetProtocolScheme,
  registerNimiElectronAppBridge,
} from '@nimiplatform/kit/shell/electron/main';
import { clearInscapeSpace, loadInscapeSpace, saveInscapeSpace } from './persistence.js';

const APP_ID = 'nimi.inscape';
let productLocale = 'zh';
declare const __NIMI_ELECTRON_PRODUCTION__: boolean;
const IS_PRODUCTION_BUNDLE =
  typeof __NIMI_ELECTRON_PRODUCTION__ !== 'undefined' && __NIMI_ELECTRON_PRODUCTION__;
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(currentDir, '..');
const preloadPath = path.join(currentDir, 'preload.cjs');
const rendererDistUrl = pathToFileURL(path.join(appRoot, 'dist', 'index.html')).toString();
const rendererUrl =
  readDevelopmentRendererUrl() ||
  (IS_PRODUCTION_BUNDLE ? '' : normalizeText(process.env.NIMI_INSCAPE_ELECTRON_RENDERER_URL));

app.setName('心相 Inscape');
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
    appCommandHandlers: {
      inscape_space_load: () => {
        const raw = loadInscapeSpace(app.getPath('userData'));
        if (raw) productLocale = JSON.parse(raw).settings.locale;
        return raw;
      },
      inscape_space_save: ({ payload }) => {
        saveInscapeSpace(
          app.getPath('userData'),
          requiredString(payload.snapshotJson, 'snapshotJson'),
          payload.attestedAdult === true,
        );
        productLocale = JSON.parse(String(payload.snapshotJson)).settings.locale;
      },
      inscape_space_clear: () => clearInscapeSpace(app.getPath('userData')),
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
  if (process.platform !== 'darwin') app.quit();
});

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
  await window.loadURL(rendererUrl || rendererDistUrl);
  return window;
}

function allowedRendererUrls(): string[] {
  if (IS_PRODUCTION_BUNDLE) return [rendererDistUrl];
  const urls = new Set<string>([rendererUrl || rendererDistUrl]);
  for (const value of normalizeText(process.env.NIMI_INSCAPE_ELECTRON_ALLOWED_RENDERER_URLS).split(
    ',',
  )) {
    const normalized = normalizeText(value);
    if (normalized) urls.add(normalized);
  }
  return [...urls];
}

function readDevelopmentRendererUrl(): string {
  const prefix = '--nimi-dev-renderer-url=';
  const values = process.argv.filter((value) => value.startsWith(prefix));
  if (IS_PRODUCTION_BUNDLE && values.length > 0) {
    throw new Error('Production Inscape does not accept development renderer arguments.');
  }
  if (values.length === 0) return '';
  if (values.length !== 1) throw new Error('Nimi development renderer URL must be singular.');
  const parsed = new URL(values[0].slice(prefix.length));
  if (
    parsed.protocol !== 'http:' ||
    !['127.0.0.1', 'localhost', '[::1]', '::1'].includes(parsed.hostname.toLowerCase()) ||
    !parsed.port ||
    parsed.username ||
    parsed.password ||
    (parsed.pathname !== '/' && parsed.pathname !== '') ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error('Nimi development renderer URL must be exact loopback.');
  }
  return parsed.origin;
}

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value) throw new Error(`${field} is required`);
  return value;
}

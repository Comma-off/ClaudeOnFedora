const { app, BrowserWindow, Menu, session, shell } = require('electron');
const path = require('node:path');

const CLAUDE_HOME_URL = 'https://claude.ai';
const CLAUDE_BASE_HOST = 'claude.ai';

// claude.ai's own favicon (data/icons/hicolor/*/apps/claudeonfedora.png),
// used as the window/taskbar icon. Without this, X11/Wayland fall back to a
// generic Electron/X icon, since there's no .desktop file involved in an
// unpackaged `electron .`/`npm start` run. Tried following the live page
// favicon dynamically instead (page-favicon-updated + nativeImage), but
// nativeImage can't decode either the SVG or the raw .ico claude.ai serves -
// simpler and more reliable to just bundle the real favicon as a static
// asset than to keep fighting image-format decoding at runtime.
const APP_ICON_PATH = path.join(__dirname, '..', 'data', 'icons', 'hicolor', '256x256', 'apps', 'claudeonfedora.png');

/*
 * Hosts, beyond claude.ai itself, allowed to load inside the app rather than
 * being handed to the system browser. Carried forward from the WebKitGTK
 * build as documented, evidence-based additions - not fresh guesses:
 *
 * - hcaptcha.com: Anthropic's Cloudflare edge serves an hCaptcha
 *   bot-verification challenge embedded as an <iframe>, a functional
 *   dependency of using claude.ai itself.
 * - challenges.cloudflare.com: Cloudflare's own Turnstile challenge widget,
 *   which claude.ai's real response headers explicitly declare as a
 *   legitimate embedded frame source in its Content-Security-Policy.
 */
const EXTRA_ALLOWED_HOSTS = ['hcaptcha.com', 'challenges.cloudflare.com'];

const SECURE_WEB_PREFERENCES = {
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,
  webSecurity: true,
  backgroundThrottling: true,
};

// Exact match OR subdomain-with-dot-boundary, case-insensitive - never a
// substring check. Applied identically to every entry so "hcaptcha.com"
// gets the same precision as "claude.ai": "evilhcaptcha.com" must not pass
// any more than "evilclaude.ai" should.
function hostIsOrSubdomainOf(host, base) {
  if (!host || !base) return false;
  const h = host.toLowerCase();
  const b = base.toLowerCase();
  return h === b || h.endsWith('.' + b);
}

function isAllowedHost(host) {
  return (
    hostIsOrSubdomainOf(host, CLAUDE_BASE_HOST) ||
    EXTRA_ALLOWED_HOSTS.some((allowed) => hostIsOrSubdomainOf(host, allowed))
  );
}

function isHttpUrl(url) {
  try {
    return ['http:', 'https:'].includes(new URL(url).protocol);
  } catch {
    return false;
  }
}

function getHost(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    autoHideMenuBar: true,
    icon: APP_ICON_PATH,
    webPreferences: SECURE_WEB_PREFERENCES,
  });
  // autoHideMenuBar alone doesn't reliably hide it on first show on Linux;
  // the Menu itself (set in buildMenu()) stays intact either way, so
  // Ctrl+R/Ctrl+Q/zoom accelerators keep working with no visible bar.
  win.setMenuBarVisibility(false);

  // Main-frame navigation only - Electron never fires this for subframe
  // (iframe) loads, so embedded content like the hCaptcha/Turnstile widgets
  // above is unaffected by this policy regardless of host. That's a
  // convenient implementation detail, not the security boundary itself: see
  // SECURE_WEB_PREFERENCES for the layer that holds even if this changed.
  win.webContents.on('will-navigate', (event, url) => {
    if (!isHttpUrl(url)) {
      event.preventDefault();
      return;
    }
    if (isAllowedHost(getHost(url))) return;
    event.preventDefault();
    shell.openExternal(url);
  });

  win.webContents.setWindowOpenHandler((details) => {
    console.log(`[popup] url=${details.url} disposition=${details.disposition}`);

    if (!isHttpUrl(details.url)) return { action: 'deny' };

    const host = getHost(details.url);
    const looksIntentional =
      details.disposition === 'foreground-tab' || details.disposition === 'new-window';

    if (isAllowedHost(host) && looksIntentional) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: { icon: APP_ICON_PATH, webPreferences: SECURE_WEB_PREFERENCES },
      };
    }

    if (!isAllowedHost(host)) {
      shell.openExternal(details.url);
    }
    return { action: 'deny' };
  });

  win.webContents.on('did-fail-load', (event, errorCode, description, url, isMainFrame) => {
    if (!isMainFrame || url.endsWith('error.html')) return;
    win.loadFile(path.join(__dirname, 'error.html'));
  });

  win.loadURL(CLAUDE_HOME_URL);
  return win;
}

function buildMenu() {
  const template = [
    {
      label: 'Claude',
      submenu: [
        { role: 'reload', accelerator: 'CmdOrCtrl+R' },
        { role: 'quit', accelerator: 'CmdOrCtrl+Q' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'zoomIn', accelerator: 'CmdOrCtrl+=' },
        { role: 'zoomOut', accelerator: 'CmdOrCtrl+-' },
        { role: 'resetZoom', accelerator: 'CmdOrCtrl+0' },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

if (process.argv.includes('--version')) {
  console.log(`claudeonfedora ${app.getVersion()}`);
  app.exit(0);
} else {
  app.setPath('userData', path.join(app.getPath('appData'), 'claudeonfedora', 'electron'));

  app.commandLine.appendSwitch(
    'disable-features',
    'Translate,OptimizationGuideModelDownloading,OptimizationHintsFetching,OptimizationTargetPrediction'
  );

  app.enableSandbox();

  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) {
    app.quit();
  } else {
    app.on('second-instance', (event, argv) => {
      const windows = BrowserWindow.getAllWindows();
      if (argv.includes('--new-window') || windows.length === 0) {
        createWindow();
      } else {
        const win = windows[0];
        if (win.isMinimized()) win.restore();
        win.focus();
      }
    });

    app.whenReady().then(() => {
      buildMenu();

      session.defaultSession.on('will-download', (event, item) => {
        item.setSavePath(path.join(app.getPath('downloads'), item.getFilename()));
      });

      createWindow();
    });

    app.on('window-all-closed', () => {
      app.quit();
    });
  }
}

// Constants

const { app, BrowserWindow, ipcMain, Notification, BrowserView, screen } = require('electron');
const util = require('util');
const fs = require('fs');
const fsextra = require('fs-extra');
const readFile = util.promisify(fs.readFile);
const sleep = util.promisify(setTimeout);
const os = require('os');
const path = require('path');
const storage = require('electron-json-storage');
const getSettingsFromStorage = util.promisify(storage.get);
const setSettingInStorage = util.promisify(storage.set);

const glassHeight = 16;
const glassOutHeight = 120;
const glassWidthRatio = 0.9;
const defaultWidth = 1280;
const defaultHeight = 720;
const defaultSettingsSaveTimeout = 3000;
const defaultGlassCloseTimeout = 5000;
const defaultUserAgent = 'Mozilla/5.0 (Glass) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36';
const defaultLocations = [
  { url: 'https://www.netflix.com', icon: 'netflix' },
  { url: 'https://www.disneyplus.com', icon: 'disneyplus' },
  { url: 'https://www.primevideo.com', icon: 'primevideo' },
  { url: 'https://www.crunchyroll.com', icon: 'crunchyroll' },
  { url: 'https://www.youtube.com', icon: 'youtube' }
];
const defaultCloseButton = { enabled: true, location: 1, icon: 'close' };
const defaultMoveButton = { enabled: true, location: 2, icon: 'move' };
const defaultHideButton = { enabled: true, location: 3, icon: 'hide' };
const defaultMaximizeButton = { enabled: true, location: 4, icon: 'maximize' };
const defaultMinimizeButton = { enabled: true, location: 5, icon: 'minimize' };
const defaultAlwaysOnTopButton = { enabled: true, location: 6, icon: 'alwaysontop' };


// Global Variables

let configuration = { settings: undefined, locations: undefined, buttons: undefined, settingsTime: undefined };
let isGlassOut = false;
let glassX = undefined;
let glassWidth = undefined;
let glassView = undefined;

let settingsSaveTimer = undefined;
let closeGlassTimer = undefined;


// Main Initialization
async function glassInitialization() {

  configuration = await getConfiguration();
  glassX = Math.floor(configuration.settings.bounds.width * ((1 - glassWidthRatio) / 2));
  glassWidth = Math.floor(configuration.settings.bounds.width * glassWidthRatio);

  // Main Window
  const mainWindow = new BrowserWindow({
    x: configuration.settings.bounds.x,
    y: configuration.settings.bounds.y,
    width: configuration.settings.bounds.width,
    height: configuration.settings.bounds.height,
    icon: path.join(__dirname, 'resources', 'logo.ico'),
    frame: false,
    movable: true,
    resizable: true,
    alwaysOnTop: configuration.settings.isAlwaysOnTop,
    backgroundColor: '#212121',
    webPreferences: {
      preload: path.join(__dirname, 'default.preload.js'),
      sandbox: false,
    }
  });

  mainWindow.setFullScreen(configuration.settings.isMaximized);

  // Content View
  const contentView = new BrowserView({
    webPreferences: {
      preload: path.join(__dirname, 'content.preload.js'),
      backgroundColor: '#00000000',
      transparent: true,
      disableHtmlFullscreenWindowResize: true,
    },
    transparent: true
  });
  contentView.setAutoResize({ vertical: true, horizontal: true });
  contentView.setBounds({ x: 0, y: 0, width: 0, height: 0 });
  mainWindow.addBrowserView(contentView);

  // Glass View
  glassView = new BrowserView({
    webPreferences: {
      preload: path.join(__dirname, 'glass.preload.js'),
      sandbox: false,
      nodeIntegration: true,
      transparent: true,
      backgroundColor: '#00000000',
    },
    transparent: true
  });
  updateGlassSize();
  mainWindow.addBrowserView(glassView);


  // Event Handlers

  ipcMain.handle('get-configuration', async () => {
    return await getConfiguration();
  });

  ipcMain.handle('navigate', async (event, url) => {
    contentView.webContents.loadURL(url);
  })

  ipcMain.handle('on-loaded-content', () => {
    contentView.setBounds({ x: 0, y: 0, width: configuration.settings.bounds.width, height: configuration.settings.bounds.height });
  });

  ipcMain.handle('on-leaving', () => {
    contentView.setBounds({ x: 0, y: 0, width: 0, height: 0 });
  });

  ipcMain.handle('clicked-in', () => {
    glassView.webContents.send('close-glass');
  });

  ipcMain.handle('get-content-css', () => {
    return fs.readFileSync(path.join(__dirname, 'content.css'), 'utf8');
  });

  ipcMain.handle('close', () => {
    app.quit();
  });

  ipcMain.handle('toggle-maximize', () => {
    configuration.settings.isMaximized = !configuration.settings.isMaximized;
    mainWindow.setFullScreen(configuration.settings.isMaximized);
    saveSettings();
  });

  ipcMain.handle('minimize', () => {
    mainWindow.minimize();
  });

  ipcMain.handle('toggle-alwaysontop', () => {
    configuration.settings.isAlwaysOnTop = !configuration.settings.isAlwaysOnTop;
    mainWindow.setAlwaysOnTop(configuration.settings.isAlwaysOnTop);
    saveSettings();
  });

  ipcMain.handle('pop-out', () => {
    if (!isGlassOut) {
      toggleGlass();
    }
  });

  ipcMain.handle('pop-in', () => {
    if (isGlassOut) {
      toggleGlass();
    }
  });

  ipcMain.handle('hover-in', () => {
    clearGlassTimeout();
  });

  ipcMain.handle('hover-out', () => {
    glassTimeout();
  });


  mainWindow.addListener('resize', () => {
    configuration.settings.bounds = mainWindow.getBounds();
    glassX = Math.floor(configuration.settings.bounds.width * ((1 - glassWidthRatio) / 2));
    glassWidth = Math.floor(configuration.settings.bounds.width * glassWidthRatio);
    updateGlassSize();
    saveSettings();
  });

  mainWindow.addListener('moved', () => {
    configuration.settings.bounds = mainWindow.getBounds();
    saveSettings();
  });

  // Initial Loads
  mainWindow.loadFile(path.join(__dirname, 'default.html'));
  contentView.webContents.loadURL('https://www.crunchyroll.com', { userAgent: configuration.settings.userAgent });
  glassView.webContents.loadFile(path.join(__dirname, 'glass.html'));
};


// App Events

app.on('ready', glassInitialization);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    glassInitialization();
  }
});


// Helper Methods

async function getConfiguration() {

  // New Settings Check

  const settingsFilePath = path.join(storage.getDataPath(), 'settings.json');
  fsextra.ensureFileSync(settingsFilePath);

  const settingsStats = fs.statSync(settingsFilePath);
  if (configuration.settings && settingsStats && configuration.settingsTime === new Date(settingsStats.mtime))
    return configuration;

  let dirty = false;

  if (settingsStats.size < 2) {
    fs.writeFileSync(settingsFilePath, '{}', { encoding: 'utf8' })
  }

  configuration.settings = await getSettingsFromStorage('settings');
  configuration.settingsTime = new Date(settingsStats.mtime);

  // Settings Initialization

  const initialized = configuration.settings.initialized;
  if (!initialized) {
    configuration.settings.initialized = true;
    dirty = true;
    new Notification({
      title: 'Glass Initialized!',
      body: `Welcome to glass, ${os.userInfo().username}! You can change or add available locations and window configuration in the json settings file found at ${storage.getDataPath()}.`
    }).show();
  }

  if (!configuration.settings.bounds) {
    const displaySize = screen.getPrimaryDisplay().workAreaSize;
    configuration.settings.bounds = new Bounds(
      Math.floor((displaySize.width - Math.min(defaultWidth, displaySize.width)) / 2),
      Math.floor((displaySize.height - Math.min(defaultHeight, displaySize.height)) / 2),
      Math.min(defaultWidth, displaySize.width),
      Math.min(defaultHeight, displaySize.height));
    dirty = true;
  }

  if (!configuration.settings.isAlwaysOnTop) {
    configuration.settings.isAlwaysOnTop = false;
    dirty = true;
  }

  if (!configuration.settings.isMaximized) {
    configuration.settings.isMaximized = false;
    dirty = true;
  }

  if (!configuration.settings.settingsSaveTimeout) {
    configuration.settings.settingsSaveTimeout = defaultSettingsSaveTimeout;
    dirty = true;
  }

  if (!configuration.settings.glassCloseTimeout) {
    configuration.settings.glassCloseTimeout = defaultGlassCloseTimeout;
    dirty = true;
  }

  if (!configuration.settings.buttons) {
    configuration.settings.buttons = {};
    dirty = true;
  }

  if (!configuration.settings.buttons.close) {
    configuration.settings.buttons.close = defaultCloseButton;
    dirty = true;
  }

  if (!configuration.settings.buttons.move) {
    configuration.settings.buttons.move = defaultMoveButton;
    dirty = true;
  }

  if (!configuration.settings.buttons.hide) {
    configuration.settings.buttons.hide = defaultHideButton;
    dirty = true;
  }

  if (!configuration.settings.buttons.maximize) {
    configuration.settings.buttons.maximize = defaultMaximizeButton;
    dirty = true;
  }

  if (!configuration.settings.buttons.minimize) {
    configuration.settings.buttons.minimize = defaultMinimizeButton;
    dirty = true;
  }

  if (!configuration.settings.buttons.alwaysontop) {
    configuration.settings.buttons.alwaysontop = defaultAlwaysOnTopButton;
    dirty = true;
  }

  if (!configuration.settings.userAgent) {
    configuration.settings.userAgent = defaultUserAgent;
    dirty = true;
  }

  if (!configuration.settings.locations) {
    configuration.settings.locations = defaultLocations;
    dirty = true;
  }

  if (dirty) {
    saveSettings();
  }


  // Icon Processing

  configuration.locations = structuredClone(configuration.settings.locations);
  for (const location of configuration.locations) {
    if (isValidHttpUrl(location.icon)) {
      location.icon = await imageUrlToBase64String(location.icon);
    }
    else if (fs.existsSync(path.join(__dirname, 'resources', 'locations', `${location.icon}.png`))) {
      location.icon = await fileToBase64String(path.join(__dirname, 'resources', 'locations', `${location.icon}.png`));
    }
    else {
      location.icon = await fileToBase64String(path.join(__dirname, 'resources', 'locations', 'default.png'));
    }
  }

  configuration.buttons = structuredClone(configuration.settings.buttons);
  for (const buttonKey in configuration.buttons) {
    const button = configuration.buttons[buttonKey];
    if (isValidHttpUrl(button.icon)) {
      button.icon = await imageUrlToBase64String(button.icon);
    }
    else if (fs.existsSync(path.join(__dirname, 'resources', 'buttons', `${button.icon}.svg`))) {
      button.icon = await readFile(path.join(__dirname, 'resources', 'buttons', `${button.icon}.svg`), 'utf8');
    }
    else {
      button.enabled = false;
    }
  }

  return configuration;
}

function saveSettings() {
  if (settingsSaveTimer) {
    clearTimeout(settingsSaveTimer);
  }

  settingsSaveTimer = setTimeout(async () => {
    await setSettingInStorage('settings', configuration.settings, { prettyPrinting: true });
    const settingsStats = fs.statSync(path.join(storage.getDataPath(), 'settings.json'));
    configuration.settingsTime = new Date(settingsStats.mtime);
  }, configuration.settings.settingsSaveTimeout);
}

function clearGlassTimeout() {
  if (closeGlassTimer) {
    clearTimeout(closeGlassTimer);
  }
}

function glassTimeout() {
  clearGlassTimeout();

  closeGlassTimer = setTimeout(async () => {
    if (isGlassOut) {
      glassView.webContents.send('close-glass');
      await sleep(125);
      toggleGlass();
    }
  }, configuration.settings.glassCloseTimeout);
}

function toggleGlass() {
  isGlassOut = !isGlassOut;
  updateGlassSize();
}

function updateGlassSize() {
  isGlassOut ?
    glassView.setBounds({ x: glassX, y: 0, width: glassWidth, height: glassOutHeight }) :
    glassView.setBounds({ x: glassX, y: 0, width: glassWidth, height: glassHeight });
}

async function imageUrlToBase64String(url) {
  try {
    const response = await fetch(url);
    const blob = await response.arrayBuffer();
    const contentType = response.headers.get('content-type');
    const base64String = `data:${contentType};base64,${Buffer.from(
      blob,
    ).toString('base64')}`;

    return base64String;
  } catch (err) {
    console.log(err);
  }
}

async function fileToBase64String(filePath) {
  try {
    const result = await readFile(filePath, {
      encoding: 'base64',
    });

    return 'data:image/png;base64,' + result;
  } catch (err) {
    console.log(err);
  }
}

function isValidHttpUrl(string) {
  let url;

  try {
    url = new URL(string);
  } catch (_) {
    return false;
  }

  return url.protocol === 'http:' || url.protocol === 'https:';
}

class Bounds {
  x = 0;
  y = 0;
  width = 0;
  height = 0;

  constructor(x, y, width, height) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
  }
}
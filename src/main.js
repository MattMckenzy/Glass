const { app, BrowserWindow, ipcMain, Notification } = require('electron');
const util = require('util');
const fs = require('fs');
const readFile = util.promisify(fs.readFile);
const os = require('os');
const path = require('path');
const storage = require('electron-json-storage');
const getSettings = util.promisify(storage.get);
const setSetting = util.promisify(storage.set);

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

async function createWindow() {
  const mainWindow = new BrowserWindow({
    height: 720,
    width: 1280,
    icon: path.join(__dirname, 'resources', 'logo.ico'),
    frame: false,
    fullscreenable: false,
    movable: true,
    resizable: true,
    backgroundColor: '#212121',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      sandbox: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'default.html'))

  let settings = await refreshSettings();

  const glassBarID = `glass-${randomId(12)}`;

  ipcMain.handle('refresh-settings', async () => {
    settings = await refreshSettings();
  });

  ipcMain.handle('get-show-dragger', async () => {
    return settings.showDragger;
  });

  ipcMain.handle('get-show-close-button', async (name) => {
    return settings.showCloseButton;
  });

  ipcMain.handle('get-locations', async () => {
    return settings.locations;
  });

  ipcMain.handle('get-id', async () => {
    return glassBarID;
  });

  ipcMain.handle('get-html', async () => {
    return fs.readFileSync(path.join(__dirname, 'glass.html'), 'utf8').replaceAll('glass-bar', glassBarID);
  });

  ipcMain.handle('get-css', async () => {
    return fs.readFileSync(path.join(__dirname, 'glass.css'), 'utf8').replaceAll('glass-bar', glassBarID);
  });

  mainWindow.webContents.loadURL('https://www.crunchyroll.com');
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.

function randomId(length = 6) {
  return Math.random().toString(36).substring(2, length + 2);
};

async function refreshSettings() {
  const settings = await getSettings('settings');
  const initialized = settings.initialized;
  if (!initialized) {
    settings.initialized = true;
    settings.showDragger = true;
    settings.showCloseButton = true;
    settings.locations = [
      { url: 'netflix.com', icon: 'netflix' },
      { url: 'disneyplus.com', icon: 'disneyplus' },
      { url: 'primevideo.com', icon: 'primevideo' },
      { url: 'crunchyroll.com', icon: 'crunchyroll' },
      { url: 'youtube.com', icon: 'youtube' }
    ];
    await setSetting('settings', settings, { prettyPrinting: true });

    new Notification({
      title: 'Glass Initialized!',
      body: `Welcome to glass, ${os.userInfo().username}! You can change or add available locations in the json settings file found at ${storage.getDataPath()}.`
    }).show();
  }

  for (const location of settings.locations) {
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

  return settings;
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
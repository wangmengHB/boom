import { app, screen, BrowserWindow, ipcMain } from 'electron';
const http = require('http');
const path = require('path');
const url = require('url');
const fs = require('fs');
const ms = require('mediaserver');
import menu from './menu';
import store from './store';
import constant from '../constant';

if (process.env.NODE_ENV !== 'development') {
  global.__static = require('path')
    .join(__dirname, '/static')
    .replace(/\\/g, '\\\\');
}

let mainWindow;
const winURL =
  process.env.NODE_ENV === 'development'
    ? 'http://localhost:9080'
    : `file://${__dirname}/index.html`;

ms.mediaTypes['.flac'] = 'audio/flac';
const allowKeys = [];
// collect audio's extname
Object.keys(ms.mediaTypes).forEach(ext => {
  if (ms.mediaTypes[ext].indexOf('audio') === 0) {
    allowKeys.push(ext);
  }
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: constant.WIN_WIDTH,
    height: constant.WIN_HEIGHT,
    useContentSize: true,
    titleBarStyle: 'hidden-inset',
    frame: false,
    transparent: true,
  });

  startMusicServer(port => {
    ipcMain.on(constant.VIEW_READY, event => {
      event.sender.send(
        constant.INIT_CONFIG,
        Object.assign(store.config, {
          port,
          allowKeys,
        })
      );
    });

    ipcMain.on(constant.SAVE_CONFIG, (event, { key, value }) => {
      store.set(key, value);
    });

    mainWindow.loadURL(winURL);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  menu(mainWindow);
}

function startMusicServer(callback) {
  const server = http.createServer(pipeMusic).listen(0, () => {
    callback(server.address().port);
  });

  return server;
}

function pipeMusic(req, res) {
  const musicUrl = decodeURIComponent(req.url);
  const extname = path.extname(musicUrl);
  if (allowKeys.indexOf(extname) < 0) {
    return notFound(res);
  }

  const fileUrl = path.join(
    store.get(constant.MUSIC_PATH),
    musicUrl.substring(1)
  );

  if (!fs.existsSync(fileUrl)) {
    return notFound(res);
  }

  ms.pipe(req, res, fileUrl);
}

function notFound(res) {
  res.writeHead(404);
  res.end('not found');
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

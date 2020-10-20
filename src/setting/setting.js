const {
  BrowserWindow, app, ipcMain
} = require('electron')
const path = require('path')
const http = require('http')
const discover = require('../discover/discover')
let capture
if (!global.linux) {
  capture = require('../capture/capture')
}

let window, server
const port = 2001

function createWindow() {
  if (window) {
    return window
  }
  window = new BrowserWindow({
    show: false,
    width: 940,
    height: 600,
    resizable: false,
    webPreferences: {
      nodeIntegration: true
    }
  })
  window.loadFile(path.resolve(__dirname, 'index.html'))
  // keep window alive to prevent default quit main process
  window.on('close', (event) => {
    event.preventDefault()
    window.hide()
  })
  window.webContents.on('did-finish-load', () => {
    window.webContents.send('devices', { devices: global.device.remotes, thisDevice: global.device.local })
    discover.event.on('discover', ({ devices, newDevice, thisDevice }) => {
      window.webContents.send('devices', { devices, thisDevice })
    })
  })
  ipcMain.on('device.connect', (event, { remoteIP, position }) => {
    // console.log( remoteIP, position)
    const remoteDevice = global.device.remotes.find(item => item.if === remoteIP)
    if (remoteDevice) {
      global.device.remote = remoteDevice
      
      capture.setConnectionPeer(global.device.remote.if, position)
      capture.startCapture()
    }
  })
  ipcMain.on('device.disconnect', (event, { remoteIP, position }) => {
    const remoteDevice = global.device.remotes.find(item => item.if === remoteIP)
    if (remoteDevice) {
      global.device.remote = null

      capture.setConnectionPeer(null, null)
      capture.closeCapture()
    }
  })
  // window.webContents.openDevTools()
}
function show() {
  if (!window) {
    createWindow()
  }
  window.show()
}
function startServer() {
  if (!server) {
    server = http.createServer((req, res) => {
      const urlObj = new URL('http://localhost' + req.url)
      if (urlObj.pathname === '/connection') {
        const position = urlObj.searchParams.get('position')
        const ip = req.socket.remoteAddress
        const remoteDeviceFound = global.device.remotes.find(dev => dev.if === ip)
        if (!remoteDeviceFound) {
          res.statusCode = 404
          res.end()
        }
        switch(req.method.toLowerCase()) {
          case 'post': 
            global.device.remote = remoteDeviceFound
            // capture.setConnectionPeer(global.device.remote.if)
            // capture.startCapture(position) // left or right
            res.statusCode = 201
            res.end()
            break
          case 'delete': 
            if (global.device.remote === remoteDeviceFound) {
              global.device.remote = null
              // capture.setConnectionPeer(null)
              // capture.startCapture(null)
            }
            res.statusCode = 200
            res.end()
            break
          default: res.end('settings http server respond')
        }
      } else {
        res.statusCode = 404
        res.end()
      }
    })
    server.listen(port, '0.0.0.0', () => {
      console.log('setting server started')
    })
  }
}

module.exports = {
  show,
  startServer
}
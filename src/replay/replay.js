const dgram = require('dgram')
const server = dgram.createSocket('udp4')
const inputAuto = require('node-addon-keyboard-auto')

const port = 8888
const address = '0.0.0.0'

server.on('message', (msg, rinfo) => {
  msg = JSON.parse(msg)
  // console.log(msg)
  switch(msg.type) {
    case 'mousemove': 
      inputAuto.mousemove(msg.x, msg.y)
      break
    case 'mousedown': 
      inputAuto.mousedown(msg.button)
      break
    case 'mouseup': 
      inputAuto.mouseup(msg.button)
      break
    case 'mousewheel': 
      if (global.linux) {
        inputAuto.mousewheel(msg.direction / -Math.abs(msg.direction))
      } else {
        inputAuto.mousewheel(msg.direction)
      }
      break
    case 'mousewheel': 
      if (global.linux) {
        inputAuto.mousewheel(msg.direction / -Math.abs(msg.direction))
      } else {
        inputAuto.mousewheel(msg.direction)
      }
      break
    case 'keydown': 
      inputAuto.keydown(msg.char)
      break
    case 'keyup': 
      inputAuto.keyup(msg.char)
      break
  }
})


module.exports = {
  start() {
    return new Promise((resolve, reject) => {
      server.bind(port, address, () => {
        resolve()
        console.log('server started!!')
      })
    })
  }
}
const dgram = require('dgram')
const os = require('os')
const {screen} = require('electron')
const si = require('systeminformation')
const EventEmitter = require('events')
const {Device} = require('./Device')

const addresses = {}
let devices = []
const PORT = 8889, IP = '224.0.0.114'
let discoverTimer
class SignalConnection extends EventEmitter {
    constructor() {
        super()
        this.server = dgram.createSocket('udp4')
        const interfaces = os.networkInterfaces()
        for (const name in interfaces) {
            interfaces[name].forEach(item => {
                if (item.family == 'IPv4' && item.address != '127.0.0.1') {
                    // console.log(name, item.address)
                    addresses[item.address] = item.mac
                }
            })
        }
        console.log(addresses)
        return this
    }
    async _getDeviceInfo() {
        const screenSize = screen.getPrimaryDisplay().size
        return new Device({
            type: (await si.chassis()).type.toLowerCase(), 
            name: os.hostname(),//'联想E49', 
            os: (await si.osInfo()).distro,// 'Linux Ubuntu x64', 
            resolution: `${screenSize.width}x${screenSize.height}`,//'1366x768', 
            IP: ''// 接收方补充 '192.168.1.8'
        })
    }
    start() {
        this.server.on('error', err => {
            console.log(`igmp server error: ${err}`)
            this.server.close()
            this.server = null
        })
        this.server.on('message', async (msg, rinfo) => {
            console.log(msg.toString(), 'from ip:', rinfo.address)
            if (false || !(rinfo.address in addresses)) {
                const msgObj = JSON.parse(msg.toString())
                switch (msgObj.cmd) {
                    case 'discover':
                        // 收到设备发现请求
                        const deviceInfo = await this._getDeviceInfo()
                        deviceInfo.cmd = 'discover.reply'
                        this._send(deviceInfo, rinfo.address)
                    break
                    case 'discover.reply':
                        // if (devices.findIndex(dev => rinfo.address == dev.IP) < 0) {
                            delete msgObj.cmd
                            msgObj.IP = rinfo.address
                            devices.push(msgObj)
                            // console.log(devices)
                            clearTimeout(discoverTimer)
                            discoverTimer = setTimeout(() => {
                                clearTimeout(discoverTimer)
                                this.emit('devices.update', {devices})
                            }, 1000)
                        // }
                    break
                    case 'downstream.add':
                        console.log(msgObj.deviceIP)
                        if (msgObj.deviceIP in addresses) { // 本设备被对方添加为下级节点
                            msgObj.upstreamDevice.IP = rinfo.address
                            this.emit('upstream.set', {device: msgObj.upstreamDevice})
                            // this.emit('upstream.set', {device: devices.find(dev => dev.IP == rinfo.address)})
                            console.log(1111)
                        }
                    break
                    case 'downstream.wakeup':
                        msgObj.device.IP = ''
                        if ((await this._getDeviceInfo()).equals(new Device(msgObj.device))) {
                            this.emit('connection.restore', {upstreamIP: rinfo.address})
                        }
                    break
                }
            }
        })
        this.server.on('listening', () => {
            const address = this.server.address()
            console.log(`igmp server listening ${address.address}:${address.port}`)
        })
        this.server.bind(PORT, '0.0.0.0', () => {
            // 监听其他设备发送的设备发现请求
            // console.log(Object.keys(addresses))
            Object.keys(addresses).forEach(ip => this.server.addMembership(IP, ip))
            // this.server.addMembership(IP, '192.168.1.5')
        })
        return this
    }
    _send(obj, ip = IP) {
        const buf = Buffer.from(JSON.stringify(obj))
        this.server.send(buf, 0, buf.length, PORT, ip)
    }
    discover() {
        // 可能会受到ssr影响，需要暂时取消代理
        this._send({cmd: 'discover'})
        devices = []
        return this
    }
    async addDownstream(downstreamDevice) {
        this._send({cmd: 'downstream.add', deviceIP: downstreamDevice.IP, upstreamDevice: await this._getDeviceInfo()}, downstreamDevice.IP)
    }
    wakeupDownstream(downstreamDevice) {
        this._send({cmd: 'downstream.wakeup', device: downstreamDevice}, downstreamDevice.IP)
    }
}
class Signal {
    static getInstance() {
        if (!Signal.connection) {
            Signal.connection = new SignalConnection()
        }
        return Signal.connection
    }
}
Signal.connection


module.exports = {
    Signal
}
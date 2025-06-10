// app.js
App({
  globalData: {
    userInfo: null,
    openid: null,
    gameRoom: null,
    socketTask: null,
    isConnected: false
  },

  onLaunch() {
    // 初始化云开发
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
    } else {
      wx.cloud.init({
        env: 'bomb-game-env', // 云开发环境ID
        traceUser: true,
      })
    }

    // 获取用户信息
    this.getUserInfo()
    
    // 获取用户openid
    this.getOpenId()
  },

  // 获取用户信息
  getUserInfo() {
    wx.getUserProfile({
      desc: '用于完善游戏资料',
      success: (res) => {
        this.globalData.userInfo = res.userInfo
        console.log('用户信息获取成功', res.userInfo)
      },
      fail: (err) => {
        console.log('用户信息获取失败', err)
      }
    })
  },

  // 获取用户openid
  getOpenId() {
    wx.cloud.callFunction({
      name: 'getOpenId',
      success: (res) => {
        this.globalData.openid = res.result.openid
        console.log('OpenID获取成功', res.result.openid)
      },
      fail: (err) => {
        console.error('OpenID获取失败', err)
      }
    })
  },

  // 创建WebSocket连接
  connectWebSocket(roomId) {
    if (this.globalData.socketTask) {
      this.globalData.socketTask.close()
    }

    this.globalData.socketTask = wx.connectSocket({
      url: `wss://your-websocket-url.com/game/${roomId}`,
      header: {
        'content-type': 'application/json'
      },
      success: () => {
        console.log('WebSocket连接成功')
      },
      fail: (err) => {
        console.error('WebSocket连接失败', err)
      }
    })

    this.globalData.socketTask.onOpen(() => {
      this.globalData.isConnected = true
      console.log('WebSocket连接已打开')
      
      // 发送用户信息
      this.sendMessage({
        type: 'join',
        data: {
          openid: this.globalData.openid,
          userInfo: this.globalData.userInfo,
          roomId: roomId
        }
      })
    })

    this.globalData.socketTask.onMessage((res) => {
      const message = JSON.parse(res.data)
      this.handleWebSocketMessage(message)
    })

    this.globalData.socketTask.onClose(() => {
      this.globalData.isConnected = false
      console.log('WebSocket连接已关闭')
    })

    this.globalData.socketTask.onError((err) => {
      console.error('WebSocket连接错误', err)
    })
  },

  // 发送WebSocket消息
  sendMessage(message) {
    if (this.globalData.socketTask && this.globalData.isConnected) {
      this.globalData.socketTask.send({
        data: JSON.stringify(message)
      })
    }
  },

  // 处理WebSocket消息
  handleWebSocketMessage(message) {
    const pages = getCurrentPages()
    const currentPage = pages[pages.length - 1]
    
    if (currentPage && currentPage.onWebSocketMessage) {
      currentPage.onWebSocketMessage(message)
    }
  },

  // 关闭WebSocket连接
  closeWebSocket() {
    if (this.globalData.socketTask) {
      this.globalData.socketTask.close()
      this.globalData.socketTask = null
      this.globalData.isConnected = false
    }
  }
})

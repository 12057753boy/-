// pages/game/game.js
const app = getApp()

Page({
  data: {
    roomId: '',
    gameId: '',
    gameState: 'setup', // setup, playing, finished
    currentPhase: 'bomb_setup', // bomb_setup, game_play, result
    currentPlayer: '',
    isMyTurn: false,
    
    // 游戏网格 5x4 = 20个格子
    gridData: [],
    selectedCell: null,
    myBombPosition: null,
    opponentBombPosition: null,
    
    // 计时器
    timeLeft: 60,
    timerInterval: null,
    
    // 玩家信息
    players: [],
    myInfo: null,
    opponentInfo: null,
    
    // 游戏状态
    gameResult: null, // win, lose, draw
    showConfirmButton: false,
    showExplosion: false,
    explosionPosition: null,
    
    // UI状态
    showResultModal: false,
    resultActions: {
      restart: false,
      exit: false
    }
  },

  onLoad(options) {
    const { roomId, gameId } = options
    this.setData({
      roomId: roomId,
      gameId: gameId
    })

    // 初始化游戏网格
    this.initGrid()
    
    // 获取游戏信息
    this.getGameInfo()
    
    // 开始设置阶段计时器
    this.startTimer(60)
  },

  onUnload() {
    this.clearTimer()
    app.closeWebSocket()
  },

  // 处理WebSocket消息
  onWebSocketMessage(message) {
    console.log('游戏页面收到消息:', message)
    
    switch (message.type) {
      case 'gameUpdate':
        this.handleGameUpdate(message.data)
        break
      case 'playerMove':
        this.handlePlayerMove(message.data)
        break
      case 'gameResult':
        this.handleGameResult(message.data)
        break
      case 'bombExploded':
        this.handleBombExploded(message.data)
        break
      case 'phaseChange':
        this.handlePhaseChange(message.data)
        break
      case 'restartRequest':
        this.handleRestartRequest(message.data)
        break
    }
  },

  // 初始化游戏网格
  initGrid() {
    const grid = []
    for (let i = 0; i < 20; i++) {
      grid.push({
        id: i,
        row: Math.floor(i / 4),
        col: i % 4,
        status: 'empty', // empty, selected, bomb, exploded
        clickedBy: null,
        emoji: ''
      })
    }
    this.setData({ gridData: grid })
  },

  // 获取游戏信息
  getGameInfo() {
    wx.cloud.callFunction({
      name: 'gameLogic',
      data: {
        action: 'getGameInfo',
        gameId: this.data.gameId
      },
      success: (res) => {
        if (res.result.success) {
          const gameInfo = res.result.game
          this.setData({
            players: gameInfo.players,
            currentPlayer: gameInfo.currentPlayer,
            gameState: gameInfo.state,
            currentPhase: gameInfo.phase
          })
          
          // 设置我的信息和对手信息
          this.setPlayerInfo()
          
          // 检查是否是我的回合
          this.checkMyTurn()
        }
      },
      fail: (err) => {
        console.error('获取游戏信息失败', err)
      }
    })
  },

  // 设置玩家信息
  setPlayerInfo() {
    const myOpenId = app.globalData.openid
    const players = this.data.players
    
    const myInfo = players.find(p => p.openid === myOpenId)
    const opponentInfo = players.find(p => p.openid !== myOpenId)
    
    this.setData({
      myInfo: myInfo,
      opponentInfo: opponentInfo
    })
  },

  // 检查是否是我的回合
  checkMyTurn() {
    const isMyTurn = this.data.currentPlayer === app.globalData.openid
    this.setData({ isMyTurn: isMyTurn })
  },

  // 点击网格
  onCellTap(e) {
    const cellId = e.currentTarget.dataset.id
    const cell = this.data.gridData[cellId]
    
    if (this.data.currentPhase === 'bomb_setup') {
      this.selectBombPosition(cellId)
    } else if (this.data.currentPhase === 'game_play') {
      this.selectGameCell(cellId)
    }
  },

  // 选择炸弹位置（设置阶段）
  selectBombPosition(cellId) {
    if (this.data.myBombPosition !== null) {
      wx.showToast({
        title: '已经选择了炸弹位置',
        icon: 'none'
      })
      return
    }

    const gridData = [...this.data.gridData]
    
    // 清除之前的选择
    gridData.forEach(cell => {
      if (cell.status === 'selected') {
        cell.status = 'empty'
        cell.emoji = ''
      }
    })
    
    // 设置新的选择
    gridData[cellId].status = 'selected'
    gridData[cellId].emoji = '💣'
    
    this.setData({
      gridData: gridData,
      myBombPosition: cellId,
      showConfirmButton: true
    })
  },

  // 选择游戏格子（游戏阶段）
  selectGameCell(cellId) {
    if (!this.data.isMyTurn) {
      wx.showToast({
        title: '不是你的回合',
        icon: 'none'
      })
      return
    }

    const cell = this.data.gridData[cellId]
    if (cell.clickedBy !== null) {
      wx.showToast({
        title: '这个格子已经被选择过了',
        icon: 'none'
      })
      return
    }

    this.setData({
      selectedCell: cellId,
      showConfirmButton: true
    })
  },

  // 确认选择
  confirmSelection() {
    if (this.data.currentPhase === 'bomb_setup') {
      this.confirmBombPosition()
    } else if (this.data.currentPhase === 'game_play') {
      this.confirmGameMove()
    }
  },

  // 确认炸弹位置
  confirmBombPosition() {
    if (this.data.myBombPosition === null) return

    app.sendMessage({
      type: 'setBombPosition',
      data: {
        gameId: this.data.gameId,
        position: this.data.myBombPosition
      }
    })

    this.setData({
      showConfirmButton: false
    })

    wx.showToast({
      title: '炸弹位置已设置',
      icon: 'success'
    })
  },

  // 确认游戏移动
  confirmGameMove() {
    if (this.data.selectedCell === null) return

    app.sendMessage({
      type: 'makeMove',
      data: {
        gameId: this.data.gameId,
        position: this.data.selectedCell
      }
    })

    // 更新网格显示
    const gridData = [...this.data.gridData]
    gridData[this.data.selectedCell].clickedBy = app.globalData.openid
    gridData[this.data.selectedCell].emoji = this.getPlayerEmoji()
    
    this.setData({
      gridData: gridData,
      selectedCell: null,
      showConfirmButton: false,
      isMyTurn: false
    })
  },

  // 获取玩家表情
  getPlayerEmoji() {
    // 可以根据玩家信息返回不同的表情
    const emojis = ['🔥', '⚡', '🌟', '💎', '🎯', '🚀']
    return emojis[Math.floor(Math.random() * emojis.length)]
  },

  // 开始计时器
  startTimer(seconds) {
    this.clearTimer()
    this.setData({ timeLeft: seconds })
    
    this.data.timerInterval = setInterval(() => {
      const newTime = this.data.timeLeft - 1
      this.setData({ timeLeft: newTime })
      
      if (newTime <= 0) {
        this.clearTimer()
        this.handleTimeUp()
      }
    }, 1000)
  },

  // 清除计时器
  clearTimer() {
    if (this.data.timerInterval) {
      clearInterval(this.data.timerInterval)
      this.data.timerInterval = null
    }
  },

  // 时间到
  handleTimeUp() {
    if (this.data.currentPhase === 'bomb_setup' && this.data.myBombPosition === null) {
      // 随机选择炸弹位置
      const availableCells = this.data.gridData.filter(cell => cell.status === 'empty')
      const randomCell = availableCells[Math.floor(Math.random() * availableCells.length)]
      this.selectBombPosition(randomCell.id)
      this.confirmBombPosition()
    } else if (this.data.currentPhase === 'game_play' && this.data.isMyTurn) {
      // 随机选择一个格子
      const availableCells = this.data.gridData.filter(cell => cell.clickedBy === null)
      if (availableCells.length > 0) {
        const randomCell = availableCells[Math.floor(Math.random() * availableCells.length)]
        this.setData({ selectedCell: randomCell.id })
        this.confirmGameMove()
      }
    }
  },

  // 处理游戏更新
  handleGameUpdate(data) {
    this.setData({
      gameState: data.state,
      currentPhase: data.phase,
      currentPlayer: data.currentPlayer
    })

    this.checkMyTurn()

    if (data.phase === 'game_play') {
      this.startTimer(90)
    }
  },

  // 处理玩家移动
  handlePlayerMove(data) {
    const gridData = [...this.data.gridData]
    gridData[data.position].clickedBy = data.player
    gridData[data.position].emoji = data.emoji

    this.setData({
      gridData: gridData,
      currentPlayer: data.nextPlayer
    })

    this.checkMyTurn()
    this.startTimer(90)
  },

  // 处理炸弹爆炸
  handleBombExploded(data) {
    this.setData({
      showExplosion: true,
      explosionPosition: data.position,
      gameResult: data.winner === app.globalData.openid ? 'win' : 'lose'
    })

    // 显示爆炸特效
    setTimeout(() => {
      this.setData({
        showExplosion: false,
        showResultModal: true
      })
      this.startResultTimer()
    }, 2000)
  },

  // 处理游戏结果
  handleGameResult(data) {
    this.setData({
      gameResult: data.result,
      showResultModal: true
    })

    this.startResultTimer()
  },

  // 处理阶段变化
  handlePhaseChange(data) {
    this.setData({
      currentPhase: data.phase
    })

    if (data.phase === 'game_play') {
      this.startTimer(90)
    } else if (data.phase === 'result') {
      this.startResultTimer()
    }
  },

  // 开始结果阶段计时器
  startResultTimer() {
    this.clearTimer()
    this.startTimer(60)
  },

  // 处理重新开始请求
  handleRestartRequest(data) {
    wx.showModal({
      title: '重新开始',
      content: `${data.playerName} 想要重新开始游戏，是否同意？`,
      success: (res) => {
        if (res.confirm) {
          app.sendMessage({
            type: 'restartResponse',
            data: {
              gameId: this.data.gameId,
              agree: true
            }
          })
        } else {
          app.sendMessage({
            type: 'restartResponse',
            data: {
              gameId: this.data.gameId,
              agree: false
            }
          })
        }
      }
    })
  },

  // 重新开始游戏
  restartGame() {
    app.sendMessage({
      type: 'requestRestart',
      data: {
        gameId: this.data.gameId
      }
    })
  },

  // 退出游戏
  exitGame() {
    wx.showModal({
      title: '确认退出',
      content: '确定要退出游戏吗？',
      success: (res) => {
        if (res.confirm) {
          app.sendMessage({
            type: 'exitGame',
            data: {
              gameId: this.data.gameId
            }
          })

          wx.navigateBack()
        }
      }
    })
  },

  // 关闭结果弹窗
  closeResultModal() {
    this.setData({
      showResultModal: false
    })
  }
})

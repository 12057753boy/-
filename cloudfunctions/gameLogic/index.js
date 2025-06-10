// cloudfunctions/gameLogic/index.js
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

// 生成游戏ID
function generateGameId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2)
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { action } = event

  try {
    switch (action) {
      case 'createGame':
        return await createGame(event, wxContext)
      case 'getGameInfo':
        return await getGameInfo(event, wxContext)
      case 'setBombPosition':
        return await setBombPosition(event, wxContext)
      case 'makeMove':
        return await makeMove(event, wxContext)
      case 'endGame':
        return await endGame(event, wxContext)
      default:
        return { success: false, message: '未知操作' }
    }
  } catch (error) {
    console.error('游戏逻辑云函数错误:', error)
    return { success: false, message: '服务器错误' }
  }
}

// 创建游戏
async function createGame(event, wxContext) {
  const { roomId, players } = event
  const gameId = generateGameId()
  
  const gameData = {
    gameId: gameId,
    roomId: roomId,
    players: players.map(player => ({
      ...player,
      bombPosition: null,
      moves: [],
      isReady: false
    })),
    state: 'setup', // setup, playing, finished
    phase: 'bomb_setup', // bomb_setup, game_play, result
    currentPlayer: players[Math.floor(Math.random() * players.length)].openid,
    winner: null,
    grid: Array(20).fill(null).map((_, index) => ({
      id: index,
      row: Math.floor(index / 4),
      col: index % 4,
      clickedBy: null,
      hasBomb: false
    })),
    createTime: new Date(),
    updateTime: new Date()
  }

  await db.collection('games').add({
    data: gameData
  })

  return {
    success: true,
    gameId: gameId,
    game: gameData
  }
}

// 获取游戏信息
async function getGameInfo(event, wxContext) {
  const { gameId } = event
  
  const gameResult = await db.collection('games')
    .where({ gameId: gameId })
    .get()
  
  if (gameResult.data.length === 0) {
    return { success: false, message: '游戏不存在' }
  }
  
  return {
    success: true,
    game: gameResult.data[0]
  }
}

// 设置炸弹位置
async function setBombPosition(event, wxContext) {
  const { gameId, position } = event
  
  const gameResult = await db.collection('games')
    .where({ gameId: gameId })
    .get()
  
  if (gameResult.data.length === 0) {
    return { success: false, message: '游戏不存在' }
  }
  
  const game = gameResult.data[0]
  
  // 检查游戏状态
  if (game.phase !== 'bomb_setup') {
    return { success: false, message: '不在炸弹设置阶段' }
  }
  
  // 更新玩家炸弹位置
  const updatedPlayers = game.players.map(player => {
    if (player.openid === wxContext.OPENID) {
      return { ...player, bombPosition: position, isReady: true }
    }
    return player
  })
  
  // 更新网格
  const updatedGrid = game.grid.map(cell => {
    if (cell.id === position) {
      return { ...cell, hasBomb: true }
    }
    return cell
  })
  
  // 检查是否所有玩家都设置了炸弹
  const allReady = updatedPlayers.every(player => player.isReady)
  const newPhase = allReady ? 'game_play' : 'bomb_setup'
  const newState = allReady ? 'playing' : 'setup'
  
  await db.collection('games')
    .doc(game._id)
    .update({
      data: {
        players: updatedPlayers,
        grid: updatedGrid,
        phase: newPhase,
        state: newState,
        updateTime: new Date()
      }
    })
  
  return {
    success: true,
    phase: newPhase,
    allReady: allReady
  }
}

// 执行移动
async function makeMove(event, wxContext) {
  const { gameId, position } = event
  
  const gameResult = await db.collection('games')
    .where({ gameId: gameId })
    .get()
  
  if (gameResult.data.length === 0) {
    return { success: false, message: '游戏不存在' }
  }
  
  const game = gameResult.data[0]
  
  // 检查游戏状态
  if (game.phase !== 'game_play') {
    return { success: false, message: '不在游戏阶段' }
  }
  
  // 检查是否是当前玩家的回合
  if (game.currentPlayer !== wxContext.OPENID) {
    return { success: false, message: '不是您的回合' }
  }
  
  // 检查位置是否已被点击
  const cell = game.grid[position]
  if (cell.clickedBy !== null) {
    return { success: false, message: '该位置已被选择' }
  }
  
  // 更新网格
  const updatedGrid = game.grid.map(gridCell => {
    if (gridCell.id === position) {
      return { ...gridCell, clickedBy: wxContext.OPENID }
    }
    return gridCell
  })
  
  // 检查是否点中炸弹
  const hitBomb = cell.hasBomb
  let winner = null
  let newPhase = 'game_play'
  let newState = 'playing'
  
  if (hitBomb) {
    // 找到炸弹的主人（输家）
    const bombOwner = game.players.find(player => player.bombPosition === position)
    winner = bombOwner ? bombOwner.openid : null
    
    // 如果点中的是对方的炸弹，当前玩家获胜
    if (winner !== wxContext.OPENID) {
      winner = wxContext.OPENID
    }
    
    newPhase = 'result'
    newState = 'finished'
  }
  
  // 切换到下一个玩家
  const currentPlayerIndex = game.players.findIndex(p => p.openid === wxContext.OPENID)
  const nextPlayerIndex = (currentPlayerIndex + 1) % game.players.length
  const nextPlayer = game.players[nextPlayerIndex].openid
  
  await db.collection('games')
    .doc(game._id)
    .update({
      data: {
        grid: updatedGrid,
        currentPlayer: hitBomb ? game.currentPlayer : nextPlayer,
        winner: winner,
        phase: newPhase,
        state: newState,
        updateTime: new Date()
      }
    })
  
  return {
    success: true,
    hitBomb: hitBomb,
    winner: winner,
    nextPlayer: hitBomb ? game.currentPlayer : nextPlayer,
    phase: newPhase
  }
}

// 结束游戏
async function endGame(event, wxContext) {
  const { gameId, winner } = event
  
  await db.collection('games')
    .where({ gameId: gameId })
    .update({
      data: {
        state: 'finished',
        phase: 'result',
        winner: winner,
        endTime: new Date(),
        updateTime: new Date()
      }
    })
  
  return { success: true }
}

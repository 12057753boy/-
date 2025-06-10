// cloudfunctions/gameRoom/index.js
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

// 生成房间ID
function generateRoomId() {
  return Math.random().toString(36).substr(2, 6).toUpperCase()
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { action } = event

  try {
    switch (action) {
      case 'create':
        return await createRoom(event, wxContext)
      case 'join':
        return await joinRoom(event, wxContext)
      case 'getRoomInfo':
        return await getRoomInfo(event, wxContext)
      case 'leaveRoom':
        return await leaveRoom(event, wxContext)
      default:
        return { success: false, message: '未知操作' }
    }
  } catch (error) {
    console.error('云函数执行错误:', error)
    return { success: false, message: '服务器错误' }
  }
}

// 创建房间
async function createRoom(event, wxContext) {
  const { userInfo } = event
  const roomId = generateRoomId()
  
  const roomData = {
    roomId: roomId,
    hostOpenId: wxContext.OPENID,
    players: [{
      openid: wxContext.OPENID,
      nickName: userInfo.nickName,
      avatarUrl: userInfo.avatarUrl,
      isHost: true,
      isReady: false,
      joinTime: new Date()
    }],
    status: 'waiting', // waiting, playing, finished
    maxPlayers: 2,
    createTime: new Date(),
    updateTime: new Date()
  }

  const result = await db.collection('gameRooms').add({
    data: roomData
  })

  return {
    success: true,
    roomId: roomId,
    room: roomData
  }
}

// 加入房间
async function joinRoom(event, wxContext) {
  const { roomId, userInfo } = event
  
  // 查找房间
  const roomResult = await db.collection('gameRooms')
    .where({ roomId: roomId })
    .get()
  
  if (roomResult.data.length === 0) {
    return { success: false, message: '房间不存在' }
  }
  
  const room = roomResult.data[0]
  
  // 检查房间状态
  if (room.status !== 'waiting') {
    return { success: false, message: '房间已开始游戏' }
  }
  
  // 检查是否已满员
  if (room.players.length >= room.maxPlayers) {
    return { success: false, message: '房间已满' }
  }
  
  // 检查是否已在房间中
  const existingPlayer = room.players.find(p => p.openid === wxContext.OPENID)
  if (existingPlayer) {
    return { success: false, message: '您已在房间中' }
  }
  
  // 添加玩家
  const newPlayer = {
    openid: wxContext.OPENID,
    nickName: userInfo.nickName,
    avatarUrl: userInfo.avatarUrl,
    isHost: false,
    isReady: false,
    joinTime: new Date()
  }
  
  const updateResult = await db.collection('gameRooms')
    .doc(room._id)
    .update({
      data: {
        players: _.push(newPlayer),
        updateTime: new Date()
      }
    })
  
  // 获取更新后的房间信息
  const updatedRoom = await db.collection('gameRooms')
    .doc(room._id)
    .get()
  
  return {
    success: true,
    room: updatedRoom.data
  }
}

// 获取房间信息
async function getRoomInfo(event, wxContext) {
  const { roomId } = event
  
  const roomResult = await db.collection('gameRooms')
    .where({ roomId: roomId })
    .get()
  
  if (roomResult.data.length === 0) {
    return { success: false, message: '房间不存在' }
  }
  
  return {
    success: true,
    room: roomResult.data[0]
  }
}

// 离开房间
async function leaveRoom(event, wxContext) {
  const { roomId } = event
  
  const roomResult = await db.collection('gameRooms')
    .where({ roomId: roomId })
    .get()
  
  if (roomResult.data.length === 0) {
    return { success: false, message: '房间不存在' }
  }
  
  const room = roomResult.data[0]
  const playerIndex = room.players.findIndex(p => p.openid === wxContext.OPENID)
  
  if (playerIndex === -1) {
    return { success: false, message: '您不在此房间中' }
  }
  
  // 移除玩家
  const updatedPlayers = room.players.filter(p => p.openid !== wxContext.OPENID)
  
  if (updatedPlayers.length === 0) {
    // 房间为空，删除房间
    await db.collection('gameRooms').doc(room._id).remove()
  } else {
    // 如果离开的是房主，转移房主权限
    if (room.players[playerIndex].isHost && updatedPlayers.length > 0) {
      updatedPlayers[0].isHost = true
    }
    
    await db.collection('gameRooms')
      .doc(room._id)
      .update({
        data: {
          players: updatedPlayers,
          hostOpenId: updatedPlayers.length > 0 ? updatedPlayers.find(p => p.isHost).openid : '',
          updateTime: new Date()
        }
      })
  }
  
  return { success: true }
}

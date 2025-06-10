// utils/util.js

/**
 * 格式化时间
 */
const formatTime = date => {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hour = date.getHours()
  const minute = date.getMinutes()
  const second = date.getSeconds()

  return `${[year, month, day].map(formatNumber).join('/')} ${[hour, minute, second].map(formatNumber).join(':')}`
}

const formatNumber = n => {
  n = n.toString()
  return n[1] ? n : `0${n}`
}

/**
 * 生成随机房间号
 */
const generateRoomId = () => {
  return Math.random().toString(36).substr(2, 6).toUpperCase()
}

/**
 * 生成随机游戏ID
 */
const generateGameId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2)
}

/**
 * 获取网格位置的行列
 */
const getGridPosition = (index) => {
  return {
    row: Math.floor(index / 4),
    col: index % 4
  }
}

/**
 * 根据行列获取网格索引
 */
const getGridIndex = (row, col) => {
  return row * 4 + col
}

/**
 * 检查两个位置是否相邻
 */
const isAdjacent = (pos1, pos2) => {
  const p1 = getGridPosition(pos1)
  const p2 = getGridPosition(pos2)
  
  const rowDiff = Math.abs(p1.row - p2.row)
  const colDiff = Math.abs(p1.col - p2.col)
  
  return (rowDiff === 1 && colDiff === 0) || (rowDiff === 0 && colDiff === 1)
}

/**
 * 获取随机表情
 */
const getRandomEmoji = () => {
  const emojis = ['🔥', '⚡', '🌟', '💎', '🎯', '🚀', '⭐', '💫', '🎪', '🎨']
  return emojis[Math.floor(Math.random() * emojis.length)]
}

/**
 * 获取玩家表情（根据玩家信息）
 */
const getPlayerEmoji = (playerInfo) => {
  // 可以根据玩家昵称或其他信息生成特定表情
  const emojis = ['🔥', '⚡', '🌟', '💎', '🎯', '🚀']
  const hash = playerInfo.nickName.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0)
    return a & a
  }, 0)
  return emojis[Math.abs(hash) % emojis.length]
}

/**
 * 防抖函数
 */
const debounce = (func, wait) => {
  let timeout
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout)
      func(...args)
    }
    clearTimeout(timeout)
    timeout = setTimeout(later, wait)
  }
}

/**
 * 节流函数
 */
const throttle = (func, limit) => {
  let inThrottle
  return function() {
    const args = arguments
    const context = this
    if (!inThrottle) {
      func.apply(context, args)
      inThrottle = true
      setTimeout(() => inThrottle = false, limit)
    }
  }
}

/**
 * 显示加载提示
 */
const showLoading = (title = '加载中...') => {
  wx.showLoading({
    title: title,
    mask: true
  })
}

/**
 * 隐藏加载提示
 */
const hideLoading = () => {
  wx.hideLoading()
}

/**
 * 显示成功提示
 */
const showSuccess = (title) => {
  wx.showToast({
    title: title,
    icon: 'success',
    duration: 2000
  })
}

/**
 * 显示错误提示
 */
const showError = (title) => {
  wx.showToast({
    title: title,
    icon: 'none',
    duration: 3000
  })
}

/**
 * 确认对话框
 */
const showConfirm = (content, title = '提示') => {
  return new Promise((resolve) => {
    wx.showModal({
      title: title,
      content: content,
      success: (res) => {
        resolve(res.confirm)
      },
      fail: () => {
        resolve(false)
      }
    })
  })
}

/**
 * 复制到剪贴板
 */
const copyToClipboard = (data) => {
  return new Promise((resolve, reject) => {
    wx.setClipboardData({
      data: data,
      success: () => {
        showSuccess('已复制到剪贴板')
        resolve(true)
      },
      fail: (err) => {
        showError('复制失败')
        reject(err)
      }
    })
  })
}

/**
 * 震动反馈
 */
const vibrate = (type = 'short') => {
  if (type === 'long') {
    wx.vibrateLong()
  } else {
    wx.vibrateShort()
  }
}

module.exports = {
  formatTime,
  generateRoomId,
  generateGameId,
  getGridPosition,
  getGridIndex,
  isAdjacent,
  getRandomEmoji,
  getPlayerEmoji,
  debounce,
  throttle,
  showLoading,
  hideLoading,
  showSuccess,
  showError,
  showConfirm,
  copyToClipboard,
  vibrate
}

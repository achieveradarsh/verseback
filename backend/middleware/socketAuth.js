const jwt = require("jsonwebtoken")
const User = require("../models/User")

const authenticateSocket = async (socket, next) => {
  try {
    const token = socket.handshake.auth.token

    if (!token) {
      return next(new Error("Authentication error"))
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    const user = User.findById(decoded.userId)

    if (!user) {
      return next(new Error("Authentication error"))
    }

    socket.userId = user.id
    socket.user = user

    // Update user online status
    User.updateOnlineStatus(user.id, true)

    next()
  } catch (error) {
    next(new Error("Authentication error"))
  }
}

module.exports = { authenticateSocket }

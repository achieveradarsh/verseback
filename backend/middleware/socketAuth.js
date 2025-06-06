const jwt = require("jsonwebtoken")
const User = require("../models/User")

const authenticateSocket = async (socket, next) => {
  try {
    const token = socket.handshake.auth.token

    if (!token) {
      return next(new Error("Authentication error - no token provided"))
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    const user = User.findById(decoded.userId)

    if (!user) {
      return next(new Error("Authentication error - user not found"))
    }

    socket.userId = user.id
    socket.user = user

    next()
  } catch (error) {
    console.error("Socket auth error:", error)
    next(new Error("Authentication error"))
  }
}

module.exports = { authenticateSocket }

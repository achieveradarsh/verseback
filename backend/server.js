const express = require("express")
const http = require("http")
const socketIo = require("socket.io")
const cors = require("cors")
const helmet = require("helmet")
const rateLimit = require("express-rate-limit")
require("dotenv").config()

// Initialize database
require("./database/init")

const authRoutes = require("./routes/auth")
const chatRoutes = require("./routes/chat")
const { authenticateSocket } = require("./middleware/socketAuth")
const Message = require("./models/Message")
const Chat = require("./models/Chat")

const app = express()
const server = http.createServer(app)

// CORS configuration
const corsOptions = {
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
}

app.use(cors(corsOptions))
app.use(helmet())
app.use(express.json())

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
})
app.use(limiter)

// Routes
app.use("/api/auth", authRoutes)
app.use("/api/chat", chatRoutes)

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() })
})

// Socket.IO setup
const io = socketIo(server, {
  cors: corsOptions,
})

// Socket authentication middleware
io.use(authenticateSocket)

// Socket connection handling
io.on("connection", (socket) => {
  console.log(`User connected: ${socket.userId}`)

  // Join user to their personal room
  socket.join(socket.userId)

  // Handle joining chat rooms
  socket.on("join-room", (roomId) => {
    socket.join(roomId)
    console.log(`User ${socket.userId} joined room ${roomId}`)
  })

  // Handle leaving chat rooms
  socket.on("leave-room", (roomId) => {
    socket.leave(roomId)
    console.log(`User ${socket.userId} left room ${roomId}`)
  })

  // Handle sending messages
  socket.on("send-message", async (data) => {
    try {
      // Verify user is participant in the chat
      if (!Chat.isParticipant(data.chatId, socket.userId)) {
        socket.emit("error", { message: "Not authorized to send messages to this chat" })
        return
      }

      const message = Message.create({
        senderId: socket.userId,
        chatId: data.chatId,
        content: data.content,
        messageType: data.messageType || "text",
      })

      // Update chat's last activity
      Chat.updateLastActivity(data.chatId)

      // Get the full message with sender info
      const fullMessage = Message.findById(message.id)

      // Emit to all users in the chat room
      io.to(data.chatId).emit("new-message", fullMessage)
    } catch (error) {
      console.error("Error sending message:", error)
      socket.emit("error", { message: "Failed to send message" })
    }
  })

  // Handle typing indicators
  socket.on("typing", (data) => {
    socket.to(data.chatId).emit("user-typing", {
      userId: socket.userId,
      isTyping: data.isTyping,
    })
  })

  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.userId}`)
  })
})

const PORT = process.env.PORT || 5000
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
  console.log(`Environment: ${process.env.NODE_ENV}`)
})

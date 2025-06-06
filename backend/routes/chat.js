const express = require("express")
const Chat = require("../models/Chat")
const Message = require("../models/Message")
const User = require("../models/User")
const auth = require("../middleware/auth")

const router = express.Router()

// Get user's chats
router.get("/chats", auth, async (req, res) => {
  try {
    const chats = Chat.getUserChats(req.user.id)
    res.json(chats)
  } catch (error) {
    console.error("Get chats error:", error)
    res.status(500).json({ message: "Failed to fetch chats" })
  }
})

// Get chat messages
router.get("/chats/:chatId/messages", auth, async (req, res) => {
  try {
    const { chatId } = req.params
    const { page = 1, limit = 50 } = req.query

    // Verify user is participant
    if (!Chat.isParticipant(chatId, req.user.id)) {
      return res.status(404).json({ message: "Chat not found or access denied" })
    }

    const offset = (page - 1) * limit
    const messages = Message.getChatMessages(chatId, Number.parseInt(limit), offset)

    res.json(messages)
  } catch (error) {
    console.error("Get messages error:", error)
    res.status(500).json({ message: "Failed to fetch messages" })
  }
})

// Create group chat
router.post("/groups", auth, async (req, res) => {
  try {
    const { name, participants } = req.body

    if (!name || !participants || participants.length < 1) {
      return res.status(400).json({ message: "Group name and at least 1 participant required" })
    }

    // Validate participants exist
    const validParticipants = []
    for (const participantId of participants) {
      const user = User.findById(participantId)
      if (user) {
        validParticipants.push(participantId)
      }
    }

    if (validParticipants.length === 0) {
      return res.status(400).json({ message: "No valid participants found" })
    }

    const chat = Chat.create({
      name,
      isGroup: validParticipants.length > 1,
      participants: [...validParticipants, req.user.id],
      adminId: req.user.id,
      chatType: validParticipants.length > 1 ? "group" : "personal",
    })

    res.json(chat)
  } catch (error) {
    console.error("Create group error:", error)
    res.status(500).json({ message: "Failed to create chat" })
  }
})

// Search users
router.get("/users/search", auth, async (req, res) => {
  try {
    const { q } = req.query

    if (!q || q.length < 2) {
      return res.json([])
    }

    const users = User.search(q, req.user.id)
    res.json(users)
  } catch (error) {
    console.error("Search users error:", error)
    res.status(500).json({ message: "Failed to search users" })
  }
})

// Get chat details
router.get("/chats/:chatId", auth, async (req, res) => {
  try {
    const { chatId } = req.params

    // Verify user is participant
    if (!Chat.isParticipant(chatId, req.user.id)) {
      return res.status(404).json({ message: "Chat not found or access denied" })
    }

    const chat = Chat.findById(chatId)
    if (!chat) {
      return res.status(404).json({ message: "Chat not found" })
    }

    res.json(chat)
  } catch (error) {
    console.error("Get chat details error:", error)
    res.status(500).json({ message: "Failed to fetch chat details" })
  }
})

module.exports = router

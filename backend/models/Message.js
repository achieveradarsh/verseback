const db = require("../database/init")
const { v4: uuidv4 } = require("uuid")

class Message {
  static create(messageData) {
    const id = uuidv4()
    const stmt = db.prepare(`
      INSERT INTO messages (id, sender_id, chat_id, content, message_type)
      VALUES (?, ?, ?, ?, ?)
    `)

    stmt.run(id, messageData.senderId, messageData.chatId, messageData.content, messageData.messageType || "text")

    return this.findById(id)
  }

  static findById(id) {
    const stmt = db.prepare(`
      SELECT m.*, u.username, u.email, u.avatar
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.id = ?
    `)

    const message = stmt.get(id)
    if (message) {
      message.sender = {
        _id: message.sender_id,
        username: message.username,
        email: message.email,
        avatar: message.avatar,
      }
    }
    return message
  }

  static getChatMessages(chatId, limit = 50, offset = 0) {
    const stmt = db.prepare(`
      SELECT m.*, u.username, u.email, u.avatar
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.chat_id = ? AND m.is_deleted = 0
      ORDER BY m.created_at DESC
      LIMIT ? OFFSET ?
    `)

    const messages = stmt.all(chatId, limit, offset)

    return messages
      .map((message) => ({
        _id: message.id,
        sender: {
          _id: message.sender_id,
          username: message.username,
          email: message.email,
          avatar: message.avatar,
        },
        chat: message.chat_id,
        content: message.content,
        messageType: message.message_type,
        createdAt: message.created_at,
      }))
      .reverse()
  }

  static deleteMessage(messageId) {
    const stmt = db.prepare("UPDATE messages SET is_deleted = 1 WHERE id = ?")
    return stmt.run(messageId)
  }
}

module.exports = Message

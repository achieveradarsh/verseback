const db = require("../database/init")
const { v4: uuidv4 } = require("uuid")

class Chat {
  static create(chatData) {
    const id = uuidv4()
    const stmt = db.prepare(`
      INSERT INTO chats (id, name, is_group, admin_id, chat_type)
      VALUES (?, ?, ?, ?, ?)
    `)

    stmt.run(
      id,
      chatData.name || null,
      chatData.isGroup ? 1 : 0,
      chatData.adminId || null,
      chatData.chatType || "personal",
    )

    // Add participants
    if (chatData.participants && chatData.participants.length > 0) {
      const participantStmt = db.prepare(`
        INSERT INTO chat_participants (chat_id, user_id)
        VALUES (?, ?)
      `)

      for (const participantId of chatData.participants) {
        participantStmt.run(id, participantId)
      }
    }

    return this.findById(id)
  }

  static findById(id) {
    const stmt = db.prepare(`
      SELECT c.*, 
             GROUP_CONCAT(u.id) as participant_ids,
             GROUP_CONCAT(u.username) as participant_usernames,
             GROUP_CONCAT(u.email) as participant_emails,
             GROUP_CONCAT(u.avatar) as participant_avatars,
             GROUP_CONCAT(u.is_online) as participant_online_status
      FROM chats c
      LEFT JOIN chat_participants cp ON c.id = cp.chat_id
      LEFT JOIN users u ON cp.user_id = u.id
      WHERE c.id = ?
      GROUP BY c.id
    `)

    const chat = stmt.get(id)
    if (!chat) return null

    // Parse participants
    chat.participants = []
    if (chat.participant_ids) {
      const ids = chat.participant_ids.split(",")
      const usernames = chat.participant_usernames.split(",")
      const emails = chat.participant_emails.split(",")
      const avatars = chat.participant_avatars.split(",")
      const onlineStatus = chat.participant_online_status.split(",")

      for (let i = 0; i < ids.length; i++) {
        chat.participants.push({
          id: ids[i],
          username: usernames[i],
          email: emails[i],
          avatar: avatars[i] || "",
          is_online: onlineStatus[i] === "1",
        })
      }
    }

    return chat
  }

  static findByParticipants(participantIds) {
    if (participantIds.length !== 2) return null

    const stmt = db.prepare(`
      SELECT c.id
      FROM chats c
      WHERE c.is_group = 0
      AND (
        SELECT COUNT(*)
        FROM chat_participants cp
        WHERE cp.chat_id = c.id
        AND cp.user_id IN (?, ?)
      ) = 2
      AND (
        SELECT COUNT(*)
        FROM chat_participants cp
        WHERE cp.chat_id = c.id
      ) = 2
    `)

    const result = stmt.get(participantIds[0], participantIds[1])
    return result ? this.findById(result.id) : null
  }

  static getUserChats(userId) {
    const stmt = db.prepare(`
      SELECT c.*,
             GROUP_CONCAT(u.id) as participant_ids,
             GROUP_CONCAT(u.username) as participant_usernames,
             GROUP_CONCAT(u.email) as participant_emails,
             GROUP_CONCAT(u.avatar) as participant_avatars,
             GROUP_CONCAT(u.is_online) as participant_online_status,
             m.content as last_message_content,
             m.created_at as last_message_time,
             sender.username as last_message_sender
      FROM chats c
      JOIN chat_participants cp ON c.id = cp.chat_id
      LEFT JOIN chat_participants cp2 ON c.id = cp2.chat_id
      LEFT JOIN users u ON cp2.user_id = u.id
      LEFT JOIN messages m ON c.id = m.chat_id
      LEFT JOIN users sender ON m.sender_id = sender.id
      WHERE cp.user_id = ?
      AND (m.id IS NULL OR m.created_at = (
        SELECT MAX(created_at)
        FROM messages
        WHERE chat_id = c.id
        AND is_deleted = 0
      ))
      GROUP BY c.id
      ORDER BY COALESCE(m.created_at, c.created_at) DESC
    `)

    const chats = stmt.all(userId)

    return chats.map((chat) => {
      // Parse participants
      chat.participants = []
      if (chat.participant_ids) {
        const ids = chat.participant_ids.split(",")
        const usernames = chat.participant_usernames.split(",")
        const emails = chat.participant_emails.split(",")
        const avatars = chat.participant_avatars.split(",")
        const onlineStatus = chat.participant_online_status.split(",")

        for (let i = 0; i < ids.length; i++) {
          chat.participants.push({
            id: ids[i],
            username: usernames[i],
            email: emails[i],
            avatar: avatars[i] || "",
            is_online: onlineStatus[i] === "1",
          })
        }
      }

      // Add last message info
      if (chat.last_message_content) {
        chat.lastMessage = {
          content: chat.last_message_content,
          createdAt: chat.last_message_time,
          sender: {
            username: chat.last_message_sender,
          },
        }
      }

      return chat
    })
  }

  static isParticipant(chatId, userId) {
    const stmt = db.prepare(`
      SELECT 1 FROM chat_participants
      WHERE chat_id = ? AND user_id = ?
    `)
    return !!stmt.get(chatId, userId)
  }

  static updateLastActivity(chatId) {
    const stmt = db.prepare(`
      UPDATE chats
      SET last_activity = CURRENT_TIMESTAMP
      WHERE id = ?
    `)
    return stmt.run(chatId)
  }

  static addParticipant(chatId, userId) {
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO chat_participants (chat_id, user_id)
      VALUES (?, ?)
    `)
    return stmt.run(chatId, userId)
  }

  static removeParticipant(chatId, userId) {
    const stmt = db.prepare(`
      DELETE FROM chat_participants
      WHERE chat_id = ? AND user_id = ?
    `)
    return stmt.run(chatId, userId)
  }

  static deleteChat(chatId) {
    const db_transaction = db.transaction(() => {
      // Delete participants
      db.prepare("DELETE FROM chat_participants WHERE chat_id = ?").run(chatId)

      // Mark messages as deleted
      db.prepare("UPDATE messages SET is_deleted = 1 WHERE chat_id = ?").run(chatId)

      // Delete chat
      db.prepare("DELETE FROM chats WHERE id = ?").run(chatId)
    })

    return db_transaction()
  }
}

module.exports = Chat

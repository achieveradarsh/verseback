const db = require("../database/init")
const { v4: uuidv4 } = require("uuid")

class User {
  static create(userData) {
    const id = uuidv4()
    const stmt = db.prepare(`
      INSERT INTO users (id, email, username, avatar)
      VALUES (?, ?, ?, ?)
    `)

    stmt.run(id, userData.email, userData.username, userData.avatar || "")
    return this.findById(id)
  }

  static findById(id) {
    const stmt = db.prepare("SELECT * FROM users WHERE id = ?")
    return stmt.get(id)
  }

  static findByEmail(email) {
    const stmt = db.prepare("SELECT * FROM users WHERE email = ?")
    return stmt.get(email)
  }

  static findByUsername(username) {
    const stmt = db.prepare("SELECT * FROM users WHERE username = ?")
    return stmt.get(username)
  }

  static findByInviteCode(inviteCode) {
    const stmt = db.prepare("SELECT * FROM users WHERE invite_code = ?")
    return stmt.get(inviteCode)
  }

  static updateInviteCode(userId, inviteCode) {
    const stmt = db.prepare("UPDATE users SET invite_code = ? WHERE id = ?")
    stmt.run(inviteCode, userId)
    return this.findById(userId)
  }

  static updateOnlineStatus(userId, isOnline) {
    const stmt = db.prepare(`
      UPDATE users 
      SET is_online = ?, last_seen = CURRENT_TIMESTAMP 
      WHERE id = ?
    `)
    stmt.run(isOnline ? 1 : 0, userId)
  }

  static search(query, excludeUserId) {
    const stmt = db.prepare(`
      SELECT id, username, email, avatar 
      FROM users 
      WHERE id != ? AND (username LIKE ? OR email LIKE ?)
      LIMIT 10
    `)
    return stmt.all(excludeUserId, `%${query}%`, `%${query}%`)
  }

  static generateInviteCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase()
  }
}

module.exports = User

const db = require("../database/init")
const { v4: uuidv4 } = require("uuid")

class OTP {
  static create(email, otp) {
    const id = uuidv4()
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000) // 5 minutes from now

    // Delete any existing OTPs for this email
    this.deleteByEmail(email)

    const stmt = db.prepare(`
      INSERT INTO otps (id, email, otp, expires_at)
      VALUES (?, ?, ?, ?)
    `)

    stmt.run(id, email, otp, expiresAt.toISOString())
    return { id, email, otp, expiresAt }
  }

  static findByEmailAndOTP(email, otp) {
    const stmt = db.prepare(`
      SELECT * FROM otps 
      WHERE email = ? AND otp = ? AND expires_at > datetime('now')
    `)
    return stmt.get(email, otp)
  }

  static deleteByEmail(email) {
    const stmt = db.prepare("DELETE FROM otps WHERE email = ?")
    return stmt.run(email)
  }

  static deleteById(id) {
    const stmt = db.prepare("DELETE FROM otps WHERE id = ?")
    return stmt.run(id)
  }
}

module.exports = OTP

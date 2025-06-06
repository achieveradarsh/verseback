const Database = require("better-sqlite3")
const path = require("path")

// Create database file in the project directory
const dbPath = path.join(__dirname, "chat.db")
const db = new Database(dbPath)

// Enable WAL mode for better concurrent access
db.pragma("journal_mode = WAL")

// Create tables
const createTables = () => {
  console.log("Initializing SQLite database...")

  // Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      username TEXT UNIQUE NOT NULL,
      avatar TEXT DEFAULT '',
      is_online INTEGER DEFAULT 0,
      last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
      invite_code TEXT UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // Chats table
  db.exec(`
    CREATE TABLE IF NOT EXISTS chats (
      id TEXT PRIMARY KEY,
      name TEXT,
      is_group INTEGER DEFAULT 0,
      admin_id TEXT,
      chat_type TEXT DEFAULT 'personal',
      last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // Chat participants table (many-to-many relationship)
  db.exec(`
    CREATE TABLE IF NOT EXISTS chat_participants (
      chat_id TEXT,
      user_id TEXT,
      joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (chat_id, user_id),
      FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `)

  // Messages table
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      sender_id TEXT NOT NULL,
      chat_id TEXT NOT NULL,
      content TEXT NOT NULL,
      message_type TEXT DEFAULT 'text',
      is_deleted INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
    )
  `)

  // OTP table
  db.exec(`
    CREATE TABLE IF NOT EXISTS otps (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      otp TEXT NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // Create indexes for better performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
    CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
    CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
    CREATE INDEX IF NOT EXISTS idx_chat_participants_user_id ON chat_participants(user_id);
    CREATE INDEX IF NOT EXISTS idx_chat_participants_chat_id ON chat_participants(chat_id);
    CREATE INDEX IF NOT EXISTS idx_otps_email ON otps(email);
    CREATE INDEX IF NOT EXISTS idx_otps_expires_at ON otps(expires_at);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    CREATE INDEX IF NOT EXISTS idx_users_invite_code ON users(invite_code);
  `)

  console.log("✅ SQLite database tables created successfully")
  console.log(`📁 Database location: ${dbPath}`)
}

// Clean up expired OTPs periodically
const cleanupExpiredOTPs = () => {
  try {
    const stmt = db.prepare("DELETE FROM otps WHERE expires_at < datetime('now')")
    const result = stmt.run()
    if (result.changes > 0) {
      console.log(`🧹 Cleaned up ${result.changes} expired OTPs`)
    }
  } catch (error) {
    console.error("Error cleaning up expired OTPs:", error)
  }
}

// Get database statistics
const getDatabaseStats = () => {
  try {
    const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get()
    const chatCount = db.prepare("SELECT COUNT(*) as count FROM chats").get()
    const messageCount = db.prepare("SELECT COUNT(*) as count FROM messages WHERE is_deleted = 0").get()

    console.log(`📊 Database Stats:`)
    console.log(`   Users: ${userCount.count}`)
    console.log(`   Chats: ${chatCount.count}`)
    console.log(`   Messages: ${messageCount.count}`)
  } catch (error) {
    console.error("Error getting database stats:", error)
  }
}

// Initialize database
createTables()

// Show initial stats
getDatabaseStats()

// Clean up expired OTPs every 5 minutes
setInterval(cleanupExpiredOTPs, 5 * 60 * 1000)

// Clean up expired OTPs on startup
cleanupExpiredOTPs()

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n🔄 Closing database connection...")
  db.close()
  console.log("✅ Database connection closed.")
  process.exit(0)
})

module.exports = db

const express = require("express")
const jwt = require("jsonwebtoken")
const nodemailer = require("nodemailer")
const User = require("../models/User")
const OTP = require("../models/OTP")
const Chat = require("../models/Chat")
const auth = require("../middleware/auth")

const router = express.Router()

// Email transporter setup
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
})

// Test email configuration on startup
transporter.verify((error, success) => {
  if (error) {
    console.error("Email configuration error:", error)
  } else {
    console.log("Email server is ready to send messages")
  }
})

// Generate and send OTP
router.post("/send-otp", async (req, res) => {
  try {
    const { email } = req.body

    if (!email) {
      return res.status(400).json({ message: "Email is required" })
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Invalid email format" })
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString()

    // Save new OTP (this will delete any existing OTP for this email)
    OTP.create(email, otp)

    // Send email
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Your Chat App Login OTP",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #2563eb; margin: 0;">Chat App</h1>
          </div>
          
          <div style="background: #f8fafc; padding: 30px; border-radius: 10px; text-align: center;">
            <h2 style="color: #1e293b; margin-bottom: 20px;">Your Login Code</h2>
            <p style="color: #64748b; margin-bottom: 30px;">Enter this code to sign in to your account:</p>
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 2px dashed #e2e8f0;">
              <div style="font-size: 36px; font-weight: bold; color: #2563eb; letter-spacing: 8px; font-family: monospace;">
                ${otp}
              </div>
            </div>
            
            <p style="color: #ef4444; font-weight: 500; margin-top: 20px;">
              ⏰ This code expires in 5 minutes
            </p>
          </div>
          
          <div style="margin-top: 30px; padding: 20px; background: #fef3c7; border-radius: 8px;">
            <p style="color: #92400e; margin: 0; font-size: 14px;">
              🔒 <strong>Security Note:</strong> If you didn't request this code, please ignore this email. 
              Never share your login code with anyone.
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 30px; color: #64748b; font-size: 12px;">
            <p>This is an automated message from Chat App. Please do not reply to this email.</p>
          </div>
        </div>
      `,
    }

    await transporter.sendMail(mailOptions)

    res.json({
      message: "OTP sent successfully",
      email: email,
      expiresIn: "5 minutes",
    })
  } catch (error) {
    console.error("Send OTP error:", error)
    res.status(500).json({ message: "Failed to send OTP. Please try again." })
  }
})

// Verify OTP and login
router.post("/verify-otp", async (req, res) => {
  try {
    const { email, otp, username } = req.body

    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required" })
    }

    // Validate OTP format
    if (!/^\d{6}$/.test(otp)) {
      return res.status(400).json({ message: "OTP must be 6 digits" })
    }

    // Find and verify OTP
    const otpDoc = OTP.findByEmailAndOTP(email, otp)

    if (!otpDoc) {
      return res.status(400).json({ message: "Invalid or expired OTP" })
    }

    // Delete used OTP
    OTP.deleteById(otpDoc.id)

    // Find or create user
    let user = User.findByEmail(email)

    if (!user) {
      if (!username) {
        return res.status(400).json({ message: "Username required for new users" })
      }

      // Validate username
      if (username.length < 3 || username.length > 20) {
        return res.status(400).json({ message: "Username must be between 3 and 20 characters" })
      }

      if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        return res.status(400).json({ message: "Username can only contain letters, numbers, and underscores" })
      }

      // Check if username is taken
      const existingUser = User.findByUsername(username)
      if (existingUser) {
        return res.status(400).json({ message: "Username already taken" })
      }

      user = User.create({ email, username })
    }

    // Generate JWT token
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: "7d" })

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        avatar: user.avatar || "",
        inviteCode: user.invite_code,
      },
    })
  } catch (error) {
    console.error("Verify OTP error:", error)
    res.status(500).json({ message: "Failed to verify OTP" })
  }
})

// Get current user
router.get("/me", auth, async (req, res) => {
  try {
    res.json({
      id: req.user.id,
      email: req.user.email,
      username: req.user.username,
      avatar: req.user.avatar || "",
      inviteCode: req.user.invite_code,
      isOnline: req.user.is_online,
      lastSeen: req.user.last_seen,
    })
  } catch (error) {
    console.error("Get user error:", error)
    res.status(500).json({ message: "Failed to get user data" })
  }
})

// Generate invite code
router.post("/generate-invite", auth, async (req, res) => {
  try {
    const inviteCode = User.generateInviteCode()
    const updatedUser = User.updateInviteCode(req.user.id, inviteCode)

    res.json({
      inviteCode: updatedUser.invite_code,
      message: "Invite code generated successfully",
    })
  } catch (error) {
    console.error("Generate invite error:", error)
    res.status(500).json({ message: "Failed to generate invite code" })
  }
})

// Join by invite code
router.post("/join-invite", auth, async (req, res) => {
  try {
    const { inviteCode } = req.body

    if (!inviteCode) {
      return res.status(400).json({ message: "Invite code is required" })
    }

    const inviter = User.findByInviteCode(inviteCode.toUpperCase())
    if (!inviter) {
      return res.status(404).json({ message: "Invalid invite code" })
    }

    if (inviter.id === req.user.id) {
      return res.status(400).json({ message: "Cannot invite yourself" })
    }

    // Check if chat already exists
    let chat = Chat.findByParticipants([req.user.id, inviter.id])

    if (!chat) {
      chat = Chat.create({
        participants: [req.user.id, inviter.id],
        isGroup: false,
        chatType: "personal",
      })
    }

    res.json({
      chat,
      message: `Successfully connected with ${inviter.username}!`,
    })
  } catch (error) {
    console.error("Join invite error:", error)
    res.status(500).json({ message: "Failed to join invite" })
  }
})

module.exports = router

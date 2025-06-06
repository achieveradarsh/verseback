const express = require("express")
const jwt = require("jsonwebtoken")
const nodemailer = require("nodemailer")
const User = require("../models/User")
const OTP = require("../models/OTP")
const Chat = require("../models/Chat")
const auth = require("../middleware/auth")

const router = express.Router()

// Email transporter setup - FIX: createTransport not createTransporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
})

// Generate and send OTP
router.post("/send-otp", async (req, res) => {
  try {
    const { email } = req.body

    if (!email) {
      return res.status(400).json({ message: "Email is required" })
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
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Your Login OTP</h2>
          <p>Your OTP for logging into the Chat App is:</p>
          <div style="background: #f0f9ff; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; margin: 20px 0; border-radius: 8px; color: #2563eb;">
            ${otp}
          </div>
          <p>This OTP will expire in 5 minutes.</p>
          <p style="color: #6b7280;">If you didn't request this, please ignore this email.</p>
        </div>
      `,
    }

    await transporter.sendMail(mailOptions)

    res.json({ message: "OTP sent successfully" })
  } catch (error) {
    console.error("Send OTP error:", error)
    res.status(500).json({ message: "Failed to send OTP" })
  }
})

// Verify OTP and login
router.post("/verify-otp", async (req, res) => {
  try {
    const { email, otp, username } = req.body

    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required" })
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
        avatar: user.avatar,
      },
    })
  } catch (error) {
    console.error("Verify OTP error:", error)
    res.status(500).json({ message: "Failed to verify OTP" })
  }
})

// Get current user
router.get("/me", auth, async (req, res) => {
  res.json({
    id: req.user.id,
    email: req.user.email,
    username: req.user.username,
    avatar: req.user.avatar,
    inviteCode: req.user.invite_code,
  })
})

// Generate invite code
router.post("/generate-invite", auth, async (req, res) => {
  try {
    const inviteCode = User.generateInviteCode()
    const updatedUser = User.updateInviteCode(req.user.id, inviteCode)

    res.json({ inviteCode: updatedUser.invite_code })
  } catch (error) {
    console.error("Generate invite error:", error)
    res.status(500).json({ message: "Failed to generate invite code" })
  }
})

// Join by invite code
router.post("/join-invite", auth, async (req, res) => {
  try {
    const { inviteCode } = req.body

    const inviter = User.findByInviteCode(inviteCode)
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

    res.json({ chat })
  } catch (error) {
    console.error("Join invite error:", error)
    res.status(500).json({ message: "Failed to join invite" })
  }
})

module.exports = router

const mongoose = require("mongoose")

const chatSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: function () {
        return this.isGroup
      },
    },
    isGroup: {
      type: Boolean,
      default: false,
    },
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: function () {
        return this.isGroup
      },
    },
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
    },
    lastActivity: {
      type: Date,
      default: Date.now,
    },
    chatType: {
      type: String,
      enum: ["personal", "group", "anonymous"],
      default: "personal",
    },
  },
  {
    timestamps: true,
  },
)

module.exports = mongoose.model("Chat", chatSchema)

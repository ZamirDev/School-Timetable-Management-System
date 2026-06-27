const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ["admin", "teacher", "student"],
    default: "admin"
  },
  schoolName: {
    type: String,
    default: ""
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null
  },
  teacherRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Teacher",
    default: null
  },
  classRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Class",
    default: null
  },
  resetToken: {
    type: String,
    default: null
  },
  resetTokenExpiry: {
    type: Date,
    default: null
  },
  plainPassword: {
    type: String,
    default: ""
  }
}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);

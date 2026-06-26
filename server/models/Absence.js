const mongoose = require("mongoose");

const absenceSchema = new mongoose.Schema({
  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Teacher",
    required: true
  },
  day: {
    type: String,
    enum: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    required: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  }
}, { timestamps: true });

// Ensure unique teacher-day combination
absenceSchema.index({ teacher: 1, day: 1 }, { unique: true });

module.exports = mongoose.model("Absence", absenceSchema);

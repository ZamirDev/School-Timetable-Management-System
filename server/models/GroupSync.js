const mongoose = require("mongoose");

const groupSyncSchema = new mongoose.Schema({
  syncId: {
    type: String,
    required: true,
  },
  groupName: {
    type: String,
    required: true,
  },
  classIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Class",
    required: true,
  }],
  teacherIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Teacher",
    required: true,
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
}, { timestamps: true });

groupSyncSchema.index({ syncId: 1, createdBy: 1 }, { unique: true });

module.exports = mongoose.model("GroupSync", groupSyncSchema);

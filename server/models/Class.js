const mongoose = require("mongoose");

const classSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  periodsPerDay: {
    type: Number,
    default: 6
  },
  teachers: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Teacher"
    }
  ],
  timetable: [
    {
      day: String,
      periods: [
        {
          period: Number,
          startTime: String,
          endTime: String,
          teacher: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Teacher"
          },
          subject: String,
          tracks: [{
            groupName: String,
            teacher: {
              type: mongoose.Schema.Types.ObjectId,
              ref: "Teacher"
            },
            subject: String
          }]
        }
      ]
    }
  ],
  schoolTiming: {
    startTime: { type: String, default: "08:00" },
    periodDuration: { type: Number, default: 40 },
    breakAfter: { type: Number, default: 3 },
    breakDuration: { type: Number, default: 20 }
  },
  teacherGroups: [{
    groupName: String,
    teachers: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Teacher"
    }]
  }],
  teacherQuota: {
    type: Map,
    of: Number,
    default: {}
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  }
});

classSchema.index({ name: 1, createdBy: 1 }, { unique: true });

module.exports = mongoose.model("Class", classSchema);
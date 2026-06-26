const express = require("express");
const LeaveRequest = require("../models/LeaveRequest");
const Absence = require("../models/Absence");
const { auth, adminOnly } = require("../middleware/auth");

const router = express.Router();

// GET /leave-requests — teachers see own, admins see all under them
router.get("/", auth, async (req, res) => {
  try {
    const isAdmin = req.user.role === "admin";
    let requests;
    if (isAdmin) {
      requests = await LeaveRequest.find({ createdBy: req.effectiveCreatedBy })
        .populate("teacher")
        .sort({ createdAt: -1 });
    } else {
      requests = await LeaveRequest.find({ requestedBy: req.user._id })
        .populate("teacher")
        .sort({ createdAt: -1 });
    }
    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /leave-requests — teacher only, submit a request
router.post("/", auth, async (req, res) => {
  try {
    if (req.user.role !== "teacher") {
      return res.status(403).json({ error: "Only teachers can submit leave requests" });
    }
    const { day, reason } = req.body;
    if (!day) {
      return res.status(400).json({ error: "Day is required" });
    }
    if (!req.user.teacherRef) {
      return res.status(400).json({ error: "No teacher profile linked to your account" });
    }
    const request = await LeaveRequest.create({
      teacher: req.user.teacherRef,
      requestedBy: req.user._id,
      day,
      reason: reason || "",
      status: "pending",
      createdBy: req.user.createdBy || req.user._id,
    });
    const populated = await request.populate("teacher");
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /leave-requests/:id — admin only, approve or reject
router.put("/:id", auth, adminOnly, async (req, res) => {
  try {
    const { status, adminNote } = req.body;
    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({ error: "Status must be 'approved' or 'rejected'" });
    }
    const request = await LeaveRequest.findOneAndUpdate(
      { _id: req.params.id, createdBy: req.effectiveCreatedBy },
      { $set: { status, adminNote: adminNote || "" } },
      { new: true }
    ).populate("teacher");
    if (!request) return res.status(404).json({ error: "Leave request not found" });

    // If approved, create the absence record automatically
    if (status === "approved" && request.teacher) {
      await Absence.findOneAndUpdate(
        { teacher: request.teacher._id, day: request.day, createdBy: req.effectiveCreatedBy },
        { $set: { teacher: request.teacher._id, day: request.day, createdBy: req.effectiveCreatedBy } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );
    }

    res.json(request);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

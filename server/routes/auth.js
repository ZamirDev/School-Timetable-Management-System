const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Teacher = require("../models/Teacher");
const Class = require("../models/Class");
const Absence = require("../models/Absence");
const LeaveRequest = require("../models/LeaveRequest");
const { auth, adminOnly, JWT_SECRET } = require("../middleware/auth");

const router = express.Router();

// POST /auth/register — admin only, creates new accounts
router.post("/register", auth, adminOnly, async (req, res) => {
  try {
    const { email, password, role, schoolName, name, subject } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(400).json({ error: "Email already registered" });
    }

    let teacherRef = null;
    if (role === "teacher") {
      if (!name || !subject) {
        return res.status(400).json({ error: "Teacher name and subject are required" });
      }
      const teacher = await Teacher.create({
        name: name.trim(),
        subject: subject.trim(),
        createdBy: req.effectiveCreatedBy
      });
      teacherRef = teacher._id;
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({
      email: email.toLowerCase(),
      password: hashed,
      role: role || "admin",
      schoolName: schoolName || "",
      createdBy: req.effectiveCreatedBy,
      teacherRef
    });
    res.status(201).json({
      _id: user._id,
      email: user.email,
      role: user.role,
      schoolName: user.schoolName,
      teacherRef
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: "7d" });
    res.json({
      token,
      user: {
        _id: user._id,
        email: user.email,
        role: user.role,
        schoolName: user.schoolName,
        teacherRef: user.teacherRef
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /auth/me — returns current user
router.get("/me", auth, (req, res) => {
  res.json({
    _id: req.user._id,
    email: req.user.email,
    role: req.user.role,
    schoolName: req.user.schoolName,
    teacherRef: req.user.teacherRef
  });
});

// DELETE /auth/users/:id — admin-only, delete a user + their data
router.delete("/users/:id", auth, adminOnly, async (req, res) => {
  try {
    const target = await User.findOne({ _id: req.params.id, createdBy: req.effectiveCreatedBy });
    if (!target) return res.status(404).json({ error: "User not found" });
    await Promise.all([
      Teacher.deleteMany({ createdBy: target._id }),
      Class.deleteMany({ createdBy: target._id }),
      Absence.deleteMany({ createdBy: target._id }),
      LeaveRequest.deleteMany({ createdBy: target._id }),
      User.findByIdAndDelete(target._id),
    ]);
    res.json({ message: "User and their data deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /auth/users — admin-only, list all created users
router.get("/users", auth, adminOnly, async (req, res) => {
  try {
    const users = await User.find({ createdBy: req.effectiveCreatedBy })
      .select("-password")
      .populate("teacherRef")
      .sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

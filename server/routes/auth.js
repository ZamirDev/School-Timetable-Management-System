const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const User = require("../models/User");
const Teacher = require("../models/Teacher");
const Class = require("../models/Class");
const Absence = require("../models/Absence");
const LeaveRequest = require("../models/LeaveRequest");
const { auth, adminOnly, JWT_SECRET } = require("../middleware/auth");

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Too many login attempts. Please try again after 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

// POST /auth/register — admin only, creates new accounts
router.post("/register", auth, adminOnly, async (req, res) => {
  try {
    const { email, password, role, schoolName, name, subject, classRef } = req.body;
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

    let studentClassRef = null;
    if (role === "student") {
      if (!classRef) {
        return res.status(400).json({ error: "Class selection is required for students" });
      }
      studentClassRef = classRef;
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({
      email: email.toLowerCase(),
      password: hashed,
      role: role || "admin",
      schoolName: schoolName || "",
      createdBy: req.effectiveCreatedBy,
      teacherRef,
      classRef: studentClassRef
    });
    res.status(201).json({
      _id: user._id,
      email: user.email,
      role: user.role,
      schoolName: user.schoolName,
      teacherRef,
      classRef: studentClassRef
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /auth/login
router.post("/login", loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (typeof email !== "string" || typeof password !== "string") {
      return res.status(401).json({ error: "Invalid credentials" });
    }
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
        teacherRef: user.teacherRef,
        classRef: user.classRef
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
    teacherRef: req.user.teacherRef,
    classRef: req.user.classRef
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
      .populate("classRef", "name")
      .sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /auth/bulk-import — admin-only, bulk import teachers and students from spreadsheet
router.post("/bulk-import", auth, adminOnly, async (req, res) => {
  try {
    const { rows } = req.body;
    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: "No rows provided" });
    }

    const result = { imported: 0, skipped: 0, errors: [] };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 1;

      try {
        if (!row.email || !row.password) {
          result.errors.push({ row: rowNum, reason: "Email and password are required" });
          continue;
        }

        const email = row.email.toLowerCase().trim();
        const existing = await User.findOne({ email });
        if (existing) {
          result.skipped++;
          continue;
        }

        const type = (row.type || "").toLowerCase().trim();

        if (type === "teacher") {
          if (!row.name || !row.subject) {
            result.errors.push({ row: rowNum, reason: "Teacher name and subject are required" });
            continue;
          }
          const teacher = await Teacher.create({
            name: row.name.trim(),
            subject: row.subject.trim(),
            createdBy: req.effectiveCreatedBy
          });
          const hashed = await bcrypt.hash(row.password, 10);
          await User.create({
            email,
            password: hashed,
            role: "teacher",
            schoolName: "",
            createdBy: req.effectiveCreatedBy,
            teacherRef: teacher._id
          });
          result.imported++;
        } else if (type === "student") {
          if (!row.className) {
            result.errors.push({ row: rowNum, reason: "Class name is required for students" });
            continue;
          }
          const cls = await Class.findOne({ name: row.className.trim(), createdBy: req.effectiveCreatedBy });
          if (!cls) {
            result.errors.push({ row: rowNum, reason: `Class "${row.className}" not found` });
            continue;
          }
          const hashed = await bcrypt.hash(row.password, 10);
          await User.create({
            email,
            password: hashed,
            role: "student",
            schoolName: "",
            createdBy: req.effectiveCreatedBy,
            classRef: cls._id
          });
          result.imported++;
        } else {
          result.errors.push({ row: rowNum, reason: `Unknown type "${row.type}". Use "teacher" or "student"` });
        }
      } catch (err) {
        result.errors.push({ row: rowNum, reason: err.message });
      }
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /auth/forgot-password — generates a reset token
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required" });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(404).json({ error: "No account with that email" });

    const crypto = require("crypto");
    const resetToken = crypto.randomBytes(32).toString("hex");
    user.resetToken = resetToken;
    user.resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour
    await user.save();

    res.json({
      message: "Reset token generated. Check server console or copy the token below.",
      token: resetToken
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /auth/reset-password — uses token to set new password
router.post("/reset-password", async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ error: "Token and new password are required" });
    if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });

    const user = await User.findOne({
      resetToken: token,
      resetTokenExpiry: { $gt: new Date() }
    });
    if (!user) return res.status(400).json({ error: "Invalid or expired token" });

    user.password = await bcrypt.hash(password, 10);
    user.resetToken = null;
    user.resetTokenExpiry = null;
    await user.save();

    res.json({ message: "Password reset successful. You can now login with your new password." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

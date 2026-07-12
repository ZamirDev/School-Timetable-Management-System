// build-v2
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const PDFDocument = require("pdfkit");
const bcrypt = require("bcryptjs");
const Teacher = require("./models/Teacher");
const Class = require("./models/Class");
const Absence = require("./models/Absence");
const GroupSync = require("./models/GroupSync");
const User = require("./models/User");

// In-memory progress store for timetable generation
const generationProgress = {};
const { auth, adminOnly } = require("./middleware/auth");
const authRoutes = require("./routes/auth");
const leaveRequestRoutes = require("./routes/leaveRequests");


const path = require("path");
const clientBuild = path.join(__dirname, "..", "client", "build");

const app = express();
app.use(cors());
app.use(express.json());
app.use("/auth", authRoutes);
app.use("/leave-requests", leaveRequestRoutes);

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];


// ─────────────────────────────────────────────
//  HELPER: Convert Mongoose Map → plain object
//  Mongoose stores teacherQuota as a Map internally.
//  bracket notation quota[tid] returns undefined on Maps.
//  Always call this before using teacherQuota.
// ─────────────────────────────────────────────
function toPlainQuota(teacherQuota) {
  if (!teacherQuota) return {};
  if (teacherQuota instanceof Map) return Object.fromEntries(teacherQuota);
  // Sometimes Mongoose returns a Map-like object with a toObject method
  if (typeof teacherQuota.toObject === "function") return teacherQuota.toObject();
  return teacherQuota;
}

function isBlank(value) {
  return String(value ?? "").trim() === "";
}

function isWholeNumber(value) {
  return Number.isInteger(value);
}

function validateTeacherInput({ name, subject }) {
  if (isBlank(name)) return "Name is required";
  if (String(name).trim().length < 2) return "Name must be at least 2 characters";
  if (isBlank(subject)) return "Subject is required";
  return "";
}

function validatePeriodsPerDayValue(periodsPerDay) {
  if (!isWholeNumber(periodsPerDay) || periodsPerDay < 1 || periodsPerDay > 12) {
    return "Periods must be between 1 and 12";
  }
  return "";
}

function validateTimingInput({ startTime, periodDuration, breaks, breakAfter, breakDuration }, periodsPerDay) {
  if (isBlank(startTime) || !/^\d{2}:\d{2}$/.test(startTime)) return "Start time is required";
  if (!isWholeNumber(periodDuration) || periodDuration < 10 || periodDuration > 120) return "Invalid period duration";
  
  if (breaks && Array.isArray(breaks) && breaks.length > 0) {
    const seen = new Set();
    for (let i = 0; i < breaks.length; i++) {
      const b = breaks[i];
      if (!isWholeNumber(b.after) || b.after < 1 || b.after > periodsPerDay)
        return `Break ${i+1}: position must be between 1 and ${periodsPerDay}`;
      if (!isWholeNumber(b.duration) || b.duration < 5 || b.duration > 60)
        return `Break ${i+1}: duration must be 5-60 minutes`;
      if (isBlank(b.label)) return `Break ${i+1}: label is required`;
      if (seen.has(b.after)) return `Break ${i+1}: duplicate position at period ${b.after}`;
      seen.add(b.after);
    }
  } else {
    // Legacy single-break validation
    if (!isWholeNumber(breakAfter) || breakAfter < 1 || breakAfter > periodsPerDay) return "Break must be within total periods";
    if (!isWholeNumber(breakDuration) || breakDuration < 5 || breakDuration > 60) return "Invalid break duration";
  }
  return "";
}

async function classNameExists(name, userId) {
  const escapedName = String(name).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return Class.exists({ name: { $regex: `^${escapedName}$`, $options: "i" }, createdBy: userId });
}


// ─────────────────────────────────────────────
//  HELPER: Shuffle teachers with equal "remaining" count
//  Problem without this: when all 7 teachers have equal remaining periods,
//  sort gives same order every day → same teacher always in P1, P2, etc.
//  Fix: within each group of equal-remaining teachers, shuffle randomly.
// ─────────────────────────────────────────────
function sortWithShuffle(teachers, targetMap, assignedMap, classDayKey, teacherClassDayCount, priorityIds = new Set()) {
  // Group teachers: those WITH daily capacity first, those AT daily max last
  const groups = {};
  for (const t of teachers) {
    const tid = String(t._id);
    const rem = (targetMap[tid] || 0) - (assignedMap[tid] || 0);
    const dayRem = classDayKey ? (teacherClassDayCount[`${tid}_${classDayKey}`] || 0) : 0;
    // Use effective remaining: negative if daily capacity exhausted
    const effectiveRem = dayRem < 2 ? rem : -1;
    // Boost teachers with explicit unmet quotas so they sort above unlimited teachers
    // This ensures quota targets are met before filling remaining slots
    const sortKey = (priorityIds.has(tid) && effectiveRem > 0) ? effectiveRem + 1000 : effectiveRem;
    if (!groups[sortKey]) groups[sortKey] = [];
    groups[sortKey].push(t);
  }

  // Shuffle within each group (Fisher-Yates)
  for (const group of Object.values(groups)) {
    for (let i = group.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [group[i], group[j]] = [group[j], group[i]];
    }
  }

  // Return sorted descending by effective remaining, shuffled within ties
  return Object.keys(groups)
    .map(Number)
    .sort((a, b) => b - a)
    .flatMap(k => groups[k]);
}


// ─────────────────────────────────────────────
//  HELPER: Resolve breaks array from schoolTiming
//  Handles legacy single-break → multi-break migration
// ─────────────────────────────────────────────
function resolveBreaks(schoolTiming) {
  if (schoolTiming?.breaks && Array.isArray(schoolTiming.breaks) && schoolTiming.breaks.length > 0) {
    return [...schoolTiming.breaks].sort((a, b) => a.after - b.after);
  }
  // Legacy fallback
  const after = schoolTiming?.breakAfter || 3;
  const duration = schoolTiming?.breakDuration || 20;
  return [{ after, duration, label: "Break" }];
}

// ─────────────────────────────────────────────
//  HELPER: Generate time slots with breaks
//  Takes school timing config and period count
//  Returns array of {period, startTime, endTime}
// ─────────────────────────────────────────────
function generateTimeSlots(schoolTiming, periodsPerDay) {
  const slots = [];
  const startTime = schoolTiming?.startTime || "08:00";
  const periodDuration = schoolTiming?.periodDuration || 40;
  const breaks = resolveBreaks(schoolTiming);

  // Build break lookup: after → total duration
  const breakDurationMap = {};
  for (const b of breaks) {
    breakDurationMap[b.after] = (breakDurationMap[b.after] || 0) + b.duration;
  }

  // Parse start time (HH:MM format)
  let [hours, minutes] = startTime.split(":").map(Number);
  let currentMinutes = hours * 60 + minutes;

  for (let p = 1; p <= periodsPerDay; p++) {
    const startHours = Math.floor(currentMinutes / 60);
    const startMins = currentMinutes % 60;
    const slotStart = `${String(startHours).padStart(2, "0")}:${String(startMins).padStart(2, "0")}`;

    currentMinutes += periodDuration;
    const endHours = Math.floor(currentMinutes / 60);
    const endMins = currentMinutes % 60;
    const slotEnd = `${String(endHours).padStart(2, "0")}:${String(endMins).padStart(2, "0")}`;

    slots.push({
      period: p,
      startTime: slotStart,
      endTime: slotEnd
    });

    // Add break(s) after this period
    if (breakDurationMap[p] && p < periodsPerDay) {
      currentMinutes += breakDurationMap[p];
    }
  }

  return slots;
}


// ─────────────────────────────────────────────
//  GENERATION PROGRESS (polled by frontend)
// ─────────────────────────────────────────────

app.get("/generate-progress", auth, (req, res) => {
  const prog = generationProgress[req.effectiveCreatedBy];
  if (!prog) return res.json({ current: 0, total: 6, stage: "", active: false });
  res.json({ ...prog, active: true });
});

// ─────────────────────────────────────────────
//  TIMETABLE GENERATOR
// ─────────────────────────────────────────────

app.post("/generate-timetable", auth, adminOnly, async (req, res) => {
  try {
    const classes = await Class.find({ createdBy: req.effectiveCreatedBy }).populate("teachers");
    const absences = await Absence.find({ createdBy: req.effectiveCreatedBy });
    const absentTeacherDays = new Set(absences.map(a => `${String(a.teacher)}_${a.day}`));

    const teacherTimeTable  = {}; // [tid][day_period] = true  → globally booked
    const teacherDayLoad    = {}; // [tid_day]          → periods today (all classes)
    const lastPeriodTeacher = {}; // [cid_day_period]   → for no back-to-back
    const teacherClassDayCount = {}; // [tid_cid_day] = count → max 2 per day per class

    const timetableMap = {};
    for (const cls of classes) {
      timetableMap[String(cls._id)] = {};
      for (const day of DAYS) timetableMap[String(cls._id)][day] = [];
    }

    // ── Generate time slots for each class ──
    const timeSlotsByClass = {};
    for (const cls of classes) {
      const cid = String(cls._id);
      const periodsPerDay = cls.periodsPerDay || 6;
      timeSlotsByClass[cid] = generateTimeSlots(cls.schoolTiming, periodsPerDay);
    }

    // ── Build targetMap per class ──
    const targetMapByClass = {};
    const warningsByClass  = {};
    const explicitQuotaByClass = {};

    for (const cls of classes) {
      const cid           = String(cls._id);
      const periodsPerDay = cls.periodsPerDay || 6;
      const totalSlots    = periodsPerDay * DAYS.length;

      // FIX: always convert Mongoose Map to plain object
      const quota = toPlainQuota(cls.teacherQuota);

      // Only keep quota entries for teachers actually assigned to this class
      const quotaEntries = Object.entries(quota).filter(([tid]) =>
        cls.teachers.some(t => String(t._id) === tid)
      );
      const quotaTotal = quotaEntries.reduce((sum, [, n]) => sum + n, 0);

      const warnings = [];
      if (quotaTotal > totalSlots) {
        warnings.push(`Quotas total ${quotaTotal} but only ${totalSlots} slots/week. Some may not be fully met.`);
      }
      warningsByClass[cls.name] = warnings;

      const noQuotaTeachers = cls.teachers.filter(t => quota[String(t._id)] === undefined);

      const targetMap = {};
      // Teachers WITH explicit quotas: respect the quota limit
      for (const [tid, n] of quotaEntries) {
        targetMap[tid] = Math.min(n, totalSlots);
      }
      // Teachers WITHOUT explicit quotas: allow unlimited assignments (up to totalSlots)
      // This removes the artificial equal-distribution cap and prevents free periods
      noQuotaTeachers.forEach((t) => {
        targetMap[String(t._id)] = totalSlots;
      });

      targetMapByClass[cid] = targetMap;

      // Track teachers with explicit (non-auto) quotas for priority sorting
      explicitQuotaByClass[cid] = new Set(quotaEntries.map(([tid]) => tid));
    }

    // ── Build teacher group lookups per class ──
    const teacherToGroup = {};  // [cid][tid] = { groupName, teacherIds }
    const groupedTeacherIds = {}; // [cid] = Set<tid>
    for (const cls of classes) {
      const cid = String(cls._id);
      teacherToGroup[cid] = {};
      groupedTeacherIds[cid] = new Set();
      if (cls.teacherGroups && Array.isArray(cls.teacherGroups)) {
        for (const g of cls.teacherGroups) {
          const ids = g.teachers.map(t => String(t._id ?? t));
          for (const tid of ids) {
            teacherToGroup[cid][tid] = { groupName: g.groupName, teacherIds: ids };
            groupedTeacherIds[cid].add(tid);
          }
        }
      }
    }

    // ── Build group sync lookups ──
    const groupSyncs = await GroupSync.find({ createdBy: req.effectiveCreatedBy });
    const syncByClass = {}; // [cid] = Array<{ syncId, teacherKey, teacherIds, groupName }>
    const slotClaims = {}; // [syncId] = Set<"day_period">
    const syncsList = []; // { syncId, classIds, teacherIds, teacherKey, groupName }
    for (const sync of groupSyncs) {
      const tids = (sync.teacherIds || []).map(t => String(t._id ?? t));
      const cids = (sync.classIds || []).map(c => String(c._id ?? c));
      const teacherKey = [...tids].sort().join(',');
      slotClaims[sync.syncId] = new Set();
      syncsList.push({ syncId: sync.syncId, classIds: cids, teacherIds: tids, teacherKey, groupName: sync.groupName });
      for (const cid of cids) {
        if (!syncByClass[cid]) syncByClass[cid] = [];
        syncByClass[cid].push({ syncId: sync.syncId, teacherKey, teacherIds: tids, groupName: sync.groupName });
      }
    }

    // assignedCount[cid][tid] = periods assigned so far in this class this week
    const assignedCount = {};
    for (const cls of classes) assignedCount[String(cls._id)] = {};

    const maxPeriods = Math.max(...classes.map(c => c.periodsPerDay || 6));

    const userId = req.effectiveCreatedBy;
    generationProgress[userId] = { current: 0, total: DAYS.length, stage: "Starting generation..." };

    // ── MAIN LOOP: day → period → ALL classes simultaneously ──
    for (let di = 0; di < DAYS.length; di++) {
      const day = DAYS[di];
      generationProgress[userId] = { current: di, total: DAYS.length, stage: `Processing ${day}...` };
      // Shuffle class order each day so no class always gets last pick
      const shuffledClasses = [...classes];
      for (let i = shuffledClasses.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledClasses[i], shuffledClasses[j]] = [shuffledClasses[j], shuffledClasses[i]];
      }

      for (let p = 1; p <= maxPeriods; p++) {
        const timeKey = `${day}_${p}`;
        const handledCids = new Set(); // classes already assigned via leader pass

        // ── SYNC LEADER PASS: try to claim unclaimed sync slots ──
        for (const syncData of syncsList) {
          if (slotClaims[syncData.syncId].has(timeKey)) continue;

          // Shuffle sync classes so the "leader" varies
          const syncCids = [...syncData.classIds];
          for (let i = syncCids.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [syncCids[i], syncCids[j]] = [syncCids[j], syncCids[i]];
          }

          for (const cid of syncCids) {
            const cls = classes.find(c => String(c._id) === cid);
            if (!cls || p > (cls.periodsPerDay || 6)) continue;
            if (handledCids.has(cid)) continue;

            // Verify this class actually has this group
            const firstTid = syncData.teacherIds[0];
            const classGroupInfo = teacherToGroup[cid]?.[firstTid];
            if (!classGroupInfo) continue;
            const classGroupKey = [...classGroupInfo.teacherIds].sort().join(',');
            if (classGroupKey !== syncData.teacherKey) continue;

            const lastKey  = `${cid}_${day}_${p - 1}`;
            const target   = targetMapByClass[cid];
            const assigned = assignedCount[cid];

            let allAvailable = true;
            for (const gid of syncData.teacherIds) {
              if (absentTeacherDays.has(`${gid}_${day}`)) { allAvailable = false; break; }
              if ((assigned[gid] || 0) >= (target[gid] || 0)) { allAvailable = false; break; }
              if ((teacherDayLoad[`${gid}_${day}`] || 0) >= 4) { allAvailable = false; break; }
              if ((teacherClassDayCount[`${gid}_${cid}_${day}`] || 0) >= 2) { allAvailable = false; break; }
              if (teacherTimeTable[gid] && teacherTimeTable[gid][timeKey]) { allAvailable = false; break; }
              if (lastPeriodTeacher[lastKey] && lastPeriodTeacher[lastKey] === gid) { allAvailable = false; break; }
            }
            if (!allAvailable) continue;

            const ft = cls.teachers.find(t => String(t._id) === syncData.teacherIds[0]);
            if (!ft) continue;

            // Assign ALL group members (full tracking — this is the leader)
            for (const gid of syncData.teacherIds) {
              assigned[gid] = (assigned[gid] || 0) + 1;
              teacherDayLoad[`${gid}_${day}`] = (teacherDayLoad[`${gid}_${day}`] || 0) + 1;
              if (!teacherTimeTable[gid]) teacherTimeTable[gid] = {};
              teacherTimeTable[gid][timeKey] = true;
              teacherClassDayCount[`${gid}_${cid}_${day}`] = (teacherClassDayCount[`${gid}_${cid}_${day}`] || 0) + 1;
            }
            lastPeriodTeacher[`${cid}_${day}_${p}`] = syncData.teacherIds[0];

            const leaderTracks = syncData.teacherIds
              .filter(gid => gid !== syncData.teacherIds[0])
              .map(gid => {
                const gt = cls.teachers.find(tt => String(tt._id) === gid);
                return { groupName: syncData.groupName, teacher: gid, subject: gt ? gt.subject : "" };
              });

            timetableMap[cid][day].push({
              period: p,
              startTime: timeSlotsByClass[cid][p - 1].startTime,
              endTime: timeSlotsByClass[cid][p - 1].endTime,
              teacher: ft._id,
              subject: ft.subject,
              tracks: leaderTracks,
            });

            slotClaims[syncData.syncId].add(timeKey);
            handledCids.add(cid);
            break; // slot claimed for this sync
          }
        }

        // ── SHUFFLED CLASS LOOP ──
        for (const cls of shuffledClasses) {
          const cid = String(cls._id);
          if (handledCids.has(cid)) continue;

          const periodsPerDay = cls.periodsPerDay || 6;
          if (p > periodsPerDay) continue;

          const lastKey  = `${cid}_${day}_${p - 1}`;
          const target   = targetMapByClass[cid];
          const assigned = assignedCount[cid];
          const sortedTeachers = sortWithShuffle(cls.teachers, target, assigned, `${cid}_${day}`, teacherClassDayCount, explicitQuotaByClass[cid]);

          let assignedTeacher = null;
          let groupAssigned = null;

          const classSyncs = syncByClass[cid] || [];

          // CHECK 1: Sync follower — mirror the leader's placement
          let syncMatch = null;
          for (const s of classSyncs) {
            if (slotClaims[s.syncId].has(timeKey)) {
              syncMatch = s;
              break;
            }
          }
          if (syncMatch) {
            let allAvailable = true;
            for (const gid of syncMatch.teacherIds) {
              if (absentTeacherDays.has(`${gid}_${day}`)) { allAvailable = false; break; }
              if ((teacherDayLoad[`${gid}_${day}`] || 0) >= 4) { allAvailable = false; break; }
              if ((teacherClassDayCount[`${gid}_${cid}_${day}`] || 0) >= 2) { allAvailable = false; break; }
              if (lastPeriodTeacher[lastKey] && lastPeriodTeacher[lastKey] === gid) { allAvailable = false; break; }
              // Intentionally NOT checking teacherTimeTable — cross-class sync is expected
            }
            if (allAvailable) {
              const ft = cls.teachers.find(t => String(t._id) === syncMatch.teacherIds[0]);
              if (ft) {
                // Follower: update only class-specific tracking, not global
                for (const gid of syncMatch.teacherIds) {
                  teacherClassDayCount[`${gid}_${cid}_${day}`] = (teacherClassDayCount[`${gid}_${cid}_${day}`] || 0) + 1;
                }
                lastPeriodTeacher[`${cid}_${day}_${p}`] = syncMatch.teacherIds[0];
                assignedTeacher = ft;
                groupAssigned = { firstTeacher: ft, teacherIds: syncMatch.teacherIds, groupName: syncMatch.groupName };
              }
            }
          }

          // CHECK 2: Normal assignment (group or individual)
          if (!assignedTeacher) {
            for (const t of sortedTeachers) {
              const tid    = String(t._id);
              const dayKey = `${tid}_${day}`;
              const classKey = `${tid}_${cid}_${day}`;

              const groupInfo = teacherToGroup[cid]?.[tid];
              if (groupInfo) {
                let allAvailable = true;
                for (const gid of groupInfo.teacherIds) {
                  if (absentTeacherDays.has(`${gid}_${day}`)) { allAvailable = false; break; }
                  if ((assigned[gid] || 0) >= (target[gid] || 0)) { allAvailable = false; break; }
                  if ((teacherDayLoad[`${gid}_${day}`] || 0) >= 4) { allAvailable = false; break; }
                  if (lastPeriodTeacher[lastKey] && lastPeriodTeacher[lastKey] === gid) { allAvailable = false; break; }
                  if ((teacherClassDayCount[`${gid}_${cid}_${day}`] || 0) >= 2) { allAvailable = false; break; }
                  if (teacherTimeTable[gid] && teacherTimeTable[gid][timeKey]) { allAvailable = false; break; }
                }
                if (!allAvailable) continue;

                for (const gid of groupInfo.teacherIds) {
                  assigned[gid] = (assigned[gid] || 0) + 1;
                  teacherDayLoad[`${gid}_${day}`] = (teacherDayLoad[`${gid}_${day}`] || 0) + 1;
                  if (!teacherTimeTable[gid]) teacherTimeTable[gid] = {};
                  teacherTimeTable[gid][timeKey] = true;
                  teacherClassDayCount[`${gid}_${cid}_${day}`] = (teacherClassDayCount[`${gid}_${cid}_${day}`] || 0) + 1;
                }
                lastPeriodTeacher[`${cid}_${day}_${p}`] = tid;
                assignedTeacher = t;
                groupAssigned = { firstTeacher: t, teacherIds: groupInfo.teacherIds, groupName: groupInfo.groupName };
                break;
              }

              if (groupedTeacherIds[cid].has(tid)) continue;
              if (absentTeacherDays.has(`${tid}_${day}`)) continue;
              if ((assigned[tid] || 0) >= (target[tid] || 0)) continue;
              if ((teacherDayLoad[dayKey] || 0) >= 4) continue;
              if (lastPeriodTeacher[lastKey] && lastPeriodTeacher[lastKey] === tid) continue;

              const lastTid = lastPeriodTeacher[lastKey];
              if (lastTid) {
                const lastTeacher = cls.teachers.find(tt => String(tt._id) === lastTid);
                if (lastTeacher && t.subject === lastTeacher.subject) continue;
              }

              if ((teacherClassDayCount[classKey] || 0) >= 2) continue;
              if (teacherTimeTable[tid] && teacherTimeTable[tid][timeKey]) continue;

              assignedTeacher = t;
              assigned[tid]          = (assigned[tid]          || 0) + 1;
              teacherDayLoad[dayKey] = (teacherDayLoad[dayKey] || 0) + 1;
              if (!teacherTimeTable[tid]) teacherTimeTable[tid] = {};
              teacherTimeTable[tid][timeKey] = true;
              lastPeriodTeacher[`${cid}_${day}_${p}`] = tid;
              teacherClassDayCount[classKey] = (teacherClassDayCount[classKey] || 0) + 1;
              break;
            }
          }

          // CHECK 3: Fallback
          if (!assignedTeacher) {
            for (const t of cls.teachers) {
              const tid    = String(t._id);
              const dayKey = `${tid}_${day}`;
              const classKey = `${tid}_${cid}_${day}`;

              const groupInfo = teacherToGroup[cid]?.[tid];
              if (groupInfo) {
                let allAvailable = true;
                for (const gid of groupInfo.teacherIds) {
                  if (absentTeacherDays.has(`${gid}_${day}`)) { allAvailable = false; break; }
                  if (teacherTimeTable[gid] && teacherTimeTable[gid][timeKey]) { allAvailable = false; break; }
                  if ((teacherClassDayCount[`${gid}_${cid}_${day}`] || 0) >= 2) { allAvailable = false; break; }
                  if ((teacherDayLoad[`${gid}_${day}`] || 0) >= 4) { allAvailable = false; break; }
                  if (lastPeriodTeacher[lastKey] && lastPeriodTeacher[lastKey] === gid) { allAvailable = false; break; }
                }
                if (!allAvailable) continue;

                for (const gid of groupInfo.teacherIds) {
                  assigned[gid] = (assigned[gid] || 0) + 1;
                  teacherDayLoad[`${gid}_${day}`] = (teacherDayLoad[`${gid}_${day}`] || 0) + 1;
                  if (!teacherTimeTable[gid]) teacherTimeTable[gid] = {};
                  teacherTimeTable[gid][timeKey] = true;
                  teacherClassDayCount[`${gid}_${cid}_${day}`] = (teacherClassDayCount[`${gid}_${cid}_${day}`] || 0) + 1;
                }
                lastPeriodTeacher[`${cid}_${day}_${p}`] = tid;
                assignedTeacher = t;
                groupAssigned = { firstTeacher: t, teacherIds: groupInfo.teacherIds, groupName: groupInfo.groupName };
                break;
              }

              if (groupedTeacherIds[cid].has(tid)) continue;
              if (absentTeacherDays.has(`${tid}_${day}`)) continue;
              if (teacherTimeTable[tid] && teacherTimeTable[tid][timeKey]) continue;
              if ((teacherClassDayCount[classKey] || 0) >= 2) continue;
              if ((teacherDayLoad[dayKey] || 0) >= 4) continue;
              if (lastPeriodTeacher[lastKey] && lastPeriodTeacher[lastKey] === tid) continue;

              const lastTid = lastPeriodTeacher[lastKey];
              if (lastTid) {
                const lastTeacher = cls.teachers.find(tt => String(tt._id) === lastTid);
                if (lastTeacher && t.subject === lastTeacher.subject) continue;
              }

              assignedTeacher = t;
              assigned[tid]          = (assigned[tid]          || 0) + 1;
              teacherDayLoad[dayKey] = (teacherDayLoad[dayKey] || 0) + 1;
              if (!teacherTimeTable[tid]) teacherTimeTable[tid] = {};
              teacherTimeTable[tid][timeKey] = true;
              lastPeriodTeacher[`${cid}_${day}_${p}`] = tid;
              teacherClassDayCount[classKey] = (teacherClassDayCount[classKey] || 0) + 1;
              break;
            }
          }

          // Build tracks array if a group was assigned
          let tracks = [];
          if (groupAssigned) {
            tracks = groupAssigned.teacherIds
              .filter(gid => gid !== String(assignedTeacher._id))
              .map(gid => {
                const gt = cls.teachers.find(tt => String(tt._id) === gid);
                return {
                  groupName: groupAssigned.groupName,
                  teacher: gid,
                  subject: gt ? gt.subject : "",
                };
              });
          }

            timetableMap[cid][day].push({
            period:  p,
            startTime: timeSlotsByClass[cid][p - 1].startTime,
            endTime: timeSlotsByClass[cid][p - 1].endTime,
            teacher: assignedTeacher ? assignedTeacher._id : null,
            subject: assignedTeacher ? assignedTeacher.subject : "Free Period",
            tracks,
          });
        }
      }
      generationProgress[userId] = { current: di + 1, total: DAYS.length, stage: `Finished ${day}` };
    }
    generationProgress[userId] = { current: DAYS.length, total: DAYS.length, stage: "Saving to database..." };

    // ── Build quota summary ──
    const quotaSummary = {};
    for (const cls of classes) {
      const cid = String(cls._id);
      const teachers = cls.teachers;
      const target = targetMapByClass[cid];
      const assigned = assignedCount[cid];
      const quota = toPlainQuota(cls.teacherQuota);
      const list = [];
      for (const t of teachers) {
        const tid = String(t._id);
        list.push({
          name: t.name,
          subject: t.subject,
          target: target[tid] ?? 0,
          got: assigned[tid] ?? 0,
          quota: quota[tid] ?? null,
        });
      }
      quotaSummary[cls.name] = { teachers: list };
    }

    // ── Debug: print quota summary ──
    console.log("\n=== QUOTA SUMMARY ===");
    for (const [className, data] of Object.entries(quotaSummary)) {
      console.log(`  ${className}:`);
      for (const t of data.teachers) {
        const status = t.got >= t.target ? "✅" : "⚠️";
        const quotaInfo = t.quota !== null ? `(quota=${t.quota})` : "(auto)";
        console.log(`    ${t.name} (${t.subject}): ${t.got}/${t.target} ${status} ${quotaInfo}`);
      }
    }
    console.log("=====================\n");

    // ── Save to MongoDB ──
    for (const cls of classes) {
      const cid = String(cls._id);
      const newTimetable = DAYS.map(day => ({
        day,
        periods: timetableMap[cid][day],
      }));
      await Class.findByIdAndUpdate(cls._id, { $set: { timetable: newTimetable } });
    }

    delete generationProgress[userId];
    res.json({ message: "Timetable Generated Successfully", quotaSummary });

  } catch (err) {
    const userId = req.effectiveCreatedBy;
    delete generationProgress[userId];
    console.log("GEN ERROR:", err);
    res.status(500).json({ error: "Generation failed" });
  }
});


// ─────────────────────────────────────────────
//  SWAP PERIODS (click-to-swap)
// ─────────────────────────────────────────────

app.put("/classes/:id/swap-periods", auth, adminOnly, async (req, res) => {
  try {
    const { day, periodA, periodB } = req.body;

    if (!day || !periodA || !periodB) {
      return res.status(400).json({ error: "day, periodA, periodB required" });
    }
    if (periodA === periodB) {
      return res.status(400).json({ error: "Cannot swap a period with itself" });
    }

    const cls = await Class.findOne({ _id: req.params.id, createdBy: req.effectiveCreatedBy });
    if (!cls) return res.status(404).json({ error: "Class not found" });

    const dayData = cls.timetable.find(d => d.day === day);
    if (!dayData) return res.status(404).json({ error: "Day not found in timetable" });

    const pA = dayData.periods.find(p => p.period === periodA);
    const pB = dayData.periods.find(p => p.period === periodB);
    if (!pA || !pB) return res.status(404).json({ error: "Period not found" });

    if (!pA.teacher && !pB.teacher) {
      return res.status(400).json({ error: "Both periods are free, nothing to swap" });
    }

    const getTid = (p) => p.teacher ? String(p.teacher) : null;
    const tidA = getTid(pA);
    const tidB = getTid(pB);

    // Load other classes to check cross-class conflicts
    const others = await Class.find({ _id: { $ne: cls._id } }, { timetable: 1, name: 1 });

    // Check teacherA (moving to periodB) would not clash
    if (tidA) {
      for (const other of others) {
        const otherDay = other.timetable.find(d => d.day === day);
        if (!otherDay) continue;
        const slot = otherDay.periods.find(p => p.period === periodB);
        if (slot && slot.teacher && String(slot.teacher) === tidA) {
          const teacherDoc = await Teacher.findById(tidA).select("name");
          return res.status(400).json({
            error: `Clash: ${teacherDoc?.name || "Teacher"} already teaches ${other.name} at ${day} Period ${periodB}`
          });
        }
      }
    }

    // Check teacherB (moving to periodA) would not clash
    if (tidB) {
      for (const other of others) {
        const otherDay = other.timetable.find(d => d.day === day);
        if (!otherDay) continue;
        const slot = otherDay.periods.find(p => p.period === periodA);
        if (slot && slot.teacher && String(slot.teacher) === tidB) {
          const teacherDoc = await Teacher.findById(tidB).select("name");
          return res.status(400).json({
            error: `Clash: ${teacherDoc?.name || "Teacher"} already teaches ${other.name} at ${day} Period ${periodA}`
          });
        }
      }
    }

    // ✅ Swap
    const tmpTeacher = pA.teacher;
    const tmpSubject = pA.subject;
    pA.teacher = pB.teacher;
    pA.subject = pB.subject;
    pB.teacher = tmpTeacher;
    pB.subject = tmpSubject;

    await cls.save();

    // Return populated
    const updated = await Class.findById(cls._id)
      .populate("teachers")
      .populate("timetable.periods.teacher")
      .populate("timetable.periods.tracks.teacher");

    res.json({ message: "Periods swapped successfully", class: updated });

  } catch (err) {
    console.log("SWAP ERROR:", err);
    res.status(500).json({ error: "Swap failed" });
  }
});


// ─────────────────────────────────────────────
//  ABSENCE ROUTES
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

app.get("/absences", auth, async (req, res) => {
  try {
    const absences = await Absence.find({ createdBy: req.effectiveCreatedBy }).populate("teacher").sort({ day: 1 });
    res.json(absences);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch absences" });
  }
});

app.post("/absences", auth, adminOnly, async (req, res) => {
  try {
    const { teacherId, day } = req.body;
    if (isBlank(teacherId)) return res.status(400).json({ error: "Select a teacher" });
    if (!DAYS.includes(day)) return res.status(400).json({ error: "Select a valid day" });

    const teacher = await Teacher.findOne({ _id: teacherId, createdBy: req.effectiveCreatedBy });
    if (!teacher) return res.status(404).json({ error: "Teacher not found" });

    const absence = await Absence.findOneAndUpdate(
      { teacher: teacherId, day, createdBy: req.effectiveCreatedBy },
      { $set: { teacher: teacherId, day, createdBy: req.effectiveCreatedBy } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).populate("teacher");

    res.json({ message: "Absence saved", absence });
  } catch (err) {
    res.status(500).json({ error: "Failed to save absence" });
  }
});

app.delete("/absences/:id", auth, adminOnly, async (req, res) => {
  try {
    await Absence.findOneAndDelete({ _id: req.params.id, createdBy: req.effectiveCreatedBy });
    res.json({ message: "Absence removed" });
  } catch (err) {
    res.status(500).json({ error: "Failed to remove absence" });
  }
});


// ─────────────────────────────────────────────
//  GROUP SYNC ROUTES
// ─────────────────────────────────────────────

app.get("/group-syncs", auth, async (req, res) => {
  try {
    const syncs = await GroupSync.find({ createdBy: req.effectiveCreatedBy })
      .populate("classIds")
      .populate("teacherIds");
    res.json(syncs);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch group syncs" });
  }
});

app.post("/group-syncs", auth, adminOnly, async (req, res) => {
  try {
    const { classIds, teacherIds, groupName } = req.body;
    if (!groupName || !groupName.trim()) return res.status(400).json({ error: "Group name is required" });
    if (!Array.isArray(classIds) || classIds.length < 2) return res.status(400).json({ error: "Select at least 2 classes" });
    if (!Array.isArray(teacherIds) || teacherIds.length < 2) return res.status(400).json({ error: "Select at least 2 teachers" });

    const syncId = Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

    const sync = new GroupSync({
      syncId,
      groupName: groupName.trim(),
      classIds,
      teacherIds,
      createdBy: req.effectiveCreatedBy,
    });
    await sync.save();

    const populated = await GroupSync.findById(sync._id)
      .populate("classIds")
      .populate("teacherIds");
    res.json(populated);
  } catch (err) {
    res.status(500).json({ error: "Failed to create group sync" });
  }
});

app.delete("/group-syncs/:syncId", auth, adminOnly, async (req, res) => {
  try {
    await GroupSync.findOneAndDelete({ syncId: req.params.syncId, createdBy: req.effectiveCreatedBy });
    res.json({ message: "Group sync removed" });
  } catch (err) {
    res.status(500).json({ error: "Failed to remove group sync" });
  }
});

// ─────────────────────────────────────────────
//  QUOTA ROUTES
// ─────────────────────────────────────────────

// PUT /classes/:id/quota
// Body: { "teacherId1": 8, "teacherId2": 1 }
app.put("/classes/:id/quota", auth, adminOnly, async (req, res) => {
  try {
    const quotaInput = req.body;
    if (!quotaInput || typeof quotaInput !== "object" || Array.isArray(quotaInput)) {
      return res.status(400).json({ error: "Body must be { teacherId: periods, ... }" });
    }
    const cls = await Class.findOne({ _id: req.params.id, createdBy: req.effectiveCreatedBy }).populate("teachers");
    if (!cls) return res.status(404).json({ error: "Class not found" });

    const assignedTeacherIds = cls.teachers.map(t => String(t._id));
    let totalQuota = 0;
    const quota = {}; // Only include teachers with actual quota values
    
    for (const [tid, n] of Object.entries(quotaInput)) {
      if (!assignedTeacherIds.includes(String(tid))) {
        return res.status(400).json({ error: "Teacher is not assigned to this class" });
      }
      
      // Convert to number and validate - skip if not a valid positive integer
      const numValue = Number(n);
      if (isNaN(numValue) || numValue < 1 || !isWholeNumber(numValue)) {
        // Skip any invalid/empty values - they won't have quota set
        continue;
      }
      
      quota[tid] = numValue;
      totalQuota += numValue;
    }

    const totalSlots = (cls.periodsPerDay || 6) * DAYS.length;
    if (totalQuota > totalSlots) {
      return res.status(400).json({ error: "Total quota exceeds available periods" });
    }
    
    const updated = await Class.findOneAndUpdate(
      { _id: req.params.id, createdBy: req.effectiveCreatedBy },
      { $set: { teacherQuota: quota } },
      { new: true }
    );

    // Return as plain object so frontend can use it directly
    const plainQuota = toPlainQuota(updated.teacherQuota);
    res.json({ message: "Quota updated", class: updated.name, teacherQuota: plainQuota });
  } catch (err) {
    console.log("QUOTA ERROR:", err);
    res.status(500).json({ error: "Failed to update quota" });
  }
});

// GET /classes/:id/quota
app.get("/classes/:id/quota", auth, async (req, res) => {
  try {
    const cls = await Class.findOne({ _id: req.params.id, createdBy: req.effectiveCreatedBy }).populate("teachers");
    if (!cls) return res.status(404).json({ error: "Class not found" });
    const plainQuota = toPlainQuota(cls.teacherQuota);
    res.json({ class: cls.name, quota: plainQuota });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch quota" });
  }
});

// PUT /classes/:id/periods-per-day
// Body: { "periodsPerDay": 8 }
app.put("/classes/:id/periods-per-day", auth, adminOnly, async (req, res) => {
  try {
    const { periodsPerDay } = req.body;
    const error = validatePeriodsPerDayValue(periodsPerDay);
    if (error) return res.status(400).json({ error });
    if (!periodsPerDay || periodsPerDay < 1 || periodsPerDay > 12) {
      return res.status(400).json({ error: "periodsPerDay must be 1–12" });
    }
    const updated = await Class.findOneAndUpdate(
      { _id: req.params.id, createdBy: req.effectiveCreatedBy },
      { $set: { periodsPerDay } },
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: "Class not found" });
    res.json({ message: "Updated", class: updated.name, periodsPerDay: updated.periodsPerDay });
  } catch (err) {
    res.status(500).json({ error: "Failed to update" });
  }
});

// PUT /classes/:id/school-timing
app.put("/classes/:id/school-timing", auth, adminOnly, async (req, res) => {
  try {
    const { startTime, periodDuration, breaks, breakAfter, breakDuration } = req.body;
    const cls = await Class.findOne({ _id: req.params.id, createdBy: req.effectiveCreatedBy });
    if (!cls) return res.status(404).json({ error: "Class not found" });
    const pDay = cls.periodsPerDay || 6;

    const timingError = validateTimingInput(
      { startTime, periodDuration, breaks, breakAfter, breakDuration },
      pDay
    );
    if (timingError) return res.status(400).json({ error: timingError });

    const schoolTiming = {};
    if (startTime) schoolTiming.startTime = startTime;
    if (periodDuration) schoolTiming.periodDuration = periodDuration;
    if (breaks && Array.isArray(breaks)) {
      schoolTiming.breaks = breaks;
      schoolTiming.breakAfter = undefined;
      schoolTiming.breakDuration = undefined;
    } else if (breakAfter !== undefined || breakDuration !== undefined) {
      schoolTiming.breakAfter = breakAfter;
      schoolTiming.breakDuration = breakDuration;
    }

    const updated = await Class.findOneAndUpdate(
      { _id: req.params.id, createdBy: req.effectiveCreatedBy },
      { $set: { schoolTiming } },
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: "Class not found" });
    res.json({ 
      message: "School timing updated", 
      class: updated.name, 
      schoolTiming: updated.schoolTiming 
    });
  } catch (err) {
    console.log("TIMING ERROR:", err);
    res.status(500).json({ error: "Failed to update school timing" });
  }
});

// PUT /update-all-classes-timing - Update school timing for ALL classes
app.put("/update-all-classes-timing", auth, adminOnly, async (req, res) => {
  try {
    const { startTime, periodDuration, breaks, breakAfter, breakDuration } = req.body;
    const pDay = 12;

    const timingError = validateTimingInput(
      { startTime, periodDuration, breaks, breakAfter, breakDuration },
      pDay
    );
    if (timingError) return res.status(400).json({ error: timingError });

    const schoolTiming = {};
    if (startTime) schoolTiming.startTime = startTime;
    if (periodDuration) schoolTiming.periodDuration = periodDuration;
    if (breaks && Array.isArray(breaks)) {
      schoolTiming.breaks = breaks;
      schoolTiming.breakAfter = undefined;
      schoolTiming.breakDuration = undefined;
    } else if (breakAfter !== undefined || breakDuration !== undefined) {
      schoolTiming.breakAfter = breakAfter;
      schoolTiming.breakDuration = breakDuration;
    }

    const result = await Class.updateMany({ createdBy: req.effectiveCreatedBy }, { $set: { schoolTiming } });

    res.json({ 
      message: "School timing updated for all classes", 
      updatedCount: result.modifiedCount,
      schoolTiming 
    });
  } catch (err) {
    console.log("TIMING ERROR:", err);
    res.status(500).json({ error: "Failed to update school timing" });
  }
});

// GET /classes/:id/school-timing
app.get("/classes/:id/school-timing", auth, async (req, res) => {
  try {
    const cls = await Class.findOne({ _id: req.params.id, createdBy: req.effectiveCreatedBy });
    if (!cls) return res.status(404).json({ error: "Class not found" });
    res.json({ class: cls.name, schoolTiming: cls.schoolTiming });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch school timing" });
  }
});


// PUT /classes/:id/edit-period — edit a single period's teacher/subject
app.put("/classes/:id/edit-period", auth, adminOnly, async (req, res) => {
  try {
    const { day, period, teacherId, subject, tracks } = req.body;
    if (!day || !period) {
      return res.status(400).json({ error: "day and period are required" });
    }

    const cls = await Class.findOne({ _id: req.params.id, createdBy: req.effectiveCreatedBy });
    if (!cls) return res.status(404).json({ error: "Class not found" });

    const dayData = cls.timetable.find(d => d.day === day);
    if (!dayData) return res.status(404).json({ error: "Day not found in timetable" });

    const p = dayData.periods.find(pr => pr.period === period);
    if (!p) return res.status(404).json({ error: "Period not found" });

    // If changing teacher, validate assignment + check conflicts
    if (teacherId !== undefined) {
      if (teacherId) {
        const teacherExists = cls.teachers.some(t => String(t) === teacherId || String(t._id) === teacherId);
        if (!teacherExists) {
          return res.status(400).json({ error: "Teacher not assigned to this class" });
        }

        // Check if teacher is absent this day
        const absence = await Absence.findOne({
          teacher: teacherId,
          day,
          createdBy: req.effectiveCreatedBy
        });
        if (absence) {
          const teacherDoc = await Teacher.findById(teacherId).select("name");
          return res.status(400).json({
            error: `${teacherDoc?.name || "Teacher"} is marked absent on ${day}`
          });
        }

        // Check cross-class conflicts
        const others = await Class.find({ _id: { $ne: cls._id } }, { timetable: 1, name: 1 });
        for (const other of others) {
          const otherDay = other.timetable.find(d => d.day === day);
          if (!otherDay) continue;
          const slot = otherDay.periods.find(pr => pr.period === period);
          if (slot && slot.teacher && String(slot.teacher) === teacherId) {
            const teacherDoc = await Teacher.findById(teacherId).select("name");
            return res.status(400).json({
              error: `Clash: ${teacherDoc?.name || "Teacher"} already teaches ${other.name} at ${day} Period ${period}`
            });
          }
        }
      }
      p.teacher = teacherId || null;
    }

    if (subject !== undefined) {
      p.subject = subject || "Free Period";
    }

    // Handle tracks (elective groups)
    if (tracks !== undefined) {
      p.tracks = tracks.filter(t => t.groupName && t.groupName.trim());
      for (const tr of p.tracks) {
        if (tr.teacher) {
          const teacherExists = cls.teachers.some(t => String(t) === String(tr.teacher) || String(t._id) === String(tr.teacher));
          if (!teacherExists) {
            return res.status(400).json({ error: `Teacher "${tr.teacher}" not assigned to this class` });
          }
        }
        if (!tr.subject) tr.subject = "Free Period";
      }
    }

    await cls.save();

    const updated = await Class.findById(cls._id)
      .populate("teachers")
      .populate("timetable.periods.teacher")
      .populate("timetable.periods.tracks.teacher");

    res.json({ message: "Period updated successfully", class: updated });
  } catch (err) {
    console.log("EDIT PERIOD ERROR:", err);
    res.status(500).json({ error: "Failed to edit period" });
  }
});

// ─────────────────────────────────────────────
//  FULL DATA IMPORT
// ─────────────────────────────────────────────

app.post("/import", auth, adminOnly, async (req, res) => {
  try {
    const { teachers, accounts, classes, timetable, teacherGroups, groupSyncs, absences } = req.body;
    const result = { teachers: 0, accounts: 0, classes: 0, periods: 0, teacherGroups: 0, groupSyncs: 0, absences: 0, errors: [] };

    // ── 1. Teachers ──
    const teacherMap = {};
    for (const t of teachers || []) {
      const name = (t.name || "").trim();
      const subject = (t.subject || "").trim();
      if (!name || !subject) continue;
      let teacher = await Teacher.findOne({ name: { $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" }, createdBy: req.effectiveCreatedBy });
      if (!teacher) {
        teacher = await Teacher.create({ name, subject, createdBy: req.effectiveCreatedBy });
        result.teachers++;
      }
      teacherMap[`${name}_${subject}`] = String(teacher._id);
    }
    const allTeachers = await Teacher.find({ createdBy: req.effectiveCreatedBy });
    for (const t of allTeachers) {
      teacherMap[`${t.name}_${t.subject}`] = String(t._id);
    }

    // ── 2. Accounts ──
    for (const a of accounts || []) {
      const email = (a.email || "").toLowerCase().trim();
      if (!email) continue;
      const existing = await User.findOne({ email });
      if (existing) continue;
      const pw = a.password || "school123";
      const hashed = await bcrypt.hash(pw, 10);
      const userData = {
        email,
        password: hashed,
        role: a.role || "teacher",
        schoolName: a.name || a.schoolName || "",
        createdBy: req.effectiveCreatedBy,
        plainPassword: pw,
      };
      if ((a.role || "").toLowerCase() === "teacher" && a.name && a.subject) {
        const tid = teacherMap[`${a.name.trim()}_${a.subject.trim()}`];
        if (tid) userData.teacherRef = tid;
      }
      if ((a.role || "").toLowerCase() === "student" && a.className) {
        const cls = await Class.findOne({ name: { $regex: `^${a.className.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" }, createdBy: req.effectiveCreatedBy });
        if (cls) userData.classRef = cls._id;
      }
      await User.create(userData);
      result.accounts++;
    }

    // ── 3. Classes ──
    for (const cl of classes || []) {
      const name = (cl.name || "").trim();
      if (!name) continue;
      let cls = await Class.findOne({ name: { $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" }, createdBy: req.effectiveCreatedBy });
      if (!cls) {
        cls = new Class({ name, createdBy: req.effectiveCreatedBy });
        result.classes++;
      }
      if (cl.periodsPerDay) cls.periodsPerDay = Number(cl.periodsPerDay);
      cls.schoolTiming = {
        startTime: cl.startTime || "08:00",
        periodDuration: Number(cl.periodDuration) || 40,
        breakAfter: Number(cl.breakAfter) || 3,
        breakDuration: Number(cl.breakDuration) || 20,
        breaks: [{ after: Number(cl.breakAfter) || 3, duration: Number(cl.breakDuration) || 20, label: "Break" }]
      };
      if (cl.teacherNames) {
        const names = typeof cl.teacherNames === "string" ? cl.teacherNames.split(",").map(s => s.trim()).filter(Boolean) : cl.teacherNames;
        for (const tname of names) {
          const teacher = await Teacher.findOne({ name: { $regex: `^${tname.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" }, createdBy: req.effectiveCreatedBy });
          if (teacher && !cls.teachers.some(t => String(t) === String(teacher._id))) {
            cls.teachers.push(teacher._id);
          }
        }
      }
      await cls.save();
    }

    // ── 4. Timetable ──
    const classMap = {};
    const allClasses = await Class.find({ createdBy: req.effectiveCreatedBy });
    for (const c of allClasses) classMap[c.name] = String(c._id);

    if (timetable && timetable.length > 0) {
      const byClass = {};
      for (const row of timetable) {
        const cName = (row.className || row.Class || "").trim();
        if (!cName || !classMap[cName]) continue;
        const cid = classMap[cName];
        if (!byClass[cid]) byClass[cid] = {};
        const day = row.day || "";
        if (!byClass[cid][day]) byClass[cid][day] = {};
        const p = Number(row.period) || 1;
        if (!byClass[cid][day][p]) byClass[cid][day][p] = { tracks: [] };
        const entry = byClass[cid][day][p];
        if (row.teacher || row.subject) {
          entry.startTime = row.startTime || "";
          entry.endTime = row.endTime || "";
          if (row.teacher && row.teacher !== "—") {
            const t = await Teacher.findOne({ name: { $regex: `^${row.teacher.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" }, createdBy: req.effectiveCreatedBy });
            if (t) entry.teacher = String(t._id);
          }
          entry.subject = row.subject || "Free Period";
        }
        if (row.groupName) {
          const tr = { groupName: row.groupName, teacher: null, subject: row.trackSubject || "" };
          if (row.trackTeacher && row.trackTeacher !== "—") {
            const tt = await Teacher.findOne({ name: { $regex: `^${row.trackTeacher.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" }, createdBy: req.effectiveCreatedBy });
            if (tt) tr.teacher = String(tt._id);
          }
          entry.tracks.push(tr);
        }
      }

      for (const cid of Object.keys(byClass)) {
        const daysArr = [];
        for (const day of Object.keys(byClass[cid])) {
          const periodsArr = [];
          for (const p of Object.keys(byClass[cid][day])) {
            const entry = byClass[cid][day][p];
            periodsArr.push({
              period: Number(p),
              startTime: entry.startTime || "",
              endTime: entry.endTime || "",
              teacher: entry.teacher || null,
              subject: entry.subject || "Free Period",
              tracks: entry.tracks || [],
            });
            result.periods++;
          }
          periodsArr.sort((a, b) => a.period - b.period);
          daysArr.push({ day, periods: periodsArr });
        }
        await Class.findByIdAndUpdate(cid, { $set: { timetable: daysArr } });
      }
    }

    // ── 5. Teacher Groups ──
    for (const tg of teacherGroups || []) {
      const cName = (tg.className || tg.Class || "").trim();
      if (!cName) continue;
      const cls = await Class.findOne({ name: { $regex: `^${cName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" }, createdBy: req.effectiveCreatedBy });
      if (!cls) continue;
      const tNames = typeof tg.teachers === "string" ? tg.teachers.split(",").map(s => s.trim()).filter(Boolean) : [];
      const tIds = [];
      for (const tn of tNames) {
        const t = await Teacher.findOne({ name: { $regex: `^${tn.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" }, createdBy: req.effectiveCreatedBy });
        if (t) tIds.push(t._id);
      }
      if (tIds.length >= 2) {
        const existingIdx = cls.teacherGroups.findIndex(g => g.groupName === tg.groupName);
        const groupEntry = { groupName: tg.groupName, teachers: tIds };
        if (existingIdx >= 0) {
          cls.teacherGroups[existingIdx] = groupEntry;
        } else {
          cls.teacherGroups.push(groupEntry);
        }
        result.teacherGroups++;
      }
      await cls.save();
    }

    // ── 6. Group Syncs ──
    for (const gs of groupSyncs || []) {
      const gName = (gs.groupName || "").trim();
      if (!gName) continue;
      const cNames = typeof gs.classes === "string" ? gs.classes.split(",").map(s => s.trim()).filter(Boolean) : [];
      const cIds = [];
      for (const cn of cNames) {
        const c = await Class.findOne({ name: { $regex: `^${cn.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" }, createdBy: req.effectiveCreatedBy });
        if (c) cIds.push(c._id);
      }
      if (cIds.length < 2) continue;
      // Find teacher IDs for this group name — look up which teachers are in the group across sync classes
      const firstClass = await Class.findById(cIds[0]).populate("teacherGroups.teachers");
      const matchedGroup = firstClass?.teacherGroups.find(g => g.groupName === gName);
      if (!matchedGroup) continue;
      const tIds = matchedGroup.teachers.map(t => t._id);
      const syncId = Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
      await GroupSync.create({
        syncId,
        groupName: gName,
        classIds: cIds,
        teacherIds: tIds,
        createdBy: req.effectiveCreatedBy,
      });
      result.groupSyncs++;
    }

    // ── 7. Absences ──
    for (const ab of absences || []) {
      const tName = (ab.teacherName || ab.teacher || "").trim();
      const day = (ab.day || "").trim();
      if (!tName || !day) continue;
      const teacher = await Teacher.findOne({ name: { $regex: `^${tName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" }, createdBy: req.effectiveCreatedBy });
      if (!teacher) continue;
      await Absence.findOneAndUpdate(
        { teacher: teacher._id, day, createdBy: req.effectiveCreatedBy },
        { $set: { teacher: teacher._id, day, createdBy: req.effectiveCreatedBy } },
        { new: true, upsert: true }
      );
      result.absences++;
    }

    res.json({ message: "Import successful", result });
  } catch (err) {
    console.log("IMPORT ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────
//  RESET / GENERATE
// ─────────────────────────────────────────────

app.post("/reset-timetable", auth, adminOnly, async (req, res) => {
  try {
    await Class.updateMany({ createdBy: req.effectiveCreatedBy }, { $set: { timetable: [] } });
    res.json({ message: "All timetables cleared" });
  } catch (err) {
    res.status(500).json({ error: "Reset failed" });
  }
});

app.delete("/classes/:id", auth, adminOnly, async (req, res) => {
  try {
    await Class.findOneAndDelete({ _id: req.params.id, createdBy: req.effectiveCreatedBy });
    res.json({ message: "Class deleted" });
  } catch (err) {
    res.status(500).json({ error: "Delete failed" });
  }
});

app.put("/classes/:id/add-period", auth, adminOnly, async (req, res) => {
  const { day, period, teacherId } = req.body;
  const teacher   = await Teacher.findOne({ _id: teacherId, createdBy: req.effectiveCreatedBy });
  const classData = await Class.findOne({ _id: req.params.id, createdBy: req.effectiveCreatedBy });
  if (!classData || !teacher) return res.status(404).json({ message: "Not found" });
  let dayEntry = classData.timetable.find(d => d.day === day);
  const newPeriod = { period, teacher: teacherId, subject: teacher.subject };
  if (!dayEntry) classData.timetable.push({ day, periods: [newPeriod] });
  else dayEntry.periods.push(newPeriod);
  await classData.save();
  res.json({ message: "Period added" });
});

// PUT /classes/:id/move-period — drag-and-drop move/swap a lecture across days
app.put("/classes/:id/move-period", auth, adminOnly, async (req, res) => {
  try {
    const { fromDay, fromPeriod, toDay, toPeriod } = req.body;

    if (!fromDay || !fromPeriod || !toDay || !toPeriod) {
      return res.status(400).json({ error: "fromDay, fromPeriod, toDay, toPeriod required" });
    }
    if (fromDay === toDay && fromPeriod === toPeriod) {
      return res.status(400).json({ error: "Cannot move a period to itself" });
    }

    const cls = await Class.findOne({ _id: req.params.id, createdBy: req.effectiveCreatedBy });
    if (!cls) return res.status(404).json({ error: "Class not found" });

    const fromDayData = cls.timetable.find(d => d.day === fromDay);
    const toDayData = cls.timetable.find(d => d.day === toDay);
    if (!fromDayData || !toDayData) return res.status(404).json({ error: "Day not found in timetable" });

    const source = fromDayData.periods.find(p => p.period === fromPeriod);
    const target = toDayData.periods.find(p => p.period === toPeriod);
    if (!source || !target) return res.status(404).json({ error: "Period not found" });

    if (!source.teacher && (!source.tracks || source.tracks.length === 0)) {
      return res.status(400).json({ error: "Source period is empty, nothing to move" });
    }

    const getTid = (p) => p.teacher ? String(p.teacher) : null;
    const tid = getTid(source);

    // Check cross-class conflict for the source teacher at the target slot
    if (tid) {
      const others = await Class.find({ _id: { $ne: cls._id } }, { timetable: 1, name: 1 });
      for (const other of others) {
        const otherDay = other.timetable.find(d => d.day === toDay);
        if (!otherDay) continue;
        const slot = otherDay.periods.find(p => p.period === toPeriod);
        if (slot && slot.teacher && String(slot.teacher) === tid) {
          const teacherDoc = await Teacher.findById(tid).select("name");
          return res.status(400).json({
            error: `Clash: ${teacherDoc?.name || "Teacher"} already teaches ${other.name} at ${toDay} Period ${toPeriod}`
          });
        }
      }
    }

    // If target also has a teacher, check reverse conflict too
    const targetTid = getTid(target);
    if (targetTid && targetTid !== tid) {
      const others = await Class.find({ _id: { $ne: cls._id } }, { timetable: 1, name: 1 });
      for (const other of others) {
        const otherDay = other.timetable.find(d => d.day === fromDay);
        if (!otherDay) continue;
        const slot = otherDay.periods.find(p => p.period === fromPeriod);
        if (slot && slot.teacher && String(slot.teacher) === targetTid) {
          const teacherDoc = await Teacher.findById(targetTid).select("name");
          return res.status(400).json({
            error: `Clash: ${teacherDoc?.name || "Teacher"} already teaches ${other.name} at ${fromDay} Period ${fromPeriod}`
          });
        }
      }
    }

    const sourceContent = {
      teacher: source.teacher,
      subject: source.subject,
      tracks: source.tracks ? source.tracks.map(t => ({ ...t })) : []
    };

    const targetHasContent = target.teacher || (target.tracks && target.tracks.length > 0);

    if (targetHasContent) {
      // Swap
      const targetContent = {
        teacher: target.teacher,
        subject: target.subject,
        tracks: target.tracks ? target.tracks.map(t => ({ ...t })) : []
      };
      target.teacher = sourceContent.teacher;
      target.subject = sourceContent.subject;
      target.tracks = sourceContent.tracks;
      source.teacher = targetContent.teacher;
      source.subject = targetContent.subject;
      source.tracks = targetContent.tracks;
    } else {
      // Move
      target.teacher = sourceContent.teacher;
      target.subject = sourceContent.subject;
      target.tracks = sourceContent.tracks;
      source.teacher = null;
      source.subject = "Free Period";
      source.tracks = [];
    }

    await cls.save();

    const updated = await Class.findById(cls._id)
      .populate("teachers")
      .populate("timetable.periods.teacher")
      .populate("timetable.periods.tracks.teacher");

    res.json({ message: targetHasContent ? "Periods swapped" : "Period moved", class: updated });

  } catch (err) {
    console.log("MOVE ERROR:", err);
    res.status(500).json({ error: "Move failed" });
  }
});

app.put("/classes/:id/remove-teacher", auth, adminOnly, async (req, res) => {
  const { teacherId } = req.body;
  const cls = await Class.findOne({ _id: req.params.id, createdBy: req.effectiveCreatedBy });
  if (!cls) return res.status(404).json({ error: "Class not found" });

  // Remove teacher from array
  cls.teachers.pull(teacherId);

  // Clean stale quota entry
  if (cls.teacherQuota) {
    cls.teacherQuota.delete(teacherId);
  }

  await cls.save();
  res.json(cls);
});

app.put("/classes/:id/assign-teacher", auth, adminOnly, async (req, res) => {
  const { teacherId } = req.body;
  if (isBlank(teacherId)) return res.status(400).json({ error: "Select a teacher" });

  const cls = await Class.findOne({ _id: req.params.id, createdBy: req.effectiveCreatedBy });
  if (!cls) return res.status(404).json({ error: "Class not found" });

  const teacher = await Teacher.findOne({ _id: teacherId, createdBy: req.effectiveCreatedBy });
  if (!teacher) return res.status(404).json({ error: "Teacher not found" });

  if (cls.teachers.some(id => String(id) === String(teacherId))) {
    return res.status(400).json({ error: "Teacher already assigned" });
  }

  const updated = await Class.findOneAndUpdate(
    { _id: req.params.id, createdBy: req.effectiveCreatedBy },
    { $addToSet: { teachers: teacherId } },
    { new: true }
  );
  res.json(updated);
});

app.put("/classes/:id/teacher-groups", auth, adminOnly, async (req, res) => {
  const { groups } = req.body;
  const cls = await Class.findOne({ _id: req.params.id, createdBy: req.effectiveCreatedBy });
  if (!cls) return res.status(404).json({ error: "Class not found" });

  if (!Array.isArray(groups)) {
    return res.status(400).json({ error: "groups must be an array" });
  }

  const assignedIds = new Set(cls.teachers.map(t => String(t._id)));

  for (const g of groups) {
    if (!g.groupName || !g.groupName.trim()) {
      return res.status(400).json({ error: "Each group needs a name" });
    }
    if (!Array.isArray(g.teacherIds) || g.teacherIds.length < 2) {
      return res.status(400).json({ error: `Group "${g.groupName}" needs at least 2 teachers` });
    }
    for (const tid of g.teacherIds) {
      if (!assignedIds.has(String(tid))) {
        return res.status(400).json({ error: `Teacher ${tid} is not assigned to this class` });
      }
    }
  }

  cls.teacherGroups = groups.map(g => ({
    groupName: g.groupName.trim(),
    teachers: g.teacherIds,
  }));

  await cls.save();
  const updated = await Class.findById(cls._id).populate("teacherGroups.teachers");
  res.json(updated);
});

app.delete("/teachers/:id", auth, adminOnly, async (req, res) => {
  await Absence.deleteMany({ teacher: req.params.id, createdBy: req.effectiveCreatedBy });
  await Teacher.findOneAndDelete({ _id: req.params.id, createdBy: req.effectiveCreatedBy });
  res.json({ message: "Teacher deleted" });
});

app.post("/classes", auth, adminOnly, async (req, res) => {
  try {
    const name = String(req.body.name ?? "").trim();
    if (isBlank(name)) return res.status(400).json({ error: "Class name is required" });
    if (await classNameExists(name, req.effectiveCreatedBy)) return res.status(400).json({ error: "Class already exists" });

    const newClass = new Class({ name, createdBy: req.effectiveCreatedBy });
    await newClass.save();
    res.json({ message: "Class added" });
  } catch (err) {
    res.status(500).json({ error: "Failed to add class" });
  }
});

app.get("/classes", auth, async (req, res) => {
  const classes = await Class.find({ createdBy: req.effectiveCreatedBy })
    .populate("teachers")
    .populate("teacherGroups.teachers")
    .populate("timetable.periods.teacher")
    .populate("timetable.periods.tracks.teacher");

  // Convert Mongoose Maps to plain objects before sending to frontend
  const result = classes.map(c => {
    const obj = c.toObject();
    obj.teacherQuota = toPlainQuota(c.teacherQuota);
    return obj;
  });

  res.json(result);
});

// GET /classes/:id — single class (for students)
app.get("/classes/:id", auth, async (req, res) => {
  try {
    const cls = await Class.findById(req.params.id)
      .populate("teachers")
      .populate("teacherGroups.teachers")
      .populate("timetable.periods.teacher")
      .populate("timetable.periods.tracks.teacher");
    if (!cls) return res.status(404).json({ error: "Class not found" });
    const obj = cls.toObject();
    obj.teacherQuota = toPlainQuota(cls.teacherQuota);
    res.json(obj);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch class" });
  }
});

app.put("/teachers/:id", auth, adminOnly, async (req, res) => {
  const { name, subject } = req.body;
  const error = validateTeacherInput({ name, subject });
  if (error) return res.status(400).json({ error });

  await Teacher.findOneAndUpdate({ _id: req.params.id, createdBy: req.effectiveCreatedBy }, { name: name.trim(), subject: subject.trim() });
  res.json({ message: "Teacher updated" });
});

app.post("/teachers", auth, adminOnly, async (req, res) => {
  const error = validateTeacherInput(req.body);
  if (error) return res.status(400).json({ error });

  const teacher = new Teacher({ name: req.body.name.trim(), subject: req.body.subject.trim(), createdBy: req.effectiveCreatedBy });
  await teacher.save();
  res.json({ message: "Teacher added" });
});

app.get("/teachers", auth, async (req, res) => {
  const teachers = await Teacher.find({ createdBy: req.effectiveCreatedBy });
  res.json(teachers);
});

app.get("/", (req, res) => {
  res.sendFile(path.join(clientBuild, "index.html"));
});

// ─────────────────────────────────────────────
//  PDF EXPORT
// ─────────────────────────────────────────────

app.get("/export-pdf/:classId", auth, async (req, res) => {
  try {
    const cls = await Class.findOne({ _id: req.params.classId, createdBy: req.effectiveCreatedBy })
      .populate("teachers")
      .populate("timetable.periods.teacher")
      .populate("timetable.periods.tracks.teacher");

    if (!cls) return res.status(404).json({ error: "Class not found" });

    const doc = new PDFDocument({ margin: 30, size: "A4" });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${cls.name}-timetable.pdf"`);

    doc.pipe(res);

    // ─────── COLOR PALETTE ────────
    const C = {
      headerBg: "#2C3E50",
      headerText: "#FFFFFF",
      tableHeaderBg: "#3498DB",
      tableHeaderText: "#FFFFFF",
      dayColBg: "#EBF5FB",
      dayColText: "#2C3E50",
      zebraLight: "#FFFFFF",
      zebraDark: "#F8F9FA",
      freeBg: "#F0F0F0",
      freeText: "#999999",
      breakBg: "#FDF2E9",
      breakBorder: "#E67E22",
      breakText: "#E67E22",
      gridLine: "#BDC3C7",
      footerText: "#999999",
      textDark: "#2C3E50",
      timeText: "#888888",
      teacherText: "#666666",
    };

    const SUBJECT_PALETTE = [
      { bg: "#E3F2FD", text: "#1565C0" },
      { bg: "#E8F5E9", text: "#2E7D32" },
      { bg: "#FFF3E0", text: "#E65100" },
      { bg: "#F3E5F5", text: "#7B1FA2" },
      { bg: "#E0F2F1", text: "#00695C" },
      { bg: "#FBE9E7", text: "#BF360C" },
      { bg: "#E8EAF6", text: "#283593" },
      { bg: "#FCE4EC", text: "#C62828" },
      { bg: "#FFF8E1", text: "#F9A825" },
      { bg: "#E0F7FA", text: "#00838F" },
    ];

    const subjectColorMap = {};
    let colorIdx = 0;
    for (const day of cls.timetable) {
      for (const p of day.periods) {
        if (p.subject && p.subject !== "Free Period" && !subjectColorMap[p.subject]) {
          subjectColorMap[p.subject] = SUBJECT_PALETTE[colorIdx % SUBJECT_PALETTE.length];
          colorIdx++;
        }
      }
    }

    // ─────── HEADER BANNER ────────
    const headerH = 85;
    doc.fillColor(C.headerBg).rect(0, 0, doc.page.width, headerH).fill();

    doc.fillColor(C.headerText);
    doc.fontSize(22).font("Helvetica-Bold")
      .text("School Timetable", 30, 14, { align: "center", width: doc.page.width - 60 });
    doc.fontSize(16).font("Helvetica-Bold")
      .text(`Class: ${cls.name}`, 30, 40, { align: "center", width: doc.page.width - 60 });
    doc.fontSize(10).font("Helvetica")
      .text(
        `${cls.periodsPerDay || 6} periods/day | Start: ${cls.schoolTiming?.startTime || "08:00"}`,
        30, 62, { align: "center", width: doc.page.width - 60 }
      );

    // ─────── CHECK IF TIMETABLE EXISTS ────────
    if (!cls.timetable || cls.timetable.length === 0) {
      doc.fillColor(C.textDark);
      doc.fontSize(12).text("No timetable generated yet.", { align: "center" });
      doc.end();
      return;
    }

    // ─────── TABLE SETUP ────────
    const periodsPerDay = cls.periodsPerDay || 6;
    const margin = 30;
    const pageWidth = doc.page.width - 2 * margin;
    const dayColWidth = 50;
    const periodColWidth = (pageWidth - dayColWidth) / periodsPerDay;
    const headerHeight = 30;
    const cellHeight = 50;

    let y = headerH + 18;

    function cellBg(x, y, w, h, bg, border) {
      if (bg) doc.fillColor(bg).rect(x, y, w, h).fill();
      doc.strokeColor(border || C.gridLine).lineWidth(0.5).rect(x, y, w, h).stroke();
    }

    // ─────── DRAW TABLE HEADER ROW ────────
    cellBg(margin, y, dayColWidth, headerHeight, C.tableHeaderBg, C.tableHeaderBg);
    doc.fillColor(C.tableHeaderText).font("Helvetica-Bold").fontSize(10)
      .text("Day", margin + 3, y + 8, { width: dayColWidth - 6, align: "center" });

    for (let p = 1; p <= periodsPerDay; p++) {
      const x = margin + dayColWidth + (p - 1) * periodColWidth;
      cellBg(x, y, periodColWidth, headerHeight, C.tableHeaderBg, C.tableHeaderBg);
      doc.fillColor(C.tableHeaderText).font("Helvetica-Bold").fontSize(9)
        .text(`P${p}`, x + 3, y + 9, { width: periodColWidth - 6, align: "center" });
    }

    y += headerHeight;

    // ─────── DRAW TABLE DATA ROWS ────────
    for (let di = 0; di < DAYS.length; di++) {
      const day = DAYS[di];
      const dayData = cls.timetable.find(d => d.day === day);
      const rowBg = di % 2 === 0 ? C.zebraLight : C.zebraDark;

      cellBg(margin, y, dayColWidth, cellHeight, C.dayColBg, C.gridLine);
      doc.fillColor(C.dayColText).font("Helvetica-Bold").fontSize(9)
        .text(day, margin + 3, y + 19, { width: dayColWidth - 6, align: "center" });

      for (let p = 1; p <= periodsPerDay; p++) {
        const x = margin + dayColWidth + (p - 1) * periodColWidth;
        const period = dayData?.periods.find(pr => pr.period === p);
        const isFree = !period || period.subject === "Free Period";

        let bg = rowBg;
        let subjectColor = null;

        if (isFree) {
          bg = C.freeBg;
        } else if (period.subject && subjectColorMap[period.subject]) {
          subjectColor = subjectColorMap[period.subject];
          bg = subjectColor.bg;
        }

        cellBg(x, y, periodColWidth, cellHeight, bg, C.gridLine);

        if (isFree) {
          doc.fillColor(C.freeText).font("Helvetica-Oblique").fontSize(8)
            .text("Free", x + 3, y + 20, { width: periodColWidth - 6, align: "center" });
        } else {
          const t1 = period.startTime || "";
          const t2 = period.endTime || "";
          const subj = period.subject || "";
          const teacher = period.teacher?.name || "—";

          doc.fillColor(C.timeText).font("Helvetica").fontSize(6)
            .text(`${t1}-${t2}`, x + 2, y + 4, { width: periodColWidth - 4, align: "center" });

          const sc = subjectColor ? subjectColor.text : C.textDark;
          doc.fillColor(sc).font("Helvetica-Bold").fontSize(8)
            .text(subj, x + 2, y + 16, { width: periodColWidth - 4, align: "center" });

          doc.fillColor(C.teacherText).font("Helvetica").fontSize(6)
            .text(teacher, x + 2, y + 30, { width: periodColWidth - 4, align: "center" });
        }
      }

      y += cellHeight;

      if (y > doc.page.height - 100) {
        doc.addPage();
        y = 30;
      }
    }

    // ─────── BREAK TIMING ROWS ────────
    if (cls.schoolTiming) {
      const breaks = resolveBreaks(cls.schoolTiming);
      const startTime = cls.schoolTiming.startTime || "08:00";
      const periodDuration = cls.schoolTiming.periodDuration || 40;

      let [hours, minutes] = startTime.split(":").map(Number);
      let baseMin = hours * 60 + minutes;

      for (const b of breaks) {
        let totalMin = baseMin + periodDuration * b.after;
        const bH = Math.floor(totalMin / 60);
        const bM = totalMin % 60;
        const breakStart = `${String(bH).padStart(2, "0")}:${String(bM).padStart(2, "0")}`;

        totalMin += b.duration;
        const eH = Math.floor(totalMin / 60);
        const eM = totalMin % 60;
        const breakEnd = `${String(eH).padStart(2, "0")}:${String(eM).padStart(2, "0")}`;

        cellBg(margin, y, dayColWidth, cellHeight, C.breakBg, C.breakBorder);
        doc.fillColor(C.breakText).font("Helvetica-Bold").fontSize(9)
          .text(`${b.label}`, margin + 3, y + 19, { width: dayColWidth - 6, align: "center" });

        cellBg(margin + dayColWidth, y, pageWidth - dayColWidth, cellHeight, C.breakBg, C.breakBorder);
        doc.fillColor(C.breakText).font("Helvetica-Bold").fontSize(9)
          .text(`${breakStart} - ${breakEnd} (${b.duration} min)`,
            margin + dayColWidth + 3, y + 19,
            { width: pageWidth - dayColWidth - 6, align: "center" }
          );
        y += cellHeight;
      }
    }

    // ─────── FOOTER ────────
    doc.moveDown(2);
    doc.fillColor(C.footerText).font("Helvetica").fontSize(8)
      .text(`Generated on ${new Date().toLocaleDateString()}`, { align: "center" });

    doc.end();
  } catch (err) {
    console.log("PDF EXPORT ERROR:", err);
    res.status(500).json({ error: "PDF generation failed" });
  }
});

// ── Health check ──
app.get("/health", (req, res) => {
  res.json({ ok: true });
});

// ── Serve built React app if it exists ──
const fs = require("fs");
if (fs.existsSync(clientBuild)) {
  app.use(express.static(clientBuild));
  app.use((req, res) => {
    if (req.method === "GET") {
      res.sendFile(path.join(clientBuild, "index.html"));
    } else {
      res.status(404).json({ error: "Not found" });
    }
  });
} else {
  app.use((req, res) => {
    res.status(404).json({ error: "Not found" });
  });
}

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.log("DB ERROR:", err));

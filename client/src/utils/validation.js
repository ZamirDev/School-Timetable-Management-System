const isBlank = (value) => String(value ?? "").trim() === "";

const isWholeNumber = (value) => {
  if (isBlank(value)) return false;
  return /^\d+$/.test(String(value).trim());
};

export const validateTeacher = ({ name, subject }) => {
  const errors = {};
  const trimmedName = String(name ?? "").trim();

  if (!trimmedName) {
    errors.name = "Name is required";
  } else if (trimmedName.length < 2) {
    errors.name = "Name must be at least 2 characters";
  }

  if (isBlank(subject)) {
    errors.subject = "Subject is required";
  }

  return errors;
};

export const validateClass = ({ name, classes }) => {
  const errors = {};
  const normalizedName = String(name ?? "").trim().toLowerCase();

  if (!normalizedName) {
    errors.name = "Class name is required";
  } else if (classes.some(classItem => String(classItem.name ?? "").trim().toLowerCase() === normalizedName)) {
    errors.name = "Class already exists";
  }

  return errors;
};

export const validatePeriodsPerDay = (periods) => {
  if (!isWholeNumber(periods)) return "Periods must be between 1 and 12";

  const value = Number(periods);
  if (value < 1 || value > 12) return "Periods must be between 1 and 12";

  return "";
};

export const validateSchoolTiming = ({ timing, periodsPerDay }) => {
  const errors = {};
  const totalPeriods = Number(periodsPerDay);
  const periodDuration = Number(timing?.periodDuration);
  const breakAfter = Number(timing?.breakAfter);
  const breakDuration = Number(timing?.breakDuration);

  if (isBlank(timing?.startTime)) {
    errors.startTime = "Start time is required";
  }

  if (!isWholeNumber(timing?.periodDuration) || periodDuration < 10 || periodDuration > 120) {
    errors.periodDuration = "Invalid period duration";
  }

  if (!isWholeNumber(timing?.breakAfter) || breakAfter < 1 || breakAfter > totalPeriods) {
    errors.breakAfter = "Break must be within total periods";
  }

  if (!isWholeNumber(timing?.breakDuration) || breakDuration < 5 || breakDuration > 60) {
    errors.breakDuration = "Invalid break duration";
  }

  return errors;
};

export const validateTeacherAssignment = ({ classItem, teacherId }) => {
  if (isBlank(teacherId)) return "Select a teacher";

  const alreadyAssigned = classItem?.teachers?.some(teacher => String(teacher._id) === String(teacherId));
  if (alreadyAssigned) return "Teacher already assigned";

  return "";
};

export const validateQuota = ({ quotaInputs, teachers, totalSlots }) => {
  const fieldErrors = {};
  const cleanQuota = {};

  for (const teacher of teachers) {
    const teacherId = String(teacher._id);
    const rawValue = quotaInputs?.[teacherId];

    // Skip blank inputs — no quota means unlimited on server
    if (isBlank(rawValue)) continue;

    if (!isWholeNumber(rawValue)) {
      fieldErrors[teacherId] = "Quota must be a positive number";
      continue;
    }

    const quota = Number(rawValue);
    if (quota < 1) {
      fieldErrors[teacherId] = "Quota must be at least 1";
      continue;
    }

    cleanQuota[teacherId] = quota;
  }

  const totalQuota = Object.values(cleanQuota).reduce((sum, quota) => sum + quota, 0);
  const formError = totalQuota > totalSlots ? "Total quota exceeds available periods" : "";

  return { fieldErrors, formError, cleanQuota };
};

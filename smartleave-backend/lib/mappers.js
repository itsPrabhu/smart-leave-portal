function toIso(value) {
  if (!value) return new Date().toISOString();
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function parseJson(value, fallback) {
  if (value == null) return fallback;
  if (Array.isArray(value) || typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function mapUser(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    name: row.name,
    email: row.email,
    role: row.role,
    department: row.department || undefined,
    rollNo: row.roll_no || undefined,
    phone: row.phone || undefined,
    childId: row.child_id ? String(row.child_id) : undefined,
    avatarUrl: row.avatar_url || undefined,
  };
}

function mapLeave(row) {
  return {
    id: String(row.id),
    studentId: String(row.user_id),
    studentName: row.student_name,
    department: row.student_department || row.department || "General",
    category: row.category,
    fromDate: toIso(row.from_date),
    toDate: toIso(row.to_date),
    reason: row.reason,
    emergency: Boolean(row.emergency),
    status: row.status,
    remarks: row.remarks || undefined,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    documents: parseJson(row.documents, []),
    facultyId: row.faculty_id ? String(row.faculty_id) : undefined,
    facultyName: row.faculty_name || undefined,
    missedClasses: parseJson(row.missed_classes, []),
    assignments: parseJson(row.assignments, []),
  };
}

function mapNotification(row) {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    title: row.title,
    body: row.body,
    type: row.type,
    read: Boolean(row.is_read),
    createdAt: toIso(row.created_at),
    link: row.link || undefined,
  };
}

function mapDepartment(row) {
  return {
    id: String(row.id),
    name: row.name,
    code: row.code,
    hod: row.hod,
  };
}

module.exports = {
  mapUser,
  mapLeave,
  mapNotification,
  mapDepartment,
};

const express = require("express");
const db = require("../db");
const auth = require("../middleware/authMiddleware");
const { mapLeave } = require("../lib/mappers");

const router = express.Router();

function summarize(leaves) {
  const byMonth = new Map();
  const byDepartment = new Map();
  const byCategory = new Map();
  const trend = new Map();

  for (const leave of leaves) {
    const created = new Date(leave.createdAt);
    const month = created.toLocaleString("en", { month: "short", year: "2-digit" });
    const monthRow = byMonth.get(month) || { approved: 0, rejected: 0, pending: 0 };
    monthRow[leave.status] += 1;
    byMonth.set(month, monthRow);

    byDepartment.set(leave.department, (byDepartment.get(leave.department) || 0) + 1);
    byCategory.set(leave.category, (byCategory.get(leave.category) || 0) + 1);

    const date = created.toISOString().slice(0, 10);
    trend.set(date, (trend.get(date) || 0) + 1);
  }

  return {
    totalLeaves: leaves.length,
    pending: leaves.filter((leave) => leave.status === "pending").length,
    approved: leaves.filter((leave) => leave.status === "approved").length,
    rejected: leaves.filter((leave) => leave.status === "rejected").length,
    byMonth: Array.from(byMonth, ([month, values]) => ({ month, ...values })),
    byDepartment: Array.from(byDepartment, ([department, count]) => ({ department, count })),
    byCategory: Array.from(byCategory, ([category, count]) => ({ category, count })),
    trend: Array.from(trend, ([date, count]) => ({ date, count })).sort((a, b) =>
      a.date.localeCompare(b.date)
    ),
  };
}

router.get("/summary", auth, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        lr.*,
        student.name AS student_name,
        student.department AS student_department,
        faculty.name AS faculty_name
      FROM leave_requests lr
      JOIN users student ON student.id = lr.user_id
      LEFT JOIN users faculty ON faculty.id = lr.faculty_id
      ORDER BY lr.created_at DESC
    `);

    res.json({ summary: summarize(rows.map(mapLeave)) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
});

module.exports = router;

const express = require("express");
const db = require("../db");
const auth = require("../middleware/authMiddleware");
const { mapLeave } = require("../lib/mappers");

const router = express.Router();

const leaveSelect = `
  SELECT
    lr.*,
    student.name AS student_name,
    student.department AS student_department,
    faculty.name AS faculty_name
  FROM leave_requests lr
  JOIN users student ON student.id = lr.user_id
  LEFT JOIN users faculty ON faculty.id = lr.faculty_id
`;

async function getCurrentUser(userId) {
  const [rows] = await db.query(
    "SELECT id,role,department,child_id FROM users WHERE id=?",
    [userId]
  );
  return rows[0];
}

async function getLeaveById(id) {
  const [rows] = await db.query(`${leaveSelect} WHERE lr.id=?`, [id]);
  return rows[0] ? mapLeave(rows[0]) : null;
}

async function notify(userId, title, body, type, link) {
  await db.query(
    `INSERT INTO notifications (user_id,title,body,type,link)
     VALUES (?,?,?,?,?)`,
    [userId, title, body, type, link || null]
  );
}

function toMysqlDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString().slice(0, 19).replace("T", " ");
}

// Get all leaves
router.get("/", auth, async (req, res) => {
  try {
    const me = await getCurrentUser(req.user.id);
    if (!me) return res.status(401).json({ message: "Unauthorized" });

    const params = [];
    let where = "";

    if (me.role === "student") {
      where = "WHERE lr.user_id=?";
      params.push(me.id);
    } else if (me.role === "parent") {
      where = "WHERE lr.user_id=?";
      params.push(me.child_id || 0);
    } else if (me.role === "faculty" && me.department) {
      where = "WHERE student.department=?";
      params.push(me.department);
    }

    const [rows] = await db.query(
      `${leaveSelect} ${where} ORDER BY lr.created_at DESC`,
      params
    );

    res.json({
      leaves: rows.map(mapLeave),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: err.sqlMessage || err.message || "Server Error",
    });
  }
});

// Create leave
router.post("/", auth, async (req, res) => {
  try {
    const me = await getCurrentUser(req.user.id);
    if (!me) return res.status(401).json({ message: "Unauthorized" });
    if (me.role !== "student") {
      return res.status(403).json({ message: "Only students can apply for leave" });
    }

    const {
      category,
      reason,
      fromDate,
      toDate,
      emergency,
      documents,
    } = req.body;

    const [result] = await db.query(
      `INSERT INTO leave_requests
       (user_id, category, reason, from_date, to_date, emergency, documents)
       VALUES (?,?,?,?,?,?,?)`,
      [
        req.user.id,
        category,
        reason,
        toMysqlDateTime(fromDate),
        toMysqlDateTime(toDate),
        emergency ? 1 : 0,
        JSON.stringify(documents || []),
      ]
    );

    const leave = await getLeaveById(result.insertId);
    const [facultyRows] = await db.query(
      "SELECT id FROM users WHERE role IN ('faculty','admin') AND (department=? OR role='admin')",
      [me.department]
    );
    await Promise.all(
      facultyRows.map((faculty) =>
        notify(
          faculty.id,
          emergency ? "Emergency leave request" : "New leave request",
          `${leave.studentName} requested ${leave.category} leave.`,
          emergency ? "emergency" : "leave_submitted",
          "/faculty/requests"
        )
      )
    );

    res.status(201).json({
      leave,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: err.sqlMessage || err.message || "Server Error",
    });
  }
});

router.get("/:id", auth, async (req, res) => {
  try {
    const leave = await getLeaveById(req.params.id);
    if (!leave) return res.status(404).json({ message: "Leave not found" });
    res.json({ leave });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.sqlMessage || err.message || "Server Error" });
  }
});

// Approve leave
router.post(
  "/:id/approve",
  auth,
  async (req, res) => {
    try {
      if (req.user.role !== "faculty" && req.user.role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const { remarks } = req.body || {};

      await db.query(
        `UPDATE leave_requests
         SET status='approved', remarks=?, faculty_id=?
         WHERE id=?`,
        [remarks || null, req.user.id, req.params.id]
      );

      const leave = await getLeaveById(req.params.id);
      if (!leave) return res.status(404).json({ message: "Leave not found" });
      await notify(
        leave.studentId,
        "Leave approved",
        `Your ${leave.category} leave was approved.`,
        "leave_approved",
        `/leaves/${leave.id}`
      );

      res.json({
        leave,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({
        message: err.sqlMessage || err.message || "Server Error",
      });
    }
  }
);

// Reject leave
router.post(
  "/:id/reject",
  auth,
  async (req, res) => {
    try {
      if (req.user.role !== "faculty" && req.user.role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const { remarks } = req.body || {};

      await db.query(
        `UPDATE leave_requests
         SET status='rejected', remarks=?, faculty_id=?
         WHERE id=?`,
        [remarks || null, req.user.id, req.params.id]
      );

      const leave = await getLeaveById(req.params.id);
      if (!leave) return res.status(404).json({ message: "Leave not found" });
      await notify(
        leave.studentId,
        "Leave rejected",
        `Your ${leave.category} leave was rejected.`,
        "leave_rejected",
        `/leaves/${leave.id}`
      );

      res.json({
        leave,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({
        message: err.sqlMessage || err.message || "Server Error",
      });
    }
  }
);

module.exports = router;

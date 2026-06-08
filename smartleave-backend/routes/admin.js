const express = require("express");
const db = require("../db");
const auth = require("../middleware/authMiddleware");
const { mapUser, mapDepartment } = require("../lib/mappers");

const router = express.Router();

function adminOnly(req, res, next) {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
}

// Get users
router.get("/users", auth, adminOnly, async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT id,name,email,role,department,roll_no,phone,child_id,avatar_url FROM users ORDER BY created_at DESC"
    );

    res.json({ users: rows.map(mapUser) });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Server Error",
    });
  }
});

// Delete user
router.delete(
  "/users/:id",
  auth,
  adminOnly,
  async (req, res) => {
    try {
      await db.query(
        "DELETE FROM users WHERE id=?",
        [req.params.id]
      );

      res.json({
        ok: true,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({
        message: "Server Error",
      });
    }
  }
);

// Departments
router.get(
  "/departments",
  auth,
  adminOnly,
  async (req, res) => {
    try {
      const [rows] = await db.query(
        "SELECT * FROM departments ORDER BY code"
      );

      res.json({ departments: rows.map(mapDepartment) });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server Error" });
    }
  }
);

router.post(
  "/departments",
  auth,
  adminOnly,
  async (req, res) => {
    try {
      const { name, code, hod } = req.body;

      const [result] = await db.query(
        "INSERT INTO departments(name,code,hod) VALUES(?,?,?)",
        [name, code, hod]
      );

      res.status(201).json({
        department: {
          id: String(result.insertId),
          name,
          code,
          hod,
        },
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server Error" });
    }
  }
);

module.exports = router;

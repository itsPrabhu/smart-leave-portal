const express = require("express");
const db = require("../db");
const auth = require("../middleware/authMiddleware");
const { mapUser } = require("../lib/mappers");

const router = express.Router();

router.patch("/", auth, async (req, res) => {
  try {
    const { name, phone, department } = req.body;

    await db.query(
      `UPDATE users
       SET name=COALESCE(?, name),
           phone=COALESCE(?, phone),
           department=COALESCE(?, department)
       WHERE id=?`,
      [name || null, phone || null, department || null, req.user.id]
    );

    const [rows] = await db.query(
      "SELECT id,name,email,role,department,roll_no,phone,child_id,avatar_url FROM users WHERE id=?",
      [req.user.id]
    );

    if (rows.length === 0) return res.status(404).json({ message: "User not found" });

    res.json({ user: mapUser(rows[0]) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
});

module.exports = router;

const express = require("express");
const db = require("../db");
const auth = require("../middleware/authMiddleware");
const { mapNotification } = require("../lib/mappers");

const router = express.Router();

// Get notifications
router.get("/", auth, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT * FROM notifications
       WHERE user_id=?`,
      [req.user.id]
    );

    res.json({
      notifications: rows.map(mapNotification),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Server Error",
    });
  }
});

// Mark as read
router.post(
  "/:id/read",
  auth,
  async (req, res) => {
    try {
      await db.query(
        `UPDATE notifications
         SET is_read=1
         WHERE id=? AND user_id=?`,
        [req.params.id, req.user.id]
      );

      res.json({
        ok: true,
      });
    } catch (err) {
      res.status(500).json({
        message: "Server Error",
      });
    }
  }
);

module.exports = router;

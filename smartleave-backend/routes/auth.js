const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../db");
const auth = require("../middleware/authMiddleware");
const { mapUser } = require("../lib/mappers");

const router = express.Router();

function signToken(user) {
  return jwt.sign(
    {
      id: user.id,
      role: user.role,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "7d",
    }
  );
}

// Register
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, role, department, rollNo, phone, childId } = req.body;

    const [existing] = await db.query(
      "SELECT * FROM users WHERE email = ?",
      [email]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        message: "Email already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(
      password,
      10
    );

    const [result] = await db.query(
      `INSERT INTO users
       (name,email,password,role,department,roll_no,phone,child_id)
       VALUES (?,?,?,?,?,?,?,?)`,
      [name, email, hashedPassword, role, department || null, rollNo || null, phone || null, childId || null]
    );

    const user = {
      id: result.insertId,
      name,
      email,
      role,
      department,
      roll_no: rollNo,
      phone,
      child_id: childId,
    };

    res.status(201).json({
      token: signToken(user),
      user: mapUser(user),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Server Error",
    });
  }
});

// Login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const [rows] = await db.query(
      "SELECT * FROM users WHERE email=?",
      [email]
    );

    if (rows.length === 0) {
      return res.status(401).json({
        message: "Invalid credentials",
      });
    }

    const user = rows[0];

    const validPassword =
      await bcrypt.compare(
        password,
        user.password
      );

    if (!validPassword) {
      return res.status(401).json({
        message: "Invalid credentials",
      });
    }

    const token = jwt.sign(
      {
        id: user.id,
        role: user.role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

    res.json({
      token,
      user: mapUser(user),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Server Error",
    });
  }
});

router.get("/me", auth, async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT id,name,email,role,department,roll_no,phone,child_id,avatar_url FROM users WHERE id=?",
      [req.user.id]
    );

    if (rows.length === 0) {
      return res.status(401).json({ message: "User not found" });
    }

    res.json({ user: mapUser(rows[0]) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
});

router.post("/forgot", async (req, res) => {
  res.json({
    ok: true,
    message: "If the email exists, a reset link was sent.",
  });
});

router.post("/reset", async (req, res) => {
  res.json({ ok: true });
});

module.exports = router;

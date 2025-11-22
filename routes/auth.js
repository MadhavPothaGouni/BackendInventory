// backend/routes/auth.js
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../db");
const { authenticate } = require("../middleware/auth");

const router = express.Router();

// helper to create JWT
function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );
}

// ---------- REGISTER ----------
router.post("/register", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password || password.length < 6) {
    return res
      .status(400)
      .json({ message: "Email and password (min 6 chars) are required" });
  }

  db.get("SELECT id FROM users WHERE email = ?", [email], async (err, row) => {
    if (err) return res.status(500).json({ message: "DB error" });
    if (row) return res.status(400).json({ message: "Email already in use" });

    try {
      const hash = await bcrypt.hash(password, 10);

      db.run(
        "INSERT INTO users (email, password_hash) VALUES (?, ?)",
        [email, hash],
        function (insertErr) {
          if (insertErr) {
            return res.status(500).json({ message: "DB insert error" });
          }

          const user = { id: this.lastID, email };
          const token = signToken(user);
          res.json({ token, user });
        }
      );
    } catch (hashErr) {
      return res.status(500).json({ message: "Hash error" });
    }
  });
});

// ---------- LOGIN ----------
router.post("/login", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res
      .status(400)
      .json({ message: "Email and password are required" });
  }

  db.get(
    "SELECT id, email, password_hash FROM users WHERE email = ?",
    [email],
    async (err, user) => {
      if (err) return res.status(500).json({ message: "DB error" });
      if (!user) return res.status(400).json({ message: "Invalid credentials" });

      const match = await bcrypt.compare(password, user.password_hash);
      if (!match) {
        return res.status(400).json({ message: "Invalid credentials" });
      }

      const token = signToken(user);
      res.json({ token, user: { id: user.id, email: user.email } });
    }
  );
});

// ---------- CURRENT USER ----------
router.get("/me", authenticate, (req, res) => {
  res.json({ id: req.user.id, email: req.user.email });
});

module.exports = router;

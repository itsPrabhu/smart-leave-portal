const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config({ quiet: true });

const app = express();
const PORT = process.env.PORT || 4000;

// ----------------------
// Allowed Origins
// ----------------------
const allowedOrigins = [
  "https://smart-leave-hub.onrender.com",
  "http://localhost:5173",
  "http://localhost:3000",
];

// ----------------------
// CORS Configuration
// ----------------------
const corsOptions = {
  origin: function (origin, callback) {
    console.log("Request origin:", origin);

    // Allow server-to-server / Postman
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log("❌ CORS blocked:", origin);
      callback(null, false);
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};

// ----------------------
// Middlewares (IMPORTANT ORDER)
// ----------------------
app.use(cors(corsOptions));
app.use(express.json({ limit: "10mb" }));

// ----------------------
// Safe Preflight Handler (FIX for Render + Node 24)
// ----------------------
app.use((req, res, next) => {
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// ----------------------
// Routes
// ----------------------
app.get("/api/health", (req, res) => {
  res.json({ message: "Backend Running" });
});

app.use("/api/auth", require("./routes/auth"));
app.use("/api/leaves", require("./routes/leaves"));
app.use("/api/notifications", require("./routes/notifications"));
app.use("/api/admin", require("./routes/admin"));
app.use("/api/analytics", require("./routes/analytics"));
app.use("/api/profile", require("./routes/profile"));

// ----------------------
// 404 Handler (NO "*" USED)
// ----------------------
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// ----------------------
// Error Handler
// ----------------------
app.use((err, req, res, next) => {
  console.error("Server Error:", err);

  res.status(err.status || 500).json({
    message: err.message || "Server Error",
  });
});

// ----------------------
// Start Server
// ----------------------
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Handle startup errors
server.on("error", (error) => {
  console.error("Server failed to start:", error);
});

// backend/server.js
const express = require("express");
const cors = require("cors");
require("dotenv").config();
const db = require("./db"); // initializes SQLite and tables
const productRoutes = require("./routes/products");
const authRoutes = require("./routes/auth");

const app = express();

app.use(cors());
app.use(express.json());

// Health check
app.get("/", (req, res) => {
  res.send("Backend is running...");
});

// Auth APIs
app.use("/api/auth", authRoutes);

// Products APIs (protected inside routes/products.js)
app.use("/api/products", productRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

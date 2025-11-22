// backend/routes/products.js
const express = require("express");
const multer = require("multer");
const csv = require("csv-parser");
const fs = require("fs");
const db = require("../db");
const { authenticate } = require("../middleware/auth");

const router = express.Router();
const upload = multer({ dest: "uploads/" });

// all product routes below this require a valid JWT
router.use(authenticate);

// ---------------------- GET ALL PRODUCTS (WITH PAGINATION + SORTING) ----------------------
router.get("/", (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 5;
  const offset = (page - 1) * limit;

  const allowedSortFields = ["id", "name", "category", "brand", "stock"];
  const requestedSortField = req.query.sortField || "id";
  const sortField = allowedSortFields.includes(requestedSortField)
    ? requestedSortField
    : "id";

  const sortOrder = req.query.sortOrder === "desc" ? "DESC" : "ASC";

  db.get("SELECT COUNT(*) AS total FROM products", [], (countErr, countRow) => {
    if (countErr) {
      return res.status(500).json({ error: countErr.message });
    }

    const total = countRow.total;
    const totalPages = Math.ceil(total / limit);

    const sql = `
      SELECT * 
      FROM products
      ORDER BY ${sortField} ${sortOrder}
      LIMIT ? OFFSET ?
    `;

    db.all(sql, [limit, offset], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });

      res.json({
        data: rows,
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
      });
    });
  });
});

// ---------------------- SEARCH PRODUCTS ----------------------
router.get("/search", (req, res) => {
  const { name } = req.query;
  db.all(
    "SELECT * FROM products WHERE LOWER(name) LIKE LOWER(?)",
    [`%${name}%`],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

// ---------------------- CREATE PRODUCT ----------------------
router.post("/", (req, res) => {
  const { name, unit, category, brand, stock, status, image } = req.body;

  db.run(
    `INSERT INTO products (name, unit, category, brand, stock, status, image)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [name, unit, category, brand, Number(stock), status, image],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });

      db.get("SELECT * FROM products WHERE id = ?", [this.lastID], (err2, row) => {
        if (err2) return res.status(500).json({ error: err2.message });
        res.json(row);
      });
    }
  );
});

// ---------------------- UPDATE PRODUCT ----------------------
router.put("/:id", (req, res) => {
  const { id } = req.params;
  const { name, unit, category, brand, stock, status, image } = req.body;

  db.get("SELECT * FROM products WHERE id = ?", [id], (err, product) => {
    if (err) return res.status(500).json({ error: "DB error 1" });
    if (!product) return res.status(404).json({ error: "Product not found" });

    const oldStock = Number(product.stock);
    const newStock = Number(stock);

    db.run(
      `UPDATE products SET name=?, unit=?, category=?, brand=?, stock=?, status=?, image=? WHERE id=?`,
      [name, unit, category, brand, newStock, status, image, id],
      function (updateErr) {
        if (updateErr) return res.status(500).json({ error: "Update error" });

        // insert log if stock changed
        if (oldStock !== newStock) {
          const changedBy = req.user?.email || "system";
          db.run(
            `INSERT INTO inventory_logs (product_id, old_stock, new_stock, changed_by, timestamp)
             VALUES (?, ?, ?, ?, datetime('now'))`,
            [id, oldStock, newStock, changedBy],
            (logErr) => {
              if (logErr) console.log("Log insert error:", logErr);
            }
          );
        }

        db.get("SELECT * FROM products WHERE id = ?", [id], (err2, updated) => {
          if (err2) return res.status(500).json({ error: "DB error 2" });
          res.json(updated);
        });
      }
    );
  });
});

// ---------------------- DELETE PRODUCT ----------------------
router.delete("/:id", (req, res) => {
  const { id } = req.params;

  db.run("DELETE FROM products WHERE id = ?", [id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// ---------------------- GET INVENTORY HISTORY ----------------------
router.get("/:id/history", (req, res) => {
  const { id } = req.params;

  db.all(
    `SELECT id, old_stock, new_stock, changed_by, timestamp
     FROM inventory_logs
     WHERE product_id = ?
     ORDER BY timestamp DESC`,
    [id],
    (err, rows) => {
      if (err) {
        console.log("History fetch error:", err);
        return res.status(500).json({ error: "Failed to load history" });
      }
      res.json(rows);
    }
  );
});

// ---------------------- IMPORT CSV ----------------------
router.post("/import", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "CSV file required" });
  }

  const results = [];

  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on("data", (row) => results.push(row))
    .on("end", () => {
      let added = 0;

      results.forEach((p) => {
        db.run(
          `INSERT INTO products (name, unit, category, brand, stock, status, image)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            p.name,
            p.unit,
            p.category,
            p.brand,
            Number(p.stock),
            p.status,
            p.image,
          ],
          function (err) {
            if (!err) added++;
          }
        );
      });

      fs.unlinkSync(req.file.path);
      res.json({ message: "CSV imported", added });
    });
});

module.exports = router;

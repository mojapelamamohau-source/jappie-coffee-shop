
import express from "express";
import cors from "cors";
import { randomUUID } from "node:crypto";
import "dotenv/config";
import { redis, getRecords } from "./redis.js";

const app = express();
const PORT = process.env.PORT || 5000;

// ==========================================
// CORS CONFIGURATION
// ==========================================

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  ...(process.env.FRONTEND_ORIGIN || "")
    .split(",")
    .map(origin => origin.trim().replace(/\/$/, ""))
    .filter(Boolean)
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests without an Origin, such as health checks.
    if (!origin) return callback(null, true);

    if (
      allowedOrigins.includes(origin.replace(/\/$/, "")) ||
      process.env.NODE_ENV !== "production"
    ) {
      return callback(null, true);
    }

    return callback(new Error("Origin not allowed by CORS."));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());

// ==========================================
// STAFF AUTHENTICATION
// ==========================================

const STAFF_USERNAME = process.env.STAFF_USERNAME;
const STAFF_PASSWORD = process.env.STAFF_PASSWORD;

// Temporary in-memory token storage.
// Tokens become invalid when the server restarts.
const staffTokens = new Set();

// STAFF LOGIN
app.post("/api/staff/login", (req, res) => {
  try {
    const { username, password } = req.body;

    if (!STAFF_USERNAME || !STAFF_PASSWORD) {
      return res.status(500).json({
        error: "Staff login has not been configured."
      });
    }

    if (
      typeof username !== "string" ||
      typeof password !== "string" ||
      username !== STAFF_USERNAME ||
      password !== STAFF_PASSWORD
    ) {
      return res.status(401).json({
        error: "Incorrect username or password."
      });
    }

    const token = randomUUID();
    staffTokens.add(token);

    return res.json({
      message: "Staff login successful.",
      token,
      staff: {
        username: STAFF_USERNAME
      }
    });
  } catch (error) {
    console.error("Staff login error:", error);

    res.status(500).json({
      error: "Could not log in."
    });
  }
});

// VERIFY STAFF TOKEN
function requireStaff(req, res, next) {
  const authorization = req.headers.authorization || "";

  const token = authorization.startsWith("Bearer ")
    ? authorization.slice(7)
    : "";

  if (!token || !staffTokens.has(token)) {
    return res.status(401).json({
      error: "Please log in as staff to continue."
    });
  }

  next();
}

// STAFF LOGOUT
app.post("/api/staff/logout", requireStaff, (req, res) => {
  const token = req.headers.authorization.slice(7);
  staffTokens.delete(token);

  res.json({
    message: "Logged out successfully."
  });
});

// ==========================================
// MENU AND ORDER DATABASE FUNCTIONS
// ==========================================

async function getMenu() {
  return await getRecords("menu");
}

async function saveMenuItem(item) {
  await redis.set(`menu:${item.id}`, item);
}

async function getOrders() {
  return await getRecords("order");
}

// ==========================================
// INITIAL MENU
// ==========================================

async function seedMenu() {
  const items = await getMenu();

  if (items.length === 0) {
    const initialMenu = [
      {
        id: "1",
        name: "Cappuccino",
        category: "Coffee",
        price: 35,
        description: "Rich espresso with steamed milk.",
        available: true
      },
      {
        id: "2",
        name: "Latte",
        category: "Coffee",
        price: 40,
        description: "Smooth coffee with creamy milk.",
        available: true
      },
      {
        id: "3",
        name: "Espresso",
        category: "Coffee",
        price: 25,
        description: "Strong and freshly brewed coffee.",
        available: true
      },
      {
        id: "4",
        name: "Green Tea",
        category: "Tea",
        price: 20,
        description: "Refreshing green tea.",
        available: true
      },
      {
        id: "5",
        name: "Chocolate Cake",
        category: "Pastries",
        price: 30,
        description: "Delicious chocolate cake.",
        available: true
      },
      {
        id: "6",
        name: "Croissant",
        category: "Pastries",
        price: 22,
        description: "Fresh and buttery croissant.",
        available: true
      }
    ];

    for (const item of initialMenu) {
      await saveMenuItem(item);
    }

    console.log("Initial menu created.");
  }
}

// ==========================================
// HEALTH CHECK
// ==========================================

app.get("/api/health", async (req, res) => {
  try {
    await redis.ping();

    res.json({
      message: "Coffee Shop API is running",
      database: "Connected"
    });
  } catch (error) {
    console.error("Health check error:", error);

    res.status(500).json({
      message: "Database connection failed"
    });
  }
});

// ==========================================
// CUSTOMER MENU ROUTES
// ==========================================

// GET ALL MENU ITEMS
app.get("/api/menu", async (req, res) => {
  try {
    res.json(await getMenu());
  } catch (error) {
    console.error("Get menu error:", error);

    res.status(500).json({
      error: "Could not retrieve menu."
    });
  }
});

// GET ONE MENU ITEM
app.get("/api/menu/:id", async (req, res) => {
  try {
    const item = await redis.get(`menu:${req.params.id}`);

    if (!item) {
      return res.status(404).json({
        error: "Menu item not found."
      });
    }

    res.json(item);
  } catch (error) {
    console.error("Get menu item error:", error);

    res.status(500).json({
      error: "Could not retrieve menu item."
    });
  }
});

// ==========================================
// STAFF MENU MANAGEMENT ROUTES
// ==========================================

// ADD MENU ITEM
app.post("/api/menu", requireStaff, async (req, res) => {
  try {
    const {
      name,
      category,
      description,
      price,
      available = true
    } = req.body;

    if (
      typeof name !== "string" || !name.trim() ||
      typeof category !== "string" || !category.trim() ||
      typeof description !== "string" || !description.trim() ||
      !Number.isFinite(price) || price <= 0 ||
      typeof available !== "boolean"
    ) {
      return res.status(400).json({
        error: "Invalid menu details."
      });
    }

    const item = {
      id: randomUUID(),
      name: name.trim(),
      category: category.trim(),
      description: description.trim(),
      price,
      available
    };

    await saveMenuItem(item);

    res.status(201).json(item);
  } catch (error) {
    console.error("Add menu item error:", error);

    res.status(500).json({
      error: "Could not add menu item."
    });
  }
});

// UPDATE MENU ITEM
app.put("/api/menu/:id", requireStaff, async (req, res) => {
  try {
    const oldItem = await redis.get(`menu:${req.params.id}`);

    if (!oldItem) {
      return res.status(404).json({
        error: "Menu item not found."
      });
    }

    const updated = {
      ...oldItem,
      ...req.body,
      id: oldItem.id
    };

    if (
      typeof updated.name !== "string" || !updated.name.trim() ||
      typeof updated.category !== "string" || !updated.category.trim() ||
      typeof updated.description !== "string" ||
      !updated.description.trim() ||
      typeof updated.price !== "number" ||
      !Number.isFinite(updated.price) ||
      updated.price <= 0 ||
      typeof updated.available !== "boolean"
    ) {
      return res.status(400).json({
        error: "Invalid menu details."
      });
    }

    await saveMenuItem(updated);

    res.json(updated);
  } catch (error) {
    console.error("Update menu item error:", error);

    res.status(500).json({
      error: "Could not update menu item."
    });
  }
});

// DELETE MENU ITEM
app.delete("/api/menu/:id", requireStaff, async (req, res) => {
  try {
    const item = await redis.get(`menu:${req.params.id}`);

    if (!item) {
      return res.status(404).json({
        error: "Menu item not found."
      });
    }

    await redis.del(`menu:${req.params.id}`);

    res.json({
      message: "Menu item deleted successfully."
    });
  } catch (error) {
    console.error("Delete menu item error:", error);

    res.status(500).json({
      error: "Could not delete menu item."
    });
  }
});

// ==========================================
// CUSTOMER ORDER ROUTES
// ==========================================

// PLACE CUSTOMER ORDER
app.post("/api/orders", async (req, res) => {
  try {
    const { customerName, items } = req.body;

    if (
      typeof customerName !== "string" ||
      !customerName.trim() ||
      !Array.isArray(items) ||
      items.length === 0
    ) {
      return res.status(400).json({
        error: "Enter your name and add items."
      });
    }

    const orderItems = [];

    for (const requested of items) {
      const menuItem = await redis.get(`menu:${requested.id}`);
      const quantity = Number(requested.quantity);

      if (!menuItem || !Number.isInteger(quantity) || quantity < 1) {
        return res.status(400).json({
          error: "Invalid order item or quantity."
        });
      }

      if (!menuItem.available) {
        return res.status(400).json({
          error: `${menuItem.name} is unavailable.`
        });
      }

      orderItems.push({
        id: menuItem.id,
        name: menuItem.name,
        price: menuItem.price,
        quantity,
        subtotal: menuItem.price * quantity
      });
    }

    const order = {
      id: randomUUID(),
      customerName: customerName.trim(),
      items: orderItems,
      total: orderItems.reduce(
        (sum, item) => sum + item.subtotal,
        0
      ),
      status: "Pending",
      createdAt: new Date().toISOString()
    };

    await redis.set(`order:${order.id}`, order);

    res.status(201).json({
      message: "Order placed successfully.",
      order
    });
  } catch (error) {
    console.error("Place order error:", error);

    res.status(500).json({
      error: "Could not place order."
    });
  }
});

// ==========================================
// STAFF ORDER MANAGEMENT ROUTES
// ==========================================

// GET ALL ORDERS
app.get("/api/orders", requireStaff, async (req, res) => {
  try {
    res.json(await getOrders());
  } catch (error) {
    console.error("Get orders error:", error);

    res.status(500).json({
      error: "Could not retrieve orders."
    });
  }
});

// GET ONE ORDER
app.get("/api/orders/:id", requireStaff, async (req, res) => {
  try {
    const order = await redis.get(`order:${req.params.id}`);

    if (!order) {
      return res.status(404).json({
        error: "Order not found."
      });
    }

    res.json(order);
  } catch (error) {
    console.error("Get order error:", error);

    res.status(500).json({
      error: "Could not retrieve order."
    });
  }
});

// UPDATE ORDER STATUS
app.patch(
  "/api/orders/:id/status",
  requireStaff,
  async (req, res) => {
    try {
      const { status } = req.body;

      const validStatuses = [
        "Pending",
        "Preparing",
        "Ready",
        "Collected"
      ];

      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          error: "Invalid order status."
        });
      }

      const order = await redis.get(`order:${req.params.id}`);

      if (!order) {
        return res.status(404).json({
          error: "Order not found."
        });
      }

      const updatedOrder = {
        ...order,
        status
      };

      await redis.set(
        `order:${updatedOrder.id}`,
        updatedOrder
      );

      res.json(updatedOrder);
    } catch (error) {
      console.error("Update order status error:", error);

      res.status(500).json({
        error: "Could not update order status."
      });
    }
  }
);

// ==========================================
// START SERVER
// ==========================================

async function startServer() {
  try {
    console.log("Connecting to Redis...");

    await redis.ping();

    console.log("Redis database connected successfully.");

    if (!STAFF_USERNAME || !STAFF_PASSWORD) {
      throw new Error(
        "STAFF_USERNAME and STAFF_PASSWORD must be configured."
      );
    }

    await seedMenu();

    app.listen(PORT, () => {
      console.log(
        `Coffee Shop API running on port ${PORT}`
      );
    });
  } catch (error) {
    console.error("Server startup failed:", error.message);
    process.exit(1);
  }
}

startServer();

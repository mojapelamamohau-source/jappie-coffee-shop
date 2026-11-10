
import React, { useEffect, useState } from "react";
import "./style.css";

const API = (
  import.meta.env.VITE_API_URL || "http://localhost:5000"
).trim().replace(/\/+$/, "").replace(/\/api$/i, "");

const productImages = {
  cappuccino: "/images/cappuccino.jpg",
  latte: "/images/latte.jpg",
  espresso: "/images/espresso.jpg",
  "green tea": "/images/green-tea.jpg",
  "chocolate cake": "/images/chocolate-cake.jpg",
  croissant: "/images/croissant.jpg",
  sprite: "/images/sprite.jpg"
};

function App() {
  const [page, setPage] = useState("Home");
  const [menuOpen, setMenuOpen] = useState(false);
  const [staffToken, setStaffToken] = useState(
    () => sessionStorage.getItem("jappieStaffToken") || ""
  );
  const [staffUsername, setStaffUsername] = useState("");
  const [staffPassword, setStaffPassword] = useState("");
  const [menuItems, setMenuItems] = useState([]);
  const [cart, setCart] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [editingId, setEditingId] = useState(null);

  const [form, setForm] = useState({
    name: "",
    category: "Coffee",
    price: "",
    description: "",
    available: true
  });

  async function request(url, options = {}) {
    const response = await fetch(`${API}${url}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(staffToken
          ? { Authorization: `Bearer ${staffToken}` }
          : {}),
        ...(options.headers || {})
      }
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      if (response.status === 401 && staffToken) {
        sessionStorage.removeItem("jappieStaffToken");
        setStaffToken("");
        setPage("Staff Login");
      }
      throw new Error(data.error || data.message || "Something went wrong.");
    }

    return data;
  }

  async function loadMenu() {
    setLoading(true);
    try {
      const data = await request("/api/menu");
      setMenuItems(
        Array.isArray(data)
          ? data
          : Array.isArray(data.items)
            ? data.items
            : []
      );
      setMessage("");
    } catch (error) {
      setMessage(`Could not load menu: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function loadOrders() {
    try {
      const data = await request("/api/orders");
      setOrders(
        Array.isArray(data)
          ? data
          : Array.isArray(data.orders)
            ? data.orders
            : []
      );
    } catch (error) {
      setMessage(error.message || "Could not load orders.");
    }
  }

  useEffect(() => {
    loadMenu();
  }, []);

  useEffect(() => {
    if (page === "Staff Dashboard" && staffToken) {
      loadOrders();
    }
  }, [page, staffToken]);

  function showPage(selectedPage) {
    const staffPages = ["Staff Dashboard", "Manage Menu"];

    if (staffPages.includes(selectedPage) && !staffToken) {
      setPage("Staff Login");
      setMessage("Please sign in with your staff account first.");
    } else {
      setPage(selectedPage);
      setMessage("");
      if (selectedPage === "Menu") loadMenu();
      if (selectedPage === "Staff Dashboard") loadOrders();
    }

    setMenuOpen(false);
  }

  async function staffLogin(event) {
    event.preventDefault();

    try {
      const result = await request("/api/staff/login", {
        method: "POST",
        body: JSON.stringify({
          username: staffUsername.trim(),
          password: staffPassword
        })
      });

      if (!result.token) {
        throw new Error("The server did not return a login token.");
      }

      sessionStorage.setItem("jappieStaffToken", result.token);
      setStaffToken(result.token);
      setStaffPassword("");
      setPage("Staff Dashboard");
      setMenuOpen(false);
      setMessage("Staff login successful.");
    } catch (error) {
      setMessage(error.message || "Staff login failed.");
    }
  }

  async function staffLogout() {
    try {
      await request("/api/staff/logout", { method: "POST" });
    } catch (error) {
      console.log("Logout request could not reach the server.");
    }

    sessionStorage.removeItem("jappieStaffToken");
    setStaffToken("");
    setStaffUsername("");
    setStaffPassword("");
    resetForm();
    setPage("Home");
    setMenuOpen(false);
    setMessage("You have been signed out.");
  }

  function addToCart(item) {
    setCart((current) => {
      const existing = current.find((x) => x.id === item.id);

      if (existing) {
        return current.map((x) =>
          x.id === item.id
            ? { ...x, quantity: x.quantity + 1 }
            : x
        );
      }

      return [...current, { ...item, quantity: 1 }];
    });

    setMessage(`${item.name} added to your cart.`);
  }

  function changeQuantity(id, amount) {
    setCart((current) =>
      current
        .map((item) =>
          item.id === id
            ? { ...item, quantity: item.quantity + amount }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  }

  function removeFromCart(id) {
    setCart((current) => current.filter((item) => item.id !== id));
  }

  const cartQuantity = cart.reduce(
    (total, item) => total + item.quantity, 0
  );

  const cartTotal = cart.reduce(
    (total, item) => total + Number(item.price) * item.quantity, 0
  );

  async function placeOrder(event) {
    event.preventDefault();

    if (!customerName.trim() || cart.length === 0) {
      setMessage("Enter your name and add items to your cart.");
      return;
    }

    const order = {
      customerName: customerName.trim(),
      items: cart.map((item) => ({
        id: item.id,
        name: item.name,
        price: Number(item.price),
        quantity: item.quantity
      })),
      total: cartTotal
    };

    try {
      await request("/api/orders", {
        method: "POST",
        body: JSON.stringify(order)
      });

      setCart([]);
      setCustomerName("");
      setMessage("Your order has been placed successfully.");
      setPage("Menu");
    } catch (error) {
      setMessage(error.message || "Could not place your order.");
    }
  }

  function resetForm() {
    setForm({
      name: "",
      category: "Coffee",
      price: "",
      description: "",
      available: true
    });
    setEditingId(null);
  }

  async function saveMenuItem(event) {
    event.preventDefault();

    if (!form.name.trim() || !form.price || Number(form.price) <= 0) {
      setMessage("Enter a valid item name and price.");
      return;
    }

    const itemData = {
      ...form,
      name: form.name.trim(),
      price: Number(form.price),
      description: form.description.trim()
    };

    try {
      if (editingId) {
        await request(`/api/menu/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(itemData)
        });
        setMessage("Menu item updated successfully.");
      } else {
        await request("/api/menu", {
          method: "POST",
          body: JSON.stringify(itemData)
        });
        setMessage("New menu item added successfully.");
      }

      resetForm();
      await loadMenu();
    } catch (error) {
      setMessage(error.message || "Could not save menu item.");
    }
  }

  function editMenuItem(item) {
    setForm({
      name: item.name || "",
      category: item.category || "Coffee",
      price: item.price ?? "",
      description: item.description || "",
      available: item.available !== false
    });
    setEditingId(item.id);
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function deleteMenuItem(id) {
    if (!window.confirm("Are you sure you want to delete this item?")) {
      return;
    }

    try {
      await request(`/api/menu/${id}`, { method: "DELETE" });
      setMessage("Menu item deleted successfully.");
      await loadMenu();
    } catch (error) {
      setMessage(error.message || "Could not delete menu item.");
    }
  }

  async function updateOrderStatus(id, status) {
    try {
      await request(`/api/orders/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status })
      });
      setMessage("Order status updated successfully.");
      await loadOrders();
    } catch (error) {
      setMessage(error.message || "Could not update order status.");
    }
  }

  function formatPrice(price) {
    return `M ${Number(price || 0).toFixed(2)}`;
  }

  function formatDate(date) {
    if (!date) return "Date unavailable";
    const parsed = new Date(date);
    return Number.isNaN(parsed.getTime())
      ? String(date)
      : parsed.toLocaleString();
  }

  function imageFor(itemName) {
    if (!itemName) return "";
    return productImages[itemName.trim().toLowerCase()] || "";
  }

  function handleImageError(event) {
    event.currentTarget.style.display = "none";
    const placeholder = event.currentTarget.nextElementSibling;
    if (placeholder) placeholder.style.display = "flex";
  }

  return (
    <div className="app">
      <header className="navbar">
        <button className="brand" onClick={() => showPage("Home")}>
          Jappie Coffee
        </button>

        <div className="nav-actions">
          <button className="cart-link" onClick={() => showPage("Cart")}>
            Cart ({cartQuantity})
          </button>

          <div className="menu-container">
            <button
              className={`hamburger ${menuOpen ? "active" : ""}`}
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Open navigation menu"
              aria-expanded={menuOpen}
            >
              <span></span><span></span><span></span>
            </button>

            {menuOpen && (
              <div className="dropdown-menu">
                {["Home", "Menu", "Cart"].map((item) => (
                  <button key={item} onClick={() => showPage(item)}>
                    {item}
                  </button>
                ))}

                {staffToken ? (
                  <>
                    <button onClick={() => showPage("Staff Dashboard")}>
                      Staff Dashboard
                    </button>
                    <button onClick={() => showPage("Manage Menu")}>
                      Manage Menu
                    </button>
                    <button onClick={staffLogout}>Staff Logout</button>
                  </>
                ) : (
                  <button onClick={() => showPage("Staff Login")}>
                    Staff Login
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="main-content">
        {message && (
          <div className="message">
            {message}
            <button
              className="message-close"
              onClick={() => setMessage("")}
              aria-label="Close message"
            >
              ×
            </button>
          </div>
        )}

        {page === "Home" && (
          <section className="hero">
            <div className="hero-text">
              <p className="eyebrow">WELCOME TO</p>
              <h1>Jappie Coffee</h1>
              <p>
                Freshly prepared coffee, delicious treats and a
                comfortable place to enjoy every moment.
              </p>
              <button
                className="primary-button"
                onClick={() => showPage("Menu")}
              >
                Explore Our Menu
              </button>
            </div>

            <div className="hero-image">
              <img
                src="/cup.jpg"
                alt="Jappie Coffee Shop"
                onError={handleImageError}
              />
              <div className="image-placeholder" style={{ display: "none" }}>
                Add your coffee shop home image
              </div>
            </div>
          </section>
        )}

        {page === "Menu" && (
          <section>
            <div className="section-heading">
              <p className="eyebrow">FRESHLY PREPARED</p>
              <h1>Our Menu</h1>
              <p>Choose your favourite coffee and treats.</p>
            </div>

            {loading ? (
              <p className="empty-message">Loading menu...</p>
            ) : menuItems.length === 0 ? (
              <p className="empty-message">No menu items available.</p>
            ) : (
              <div className="products">
                {menuItems.map((item) => (
                  <article className="product-card" key={item.id}>
                    <div className="product-picture">
                      {imageFor(item.name) ? (
                        <>
                          <img
                            src={imageFor(item.name)}
                            alt={item.name}
                            onError={handleImageError}
                          />
                          <div
                            className="image-placeholder"
                            style={{ display: "none" }}
                          >
                            {item.name} image
                          </div>
                        </>
                      ) : (
                        <div className="image-placeholder">
                          Add {item.name} image
                        </div>
                      )}
                    </div>

                    <div className="product-details">
                      <p className="category">{item.category}</p>
                      <h2>{item.name}</h2>
                      <p className="product-description">
                        {item.description}
                      </p>

                      <div className="product-bottom">
                        <strong>{formatPrice(item.price)}</strong>
                        <button
                          className="primary-button small-button"
                          disabled={item.available === false}
                          onClick={() => addToCart(item)}
                        >
                          {item.available === false
                            ? "Unavailable"
                            : "Add to Cart"}
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {page === "Cart" && (
          <section className="page-section">
            <div className="section-heading">
              <p className="eyebrow">YOUR SELECTION</p>
              <h1>Your Cart</h1>
            </div>

            {cart.length === 0 ? (
              <div className="empty-box">
                <h2>Your cart is empty</h2>
                <p>Add something delicious from our menu.</p>
                <button
                  className="primary-button"
                  onClick={() => showPage("Menu")}
                >
                  Browse Menu
                </button>
              </div>
            ) : (
              <div className="cart-layout">
                <div className="cart-items">
                  {cart.map((item) => (
                    <div className="cart-item" key={item.id}>
                      <div>
                        <h3>{item.name}</h3>
                        <p>{formatPrice(item.price)} each</p>
                      </div>

                      <div className="quantity-controls">
                        <button onClick={() => changeQuantity(item.id, -1)}>
                          −
                        </button>
                        <span>{item.quantity}</span>
                        <button onClick={() => changeQuantity(item.id, 1)}>
                          +
                        </button>
                      </div>

                      <strong>
                        {formatPrice(item.price * item.quantity)}
                      </strong>
                      <button
                        className="remove-button"
                        onClick={() => removeFromCart(item.id)}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>

                <form className="checkout-box" onSubmit={placeOrder}>
                  <h2>Order Summary</h2>
                  <label htmlFor="customerName">Customer Name</label>
                  <input
                    id="customerName"
                    value={customerName}
                    onChange={(event) => setCustomerName(event.target.value)}
                    placeholder="Enter your name"
                    required
                  />
                  <div className="total-line">
                    <span>Total</span>
                    <strong>{formatPrice(cartTotal)}</strong>
                  </div>
                  <button type="submit" className="primary-button full-button">
                    Place Order
                  </button>
                </form>
              </div>
            )}
          </section>
        )}

        {page === "Staff Login" && (
          <section className="page-section">
            <div className="section-heading">
              <p className="eyebrow">AUTHORISED STAFF ONLY</p>
              <h1>Staff Login</h1>
              <p>Sign in to manage the coffee shop.</p>
            </div>

            <form className="menu-form staff-login-form" onSubmit={staffLogin}>
              <h2>Staff Sign In</h2>
              <label htmlFor="staffUsername">Username</label>
              <input
                id="staffUsername"
                value={staffUsername}
                onChange={(event) => setStaffUsername(event.target.value)}
                autoComplete="username"
                required
              />
              <label htmlFor="staffPassword">Password</label>
              <input
                id="staffPassword"
                type="password"
                value={staffPassword}
                onChange={(event) => setStaffPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
              <button type="submit" className="primary-button full-button">
                Sign In
              </button>
            </form>
          </section>
        )}

        {page === "Staff Dashboard" && (
          <section className="page-section">
            <div className="section-heading dashboard-heading">
              <div>
                <p className="eyebrow">STAFF AREA</p>
                <h1>Staff Dashboard</h1>
                <p>View and manage customer orders.</p>
              </div>
              <div className="dashboard-actions">
                <button className="secondary-button" onClick={loadOrders}>
                  Refresh Orders
                </button>
                <button className="secondary-button" onClick={staffLogout}>
                  Staff Logout
                </button>
              </div>
            </div>

            <div className="dashboard-stats">
              <div className="stat-card">
                <p>Total Orders</p>
                <h2>{orders.length}</h2>
              </div>
              <div className="stat-card">
                <p>Pending Orders</p>
                <h2>{orders.filter((o) => o.status === "Pending").length}</h2>
              </div>
              <div className="stat-card">
                <p>Ready Orders</p>
                <h2>{orders.filter((o) => o.status === "Ready").length}</h2>
              </div>
            </div>

            <div className="orders-section">
              <h2>Customer Orders</h2>
              {orders.length === 0 ? (
                <p className="empty-message">No orders have been placed yet.</p>
              ) : (
                <div className="orders-grid">
                  {orders.map((order) => (
                    <article className="order-card" key={order.id}>
                      <div className="order-top">
                        <div>
                          <p className="category">ORDER</p>
                          <h3>{order.customerName || "Customer"}</h3>
                        </div>
                        <span className={`status ${(order.status || "Pending").toLowerCase()}`}>
                          {order.status || "Pending"}
                        </span>
                      </div>

                      <p className="order-date">
                        {formatDate(order.createdAt)}
                      </p>

                      <div className="order-products">
                        {(order.items || []).map((item, index) => (
                          <div
                            className="order-product"
                            key={`${item.id || item.name}-${index}`}
                          >
                            <span>{item.name} × {item.quantity}</span>
                            <strong>
                              {formatPrice(Number(item.price) * Number(item.quantity))}
                            </strong>
                          </div>
                        ))}
                      </div>

                      <div className="total-line">
                        <strong>Order Total</strong>
                        <strong>{formatPrice(order.total)}</strong>
                      </div>

                      <label htmlFor={`status-${order.id}`}>
                        Update Order Status
                      </label>
                      <select
                        id={`status-${order.id}`}
                        value={order.status || "Pending"}
                        onChange={(event) =>
                          updateOrderStatus(order.id, event.target.value)
                        }
                      >
                        <option value="Pending">Pending</option>
                        <option value="Preparing">Preparing</option>
                        <option value="Ready">Ready</option>
                        <option value="Collected">Collected</option>
                      </select>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {page === "Manage Menu" && (
          <section className="page-section">
            <div className="section-heading">
              <p className="eyebrow">STAFF AREA</p>
              <h1>Manage Menu</h1>
              <p>Add, update or remove menu items.</p>
            </div>

            <form className="menu-form" onSubmit={saveMenuItem}>
              <h2>{editingId ? "Update Menu Item" : "Add New Menu Item"}</h2>

              <label htmlFor="itemName">Item Name</label>
              <input
                id="itemName"
                value={form.name}
                onChange={(event) =>
                  setForm({ ...form, name: event.target.value })
                }
                required
              />

              <label htmlFor="category">Category</label>
              <select
                id="category"
                value={form.category}
                onChange={(event) =>
                  setForm({ ...form, category: event.target.value })
                }
              >
                <option value="Coffee">Coffee</option>
                <option value="Tea">Tea</option>
                <option value="Pastries">Pastries</option>
                <option value="Cold Drinks">Cold Drinks</option>
                <option value="Other">Other</option>
              </select>

              <label htmlFor="price">Price (M)</label>
              <input
                id="price"
                type="number"
                min="0.01"
                step="0.01"
                value={form.price}
                onChange={(event) =>
                  setForm({ ...form, price: event.target.value })
                }
                required
              />

              <label htmlFor="description">Description</label>
              <textarea
                id="description"
                rows="3"
                value={form.description}
                onChange={(event) =>
                  setForm({ ...form, description: event.target.value })
                }
              />

              <label className="availability-option">
                <input
                  type="checkbox"
                  checked={form.available}
                  onChange={(event) =>
                    setForm({ ...form, available: event.target.checked })
                  }
                />
                Available for ordering
              </label>

              <div className="form-actions">
                <button type="submit" className="primary-button">
                  {editingId ? "Save Changes" : "Add Menu Item"}
                </button>
                {editingId && (
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={resetForm}
                  >
                    Cancel Edit
                  </button>
                )}
              </div>
            </form>

            <div className="manage-list">
              <h2>Existing Menu Items</h2>
              {menuItems.map((item) => (
                <div className="manage-item" key={item.id}>
                  <div>
                    <h3>{item.name}</h3>
                    <p>{item.category} · {formatPrice(item.price)}</p>
                  </div>
                  <div className="manage-actions">
                    <button
                      className="secondary-button"
                      onClick={() => editMenuItem(item)}
                    >
                      Edit
                    </button>
                    <button
                      className="delete-button"
                      onClick={() => deleteMenuItem(item.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      <footer className="footer">
        <div className="footer-main">
          <div className="footer-brand">
            <h2>Jappie Coffee</h2>
            <p>
              Fresh coffee. Good moments.
              Made with care, served with warmth.
            </p>
          </div>

          <div className="footer-contact">
            <h3 className="footer-heading">Contact Us</h3>
            <p><a href="tel:+26667478429">+266 67478429</a></p>
            <p><a href="tel:+26658801655">+266 58801655</a></p>
            <p><a href="mailto:jappie@gmail.com">jappie@gmail.com</a></p>
          </div>

          <div className="footer-location">
            <h3 className="footer-heading">Find Us</h3>
            <p>Ha-Thetsane, Maseru, Lesotho</p>
            <a
              className="location-link"
              href="https://www.google.com/maps/search/?api=1&query=Ha-Thetsane%2C+Maseru%2C+Lesotho"
              target="_blank"
              rel="noopener noreferrer"
            >
              View Our Location
            </a>
          </div>
        </div>

        <div className="footer-bottom">
          <p>
            © {new Date().getFullYear()} Jappie Coffee. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;

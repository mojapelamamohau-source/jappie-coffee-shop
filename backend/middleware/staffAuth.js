export function staffAuth(req, res, next) {
  const expected = process.env.STAFF_API_KEY;
  const supplied = req.get("x-staff-key");

  if (!expected) {
    return res.status(500).json({ error: "Staff authentication is not configured." });
  }
  if (!supplied || supplied !== expected) {
    return res.status(401).json({ error: "Staff access required. Check your staff key." });
  }
  next();
}

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const SECRET = "nexonet_secret_key_gothic";
const DATA_FILE = path.join(__dirname, "data.json");

let db = { users: [], statuses: [], chat: [] };

function load() {
  if (fs.existsSync(DATA_FILE)) {
    try {
      db = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
      if (!db.statuses) db.statuses = [];
      if (!db.chat) db.chat = [];
    } catch (e) {
      console.error("Error al cargar data.json:", e);
    }
  }
}

function save() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
}

load();

// 🖼️ Aumentamos el límite de JSON a 10mb para permitir la subida de imágenes en base64
app.use(express.json({ limit: "10mb" }));
app.use(express.static(path.join(__dirname, "public")));

const clean = (str, max) => (str ? String(str).trim().substring(0, max) : "");

function auth(req, res, next) {
  const h = req.headers.authorization;
  if (!h) return res.status(401).json({ error: "No autorizado" });
  try {
    const token = h.split(" ")[1];
    const data = jwt.verify(token, SECRET);
    req.user = data.user;
    next();
  } catch {
    res.status(401).json({ error: "Token inválido" });
  }
}

// Registro
app.post("/api/register", async (req, res) => {
  const user = clean(req.body.user, 20).toLowerCase();
  const pass = req.body.pass;
  const nick = clean(req.body.nick, 24) || user;
  
  if (!user || !pass) return res.status(400).json({ error: "Faltan datos" });
  if (db.users.find(u => u.user === user)) return res.status(400).json({ error: "El usuario ya existe" });

  const hash = await bcrypt.hash(pass, 10);
  db.users.push({ user, hash, nick, bio: "Alma errante en NexoNet." });
  save();
  res.json({ ok: true });
});

// Login
app.post("/api/login", async (req, res) => {
  const user = clean(req.body.user, 20).toLowerCase();
  const pass = req.body.pass;
  
  const u = db.users.find(x => x.user === user);
  if (!u || !(await bcrypt.compare(pass, u.hash))) {
    return res.status(400).json({ error: "Credenciales inválidas" });
  }

  const token = jwt.sign({ user }, SECRET, { expiresIn: "30d" });
  res.json({ token });
});

// Perfil propio
app.get("/api/me", auth, (req, res) => {
  const u = db.users.find(x => x.user === req.user);
  if (!u) return res.status(404).json({ error: "No encontrado" });
  res.json({ user: u.user, nick: u.nick, bio: u.bio });
});

app.put("/api/me", auth, (req, res) => {
  const u = db.users.find(x => x.user === req.user);
  if (!u) return res.status(404).json({ error: "No encontrado" });
  
  u.nick = clean(req.body.nick, 24) || u.nick;
  u.bio = clean(req.body.bio, 160) || u.bio;
  save();
  res.json({ user: u.user, nick: u.nick, bio: u.bio });
});

// Lista de habitantes
app.get("/api/people", auth, (req, res) => {
  res.json(db.users.map(u => ({ user: u.user, nick: u.nick, bio: u.bio })));
});

// Obtener publicaciones (statuses)
app.get("/api/statuses", auth, (req, res) => {
  res.json(db.statuses.slice(-100).reverse());
});

// ==========================================================
// 📌 RUTAS: Crear estado (con soporte de imagen), hilos y reacciones
// ==========================================================

app.post("/api/statuses", auth, (req, res) => {
  const text = clean(req.body.text, 500); // Ampliamos ligeramente el texto por si va acompañado de post
  const image = req.body.image || null;  // 🖼️ Recibimos la imagen adjunta (Base64)

  if (!text && !image) return res.status(400).json({ error: "Escribe algo o adjunta una imagen." });

  const s = { 
    id: Date.now().toString() + Math.random().toString(36).substring(2, 7),
    user: req.user, 
    text, 
    image, // 🖼️ Guardamos la imagen en la publicación
    ts: Date.now(),
    replies: [],
    reactions: {} 
  };

  db.statuses.push(s);
  db.statuses = db.statuses.slice(-500);
  save();
  io.emit("status", s);
  res.json(s);
});

// Endpoint para responder en hilo
app.post("/api/statuses/:id/reply", auth, (req, res) => {
  const text = clean(req.body.text, 280);
  if (!text) return res.status(400).json({ error: "Escribe una respuesta" });
  const st = db.statuses.find(x => x.id === req.params.id);
  if (!st) return res.status(404).json({ error: "Publicación no encontrada" });
  
  const reply = { user: req.user, text, ts: Date.now() };
  if (!st.replies) st.replies = [];
  st.replies.push(reply);
  save();
  io.emit("status_update", st);
  res.json(st);
});

// Endpoint para reaccionar con emojis
app.post("/api/statuses/:id/react", auth, (req, res) => {
  const emoji = clean(req.body.emoji, 10);
  if (!emoji) return res.status(400).json({ error: "Emoji inválido" });
  const st = db.statuses.find(x => x.id === req.params.id);
  if (!st) return res.status(404).json({ error: "Publicación no encontrada" });
  
  if (!st.reactions) st.reactions = {};
  if (!st.reactions[emoji]) st.reactions[emoji] = [];
  
  const idx = st.reactions[emoji].indexOf(req.user);
  if (idx > -1) {
    st.reactions[emoji].splice(idx, 1);
    if (st.reactions[emoji].length === 0) delete st.reactions[emoji];
  } else {
    st.reactions[emoji].push(req.user);
  }
  save();
  io.emit("status_update", st);
  res.json(st);
});

// ==========================================================

// WebSockets para Chat Global en tiempo real
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    const data = jwt.verify(token, SECRET);
    socket.user = data.user;
    next();
  } catch {
    next(new Error("Autenticación fallida"));
  }
});

io.on("connection", (socket) => {
  socket.emit("history", db.chat.slice(-50));

  socket.on("chat", (text) => {
    const cleanText = clean(text, 300);
    if (!cleanText) return;
    const m = { user: socket.user, text: cleanText, ts: Date.now() };
    db.chat.push(m);
    db.chat = db.chat.slice(-200);
    save();
    io.emit("chat", m);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});

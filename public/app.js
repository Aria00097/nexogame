const $ = (id) => document.getElementById(id);
let token = localStorage.getItem("nexogame_token");
let me = null, socket = null, people = {};

async function api(path, method = "GET", body) {
  const r = await fetch("/api" + path, {
    method,
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || "Error");
  return data;
}

const nameOf = (u) => (people[u] && people[u].nick) || u;
const when = (t) => new Date(t).toLocaleString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

function createStatusCard(s) {
  const card = document.createElement("div");
  card.className = "card" + (s.user === me.user ? " me" : "");
  card.dataset.id = s.id;

  // Cabecera del post (Usuario y fecha)
  const header = document.createElement("div");
  header.style.display = "flex";
  header.style.justifyContent = "space-between";
  header.style.alignItems = "center";
  header.style.marginBottom = "8px";

  const author = document.createElement("span");
  author.className = "who";
  author.textContent = "@" + nameOf(s.user);

  const time = document.createElement("span");
  time.className = "ts";
  time.textContent = when(s.ts);

  header.append(author, time);

  // Texto del post
  const content = document.createElement("div");
  content.style.marginBottom = "12px";
  content.style.wordBreak = "break-word";
  content.textContent = s.text;

  // 🖼️ Contenedor de la imagen estilo Facebook / Modal flotante si el post tiene imagen
  let imageHtmlNode = null;
  if (s.image) {
    const imgContainer = document.createElement("div");
    imgContainer.className = "post-image-container";
    
    const img = document.createElement("img");
    img.src = s.image;
    img.alt = "Imagen de la publicación";
    img.className = "post-image";
    // Al hacer clic, abre la ventana flotante (Modal) en lugar de una pestaña nueva
    img.onclick = () => openImageModal(s.image);
    
    imgContainer.appendChild(img);
    imageHtmlNode = imgContainer;
  }

  // Barra de reacciones con Emojis (💀, 🖤, 🦇, ✨)
  const reactionsBar = document.createElement("div");
  reactionsBar.className = "reactions-bar";
  reactionsBar.style.display = "flex";
  reactionsBar.style.gap = "6px";
  reactionsBar.style.marginBottom = "12px";

  const emojis = ["💀", "🖤", "🦇", "✨"];
  emojis.forEach(emoji => {
    const btn = document.createElement("button");
    btn.className = "reaction-btn";
    const count = (s.reactions && s.reactions[emoji]) ? s.reactions[emoji].length : 0;
    const hasReacted = (s.reactions && s.reactions[emoji] && s.reactions[emoji].includes(me.user));
    
    btn.style.background = hasReacted ? "rgba(115,34,56,0.5)" : "rgba(13,9,18,0.4)";
    btn.style.border = "1px solid var(--bd)";
    btn.style.borderRadius = "12px";
    btn.style.padding = "2px 8px";
    btn.style.cursor = "pointer";
    btn.style.color = "var(--tx)";
    btn.style.fontSize = "13px";
    btn.textContent = `${emoji} ${count > 0 ? count : ""}`;

    btn.onclick = async () => {
      try {
        await api(`/statuses/${s.id}/react`, "POST", { emoji });
      } catch (e) { console.error(e); }
    };
    reactionsBar.appendChild(btn);
  });

  // Contenedor del hilo de respuestas
  const threadContainer = document.createElement("div");
  threadContainer.style.borderTop = "1px solid rgba(90,53,79,0.3)";
  threadContainer.style.paddingTop = "10px";
  threadContainer.style.marginTop = "8px";

  const repliesList = document.createElement("div");
  repliesList.style.marginBottom = "8px";
  
  if (s.replies && s.replies.length > 0) {
    s.replies.forEach(r => {
      const repDiv = document.createElement("div");
      repDiv.style.fontSize = "14px";
      repDiv.style.marginBottom = "6px";
      repDiv.style.paddingLeft = "10px";
      repDiv.style.borderLeft = "2px solid var(--bd)";
      repDiv.innerHTML = `<span class="who">@${nameOf(r.user)}</span>: <span style="color: var(--tx);">${r.text}</span> <span class="ts">(${when(r.ts)})</span>`;
      repliesList.appendChild(repDiv);
    });
  }

  // Input para responder en hilo
  const replyRow = document.createElement("div");
  replyRow.className = "row";
  replyRow.style.marginTop = "6px";

  const replyInput = document.createElement("input");
  replyInput.placeholder = "Escribe una respuesta en el hilo...";
  replyInput.maxLength = 200;
  replyInput.style.fontSize = "14px";
  replyInput.style.padding = "6px 10px";

  const replyBtn = document.createElement("button");
  replyBtn.className = "btn";
  replyBtn.style.padding = "6px 12px";
  replyBtn.style.fontSize = "14px";
  replyBtn.textContent = "Responder";

  const sendReply = async () => {
    const text = replyInput.value.trim();
    if (!text) return;
    try {
      await api(`/statuses/${s.id}/reply`, "POST", { text });
      replyInput.value = "";
    } catch (e) { alert(e.message); }
  };

  replyBtn.onclick = sendReply;
  replyInput.onkeydown = (e) => { if (e.key === "Enter") sendReply(); };

  replyRow.append(replyInput, replyBtn);
  threadContainer.append(repliesList, replyRow);

  // 🛠️ ENSAMBLAR LA TARJETA EN ORDEN CORRECTO (Incluyendo la imagen si existe)
  card.append(header, content);
  if (imageHtmlNode) card.append(imageHtmlNode); 
  card.append(reactionsBar, threadContainer);
  
  return card;
}

function addStatus(s, top) {
  const el = createStatusCard(s);
  top ? $("feed").prepend(el) : $("feed").append(el);
}

function updateStatusCard(s) {
  const existing = document.querySelector(`[data-id='${s.id}']`);
  if (existing) {
    const newCard = createStatusCard(s);
    existing.replaceWith(newCard);
  }
}

function addChat(m) {
  const log = $("chatlog");
  if (!log) return;
  const bottom = log.scrollTop + log.clientHeight >= log.scrollHeight - 40;
  log.append(item("msg", m));
  if (bottom) log.scrollTop = log.scrollHeight;
}

function item(cls, m) {
  const d = document.createElement("div");
  d.className = cls;
  const w = document.createElement("span");
  w.className = "who";
  w.textContent = "@" + nameOf(m.user);
  const t = document.createElement("span");
  t.className = "ts";
  t.textContent = when(m.ts);
  const b = document.createElement("div");
  b.textContent = m.text;
  d.append(w, t, b);
  return d;
}

async function loadPeople() {
  const list = await api("/people");
  people = {};
  list.forEach((p) => (people[p.user] = p));
  const box = $("people");
  if (!box) return;
  box.textContent = "";
  list.forEach((p) => {
    const c = document.createElement("div");
    c.className = "card";
    const n = document.createElement("span");
    n.className = "who";
    n.textContent = "@" + p.nick;
    const b = document.createElement("div");
    b.textContent = p.bio || "";
    c.append(n, b);
    box.append(c);
  });
}

async function enter() {
  try { 
    me = await api("/me"); 
  } catch (err) { 
    return logout(false); 
  }
  
  const authEl = $("auth");
  if (authEl) { authEl.classList.add("hide"); authEl.style.display = "none"; }
  
  $("app").classList.remove("hide");
  $("topnav").classList.remove("hide");
  $("out").classList.remove("hide");
  
  if ($("nick")) $("nick").value = me.nick || "";
  if ($("bio")) $("bio").value = me.bio || "";
  
  await loadPeople();
  const sts = await api("/statuses");
  $("feed").textContent = "";
  if (!sts.length) {
    $("feed").innerHTML = '<div class="card" style="text-align:center; color:var(--mu);">Aún no hay publicaciones en las sombras. ¡Comparte la primera!</div>';
  } else {
    sts.forEach((s) => addStatus(s));
  }

  socket = io({ auth: { token } });
  socket.on("history", (h) => { 
    const log = $("chatlog"); 
    if (log) { log.textContent = ""; h.forEach(addChat); } 
  });
  socket.on("chat", async (m) => { if (!people[m.user]) await loadPeople(); addChat(m); });
  socket.on("status", async (s) => {
    if (!people[s.user]) await loadPeople();
    const note = $("feed").querySelector(".card[style*='text-align:center']");
    if (note) note.remove();
    addStatus(s, true);
  });
  socket.on("status_update", async (s) => {
    if (!people[s.user]) await loadPeople();
    updateStatusCard(s);
  });
}

function logout(reload = true) {
  localStorage.removeItem("nexogame_token");
  token = null;
  me = null;
  if (reload) location.reload();
}

async function authenticate() {
  const errEl = $("err");
  if (errEl) errEl.textContent = "";
  try {
    const userVal = $("u").value.trim().toLowerCase();
    const passVal = $("p").value;
    if (!userVal || !passVal) throw new Error("Ingresa tu usuario y contraseña");

    const r = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user: userVal, pass: passVal }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || "Credenciales inválidas");
    
    token = data.token;
    localStorage.setItem("nexogame_token", token);
    await enter();
  } catch (e) { if (errEl) errEl.textContent = e.message; }
}

if ($("login")) $("login").onclick = authenticate;
if ($("out")) $("out").onclick = () => logout(true);

const send = () => {
  const cmEl = $("cm");
  if (!cmEl) return;
  const t = cmEl.value.trim();
  if (!t || !socket) return;
  socket.emit("chat", t);
  cmEl.value = "";
};

if ($("send")) $("send").onclick = send;
if ($("cm")) { $("cm").onkeydown = (e) => { if (e.key === "Enter") send(); }; }

if ($("save")) {
  $("save").onclick = async () => {
    try {
      me = await api("/me", "PUT", { nick: $("nick").value, bio: $("bio").value });
      await loadPeople();
      $("ok").textContent = "¡Guardado!";
      setTimeout(() => ($("ok").textContent = ""), 2000);
    } catch (e) { $("ok").textContent = e.message; }
  };
}

document.querySelectorAll("nav button").forEach((b) => {
  b.onclick = () => {
    document.querySelectorAll("nav button").forEach((x) => x.classList.toggle("on", x === b));
    document.querySelectorAll(".tab-section").forEach((s) => s.classList.add("hide"));
    const target = $(b.dataset.t);
    if (target) target.classList.remove("hide");
    if (b.dataset.t === "chat") {
      const log = $("chatlog");
      if (log) log.scrollTop = log.scrollHeight;
    }
  };
});

if (token) enter();

// ==========================================================
// 🖼️ GESTIÓN DE IMÁGENES Y PUBLICACIÓN DESDE EL CREADOR DE POSTS
// ==========================================================
let currentImageBase64 = null;

const imageFileInput = document.getElementById("imageFileInput");
const imgPreviewContainer = document.getElementById("imgPreviewContainer");
const imgPreview = document.getElementById("imgPreview");
const btnRemoveImg = document.getElementById("btnRemoveImg");

if (imageFileInput) {
  imageFileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function(event) {
        currentImageBase64 = event.target.result;
        if (imgPreview) imgPreview.src = currentImageBase64;
        if (imgPreviewContainer) imgPreviewContainer.style.display = "inline-block";
      };
      reader.readAsDataURL(file);
    }
  });
}

if (btnRemoveImg) {
  btnRemoveImg.addEventListener("click", () => {
    currentImageBase64 = null;
    if (imageFileInput) imageFileInput.value = "";
    if (imgPreviewContainer) imgPreviewContainer.style.display = "none";
  });
}

const btnPost = document.getElementById("post");
if (btnPost) {
  btnPost.addEventListener("click", async () => {
    const statusInput = document.getElementById("statusInput");
    const text = statusInput ? statusInput.value.trim() : "";

    if (!text && !currentImageBase64) {
      alert("Escribe algo o adjunta una imagen para publicar.");
      return;
    }

    try {
      const res = await fetch("/api/statuses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ text, image: currentImageBase64 })
      });

      const data = await res.json();

      if (res.ok) {
        if (statusInput) statusInput.value = "";
        currentImageBase64 = null;
        if (imageFileInput) imageFileInput.value = "";
        if (imgPreviewContainer) imgPreviewContainer.style.display = "none";
      } else {
        alert(data.error || "Error al publicar");
      }
    } catch (err) {
      console.error(err);
      alert("Error de conexión con el servidor.");
    }
  });
}

// ==========================================================
// 🔍 FUNCIONALIDAD DE VISTA PREVIA FLOTANTE (MODAL/LIGHTBOX)
// ==========================================================
function openImageModal(src) {
  const modal = document.getElementById("imageModal");
  const modalImg = document.getElementById("fullModalImage");
  if (modal && modalImg) {
    modalImg.src = src;
    modal.classList.remove("hide");
  }
}

function closeImageModal() {
  const modal = document.getElementById("imageModal");
  if (modal) {
    modal.classList.add("hide");
  }
}

// Cerrar también al presionar la tecla 'Escape'
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeImageModal();
});
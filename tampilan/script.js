const ADMIN_PASSWORD = "adinda1991"

let activeCategory = "All"
let pendingSnippetId = null
let confirmCallback = null
let snippetsCache = []

const homePage = document.getElementById("homePage")
const detailPage = document.getElementById("detailPage")
const snippetList = document.getElementById("snippetList")
const adminPanel = document.getElementById("adminPanel")

function showLoading() {
  document.getElementById("loading")?.classList.remove("hidden")
}

function hideLoading() {
  document.getElementById("loading")?.classList.add("hidden")
}

function getItemCategories(item) {
  if (Array.isArray(item.categories) && item.categories.length) {
    return item.categories
  }

  return String(item.category || "All")
    .split(",")
    .map(v => v.trim())
    .filter(Boolean)
}

function formatDate(value) {
  if (!value) return "-"

  if (typeof value === "number") {
    return new Date(value).toLocaleString("id-ID")
  }

  const date = new Date(value)
  if (!isNaN(date.getTime())) {
    return date.toLocaleString("id-ID")
  }

  return String(value)
}

async function getSnippets() {
  try {
    const res = await fetch(`/api/snippets?t=${Date.now()}`, {
      cache: "no-store"
    })

    const data = await res.json()

    if (!Array.isArray(data)) {
      console.log("GET bukan array:", data)
      return []
    }

    snippetsCache = data
    renderCategories()
    return data
  } catch (err) {
    console.log("GET snippets gagal:", err)
    return []
  }
}

function renderCategories() {
  const menu = document.querySelectorAll(".side-menu")[1]

  const categories = [
    ...new Set(
      snippetsCache.flatMap(v => getItemCategories(v))
    )
  ].sort((a, b) =>
    a.localeCompare(b, "id", {
      sensitivity: "base"
    })
  )

  menu.innerHTML = `
    <p>CATEGORIES</p>

    <button
      class="cat ${activeCategory === "All" ? "active" : ""}"
      onclick="setCategory('All')"
    >
      <span class="material-icons">grid_view</span>
      All
    </button>

    ${categories
      .filter(cat => cat !== "All")
      .map(cat => `
        <button
          class="cat ${activeCategory === cat ? "active" : ""}"
          onclick="setCategory('${cat.replace(/'/g, "\\'")}')"
        >
          <span class="material-icons">folder</span>
          ${escapeHTML(cat)}
        </button>
      `).join("")}
  `
}

async function saveSnippets(data) {
  const res = await fetch("/api/snippets", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(data)
  })

  const result = await res.json().catch(() => null)

  console.log("SAVE RESPONSE:", result)

  if (!res.ok || result?.status === false) {
    showToast(result?.message || "Gagal save snippet")
    return false
  }

  snippetsCache = data
  renderCategories()
  return true
}

async function openFromUrl() {
  const path = window.location.pathname

  if (!path.startsWith("/code/")) return

  const slug = path.split("/code/")[1]
  if (!slug) return

  const snippets = await getSnippets()

  const item = snippets.find(x =>
    slugify(x.title) === slug ||
    slugify(String(x.title || "").replace(/\.[a-z0-9]+$/i, "")) === slug
  )

  if (!item) {
    showToast("Snippet not found")
    return
  }

  await openDetail(item.id, false)
}

function isAdmin() {
  return sessionStorage.getItem("admin_login") === "true"
}

function openSidebar() {
  document.getElementById("sidebar").classList.add("show")
  document.querySelector(".overlay").classList.remove("hidden")
}

function closeSidebar() {
  document.getElementById("sidebar").classList.remove("show")
  document.querySelector(".overlay").classList.add("hidden")
}

function openLogin() {
  document.getElementById("loginModal").classList.remove("hidden")
}

function closeLogin() {
  document.getElementById("loginModal").classList.add("hidden")
}

async function loginAdmin() {
  const pass = document.getElementById("adminPass").value

  if (pass !== ADMIN_PASSWORD) {
    showToast("Wrong password")
    return
  }

  sessionStorage.setItem("admin_login", "true")
  document.getElementById("adminPass").value = ""

  closeLogin()
  checkAdmin()
  await renderSnippets()
}

async function logoutAdmin() {
  sessionStorage.removeItem("admin_login")

  checkAdmin()
  await renderSnippets()
}

function checkAdmin() {
  const loginBtn = document.getElementById("loginBtn")
  const logoutBtn = document.getElementById("logoutBtn")

  if (isAdmin()) {
    adminPanel.classList.remove("hidden")
    loginBtn.classList.add("hidden")
    logoutBtn.classList.remove("hidden")
  } else {
    adminPanel.classList.add("hidden")
    loginBtn.classList.remove("hidden")
    logoutBtn.classList.add("hidden")
  }
}

async function setCategory(cat) {
  activeCategory = cat

  document.querySelectorAll(".cat").forEach(btn => {
    btn.classList.remove("active")

    if (btn.innerText.trim().toLowerCase() === cat.toLowerCase()) {
      btn.classList.add("active")
    }
  })

  closeSidebar()
  await renderSnippets()
}

async function renderSnippets() {
  showLoading()

  try {
    const keyword = document
      .getElementById("searchInput")
      .value
      .toLowerCase()

    const data = await getSnippets()

    const snippets = data
      .filter(item => {
        const cats = getItemCategories(item)

        const matchSearch =
          String(item.title || "").toLowerCase().includes(keyword) ||
          String(item.lang || "").toLowerCase().includes(keyword) ||
          cats.join(" ").toLowerCase().includes(keyword) ||
          String(item.author || "").toLowerCase().includes(keyword)

        const matchCat =
          activeCategory === "All" ||
          cats.includes(activeCategory)

        return matchSearch && matchCat
      })
      .sort((a, b) =>
        String(a.title || "").localeCompare(String(b.title || ""), "id", {
          sensitivity: "base",
          numeric: true
        })
      )

    if (!snippets.length) {
      snippetList.innerHTML = `
        <div class="empty">
          <span class="material-icons">search_off</span>
          <p>Snippet not found.</p>
        </div>
      `
      return
    }

    snippetList.innerHTML = snippets.map(item => {
      const cats = getItemCategories(item)

      return `
        <div class="snippet-item" onclick="openDetail(${item.id})">

          <div class="icon-box">
            <span class="material-icons">code</span>
          </div>

          <div class="snippet-info">
            <h3>${escapeHTML(item.title)}</h3>

            <div class="tags">
              <span class="lang">
                ${escapeHTML(formatLang(item.lang || "javascript"))}
              </span>

              ${cats.map(cat => `
                <span class="cat-text">${escapeHTML(cat)}</span>
              `).join("")}

              ${item.password ? `
                <span class="locked">
                  <img src="/tampilan/icon/lock.png">
                </span>
              ` : ""}
            </div>

            <div class="snippet-meta">
              <span>By ${escapeHTML(item.author || "Unknown")}</span>
              <span>👁 ${item.views || 0}</span>
              <span>❤️ ${item.likes || 0}</span>
            </div>
          </div>

          <span class="material-icons arrow">
            arrow_forward
          </span>
        </div>
      `
    }).join("")
  } finally {
    hideLoading()
  }
}

async function openDetail(id, force = false) {
  const snippets = await getSnippets()
  const item = snippets.find(x => x.id === id)

  if (!item) return

  if (item.password && !force) {
    pendingSnippetId = id
    document.getElementById("passwordModal").classList.remove("hidden")
    return
  }

  item.views = Number(item.views || 0) + 1
  await saveSnippets(snippets)

  const cats = getItemCategories(item)

  homePage.classList.add("hidden")
  detailPage.classList.remove("hidden")

  history.pushState(null, "", `/code/${slugify(item.title)}`)

  detailPage.innerHTML = `
    <div class="detail">

      <button class="back-btn" onclick="goHome()">
        <span class="material-icons">arrow_back</span>
        Back
      </button>

      <h2>${escapeHTML(item.title)}</h2>

      <div class="meta">
        <div>
          Author
          <b>${escapeHTML(item.author || "Unknown")}</b>
        </div>

        <div>
          Language
          <b>${escapeHTML(formatLang(item.lang || "javascript"))}</b>
        </div>

        <div>
          Category
          <b>${escapeHTML(cats.join(", "))}</b>
        </div>

        <div>
          Views
          <b>👁 ${item.views || 0}</b>
        </div>

        <div>
          Likes
          <b>❤️ ${item.likes || 0}</b>
        </div>
      </div>

      <div class="form-actions" style="margin-bottom:20px">
        <button
          class="admin-action blue"
          onclick="likeSnippet(${item.id})"
        >
          ❤️ Like (${item.likes || 0})
        </button>
      </div>

      ${isAdmin() ? `
        <div class="form-actions" style="margin-bottom:20px">

          <button
            class="admin-action blue"
            onclick="editSnippet(${item.id})"
          >
            Edit
          </button>

          <button
            class="admin-action red"
            onclick="deleteSnippet(${item.id})"
          >
            Delete
          </button>

        </div>
      ` : ""}

      <div class="code-window">

        <div class="window-head">

          <div class="dots">
            <span></span>
            <span></span>
            <span></span>
          </div>

          <div class="window-actions">

            <button onclick="copyCode(${item.id})">
              <span class="material-icons">content_copy</span>
            </button>

            <button onclick="downloadCode(${item.id})">
              <span class="material-icons">download</span>
            </button>

          </div>

        </div>

        <pre><code class="language-${escapeHTML(item.lang || "javascript")}">${escapeHTML(item.content)}</code></pre>

      </div>

    </div>
  `

  document
    .querySelectorAll("pre code")
    .forEach(block => hljs.highlightElement(block))

  window.scrollTo(0, 0)
}

function closePasswordModal() {
  document.getElementById("passwordModal").classList.add("hidden")
  document.getElementById("snippetPasswordInput").value = ""
  pendingSnippetId = null
}

async function submitSnippetPassword() {
  const input = document.getElementById("snippetPasswordInput").value
  const snippets = await getSnippets()

  const item = snippets.find(x => x.id === pendingSnippetId)
  if (!item) return

  if (input !== item.password) {
    showToast("Wrong password")
    return
  }

  document.getElementById("passwordModal").classList.add("hidden")
  document.getElementById("snippetPasswordInput").value = ""

  const id = pendingSnippetId
  pendingSnippetId = null

  await openDetail(id, true)
}

async function goHome() {
  detailPage.classList.add("hidden")
  homePage.classList.remove("hidden")

  history.pushState(null, "", "/code")

  closeSidebar()
  await renderSnippets()
}

window.addEventListener("popstate", async () => {
  detailPage.classList.add("hidden")
  homePage.classList.remove("hidden")
  closeSidebar()
  await renderSnippets()
})

async function saveSnippet() {
  const editId = document.getElementById("editId").value

  const title = document.getElementById("codeTitle").value.trim()
  const author = document.getElementById("codeAuthor").value.trim()
  const lang = document.getElementById("codeLang").value
  const categoryInput = document.getElementById("codeCategory").value.trim() || "All"

  const categories = categoryInput
    .split(",")
    .map(v => v.trim())
    .filter(Boolean)

  const category = categories.join(", ")

  const password = document.getElementById("codePassword").value.trim()
  const content = document.getElementById("codeContent").value.trim()

  if (!title || !content) {
    showToast("Title and code are required fields.")
    return
  }

  let snippets = await getSnippets()

  if (editId) {
    snippets = snippets.map(item =>
      item.id == editId
        ? {
            ...item,
            title,
            author,
            lang,
            category,
            categories,
            password,
            content,
            views: Number(item.views || 0),
            likes: Number(item.likes || 0),
            updatedAt: Date.now()
          }
        : item
    )
  } else {
    snippets.unshift({
      id: Date.now(),
      title,
      author,
      lang,
      category,
      categories,
      password,
      content,
      views: 0,
      likes: 0,
      createdAt: Date.now()
    })
  }

  const saved = await saveSnippets(snippets)

  if (!saved) return

  resetForm()
  await renderSnippets()
  showToast("Code saved successfully")
}

async function editSnippet(id) {
  const snippets = await getSnippets()
  const item = snippets.find(x => x.id === id)
  if (!item) return

  await goHome()

  document.getElementById("formTitle").innerText = "Edit Code"
  document.getElementById("editId").value = item.id
  document.getElementById("codeTitle").value = item.title
  document.getElementById("codeAuthor").value = item.author || "Swiper Fvck"
  document.getElementById("codeLang").value = item.lang || "javascript"
  document.getElementById("codeCategory").value = getItemCategories(item).join(", ")
  document.getElementById("codePassword").value = item.password || ""
  document.getElementById("codeContent").value = item.content

  window.scrollTo({
    top: adminPanel.offsetTop - 90,
    behavior: "smooth"
  })
}

async function deleteSnippet(id) {
  showConfirm(
    "Delete Code",
    "Are you sure you want to delete this snippet?",
    async () => {
      const snippets = await getSnippets()
      const data = snippets.filter(item => item.id !== id)

      await saveSnippets(data)
      await goHome()
      showToast("Code deleted successfully")
    }
  )
}

function resetForm() {
  document.getElementById("formTitle").innerText = "Add Code"
  document.getElementById("editId").value = ""
  document.getElementById("codeTitle").value = ""
  document.getElementById("codeAuthor").value = "Swiper Fvck"
  document.getElementById("codeLang").value = "javascript"
  document.getElementById("codeCategory").value = "All"
  document.getElementById("codePassword").value = ""
  document.getElementById("codeContent").value = ""
}

async function copyCode(id) {
  const snippets = await getSnippets()
  const item = snippets.find(x => x.id === id)
  if (!item) return

  navigator.clipboard.writeText(item.content)
  showToast("Code successfully copied")
}

async function downloadCode(id) {
  const snippets = await getSnippets()
  const item = snippets.find(x => x.id === id)
  if (!item) return

  const blob = new Blob([item.content], {
    type: "text/plain"
  })

  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")

  a.href = url
  a.download = item.title
  a.click()

  URL.revokeObjectURL(url)
}

async function likeSnippet(id) {
  const likedKey = `liked_${id}`

  if (localStorage.getItem(likedKey)) {
    showToast("You already liked this snippet")
    return
  }

  const snippets = await getSnippets()
  const item = snippets.find(x => x.id === id)

  if (!item) return

  item.likes = Number(item.likes || 0) + 1
  localStorage.setItem(likedKey, "true")

  await saveSnippets(snippets)

  showToast("Liked ❤️")
  await openDetail(id, true)
}

function escapeHTML(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}

function slugify(text) {
  return String(text)
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

function formatLang(lang) {
  lang = String(lang || "javascript")

  if (lang === "javascript") return "Javascript"
  if (lang === "bash") return "Shell"

  return lang.charAt(0).toUpperCase() + lang.slice(1)
}

async function seedData() {
  return
}

function showToast(message) {
  const toast = document.getElementById("toast")
  toast.innerText = message
  toast.classList.add("show")

  clearTimeout(window.toastTimeout)

  window.toastTimeout = setTimeout(() => {
    toast.classList.remove("show")
  }, 2500)
}

function showConfirm(title, message, callback) {
  document.getElementById("confirmTitle").innerText = title
  document.getElementById("confirmMessage").innerText = message
  document.getElementById("confirmModal").classList.remove("hidden")

  confirmCallback = callback
}

function closeConfirm() {
  document.getElementById("confirmModal").classList.add("hidden")
  confirmCallback = null
}

document.getElementById("confirmYes").onclick = async () => {
  if (confirmCallback) {
    await confirmCallback()
  }

  closeConfirm()
}

;(async () => {
  await seedData()
  checkAdmin()
  await renderSnippets()
  await openFromUrl()
})()
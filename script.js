const ADMIN_PASSWORD = "adinda1991"

let activeCategory = "All"
let pendingSnippetId = null
let confirmCallback = null

const homePage = document.getElementById("homePage")
const detailPage = document.getElementById("detailPage")
const snippetList = document.getElementById("snippetList")
const adminPanel = document.getElementById("adminPanel")

function getSnippets() {
  return JSON.parse(localStorage.getItem("snippets")) || []
}

function saveSnippets(data) {
  localStorage.setItem("snippets", JSON.stringify(data))
}

function isAdmin() {
  return localStorage.getItem("admin_login") === "true"
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

function loginAdmin() {
  const pass = document.getElementById("adminPass").value

  if (pass !== ADMIN_PASSWORD) {
    showToast("Wrong password")
    return
  }

  localStorage.setItem("admin_login", "true")
  document.getElementById("adminPass").value = ""
  closeLogin()
  checkAdmin()
  renderSnippets()
}

function logoutAdmin() {
  localStorage.removeItem("admin_login")
  checkAdmin()
  renderSnippets()
}

function checkAdmin() {
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

function setCategory(cat) {
  activeCategory = cat

  document.querySelectorAll(".cat").forEach(btn => {
    btn.classList.remove("active")
    if (btn.innerText.trim().toLowerCase() === cat.toLowerCase()) {
      btn.classList.add("active")
    }
  })

  closeSidebar()
  renderSnippets()
}

function renderSnippets() {
  const keyword = document.getElementById("searchInput").value.toLowerCase()

  const snippets = getSnippets().filter(item => {
    const matchSearch =
      item.title.toLowerCase().includes(keyword) ||
      item.lang.toLowerCase().includes(keyword) ||
      item.category.toLowerCase().includes(keyword)

    const matchCat = activeCategory === "All" || item.category === activeCategory

    return matchSearch && matchCat
  })

  if (!snippets.length) {
    snippetList.innerHTML = `
      <div class="empty">
        <span class="material-icons">search_off</span>
        <p>Snippet not found.</p>
      </div>
    `
    return
  }

  snippetList.innerHTML = snippets.map(item => `
    <div class="snippet-item" onclick="openDetail(${item.id})">
      <div class="icon-box">
        <span class="material-icons">code</span>
      </div>

      <div class="snippet-info">
        <h3>${escapeHTML(item.title)}</h3>

        <div class="tags">
          <span class="lang">${escapeHTML(formatLang(item.lang))}</span>
          <span class="cat-text">${escapeHTML(item.category)}</span>
          ${item.password ? `
  <span class="locked">
    <img src="/icon/lock.png">
  </span>
` : ""}
        </div>
      </div>

      <span class="material-icons arrow">arrow_forward</span>
    </div>
  `).join("")
}

function openDetail(id, force = false) {
  const item = getSnippets().find(x => x.id === id)
  if (!item) return

  if (item.password && !force) {
    pendingSnippetId = id
    document.getElementById("passwordModal").classList.remove("hidden")
    return
  }

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
        <div>Author <b>${escapeHTML(item.author || "Unknown")}</b></div>
        <div>Language <b>${escapeHTML(formatLang(item.lang))}</b></div>
        <div>Category <b>${escapeHTML(item.category)}</b></div>
      </div>

      ${isAdmin() ? `
        <div class="form-actions" style="margin-bottom:20px">
          <button class="admin-action blue" onclick="editSnippet(${item.id})">Edit</button>
          <button class="admin-action red" onclick="deleteSnippet(${item.id})">Delete</button>
        </div>
      ` : ""}

      <div class="code-window">
        <div class="window-head">
          <div class="dots">
            <span></span><span></span><span></span>
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

        <pre><code class="language-${item.lang}">${escapeHTML(item.content)}</code></pre>
      </div>
    </div>
  `

  document.querySelectorAll("pre code").forEach(block => hljs.highlightElement(block))
  window.scrollTo(0, 0)
}

function closePasswordModal() {
  document.getElementById("passwordModal").classList.add("hidden")
  document.getElementById("snippetPasswordInput").value = ""
  pendingSnippetId = null
}

function submitSnippetPassword() {
  const input = document.getElementById("snippetPasswordInput").value
  const item = getSnippets().find(x => x.id === pendingSnippetId)

  if (!item) return

  if (input !== item.password) {
    showToast("Wrong password")
    return
  }

  document.getElementById("passwordModal").classList.add("hidden")
  document.getElementById("snippetPasswordInput").value = ""

  const id = pendingSnippetId
  pendingSnippetId = null

  openDetail(id, true)
}

function goHome() {
  detailPage.classList.add("hidden")
  homePage.classList.remove("hidden")
  history.pushState(null, "", "/code")
  closeSidebar()
  renderSnippets()
}

window.addEventListener("popstate", () => {
  goHome()
})

function saveSnippet() {
  const editId = document.getElementById("editId").value
  const title = document.getElementById("codeTitle").value.trim()
  const author = document.getElementById("codeAuthor").value.trim()
  const lang = document.getElementById("codeLang").value
  const category = document.getElementById("codeCategory").value
  const password = document.getElementById("codePassword").value.trim()
  const content = document.getElementById("codeContent").value.trim()

  if (!title || !content) {
    showToast("Title and code are required fields.")
    return
  }

  let snippets = getSnippets()

  if (editId) {
    snippets = snippets.map(item => item.id == editId ? {
      ...item,
      title,
      author,
      lang,
      category,
      password,
      content
    } : item)
  } else {
    snippets.unshift({
      id: Date.now(),
      title,
      author,
      lang,
      category,
      password,
      content
    })
  }

  saveSnippets(snippets)
  resetForm()
  renderSnippets()
}

function editSnippet(id) {
  const item = getSnippets().find(x => x.id === id)
  if (!item) return

  goHome()

  document.getElementById("formTitle").innerText = "Edit Code"
  document.getElementById("editId").value = item.id
  document.getElementById("codeTitle").value = item.title
  document.getElementById("codeAuthor").value = item.author || ""
  document.getElementById("codeLang").value = item.lang
  document.getElementById("codeCategory").value = item.category
  document.getElementById("codePassword").value = item.password || ""
  document.getElementById("codeContent").value = item.content

  window.scrollTo({
    top: adminPanel.offsetTop - 90,
    behavior: "smooth"
  })
}

function deleteSnippet(id) {
  showConfirm(
  "Delete Code",
  "Are you sure you want to delete this snippet?",
  () => {
    const data = getSnippets()
      .filter(item => item.id !== id)

    saveSnippets(data)
    goHome()

    showToast("Code deleted successfully")
  }
)

return
}

function resetForm() {
  document.getElementById("formTitle").innerText = "Add Code"
  document.getElementById("editId").value = ""
  document.getElementById("codeTitle").value = ""
  document.getElementById("codeAuthor").value = ""
  document.getElementById("codeLang").value = "javascript"
  document.getElementById("codeCategory").value = "Tools"
  document.getElementById("codePassword").value = ""
  document.getElementById("codeContent").value = ""
}

function copyCode(id) {
  const item = getSnippets().find(x => x.id === id)
  if (!item) return

  navigator.clipboard.writeText(item.content)
  showToast("Code successfully copied")
}

function downloadCode(id) {
  const item = getSnippets().find(x => x.id === id)
  if (!item) return

  const blob = new Blob([item.content], { type: "text/plain" })
  const url = URL.createObjectURL(blob)

  const a = document.createElement("a")
  a.href = url
  a.download = item.title
  a.click()

  URL.revokeObjectURL(url)
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
  return text
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

function formatLang(lang) {
  if (lang === "javascript") return "Javascript"
  if (lang === "bash") return "Shell"
  return lang.charAt(0).toUpperCase() + lang.slice(1)
}

function seedData() {
  if (getSnippets().length) return

  saveSnippets([
    {
      id: 1,
      title: "alkiosku.js",
      author: "Swiper Fvck",
      lang: "javascript",
      category: "Tools",
      password: "123",
      content: `/*
Alkiosku Digital PPOB - QRIS
Password snippet ini: 123
*/

const headers = {
  "User-Agent": "okhttp/3.14.9",
  "Connection": "Keep-Alive",
  "Accept-Encoding": "gzip"
}

async function main() {
  console.log("Hello Snippetra")
}

main()`
    },
    {
      id: 2,
      title: "play.js",
      author: "Admin",
      lang: "javascript",
      category: "Downloader",
      password: "",
      content: `const axios = require("axios")

async function play(query) {
  const { data } = await axios.get("https://example.com/api", {
    params: { q: query }
  })

  return data
}`
    }
  ])
}

seedData()
checkAdmin()
renderSnippets()

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

  document
    .getElementById("confirmModal")
    .classList.remove("hidden")

  confirmCallback = callback
}

function closeConfirm() {
  document
    .getElementById("confirmModal")
    .classList.add("hidden")

  confirmCallback = null
}

document
  .getElementById("confirmYes")
  .onclick = () => {

  if (confirmCallback) {
    confirmCallback()
  }

  closeConfirm()
}
const ImageKit = require("imagekit")

const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC,
  privateKey: process.env.IMAGEKIT_PRIVATE,
  urlEndpoint: process.env.IMAGEKIT_URL
})

const JSON_FILE = "snippets.json"
const FOLDER = "/snippetra"

async function uploadToImageKit(buffer, fileName, folder = FOLDER) {
  try {
    const uploaded = await imagekit.upload({
      file: buffer,
      fileName,
      folder,
      useUniqueFileName: false,
      overwriteFile: true
    })

    return {
      status: true,
      url: uploaded.url,
      fileId: uploaded.fileId
    }
  } catch (e) {
    return {
      status: false,
      error: e.message
    }
  }
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type")

  // penting biar Vercel/browser gak cache response API
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate")
  res.setHeader("Pragma", "no-cache")
  res.setHeader("Expires", "0")

  if (req.method === "OPTIONS") {
    return res.status(200).end()
  }

  if (req.method === "GET") {
    try {
      const url = `${process.env.IMAGEKIT_URL}/snippetra/snippets.json?t=${Date.now()}`

      const response = await fetch(url, {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache"
        }
      })

      if (!response.ok) {
        return res.status(200).json([])
      }

      const text = await response.text()

      if (!text.trim()) {
        return res.status(200).json([])
      }

      const data = JSON.parse(text)

      if (!Array.isArray(data)) {
        return res.status(200).json([])
      }

      return res.status(200).json(data)
    } catch (e) {
      return res.status(500).json({
        status: false,
        message: e.message
      })
    }
  }

  if (req.method === "POST") {
    try {
      const snippets = req.body

      if (!Array.isArray(snippets)) {
        return res.status(400).json({
          status: false,
          message: "Body harus berupa array snippets"
        })
      }

      const jsonBuffer = Buffer.from(
        JSON.stringify(snippets, null, 2),
        "utf8"
      )

      const upload = await uploadToImageKit(
        jsonBuffer,
        JSON_FILE
      )

      if (!upload.status) {
        return res.status(500).json({
          status: false,
          message: upload.error
        })
      }

      return res.status(200).json({
        status: true,
        success: true,
        message: "Snippet saved",
        total: snippets.length,
        url: `${upload.url}?t=${Date.now()}`
      })
    } catch (e) {
      return res.status(500).json({
        status: false,
        message: e.message
      })
    }
  }

  return res.status(405).json({
    status: false,
    message: "Method not allowed"
  })
}
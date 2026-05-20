const ImageKit = require("imagekit")

const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC,
  privateKey: process.env.IMAGEKIT_PRIVATE,
  urlEndpoint: process.env.IMAGEKIT_URL
})

const JSON_FILE = "snippets.json"

async function uploadToImageKit(buffer, fileName, folder = "/snippetra") {
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
      url: uploaded.url
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

  if (req.method === "OPTIONS") {
    return res.status(200).end()
  }

  if (req.method === "GET") {
    try {
      const files = await imagekit.listFiles({
        path: "/snippetra"
      })

      const file = files.find(v => v.name === JSON_FILE)

      if (!file) {
        return res.status(200).json([])
      }

      const data = await fetch(file.url)
        .then(r => r.json())

      return res.status(200).json(data)

    } catch (e) {
      return res.status(500).json({
        error: e.message
      })
    }
  }

  if (req.method === "POST") {
    try {
      const snippets = req.body

      const upload = await uploadToImageKit(
        Buffer.from(
          JSON.stringify(snippets, null, 2)
        ),
        JSON_FILE
      )

      if (!upload.status) {
        return res.status(500).json({
          error: upload.error
        })
      }

      return res.status(200).json({
        success: true,
        url: upload.url
      })

    } catch (e) {
      return res.status(500).json({
        error: e.message
      })
    }
  }

  return res.status(405).json({
    error: "Method not allowed"
  })
}
const express = require("express");
const ytSearch = require("yt-search");

const app = express();
const PORT = process.env.PORT || 3000;

// Configurar Express
app.use(express.static("public"));
app.set("view engine", "ejs");

// Página principal
app.get("/", (req, res) => {
  res.render("index");
});

// API de búsqueda
app.get("/search", async (req, res) => {
  try {
    const query = req.query.q;
    if (!query) return res.status(400).json({ error: "Falta la consulta" });

    const result = await ytSearch(query);
    const songs = result.videos.slice(0, 10).map(video => ({
      title: video.title,
      url: video.url
    }));

    res.json(songs);
  } catch (err) {
    console.error("Error en /search:", err);
    res.status(500).json({ error: "Error al buscar canciones" });
  }
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
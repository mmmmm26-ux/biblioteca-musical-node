const express = require('express');
const bodyParser = require('body-parser');
const yts = require('yt-search');
const path = require('path');

const app = express();
const port = process.env.PORT || 8080;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.render('index', { canciones: [] });
});

app.post('/', async (req, res) => {
  const query = req.body.query;
  const r = await yts(query);
  const results = r.videos.slice(0, 5).map(video => ({
    title: video.title,
    channel: video.author.name,
    id: video.videoId
  }));
  res.render('index', { canciones: results });
});

app.listen(port, () => {
  console.log(`Servidor funcionando en http://localhost:${port}`);
});

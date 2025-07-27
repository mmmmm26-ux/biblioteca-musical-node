let results = [];
let currentIndex = 0;
let currentQuery = "";
const resultsContainer = document.getElementById("results");

document.getElementById("searchForm").addEventListener("submit", async function (e) {
  e.preventDefault();
  currentQuery = document.getElementById("searchQuery").value;
  currentIndex = 0;
  results = await fetchResults(currentQuery);
  resultsContainer.innerHTML = "";
  playCurrent();
});

async function fetchResults(query) {
  const response = await fetch(`/search?q=${encodeURIComponent(query)}`);
  const data = await response.json();
  return data;
}

function playCurrent() {
  if (currentIndex >= results.length) {
    loadMore();
    return;
  }

  const video = results[currentIndex];
  const videoDiv = document.createElement("div");

  videoDiv.innerHTML = `
    <h3>${video.title}</h3>
    <audio id="audioPlayer" controls autoplay>
      <source src="${video.url}" type="audio/mpeg">
      Tu navegador no soporta audio.
    </audio>
  `;

  resultsContainer.innerHTML = "";
  resultsContainer.appendChild(videoDiv);

  const player = document.getElementById("audioPlayer");
  player.addEventListener("ended", () => {
    currentIndex++;
    playCurrent();
  });
}

async function loadMore() {
  const more = await fetchResults(currentQuery);
  if (more.length === 0) return;
  results = results.concat(more);
  playCurrent();
}
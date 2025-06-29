document.addEventListener("DOMContentLoaded", () => {
  const createBtn = document.getElementById("crearPlaylistBtn");
  const inputNombre = document.getElementById("nuevaPlaylist");
  const selectPlaylist = document.getElementById("listaPlaylists");
  const resultados = document.getElementById("resultados");

  const getPlaylists = () => {
    const stored = localStorage.getItem("playlists");
    return stored ? JSON.parse(stored) : {};
  };

  const setPlaylists = (playlists) => {
    localStorage.setItem("playlists", JSON.stringify(playlists));
  };

  const actualizarSelector = () => {
    const playlists = getPlaylists();
    selectPlaylist.innerHTML = <option>-- Selecciona una playlist --</option>;
    Object.keys(playlists).forEach((name) => {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      selectPlaylist.appendChild(opt);
    });
  };

  createBtn.addEventListener("click", () => {
    const nombre = inputNombre.value.trim();
    if (!nombre) return alert("Escribe un nombre de playlist");
    const playlists = getPlaylists();
    if (playlists[nombre]) return alert("Ya existe esa playlist");
    playlists[nombre] = [];
    setPlaylists(playlists);
    inputNombre.value = "";
    actualizarSelector();
  });

  selectPlaylist.addEventListener("change", () => {
    const nombre = selectPlaylist.value;
    const playlists = getPlaylists();
    const lista = playlists[nombre] || [];
    resultados.innerHTML = <h3>${nombre}</h3>;
    if (lista.length === 0) {
      resultados.innerHTML += "<p>Sin canciones.</p>";
    } else {
      const ul = document.createElement("ul");
      lista.forEach((cancion) => {
        const li = document.createElement("li");
        li.innerHTML = `<b>${cancion.title}</b> - ${cancion.channel}
          <br><audio controls src="https://www.youtube.com/watch?v=${cancion.id}"></audio>`;
        ul.appendChild(li);
      });
      resultados.appendChild(ul);
    }
  });

  // Agregar botón para guardar a playlist desde resultados
  resultados.addEventListener("click", (e) => {
    if (e.target.classList.contains("add-to-playlist")) {
      const id = e.target.dataset.id;
      const title = e.target.dataset.title;
      const channel = e.target.dataset.channel;
      const nombre = selectPlaylist.value;
      if (!nombre || nombre === "-- Selecciona una playlist --")
        return alert("Selecciona una playlist");
      const playlists = getPlaylists();
      playlists[nombre].push({ title, channel, id });
      setPlaylists(playlists);
      alert("Agregada a playlist");
    }
  });

  actualizarSelector();
});

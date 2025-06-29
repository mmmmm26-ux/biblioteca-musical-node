document.addEventListener("DOMContentLoaded", () => {
  const favList = document.getElementById("favoritos");
  const playlistSelect = document.getElementById("playlist-select");
  const playlistInput = document.getElementById("playlist-nombre");
  const crearPlaylistBtn = document.getElementById("crear-playlist");

  let favoritos = JSON.parse(localStorage.getItem("favoritos")) || [];
  let playlists = JSON.parse(localStorage.getItem("playlists")) || {};

  const results = document.querySelectorAll("#resultados li");

  // Cargar playlists al dropdown
  function actualizarPlaylists() {
    playlistSelect.innerHTML = '<option value="">-- Selecciona una playlist --</option>';
    Object.keys(playlists).forEach(nombre => {
      const option = document.createElement("option");
      option.value = nombre;
      option.textContent = nombre;
      playlistSelect.appendChild(option);
    });

    // También rellenar los dropdowns en cada canción
    document.querySelectorAll(".playlist-dropdown").forEach(dropdown => {
      dropdown.innerHTML = '<option value="">➕ Agregar a playlist</option>';
      Object.keys(playlists).forEach(nombre => {
        const opt = document.createElement("option");
        opt.value = nombre;
        opt.textContent = nombre;
        dropdown.appendChild(opt);
      });
    });
  }

  actualizarPlaylists();

  // Crear nueva playlist
  crearPlaylistBtn.addEventListener("click", () => {
    const nombre = playlistInput.value.trim();
    if (!nombre || playlists[nombre]) return;
    playlists[nombre] = [];
    localStorage.setItem("playlists", JSON.stringify(playlists));
    playlistInput.value = "";
    actualizarPlaylists();
  });

  // Agregar favoritos
  resultados.querySelectorAll(".fav-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const li = btn.closest("li");
      const id = li.getAttribute("data-id");
      if (!favoritos.includes(id)) {
        favoritos.push(id);
        localStorage.setItem("favoritos", JSON.stringify(favoritos));
        mostrarFavorito(id);
      }
    });
  });

  // Agregar a playlist
  resultados.forEach(li => {
    const dropdown = li.querySelector(".playlist-dropdown");
    dropdown.addEventListener("change", () => {
      const id = li.getAttribute("data-id");
      const nombre = dropdown.value;
      if (nombre && !playlists[nombre].includes(id)) {
        playlists[nombre].push(id);
        localStorage.setItem("playlists", JSON.stringify(playlists));
        alert("Agregado a playlist: " + nombre);
      }
    });
  });

  // Mostrar favoritos al cargar
  favoritos.forEach(id => mostrarFavorito(id));

  function mostrarFavorito(id) {
    const iframe = document.createElement("iframe");
    iframe.src = https://www.youtube.com/embed/${id};
    iframe.width = 250;
    iframe.height = 140;
    iframe.setAttribute("allowfullscreen", true);
    iframe.style.border = "none";

    const li = document.createElement("li");
    li.appendChild(iframe);
    favList.appendChild(li);
  }
});

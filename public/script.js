document.addEventListener('DOMContentLoaded', () => {
  const btnCrear = document.getElementById('crear-playlist');
  const inputNombre = document.getElementById('playlist-nombre');
  const select = document.getElementById('playlist-select');
  const btnsAgregar = document.querySelectorAll('.add-to-playlist');

  const playlists = JSON.parse(localStorage.getItem('playlists') || '{}');
  for (const nombre in playlists) {
    const option = document.createElement('option');
    option.value = nombre;
    option.textContent = nombre;
    select.appendChild(option);
  }

  btnCrear.addEventListener('click', () => {
    const nombre = inputNombre.value.trim();
    if (!nombre) return alert('Escribe un nombre');
    if (playlists[nombre]) return alert('Ya existe');
    playlists[nombre] = [];
    localStorage.setItem('playlists', JSON.stringify(playlists));
    const option = document.createElement('option');
    option.value = nombre;
    option.textContent = nombre;
    select.appendChild(option);
    inputNombre.value = '';
  });

  btnsAgregar.forEach(btn => {
    btn.addEventListener('click', () => {
      const li = btn.closest('li');
      const id = li.dataset.id;
      const title = li.querySelector('strong').textContent;
      const playlistName = select.value;
      if (!playlistName) return alert('Selecciona una playlist');
      playlists[playlistName].push({ id, title });
      localStorage.setItem('playlists', JSON.stringify(playlists));
      alert('Agregada a ' + playlistName);
    });
  });
});

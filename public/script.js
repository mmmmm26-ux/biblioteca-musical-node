document.addEventListener("DOMContentLoaded", () => {
  const favList = document.getElementById("favoritos");
  const favButtons = document.querySelectorAll(".fav-btn");

  let favoritos = JSON.parse(localStorage.getItem("favoritos")) || [];

  // Mostrar favoritos al cargar
  favoritos.forEach(id => mostrarFavorito(id));

  favButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const item = btn.closest("li");
      const id = item.getAttribute("data-id");

      if (!favoritos.includes(id)) {
        favoritos.push(id);
        localStorage.setItem("favoritos", JSON.stringify(favoritos));
        mostrarFavorito(id);
      }
    });
  });

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

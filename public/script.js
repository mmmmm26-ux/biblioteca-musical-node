let players = [];
let currentIndex = 0;

function onYouTubeIframeAPIReady() {
    const iframes = document.querySelectorAll('.video-player');

    iframes.forEach((iframe, index) => {
        players[index] = new YT.Player(iframe, {
            events: {
                'onStateChange': (event) => {
                    if (event.data === YT.PlayerState.ENDED && index === currentIndex) {
                        playNext(index + 1);
                    }
                }
            }
        });
    });
}

function playNext(index) {
    if (index < players.length) {
        currentIndex = index;
        players[index].playVideo();
    }
}

// Cargar la API de YouTube al cargar la página
let tag = document.createElement('script');
tag.src = "https://www.youtube.com/iframe_api";
document.body.appendChild(tag);

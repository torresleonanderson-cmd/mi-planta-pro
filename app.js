// ==========================================
// 1. ELEMENTOS DE LA UI
// ==========================================
const videoElement = document.getElementById('videoElement');
const audioElement = document.getElementById('audioElement'); 
const txtEstado = document.getElementById('txtEstado');
const modal = document.getElementById('modalExito');

// Controles de la Planta (Rack)
const canvas = document.getElementById('vumetro');
const ctxVumetro = canvas ? canvas.getContext('2d') : null;
const controlVolumen = document.getElementById('controlVolumen');
const valVolumen = document.getElementById('valVolumen');
const controlBajos = document.getElementById('controlBajos');
const controlMedios = document.getElementById('controlMedios');
const controlBrillos = document.getElementById('controlBrillos');

// Nuevos Controles del Televisor (Los que no te funcionaban)
const btnPlayPause = document.getElementById('btnPlayPause');
const btnRetroceder = document.getElementById('btnRetroceder');
const btnAdelantar = document.getElementById('btnAdelantar');
const btnTvFullscreen = document.getElementById('btnTvFullscreen');
const progressBar = document.getElementById('progressBar');
const progressContainer = document.getElementById('progressContainer');
const timeDisplay = document.getElementById('timeDisplay');

// Variables de Audio Pro
let audioCtx, sourceVideo, sourceAudio, nodoVolumen, filtroBajos, filtroMedios, filtroBrillos, analizador;

// ==========================================
// 2. LÓGICA DE REPRODUCCIÓN (AL CARGAR)
// ==========================================
window.addEventListener('DOMContentLoaded', () => {
    let ruta = localStorage.getItem('reproducirRuta');
    let tipo = localStorage.getItem('reproducirTipo');
    let nombre = localStorage.getItem('reproducirNombre');

    if (ruta && tipo) {
        localStorage.removeItem('reproducirRuta'); // Limpiar para evitar loops

        if (tipo === 'audio') {
            videoElement.style.display = 'none';
            audioElement.style.display = 'block';
            audioElement.src = ruta;
            prepararMedia(audioElement, nombre);
        } else {
            audioElement.style.display = 'none';
            videoElement.style.display = 'block';
            videoElement.src = ruta;
            prepararMedia(videoElement, nombre);
        }
    }
});

function prepararMedia(elemento, nombre) {
    elemento.play().then(() => {
        conectarProcesador(elemento);
        lanzarExito(nombre);
        btnPlayPause.innerText = "⏸";
    }).catch(() => {
        txtEstado.innerHTML = "⚠️ SISTEMA EN PAUSA - HAZ CLIC EN PLAY PARA INICIAR";
        btnPlayPause.innerText = "▶";
        // Esperar clic para activar AudioContext por seguridad del navegador
        document.body.addEventListener('click', () => {
            elemento.play();
            conectarProcesador(elemento);
            lanzarExito(nombre);
            btnPlayPause.innerText = "⏸";
        }, { once: true });
    });
}

// ==========================================
// 3. FUNCIONALIDAD DE LOS BOTONES DEL TV
// ==========================================

// Función para saber cuál está sonando ahora
function getActiveMedia() {
    return videoElement.style.display !== 'none' ? videoElement : audioElement;
}

// BOTÓN PLAY / PAUSA
btnPlayPause.onclick = () => {
    const media = getActiveMedia();
    if (media.paused) {
        media.play();
        btnPlayPause.innerText = "⏸";
    } else {
        media.pause();
        btnPlayPause.innerText = "▶";
    }
};

// BOTONES ADELANTAR / RETROCEDER (10 segundos)
btnRetroceder.onclick = () => { getActiveMedia().currentTime -= 10; };
btnAdelantar.onclick = () => { getActiveMedia().currentTime += 10; };

// BOTÓN PANTALLA COMPLETA (Del contenedor para ver los controles)
btnTvFullscreen.onclick = () => {
    const container = document.getElementById('contenedorPrincipal');
    if (container.requestFullscreen) container.requestFullscreen();
    else if (container.webkitRequestFullscreen) container.webkitRequestFullscreen();
};

// CLICK EN LA BARRA DE PROGRESO PARA BUSCAR
progressContainer.onclick = (e) => {
    const media = getActiveMedia();
    const rect = progressContainer.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    media.currentTime = pos * media.duration;
};

// ACTUALIZAR BARRA Y TIEMPO (Se ejecuta mientras avanza el video/audio)
function actualizarUI() {
    const media = getActiveMedia();
    if (!media.duration) return;

    // Mover la barra
    const porcentaje = (media.currentTime / media.duration) * 100;
    progressBar.style.width = porcentaje + "%";

    // Cambiar el texto del tiempo (00:00)
    const m = Math.floor(media.currentTime / 60);
    const s = Math.floor(media.currentTime % 60);
    const dm = Math.floor(media.duration / 60);
    const ds = Math.floor(media.duration % 60);
    timeDisplay.innerText = `${m}:${s < 10 ? '0'+s : s} / ${dm}:${ds < 10 ? '0'+ds : ds}`;
}

videoElement.ontimeupdate = actualizarUI;
audioElement.ontimeupdate = actualizarUI;

// ==========================================
// 4. PROCESADOR DE AUDIO (VÚMETRO Y EQ)
// ==========================================
function conectarProcesador(elemento) {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        analizador = audioCtx.createAnalyser();
        analizador.fftSize = 256;
        nodoVolumen = audioCtx.createGain();

        // Filtros EQ
        filtroBajos = audioCtx.createBiquadFilter(); filtroBajos.type = 'lowshelf'; filtroBajos.frequency.value = 200;
        filtroMedios = audioCtx.createBiquadFilter(); filtroMedios.type = 'peaking'; filtroMedios.frequency.value = 1000;
        filtroBrillos = audioCtx.createBiquadFilter(); filtroBrillos.type = 'highshelf'; filtroBrillos.frequency.value = 3000;

        filtroBajos.connect(filtroMedios); filtroMedios.connect(filtroBrillos);
        filtroBrillos.connect(nodoVolumen); nodoVolumen.connect(analizador);
        analizador.connect(audioCtx.destination);
        iniciarVumetro();
    }
    
    // Conectar la fuente de audio si no existe
    if (elemento === videoElement && !sourceVideo) {
        sourceVideo = audioCtx.createMediaElementSource(videoElement);
        sourceVideo.connect(filtroBajos);
    } else if (elemento === audioElement && !sourceAudio) {
        sourceAudio = audioCtx.createMediaElementSource(audioElement);
        sourceAudio.connect(filtroBajos);
    }
}

// Función del Vúmetro
function iniciarVumetro() {
    if (!ctxVumetro) return;
    const bufferLength = analizador.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    function dibujar() {
        requestAnimationFrame(dibujar);
        analizador.getByteFrequencyData(dataArray);
        ctxVumetro.clearRect(0, 0, canvas.width, canvas.height);
        let barWidth = (canvas.width / bufferLength) * 2.5;
        let x = 0;
        for (let i = 0; i < bufferLength; i++) {
            let barHeight = dataArray[i] / 2;
            ctxVumetro.fillStyle = `rgb(0, ${barHeight + 100}, 255)`;
            ctxVumetro.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
            x += barWidth + 1;
        }
    }
    dibujar();
}

// ==========================================
// 5. EVENTOS DE LOS CONTROLES DEL RACK (PERILLAS)
// ==========================================
controlVolumen.oninput = (e) => {
    if (nodoVolumen) nodoVolumen.gain.value = e.target.value;
    document.getElementById('valVolumen').innerText = Math.round(e.target.value * 100) + "%";
};

controlBajos.oninput = (e) => {
    if (filtroBajos) filtroBajos.gain.value = e.target.value;
    document.getElementById('valBajos').innerText = e.target.value + "dB";
};

document.getElementById('btnStop').onclick = () => {
    const m = getActiveMedia();
    m.pause(); m.currentTime = 0;
    btnPlayPause.innerText = "▶";
    txtEstado.innerText = "■ SISTEMA DETENIDO";
};

// ==========================================
// 6. MODAL Y EXITO
// ==========================================
function lanzarExito(nombre) {
    document.getElementById('modalMsg').innerText = "Reproduciendo: " + nombre;
    modal.classList.add('active');
    txtEstado.innerHTML = `🔊 ONLINE: ${nombre}`;
    setTimeout(cerrarModal, 3000);
}


// --- LÓGICA TÁCTIL PARA MÓVILES ---
const tvPantalla = document.getElementById('contenedorPrincipal');
const controlesOverlay = document.getElementById('controlesOverlay');

// Al tocar la pantalla del TV, mostramos/ocultamos los controles
tvPantalla.addEventListener('click', (e) => {
    // Si el clic no fue en un botón, alternamos la visibilidad
    if (e.target.tagName !== 'BUTTON') {
        controlesOverlay.classList.toggle('show-mobile');
    }
});

// Ocultar controles automáticamente después de 4 segundos si se están mostrando
setInterval(() => {
    if (controlesOverlay.classList.contains('show-mobile')) {
        const media = getActiveMedia();
        if (!media.paused) { // Solo si está reproduciendo
            controlesOverlay.classList.remove('show-mobile');
        }
    }
}, 4000);

function cerrarModal() {
    modal.classList.remove('active');
}

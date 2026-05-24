// --- ESTADO GLOBAL ---
let audioCtx, sourceVideo, sourceAudio, nodoVolumen, filtroBajos, filtroMedios, filtroBrillos, analizador;

// --- ELEMENTOS ---
const videoElement = document.getElementById('videoElement');
const audioElement = document.getElementById('audioElement');
const txtEstado = document.getElementById('txtEstado');
const modal = document.getElementById('modalExito');

// --- INICIO AL CARGAR ---
window.addEventListener('DOMContentLoaded', () => {
    const ruta = localStorage.getItem('reproducirRuta');
    const tipo = localStorage.getItem('reproducirTipo');
    const nombre = localStorage.getItem('reproducirNombre');

    if (ruta && tipo) {
        localStorage.removeItem('reproducirRuta'); // Evitar loops
        prepararReproduccion(ruta, tipo, nombre);
    }
});

function prepararReproduccion(ruta, tipo, nombre) {
    if (tipo === 'audio') {
        videoElement.style.display = 'none';
        audioElement.style.display = 'block';
        audioElement.src = ruta;
        manejarPlay(audioElement, nombre);
    } else {
        audioElement.pause();
        videoElement.style.display = 'block';
        videoElement.src = ruta;
        manejarPlay(videoElement, nombre);
    }
}

function manejarPlay(elemento, nombre) {
    elemento.play()
        .then(() => {
            conectarProcesador(elemento);
            lanzarExito(nombre);
        })
        .catch(() => {
            txtEstado.innerHTML = "⚠️ SISTEMA BLOQUEADO - HAZ CLIC PARA ACTIVAR";
            document.body.addEventListener('click', () => {
                elemento.play();
                conectarProcesador(elemento);
                lanzarExito(nombre);
            }, { once: true });
        });
}

function conectarProcesador(elemento) {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        
        analizador = audioCtx.createAnalyser();
        analizador.fftSize = 256;

        nodoVolumen = audioCtx.createGain();
        
        filtroBajos = audioCtx.createBiquadFilter();
        filtroBajos.type = 'lowshelf'; filtroBajos.frequency.value = 200;

        filtroMedios = audioCtx.createBiquadFilter();
        filtroMedios.type = 'peaking'; filtroMedios.frequency.value = 1000;

        filtroBrillos = audioCtx.createBiquadFilter();
        filtroBrillos.type = 'highshelf'; filtroBrillos.frequency.value = 3000;

        // Cadena: Source -> EQ -> Volumen -> Analizador -> Salida
        filtroBajos.connect(filtroMedios);
        filtroMedios.connect(filtroBrillos);
        filtroBrillos.connect(nodoVolumen);
        nodoVolumen.connect(analizador);
        analizador.connect(audioCtx.destination);
        
        iniciarVumetro();
    }

    // Conexión dinámica
    const source = audioCtx.createMediaElementSource(elemento);
    source.connect(filtroBajos);
}

// --- VÚMETRO ---
function iniciarVumetro() {
    const canvas = document.getElementById('vumetro');
    const ctx = canvas.getContext('2d');
    const bufferLength = analizador.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    function dibujar() {
        requestAnimationFrame(dibujar);
        analizador.getByteFrequencyData(dataArray);
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const barWidth = (canvas.width / bufferLength) * 2.5;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
            const barHeight = dataArray[i] / 2;
            const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
            grad.addColorStop(0, '#ff0055'); // Rojo arriba
            grad.addColorStop(0.5, '#00f2ff'); // Cyan medio
            grad.addColorStop(1, '#00ff88'); // Verde abajo
            
            ctx.fillStyle = grad;
            ctx.fillRect(x, canvas.height - barHeight, barWidth - 1, barHeight);
            x += barWidth;
        }
    }
    dibujar();
}

// --- MODAL Y UI ---
function lanzarExito(nombre) {
    document.getElementById('modalMsg').innerText = nombre;
    modal.classList.add('active');
    txtEstado.innerHTML = `🔊 PROCESANDO: ${nombre}`;
    setTimeout(cerrarModal, 2500);
}

function cerrarModal() {
    modal.classList.remove('active');
}

// --- CONTROLES EQ ---
document.getElementById('controlVolumen').oninput = (e) => {
    const v = e.target.value;
    document.getElementById('valVolumen').innerText = Math.round(v * 100) + "%";
    if (nodoVolumen) nodoVolumen.gain.value = v;
};

document.getElementById('controlBajos').oninput = (e) => {
    document.getElementById('valBajos').innerText = e.target.value + "dB";
    if (filtroBajos) filtroBajos.gain.value = e.target.value;
};
// Repetir similar para Medios y Brillos...

// --- NUEVOS ELEMENTOS ---
const btnStop = document.getElementById('btnStop');
const btnFullscreen = document.getElementById('btnFullscreen');
const tvExterior = document.querySelector('.tv-exterior'); // Usamos el contenedor para que se vea con marco

// --- LÓGICA PARA PARAR (STOP) ---
btnStop.onclick = () => {
    // Paramos ambos elementos
    audioElement.pause();
    videoElement.pause();
    
    // Reiniciamos el tiempo a cero
    audioElement.currentTime = 0;
    videoElement.currentTime = 0;
    
    // Actualizamos el texto de estado
    txtEstado.innerHTML = "■ REPRODUCCIÓN DETENIDA - SISTEMA EN ESPERA";
    
    // Opcional: Ocultar el video si quieres que la pantalla quede negra
    videoElement.style.display = 'none';
};

// --- LÓGICA PARA PANTALLA COMPLETA ---
btnFullscreen.onclick = () => {
    // Si hay un video cargado, lo ponemos en grande
    if (videoElement.src) {
        if (videoElement.requestFullscreen) {
            videoElement.requestFullscreen();
        } else if (videoElement.webkitRequestFullscreen) { /* Safari */
            videoElement.webkitRequestFullscreen();
        } else if (videoElement.msRequestFullscreen) { /* IE11 */
            videoElement.msRequestFullscreen();
        }
    } else {
        alert("Primero selecciona un video en la biblioteca.");
    }
};

// --- REPASO AL BOTÓN MUTE (Por si no lo tenías configurado) ---
const btnMute = document.getElementById('btnMute');
btnMute.onclick = () => {
    audioElement.muted = !audioElement.muted;
    videoElement.muted = !videoElement.muted;
    btnMute.classList.toggle('btn-danger');
    btnMute.innerText = audioElement.muted ? "UNMUTE" : "MUTE";
};

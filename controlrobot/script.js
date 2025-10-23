const WEBHOOK_URL_NODE = "http://192.168.2.150/comando";
const WEBHOOK_URL_N8N = "http://192.168.2.150:5678/webhook/4b68e260-2817-4c8f-b3eb-e332e32ddfed";

const videoElement = document.getElementById('video');
const ojoIzq = document.getElementById('ojo-izq');
const ojoDer = document.getElementById('ojo-der');
const boca = document.getElementById('boca');
const bocaContenedor = document.getElementById('bocaContenedor');
const cejaIzq = document.getElementById('ceja-izq');
const cejaDer = document.getElementById('ceja-der');
const estadoVoz = document.getElementById('estadoVoz');
const estadoMovimiento = document.getElementById('estadoMovimiento');
const cara = document.getElementById('cara');

let reconocimientoActivo = false;
let modoPregunta = false;
let hablando = false;
let suavizadoOjoX = 0, suavizadoOjoY = 0;
let parpadeoIntervalo = null;

// --- Control de envío de movimiento ---
let movimientoPendiente = null;
let debounceTimer = null;
function enviarMovimientoDebounced(direccion) {
  movimientoPendiente = direccion;
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    enviarMovimiento(movimientoPendiente);
    movimientoPendiente = null;
  }, 800);
}

async function enviarMovimiento(direccion) {
  const data = { movimiento: direccion, timestamp: Date.now() };
  estadoMovimiento.textContent = `➡️ Movimiento detectado: ${direccion.toUpperCase()}`;
  try {
    await fetch(WEBHOOK_URL_NODE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
  } catch (e) {
    console.warn("Error enviando al webhook:", e);
    estadoMovimiento.textContent = `⚠️ Error al enviar a Node-RED (${direccion})`;
  }
}

async function enviarComandoNodeRed(comando) {
  try {
    const response = await fetch(WEBHOOK_URL_NODE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comando: comando, timestamp: Date.now() })
    });

    if (!response.ok) {
      console.warn("Error al enviar comando a Node-RED:", response.statusText);
    } else {
      console.log("Comando enviado a Node-RED:", comando);
    }
  } catch (error) {
    console.error("Error en la conexión con Node-RED:", error);
  }
}


// --- Configuración de FaceMesh ---
const faceMesh = new FaceMesh({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
});
faceMesh.setOptions({
  maxNumFaces: 1,
  refineLandmarks: true,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5
});

// --- Animaciones aleatorias cuando está en reposo ---
function parpadearAmbos() {
  ojoIzq.classList.add('cerrado');
  ojoDer.classList.add('cerrado');
  setTimeout(() => {
    ojoIzq.classList.remove('cerrado');
    ojoDer.classList.remove('cerrado');
  }, 200);
}
function parpadearOjo(ojo) {
  ojo.classList.add('cerrado');
  setTimeout(() => ojo.classList.remove('cerrado'), 200);
}

const expresionesAleatorias = ['neutral', 'feliz', 'sorprendido'];

function mostrarCaraAleatoria() {
  if (reconocimientoActivo) return;

  const expresion = expresionesAleatorias[Math.floor(Math.random() * expresionesAleatorias.length)];
  boca.className = 'boca ' + expresion;

  const bocaEscalaX = 0.8 + Math.random() * 0.4;
  const bocaEscalaY = 0.8 + Math.random() * 0.4;
  boca.style.transform = `scaleX(${bocaEscalaX}) scaleY(${bocaEscalaY})`;

  const ojoEscalaIzq = 0.8 + Math.random() * 0.4;
  const ojoEscalaDer = 0.8 + Math.random() * 0.4;
  const eyeOffsetX = (Math.random() - 0.5) * 10;
  const eyeOffsetY = (Math.random() - 0.5) * 10;
  ojoIzq.style.transform = `scale(${ojoEscalaIzq}) translate(${eyeOffsetX}px, ${eyeOffsetY}px)`;
  ojoDer.style.transform = `scale(${ojoEscalaDer}) translate(${eyeOffsetX}px, ${eyeOffsetY}px)`;

  const margenEncimaOjo = 25;
  let baseCejaY = -25;
  if (expresion === "feliz") baseCejaY -= 10;
  if (expresion === "sorprendido") baseCejaY -= 15;
  const cejaY = baseCejaY - margenEncimaOjo;

  const rotIzq = (Math.random() - 0.5) * 20;
  const rotDer = (Math.random() - 0.5) * 20;
  cejaIzq.style.transform = `translate(-50%, ${cejaY}px) rotate(${rotIzq}deg)`;
  cejaDer.style.transform = `translate(-50%, ${cejaY}px) rotate(${rotDer}deg)`;

  if (Math.random() < 0.5) parpadearAmbos();
}

function iniciarCarasAleatorias() {
  if (parpadeoIntervalo) clearInterval(parpadeoIntervalo);
  parpadeoIntervalo = setInterval(() => {
    mostrarCaraAleatoria();
  }, 2000 + Math.random() * 2000);
}
iniciarCarasAleatorias();

// --- Control de movimientos físicos ---
let ultimaDireccion = null;
let ultimoEnvio = 0;

function controlarMovimiento(direccion) {
  if (direccion !== ultimaDireccion) {
    enviarMovimiento(direccion);
    ultimaDireccion = direccion;
  }
}

// --- 💤 Reposo automático ---
let tiempoUltimaCara = Date.now();
const TIEMPO_SIN_CARA = 1000; // ms

setInterval(() => {
  const ahora = Date.now();
  if (ahora - tiempoUltimaCara > TIEMPO_SIN_CARA) {
    if (ultimaDireccion !== "stop") {
      enviarMovimiento("stop");
      ultimaDireccion = "stop";
    }
    cara.style.transition = "transform 0.6s ease";
    ojoIzq.style.transform = "translate(0, 0)";
    ojoDer.style.transform = "translate(0, 0)";
    bocaContenedor.style.transform = "translate(0, 0)";
    cejaIzq.style.transform = "translate(-50%, -25px) rotate(0deg)";
    cejaDer.style.transform = "translate(-50%, -25px) rotate(0deg)";
    setTimeout(() => (cara.style.transition = ""), 600);
  }
}, 200);

// --- Función unificada de animación de boca y cejas ---
function animarBocaYCejasDuranteHabla(getLimX, getLimY, onEndCallback) {
  hablando = true;
  boca.className = 'boca boca-feliz-leve';
  let abrir = false;

  const animInterval = setInterval(() => {
    abrir = !abrir;
    boca.style.transform = abrir ? 'scaleY(1.8) scaleX(1.2)' : 'scaleY(1) scaleX(1.2)';

    // --- Cejas siguen los ojos pero centradas ---
    const offsetCejaX = -70;   // corrección horizontal para centrar
    const offsetCejaY = -80; // separación vertical sobre los ojos
    const rotIzq = -10;      // rotación expresiva
    const rotDer = 10;

    const limX = getLimX();
    const limY = getLimY();

    cejaIzq.style.transform = `translate(${limX + offsetCejaX}px, ${limY + offsetCejaY}px) rotate(${rotIzq}deg)`;
    cejaDer.style.transform = `translate(${limX + offsetCejaX}px, ${limY + offsetCejaY}px) rotate(${rotDer}deg)`;
  }, 180);

  return () => {
    clearInterval(animInterval);
    boca.style.transform = 'scaleY(1) scaleX(1)';
    boca.className = 'boca';
    hablando = false;
    cejaIzq.style.transform = 'translate(-50%, -25px) rotate(0deg)';
    cejaDer.style.transform = 'translate(-50%, -25px) rotate(0deg)';
    if (onEndCallback) onEndCallback();
  };
}


// --- Procesamiento de FaceMesh ---
faceMesh.onResults((results) => {
  console.log("Detectando Cara");
  if (results.multiFaceLandmarks?.length) tiempoUltimaCara = Date.now();
  if (!reconocimientoActivo) return;

  const landmarks = results.multiFaceLandmarks[0];

  if (landmarks != undefined){
    const leftEye = landmarks[468];
    const rightEye = landmarks[473];
    const avgX = (leftEye.x + rightEye.x) / 2;
    const avgY = (leftEye.y + rightEye.y) / 2;

    const targetX = (0.5 - avgX) * 800;
    const targetY = (avgY - 0.5) * 800;
    suavizadoOjoX += (targetX - suavizadoOjoX) * 0.2;
    suavizadoOjoY += (targetY - suavizadoOjoY) * 0.2;

    const caraRect = cara.getBoundingClientRect();
    const maxX = caraRect.width * 0.133;
    const maxY = caraRect.height * 0.083;
    const limX = Math.max(-maxX, Math.min(maxX, suavizadoOjoX));
    const limY = Math.max(-maxY, Math.min(maxY, suavizadoOjoY));

    if (!reconocimientoActivo) return;

    const leftEAR = Math.abs(landmarks[159].y - landmarks[145].y);
    const rightEAR = Math.abs(landmarks[386].y - landmarks[374].y);
    const umbralParpadeo = 0.005;
    if (leftEAR < umbralParpadeo && !ojoDer.classList.contains('cerrado')) parpadearOjo(ojoDer);
    if (rightEAR < umbralParpadeo && !ojoIzq.classList.contains('cerrado')) parpadearOjo(ojoIzq);

    ojoIzq.style.transform = `translate(${limX}px, ${limY}px)`;
    ojoDer.style.transform = `translate(${limX}px, ${limY}px)`;
    bocaContenedor.style.transform = `translate(${limX * 0.5}px, ${limY * 0.5}px)`;

    const umbralX = caraRect.width * 0.1;
    const umbralY = caraRect.height * 0.08;
    let direccion = null;

    if (Math.abs(limX) > Math.abs(limY)) {
      if (limX > umbralX) direccion = "derecha";
      else if (limX < -umbralX) direccion = "izquierda";
    } else {
      if (limY > umbralY) direccion = "abajo";
      else if (limY < -umbralY) direccion = "arriba";
    }
    if (!direccion) direccion = "centro";
    controlarMovimiento(direccion);

    if (!hablando) {
      const eyeDistance = Math.abs(landmarks[263].x - landmarks[33].x);
      const mouthOpen = Math.abs(landmarks[14].y - landmarks[13].y) / eyeDistance;
      const mouthWidth = Math.abs(landmarks[291].x - landmarks[61].x) / eyeDistance;

      boca.className = "boca neutral";
      let expresion = "neutral";
      if (mouthOpen > 0.30) expresion = "sorprendido";
      else if (mouthWidth > 0.65 && mouthOpen < 0.25) expresion = "feliz";
      boca.classList.add(expresion);

      let cejaY = -25, rotIzq = 0, rotDer = 0;
      if (expresion === "feliz") cejaY -= 10;
      if (expresion === "sorprendido") cejaY -= 15;
      cejaIzq.style.transform = `translate(${limX - 75}px, ${limY + cejaY}px) rotate(${rotIzq}deg)`;
      cejaDer.style.transform = `translate(${limX - 50}px, ${limY + cejaY}px) rotate(${rotDer}deg)`;
    }
  }
});

// --- Cámara ---
const camera = new Camera(videoElement, {
  onFrame: async () => { await faceMesh.send({ image: videoElement }); },
  width: 640,
  height: 480
});
camera.start();

// --- Funciones de voz ---
function hablar(texto) {
  if ('speechSynthesis' in window) {
    const utterance = new SpeechSynthesisUtterance(texto);
    utterance.lang = 'es-ES';
    utterance.rate = 1;
    utterance.pitch = 1;

    let stopAnim = null;
    utterance.onstart = () => {
      stopAnim = animarBocaYCejasDuranteHabla(
        () => suavizadoOjoX,
        () => suavizadoOjoY
      );
    };

    utterance.onend = () => {
      if (stopAnim) stopAnim();
    };

    window.speechSynthesis.speak(utterance);
  } else console.warn("Tu navegador no soporta SpeechSynthesis");
}

async function hablarMientrasSuena(audio) {
  const stopAnim = animarBocaYCejasDuranteHabla(
    () => suavizadoOjoX,
    () => suavizadoOjoY
  );

  audio.onended = () => {
    stopAnim();
  };
}

// --- 🟢 Color verde para modo pregunta ---
function activarColorVerde() {
  cara.classList.add("modo-pregunta");
}

function restaurarColorNormal() {
  cara.classList.remove("modo-pregunta");
}


// --- Reconocimiento de voz ---
if ('webkitSpeechRecognition' in window) {
  const recognition = new webkitSpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = false;
  recognition.lang = 'es-ES';

  recognition.onresult = (event) => {
  console.log("Detecta Audio");  
  let texto = event.results[event.results.length - 1][0].transcript.toLowerCase().trim();
  console.log("🗣️ Palabra detectada:", texto);

  //Funcionalidad de activación/desactivación tradicional
  if ((texto.includes('activar')|| texto.includes('actívate')|| texto.includes('activate')) && !reconocimientoActivo) {
    reconocimientoActivo = true;
    estadoVoz.textContent = '🤖 Activado';
    estadoMovimiento.textContent = '📡 Esperando movimiento...';
    cara.classList.add('activar');
    hablar("Modo activado, me llamo Che Robot y estoy listo para lo que necesites");
  } else if ((texto.includes('desactivar') || texto.includes('adios')) && reconocimientoActivo) {
    reconocimientoActivo = false;
    estadoVoz.textContent = '🛑 Desactivado (diga \"activar\" para reactivar)';
    estadoMovimiento.textContent = '⏸️ Movimientos pausados';
    cara.classList.remove('activa');
    restaurarColorNormal(); // 🟢 NUEVO: apaga el color verde si estaba activo

  } else if (reconocimientoActivo && !modoPregunta) {
     // Primero revisa si la pregunta coincide con alguna respuesta predefinida
    console.log("Analizando Pregunta");
    let respuestaAutomatica = procesarPreguntaAvanzada(texto);
    console.log(respuestaAutomatica);
      if (!respuestaAutomatica && (texto.includes('pregunta') || texto.includes('pregunto'))) {
        modoPregunta = true
        console.log("Modo Pregunta");  
        activarColorVerde(); // 🟢 NUEVO: enciende el color verde visual de modo pregunta
      }  
    }
    else if (reconocimientoActivo && modoPregunta) {
      //Mandar a N8N
      enviarPreguntaPersonalizada(texto);
      modoPregunta = false;
      restaurarColorNormal(); // 🟢 NUEVO: vuelve al color normal al terminar la pregunta
    }

  texto = "";
};

// --- 🟢 ACTIVAR / DESACTIVAR ROBOT CON TECLA ---
// Escucha si se presiona una tecla en el teclado
document.addEventListener("keydown", function(event) {
  // Si se presiona la tecla R (puede ser mayúscula o minúscula)
  if (event.key.toLowerCase() === "enter") {
    if (!reconocimientoActivo) {
      // Activar robot
      reconocimientoActivo = true;
      estadoVoz.textContent = '🤖 Activado (por tecla enter)';
      estadoMovimiento.textContent = '📡 Esperando movimiento...';
      cara.classList.add('activa');
      hablar("Modo activado manualmente, listo para recibir comandos");
      console.log("🟢 Robot activado por tecla enter enter");
    } else {
      // Desactivar robot
      reconocimientoActivo = false;
      estadoVoz.textContent = '🛑 Desactivado (por tecla enter)';
      estadoMovimiento.textContent = '⏸️ Movimientos pausados';
      cara.classList.remove('activa');
      restaurarColorNormal(); // si tenés esta función
      console.log("🔴 Robot desactivado por tecla enter");
    }
  }
});


/*async function grabarYEnviarAudioConSensibilidad(umbral = 0.1, duracionMax = 5000) {
  estadoVoz.textContent = "🎙 Preparando grabación…";
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    source.connect(analyser);
    analyser.fftSize = 512;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const mediaRecorder = new MediaRecorder(stream);
    const chunks = [];

    mediaRecorder.ondataavailable = (e) => chunks.push(e.data);

    // Monitoreo de volumen para sensibilidad
    let grabando = false;
    const startTime = Date.now();

    const checkVolume = () => {
      analyser.getByteTimeDomainData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const val = (dataArray[i] - 128) / 128;
        sum += val * val;
      }
      const rms = Math.sqrt(sum / dataArray.length);

      if (rms > umbral && !grabando) {
        mediaRecorder.start();
        grabando = true;
        estadoVoz.textContent = "🎙 Grabando...";
        console.log("Grabación iniciada, RMS:", rms);
      }

      if (grabando && (rms < umbral || Date.now() - startTime > duracionMax)) {
        if (mediaRecorder.state === "recording") mediaRecorder.stop();
        grabando = false;
        console.log("Grabación detenida, RMS:", rms);
      }

      if (!grabando) requestAnimationFrame(checkVolume);
    };

    checkVolume();

    mediaRecorder.onstop = async () => {
      const audioBlob = new Blob(chunks, { type: 'audio/webm' });
      const formData = new FormData();
      formData.append('audio', audioBlob, 'grabacion.webm');

      estadoVoz.textContent = '✨ Enviando audio...';
      boca.className = 'boca feliz';

      try {
        const response = await fetch(WEBHOOK_URL_N8N, {
          method: 'POST',
          body: formData
        });

        if (!response.ok) throw new Error("Respuesta no válida del servidor");

        const audioBlobRespuesta = await response.blob();
        const audioURL = URL.createObjectURL(audioBlobRespuesta);
        const audio = new Audio(audioURL);
        audio.play();

        hablarMientrasSuena(audio);

        estadoVoz.textContent = '🔊 Reproduciendo respuesta...';
      } catch (error) {
        console.error('Error en la solicitud fetch:', error);
        estadoVoz.textContent = '❌ Error de conexión o respuesta';

      } finally {
        setTimeout(() => {
          estadoVoz.textContent = '🤖 Activado';
          boca.className = 'boca neutral';
        }, 5000);
      }
    };

  } catch (error) {
    console.error("Error al grabar:", error);
    estadoVoz.textContent = "⚠️ No se pudo grabar audio";
  }
}*/




  recognition.onerror = (e) => console.error('Error:', e);
  recognition.onend = () => recognition.start();
  recognition.start();
} else {
  estadoVoz.textContent = '🎤 Usando reconocimiento offline (Vosk.js)';
}


// --- 📝 Preguntas y respuestas avanzadas ---
const preguntasRespuestas = [
  {
    frases: ["cómo te llamas", "cuál es tu nombre", "quien eres", "dime tu nombre"],
    respuesta: "Me llamo Che Robot, ¡mucho gusto!"
  },
  {
    frases: ["qué año es", "en qué año estamos", "dime el año"],
    respuesta: "Estamos en el año 2025."
  },
  {
    frases: ["qué haces", "cuál es tu función", "para qué sirves", "a qué te dedicas"],
    respuesta: "Estoy aquí para ayudarte y acompañarte en lo que necesites."
  },
  {
    frases: ["hola", "buen día", "buenos días", "buenas tardes", "buenas noches", "hola robot"],
    respuesta: "¡Hola! ¿Cómo estás?"
  },
  {
    frases: ["adiós", "adios", "hasta luego", "nos vemos",  "hasta pronto"],
    respuesta: "Que tengas un buen día."
  },
  {
    frases: ["gracias", "muchas gracias", "te lo agradezco"],
    respuesta: "De nada, estoy para ayudarte en lo que necesites"
  },
  {
    frases: ["de que sos hincha", "boca o river"],
    respuesta: "Soy del club atletico boca juniors , TE FUISTE A LA B RIVER PLATE."
  },
  {
    frases: ["¿Qué es la mecatronica?","Definicion de mecatronica"],
    respuesta: "La mecatrónica es la disciplina que integra mecánica, electrónica e informática para diseñar y construir productos inteligentes y sistemas automatizados, como la robótica."
  },
];

function procesarPreguntaAvanzada(texto) {
  texto = texto.toLowerCase().trim();

  // --- Comandos a Node-RED ---
  if (texto.includes("saludar")) {
    hablar("¡Hola! Te saludo con mucho gusto.");
    enviarComandoNodeRed("saludar"); 
    return true;
  }

  if (texto.includes("detener")) {
    hablar("Deteniendo la acción.");
    enviarComandoNodeRed("detener"); 
    return true;
  }

  if (texto.includes("derecha")) {
    hablar("Girando a la derecha.");
    enviarComandoNodeRed("girar_derecha");
    return true;
  }

  if (texto.includes("izquierda")) {
    hablar("Girando a la izquierda.");
    enviarComandoNodeRed("girar_izquierda");
    return true;
  }

  // --- Respuestas predefinidas ---
  for (const item of preguntasRespuestas) {
    for (const frase of item.frases) {
      if (texto.includes(frase.toLowerCase())) {
        hablar(item.respuesta);
        return true; // encontró una respuesta
      }
    }
  }

  return false; // no coincidió con ninguna pregunta ni comando
}

async function enviarPreguntaPersonalizada(pregunta){

  const formData = new FormData();
  formData.append('text', pregunta);

  estadoVoz.textContent = '✨ Enviando audio...';
  boca.className = 'boca feliz';

  try {
      const response = await fetch(WEBHOOK_URL_N8N, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) throw new Error("Respuesta no válida del servidor");

      const audioBlobRespuesta = await response.blob();
      const audioURL = URL.createObjectURL(audioBlobRespuesta);
      const audio = new Audio(audioURL);
      audio.volume = 1.0;
      audio.play();

      hablarMientrasSuena(audio);

      estadoVoz.textContent = '🔊 Reproduciendo respuesta...';
    } catch (error) {
      console.error('Error en la solicitud fetch:', error);
      estadoVoz.textContent = '❌ Error de conexión o respuesta';

    } finally {
      setTimeout(() => {
        estadoVoz.textContent = '🤖 Activado';
        boca.className = 'boca neutral';
      }, 500);
    }
}


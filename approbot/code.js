// ✅ Crear conexión WebSocket con Node-RED (corregido: sin doble barra)
const socket = new WebSocket("ws://192.168.2.150:1880/ws/code");

// Evento: cuando se abre la conexión
socket.onopen = () => {
  console.log("Conectado al servidor WebSocket");
};

// Evento: cuando hay error
socket.onerror = (error) => {
  console.error("Error en WebSocket:", error);
};

// Evento: cuando Node-RED envía una respuesta
socket.onmessage = (event) => {
  console.log("Mensaje recibido desde Node-RED:", event.data);
};

// Función para enviar el comando
function enviarComando(comando) {
  if (socket.readyState === WebSocket.OPEN) {
       socket.send(JSON.stringify({comando}));
    console.log("Enviado comando:", comando);
  } else {
    console.error("El WebSocket no está conectado");
  }
}

// ✅ Función auxiliar para evitar errores si el elemento no existe
function asignarEvento(id, comando) {
  const boton = document.getElementById(id);
  if (boton) {
    boton.addEventListener("pointerdown", () => enviarComando(comando));
  } else {
    console.warn(`⚠️ Botón no encontrado: ${id}`);
  }
}

// --- Asignación de eventos ---

asignarEvento("up", "adelante");
asignarEvento("down", "atras");
asignarEvento("left", "izquierda");
asignarEvento("right", "derecha");

asignarEvento("lev_brazo_izq", "levantar brazo izquierdo");
asignarEvento("baj_brazo_izq", "bajar brazo izquierdo");
asignarEvento("lev_brazo_der", "levantar brazo derecho");
asignarEvento("baj_brazo_der", "bajar brazo derecho");

asignarEvento("levantar_cabeza", "levantar cabeza");
asignarEvento("bajar_cabeza", "bajar cabeza");
asignarEvento("girar_cabeza_izq", "girar cabeza izq");
asignarEvento("girar_cabeza_der", "girar cabeza der");

asignarEvento("flex_codo_izq", "flex codo izq");
asignarEvento("flex_codo_der", "flex codo der");
asignarEvento("ext_codo_izq", "ext codo izq");
asignarEvento("ext_codo_der", "ext codo der");

asignarEvento("abrir_pinzas_izq", "abrir pinzas izq");
asignarEvento("cerrar_pinzas_izq", "cerrar pinzas izq");
asignarEvento("abrir_pinzas_der", "abrir pinzas der");
asignarEvento("cerrar_pinzas_der", "cerrar pinzas der");

asignarEvento("saludar", "saludar");
asignarEvento("si", "asentir");
asignarEvento("no", "no");
asignarEvento("pensar", "pensar");
asignarEvento("saludo_formal", "apreton de pinzas");
asignarEvento("festejar", "festejar");
asignarEvento("maso", "mas o menos");
asignarEvento("macarena", "macarena");
asignarEvento("selfie", "selfie");
asignarEvento("dab", "dab");
asignarEvento("robot", "bailar");
asignarEvento("stop", "frenar");
asignarEvento("asterisco", "asterisco");

// --- Nuevos botones ---
asignarEvento("mate", "servir_mate");
asignarEvento("boxeo", "boxeo");
asignarEvento("home", "home");
asignarEvento("vacio4", "vacio");
asignarEvento("vacio5", "vacio");
asignarEvento("vacio6", "vacio");

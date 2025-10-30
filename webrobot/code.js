// Crear conexión WebSocket con Node-RED
const socket = new WebSocket("ws://192.168.2.150:1880//ws/code");

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
    // 🔹 Enviar estructura { comando: "..." } dentro de msg.payload
    socket.send(JSON.stringify({ comando }));
    console.log("Enviado comando:", comando);
  } else {
    console.error("El WebSocket no está conectado");
  }
}

// Asignar eventos a cada botón
document.getElementById("up").addEventListener("pointerdown", () => enviarComando("adelante"));
document.getElementById("down").addEventListener("pointerdown", () => enviarComando("atras"));
document.getElementById("left").addEventListener("pointerdown", () => enviarComando("izquierda"));
document.getElementById("right").addEventListener("pointerdown", () => enviarComando("derecha"));

document.getElementById("lev_brazo_izq").addEventListener("pointerdown", () => enviarComando("levantar brazo izquierdo"));
document.getElementById("baj_brazo_izq").addEventListener("pointerdown", () => enviarComando("bajar brazo izquierdo"));
document.getElementById("lev_brazo_der").addEventListener("pointerdown", () => enviarComando("levantar brazo derecho"));
document.getElementById("baj_brazo_der").addEventListener("pointerdown", () => enviarComando("bajar brazo derecho"));
document.getElementById("levantar_cabeza").addEventListener("pointerdown", () => enviarComando("levantar cabeza"));
document.getElementById("bajar_cabeza").addEventListener("pointerdown", () => enviarComando("bajar cabeza"));
document.getElementById("girar_cabeza_izq").addEventListener("pointerdown", () => enviarComando("girar cabeza izq"));
document.getElementById("girar_cabeza_der").addEventListener("pointerdown", () => enviarComando("girar cabeza der"));

document.getElementById("flex_codo_izq").addEventListener("pointerdown", () => enviarComando("flex codo izq"));
document.getElementById("flex_codo_der").addEventListener("pointerdown", () => enviarComando("flex codo der"));
document.getElementById("ext_codo_izq").addEventListener("pointerdown", () => enviarComando("ext codo izq"));
document.getElementById("ext_codo_der").addEventListener("pointerdown", () => enviarComando("ext codo der"));
document.getElementById("abrir_pinzas_izq").addEventListener("pointerdown", () => enviarComando("abrir pinzas izq"));
document.getElementById("cerrar_pinzas_izq").addEventListener("pointerdown", () => enviarComando("cerrar pinzas izq"));
document.getElementById("abrir_pinzas_der").addEventListener("pointerdown", () => enviarComando("abrir pinzas der"));
document.getElementById("cerrar_pinzas_der").addEventListener("pointerdown", () => enviarComando("cerrar pinzas der"));

document.getElementById("saludar").addEventListener("pointerdown", () => enviarComando("saludar"));
document.getElementById("si").addEventListener("pointerdown", () => enviarComando("asentir"));
document.getElementById("no").addEventListener("pointerdown", () => enviarComando("no"));
document.getElementById("pensar").addEventListener("pointerdown", () => enviarComando("pensar"));
document.getElementById("saludo_formal").addEventListener("pointerdown", () => enviarComando("apreton de pinzas"));
document.getElementById("bailar").addEventListener("pointerdown", () => enviarComando("bailar"));
document.getElementById("maso").addEventListener("pointerdown", () => enviarComando("mas o menos"));
document.getElementById("macarena").addEventListener("pointerdown", () => enviarComando("macarena"));
document.getElementById("selfie").addEventListener("pointerdown", () => enviarComando("selfie"));
document.getElementById("egipcio").addEventListener("pointerdown", () => enviarComando("egipcio"));
document.getElementById("robot").addEventListener("pointerdown", () => enviarComando("robot"));
document.getElementById("stop").addEventListener("pointerdown", () => enviarComando("frenar"));

// --- NUEVOS BOTONES VACÍOS ---
document.getElementById("mate").addEventListener("pointerdown", () => enviarComando("mate"));
document.getElementById("boxeo").addEventListener("pointerdown", () => enviarComando("boxeo"));
document.getElementById("home").addEventListener("pointerdown", () => enviarComando("home"));
document.getElementById("vacio4").addEventListener("pointerdown", () => enviarComando("vacio"));
document.getElementById("vacio5").addEventListener("pointerdown", () => enviarComando("vacio"));
document.getElementById("vacio6").addEventListener("pointerdown", () => enviarComando("vacio"));


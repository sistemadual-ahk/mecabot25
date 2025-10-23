// Crear conexión WebSocket con Node-RED
// Por defecto Node-RED expone ws://localhost:1880/ws/<path>
const socket = new WebSocket("ws://127.0.0.1:1880/ws/code");

// Evento: cuando se abre la conexión
socket.onopen = () => {
  console.log("Conectado al servidor WebSocket");
};

// Evento: cuando hay error
socket.onerror = (error) => {
  console.error("Error en WebSocket:", error);
};

// Función para enviar el comando
function enviarComando(comando) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(comando);
    console.log("Enviado:", comando);
  } else {
    console.error("El WebSocket no está conectado");
  }
}
// Asignar eventos a cada flecha
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
document.getElementById("bailar").addEventListener("pointerdown", () => enviarComando("bailar"));
document.getElementById("aplaudir").addEventListener("pointerdown", () => enviarComando("aplaudir"));
document.getElementById("culturista").addEventListener("pointerdown", () => enviarComando("culturista"));
document.getElementById("si").addEventListener("pointerdown", () => enviarComando("si"));
document.getElementById("no").addEventListener("pointerdown", () => enviarComando("no"));
document.getElementById("stop").addEventListener("pointerdown", () => enviarComando("frenar"));
// --- NUEVOS BOTONES VACÍOS ---
document.getElementById("mate").addEventListener("pointerdown", () => enviarComando("mate"));
document.getElementById("vacio2").addEventListener("pointerdown", () => enviarComando("vacio"));
document.getElementById("vacio3").addEventListener("pointerdown", () => enviarComando("vacio"));
document.getElementById("vacio4").addEventListener("pointerdown", () => enviarComando("vacio"));
document.getElementById("vacio5").addEventListener("pointerdown", () => enviarComando("vacio"));
document.getElementById("vacio6").addEventListener("pointerdown", () => enviarComando("vacio"));



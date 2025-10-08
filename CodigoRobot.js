// Crear conexión WebSocket con Node-RED
// Por defecto Node-RED expone ws://localhost:1880/ws/<path>
const socket = new WebSocket("ws://192.168.0.25:1880/ws/movimiento");

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
document.getElementById("up").addEventListener("touchstart", () => enviarComando("adelante"));
document.getElementById("down").addEventListener("touchstart", () => enviarComando("atras"));
document.getElementById("left").addEventListener("touchstart", () => enviarComando("izquierda"));
document.getElementById("right").addEventListener("touchstart", () => enviarComando("derecha"));



document.getElementById("up").addEventListener("touchend", () => enviarComando("frenar"));
document.getElementById("down").addEventListener("touchend", () => enviarComando("frenar"));
document.getElementById("left").addEventListener("touchend", () => enviarComando("frenar"));
document.getElementById("right").addEventListener("touchend", () => enviarComando("frenar"));
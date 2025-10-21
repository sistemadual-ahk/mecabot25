// Crear conexión WebSocket con Node-RED
// Por defecto Node-RED expone ws://localhost:1880/ws/<path>
const socket = new WebSocket("ws://192.168.2.150:1880/code");

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

document.getElementById("up").addEventListener("pointerup", () => enviarComando("frenar"));
document.getElementById("down").addEventListener("pointerup", () => enviarComando("frenar"));
document.getElementById("left").addEventListener("pointerup", () => enviarComando("frenar"));
document.getElementById("right").addEventListener("pointerup", () => enviarComando("frenar"));

document.getElementById("saludar").addEventListener("pointerdown", () => enviarComando("saludar"));
document.getElementById("bailar").addEventListener("pointerdown", () => enviarComando("bailar"));
document.getElementById("aplaudir").addEventListener("pointerdown", () => enviarComando("aplaudir"));
document.getElementById("culturista").addEventListener("pointerdown", () => enviarComando("culturista"));
document.getElementById("si").addEventListener("pointerdown", () => enviarComando("si"));
document.getElementById("no").addEventListener("pointerdown", () => enviarComando("no"));
// --- NUEVOS BOTONES VACÍOS ---
document.getElementById("mate").addEventListener("pointerdown", () => enviarComando("mate"));
document.getElementById("vacio2").addEventListener("pointerdown", () => enviarComando("vacio"));
document.getElementById("vacio3").addEventListener("pointerdown", () => enviarComando("vacio"));
document.getElementById("vacio4").addEventListener("pointerdown", () => enviarComando("vacio"));
document.getElementById("vacio5").addEventListener("pointerdown", () => enviarComando("vacio"));

document.getElementById("vacio6").addEventListener("pointerdown", () => enviarComando("vacio"));




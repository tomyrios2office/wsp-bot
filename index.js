const WhatsAppServer = require("./server");

// Crear instancia del servidor
const server = new WhatsAppServer();

// Manejo de señales para cierre graceful
process.on("SIGINT", () => server.stop());
process.on("SIGTERM", () => server.stop());

// Iniciar servidor
server.start().catch((error) => {
  console.error("Error iniciando servidor:", error);
  process.exit(1);
});

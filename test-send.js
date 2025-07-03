const axios = require("axios");

async function testSendMessage() {
  try {
    console.log("Enviando solicitud al servidor...");

    const response = await axios.post("http://localhost:3000/send-message", {
      to: "5491134083140",
      message: "¡Hola! Este es un mensaje enviado desde la API.",
    });

    console.log("Respuesta del servidor:", response.data);
  } catch (error) {
    console.error("Error al enviar mensaje:");
    if (error.response) {
      // El servidor respondió con un código de error
      console.error("Respuesta del servidor:", {
        status: error.response.status,
        data: error.response.data,
      });
    } else if (error.request) {
      // La solicitud se hizo pero no se recibió respuesta
      console.error("No se recibió respuesta del servidor");
      console.error("Detalles de la solicitud:", error.request);
    } else {
      // Error al configurar la solicitud
      console.error("Error al configurar la solicitud:", error.message);
    }
  }
}

testSendMessage();

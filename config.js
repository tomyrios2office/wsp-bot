require("dotenv").config();

/**
 * Configuración centralizada del sistema
 */
const config = {
  // Configuración del servidor
  server: {
    port: process.env.PORT || 3000,
    host: process.env.HOST || "0.0.0.0",
  },

  // Configuración de WhatsApp
  whatsapp: {
    session: {
      dataPath: process.env.WHATSAPP_SESSION_PATH || "./sessions",
      clientId: process.env.WHATSAPP_CLIENT_ID || "bot-client",
    },
  },

  // Configuración de N8N
  n8n: {
    webhookUrl:
      process.env.N8N_WEBHOOK_URL || "http://localhost:5678/webhook/whatsapp",
    timeout: parseInt(process.env.N8N_TIMEOUT) || 10000,
    retryAttempts: parseInt(process.env.N8N_RETRY_ATTEMPTS) || 3,
    retryDelay: parseInt(process.env.N8N_RETRY_DELAY) || 5000,
  },

  // Configuración de reconexión
  reconnection: {
    maxAttempts: parseInt(process.env.RECONNECTION_MAX_ATTEMPTS) || 5,
    interval: parseInt(process.env.RECONNECTION_INTERVAL) || 30000,
  },

  // Configuración de seguridad
  security: {
    rateLimit: {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutos
      maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    },
    messageMaxLength: parseInt(process.env.MESSAGE_MAX_LENGTH) || 4096,
  },

  // Mensajes del sistema
  messages: {
    invalidNumber:
      "Número de teléfono inválido. Debe ser un número argentino válido.",
    messageTooLong: "El mensaje es demasiado largo. Máximo 4096 caracteres.",
    botNotConnected: "El bot no está conectado. Por favor, intenta más tarde.",
    webhookError:
      "Error enviando mensaje a N8N. Revisa la configuración del webhook.",
  },

  // Configuración de validación de números
  phoneValidation: {
    defaultCountry: "AR",
    allowedCountries: ["AR"],
  },
};

module.exports = config;

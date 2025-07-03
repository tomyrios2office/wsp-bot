require("dotenv").config();

/**
 * Configuración centralizada del sistema de bot de WhatsApp
 */
const config = {
  // Configuración del Webhook N8N
  n8n: {
    webhookUrl:
      process.env.N8N_WEBHOOK_URL ||
      "https://primary-production-87c85.up.railway.app/webhook-test/1a8d1893-2662-4e43-af10-14f2d2fffa2d",
    timeout: parseInt(process.env.WEBHOOK_TIMEOUT) || 10000,
    retryAttempts: parseInt(process.env.WEBHOOK_RETRY_ATTEMPTS) || 3,
  },

  // Configuración del Servidor
  server: {
    port: parseInt(process.env.PORT) || 3000,
    environment: process.env.NODE_ENV || "development",
  },

  // Configuración de Logs
  logging: {
    level: process.env.LOG_LEVEL || "info",
  },

  // Configuración de WhatsApp Web
  whatsapp: {
    puppeteer: {
      headless: process.env.PUPPETEER_HEADLESS === "true",
      args: (
        process.env.PUPPETEER_ARGS ||
        "--no-sandbox,--disable-setuid-sandbox,--disable-dev-shm-usage,--disable-accelerated-2d-canvas,--no-first-run,--no-zygote,--disable-gpu"
      ).split(","),
      timeout: 60000,
    },
    session: {
      dataPath: "./.wwebjs_auth",
      clientId: "whatsapp-bot-n8n",
    },
  },

  // Configuración de Seguridad
  security: {
    rateLimit: {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) || 60000,
      maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    },
    messageMaxLength: parseInt(process.env.MESSAGE_MAX_LENGTH) || 4096,
  },

  // Configuración de Reconexión
  reconnection: {
    interval: parseInt(process.env.RECONNECT_INTERVAL) || 5000,
    maxAttempts: parseInt(process.env.MAX_RECONNECT_ATTEMPTS) || 10,
  },

  // Configuración de Mensajes
  messages: {
    error: "Lo siento, ha ocurrido un error. Por favor, intenta de nuevo.",
    invalidNumber: "El número de teléfono proporcionado no es válido.",
    messageTooLong: "El mensaje es demasiado largo. Máximo 4096 caracteres.",
  },

  // Configuración de Validación
  validation: {
    phoneNumberPattern: /^(\+?54)?9?1[1-9]\d{6,9}$/,
  },
};

module.exports = config;

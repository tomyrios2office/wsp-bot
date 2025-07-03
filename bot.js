const { Client, LocalAuth } = require("whatsapp-web.js");
const axios = require("axios");
const config = require("./config");
const MessageFormatter = require("./utils/messageFormatter");
const PhoneValidator = require("./utils/phoneValidator");

// Importar qrcode-terminal de forma opcional
let qrcode;
try {
  qrcode = require("qrcode-terminal");
} catch (error) {
  console.log("qrcode-terminal no disponible, usando console.log para QR");
  qrcode = {
    generate: (qr) => console.log("QR Code generado:", qr),
  };
}

/**
 * Clase principal del Bot de WhatsApp
 */
class WhatsAppBot {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.messageQueue = [];
    this.isProcessingQueue = false;
    this.currentQR = null;
  }

  /**
   * Log simple sin Winston para reducir dependencias
   */
  log(level, message, data = {}) {
    const timestamp = new Date().toISOString();
    const logData = {
      timestamp,
      level,
      service: "whatsapp-bot",
      message,
      ...data,
    };

    if (level === "error") {
      console.error(JSON.stringify(logData));
    } else if (level === "warn") {
      console.warn(JSON.stringify(logData));
    } else {
      console.log(JSON.stringify(logData));
    }
  }

  /**
   * Inicializa el bot de WhatsApp
   */
  async initialize() {
    try {
      this.log("info", "Iniciando bot de WhatsApp...");

      // Configuración optimizada de Puppeteer para Railway
      const puppeteerConfig = {
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-accelerated-2d-canvas",
          "--no-first-run",
          "--no-zygote",
          "--single-process",
          "--disable-gpu",
          "--disable-background-timer-throttling",
          "--disable-backgrounding-occluded-windows",
          "--disable-renderer-backgrounding",
          "--disable-features=TranslateUI",
          "--disable-ipc-flooding-protection",
        ],
        timeout: 60000,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      };

      // Crear cliente de WhatsApp
      this.client = new Client({
        authStrategy: new LocalAuth({
          dataPath: config.whatsapp.session.dataPath,
          clientId: config.whatsapp.session.clientId,
        }),
        puppeteer: puppeteerConfig,
      });

      // Configurar eventos
      this.setupEvents();

      // Inicializar cliente
      await this.client.initialize();

      this.log("info", "Bot de WhatsApp inicializado correctamente");
    } catch (error) {
      this.log("error", "Error inicializando bot:", {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Configura los eventos del cliente de WhatsApp
   */
  setupEvents() {
    // Evento de QR Code
    this.client.on("qr", (qr) => {
      this.currentQR = qr;
      this.log("info", "QR Code generado. Escanea con WhatsApp:");
      qrcode.generate(qr, { small: true });
    });

    // Evento de autenticación exitosa
    this.client.on("ready", () => {
      this.isConnected = true;
      this.currentQR = null;
      this.reconnectAttempts = 0;
      this.log("info", "Bot de WhatsApp conectado y listo");
      this.processMessageQueue();
    });

    // Evento de autenticación
    this.client.on("authenticated", () => {
      this.log("info", "Autenticación exitosa");
    });

    // Evento de autenticación fallida
    this.client.on("auth_failure", (msg) => {
      this.log("error", "Error de autenticación:", { message: msg });
    });

    // Evento de mensaje recibido
    this.client.on("message", async (message) => {
      await this.handleIncomingMessage(message);
    });

    // Evento de desconexión
    this.client.on("disconnected", (reason) => {
      this.isConnected = false;
      this.log("warn", "Bot desconectado:", { reason });
      this.handleDisconnection();
    });

    // Evento de cambio de estado
    this.client.on("change_state", (state) => {
      this.log("info", "Estado del bot cambiado:", { state });
    });

    // Evento de carga de mensajes
    this.client.on("loading_screen", (percent, message) => {
      this.log("info", `Cargando: ${percent}% - ${message}`);
    });
  }

  /**
   * Maneja los mensajes entrantes
   */
  async handleIncomingMessage(message) {
    try {
      // Validar mensaje
      if (!MessageFormatter.isValidMessage(message)) {
        this.log("debug", "Mensaje ignorado (inválido o del propio bot)");
        return;
      }

      this.log("info", "Mensaje recibido:", {
        from: message.from,
        type: message.type,
        hasMedia: message.hasMedia,
        body: message.body
          ? message.body.substring(0, 100) + "..."
          : "Sin texto",
      });

      // Obtener información del contacto y chat
      const contact = await this.getContactInfo(message.from);
      const chat = await this.getChatInfo(message.from);

      // Formatear mensaje para N8N
      const formattedMessage = MessageFormatter.formatMessageForN8N(
        message,
        contact,
        chat
      );

      if (!formattedMessage) {
        this.log("error", "Error formateando mensaje para N8N");
        return;
      }

      // Enviar a webhook N8N
      await this.sendToN8N(formattedMessage);

      // Agregar a cola de procesamiento si es necesario
      this.addToMessageQueue(formattedMessage);
    } catch (error) {
      this.log("error", "Error procesando mensaje entrante:", {
        error: error.message,
        stack: error.stack,
      });
    }
  }

  /**
   * Obtiene información del contacto
   */
  async getContactInfo(contactId) {
    try {
      const contact = await this.client.getContactById(contactId);
      return {
        name: contact.pushname || contact.name || "Desconocido",
        number: PhoneValidator.fromWhatsAppFormat(contactId),
        isMyContact: contact.isMyContact || false,
      };
    } catch (error) {
      this.log("error", "Error obteniendo información del contacto:", {
        error: error.message,
      });
      return {
        name: "Desconocido",
        number: PhoneValidator.fromWhatsAppFormat(contactId),
        isMyContact: false,
      };
    }
  }

  /**
   * Obtiene información del chat
   */
  async getChatInfo(chatId) {
    try {
      const chat = await this.client.getChatById(chatId);
      return {
        name: chat.name || "Chat privado",
        isGroup: PhoneValidator.isGroup(chatId),
      };
    } catch (error) {
      this.log("error", "Error obteniendo información del chat:", {
        error: error.message,
      });
      return {
        name: "Chat privado",
        isGroup: PhoneValidator.isGroup(chatId),
      };
    }
  }

  /**
   * Envía mensaje a webhook N8N
   */
  async sendToN8N(messageData) {
    try {
      const response = await axios.post(config.n8n.webhookUrl, messageData, {
        timeout: config.n8n.timeout,
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "WhatsApp-Bot-N8N/1.0",
        },
      });

      this.log("info", "Mensaje enviado a N8N exitosamente:", {
        messageId: messageData.messageId,
        status: response.status,
      });

      return response.data;
    } catch (error) {
      this.log("error", "Error enviando mensaje a N8N:", {
        messageId: messageData.messageId,
        error: error.message,
        status: error.response?.status,
      });

      // Reintentar envío
      await this.retryWebhookSend(messageData);
    }
  }

  /**
   * Reintenta el envío del webhook
   */
  async retryWebhookSend(messageData, attempt = 1) {
    try {
      if (attempt > config.n8n.retryAttempts) {
        this.log("error", "Máximo de reintentos alcanzado para webhook");
        return;
      }

      this.log(
        "info",
        `Reintentando envío a N8N (intento ${attempt}/${config.n8n.retryAttempts})`
      );

      // Esperar antes de reintentar
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));

      const response = await axios.post(config.n8n.webhookUrl, messageData, {
        timeout: config.n8n.timeout,
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "WhatsApp-Bot-N8N/1.0",
        },
      });

      this.log("info", "Reenvío a N8N exitoso:", {
        messageId: messageData.messageId,
        attempt,
      });
    } catch (error) {
      this.log("error", `Error en reintento ${attempt}:`, error.message);
      await this.retryWebhookSend(messageData, attempt + 1);
    }
  }

  /**
   * Agrega mensaje a la cola de procesamiento
   */
  addToMessageQueue(message) {
    this.messageQueue.push({
      ...message,
      timestamp: Date.now(),
    });

    // Limpiar cola antigua (mantener solo últimos 100 mensajes)
    if (this.messageQueue.length > 100) {
      this.messageQueue = this.messageQueue.slice(-100);
    }
  }

  /**
   * Procesa la cola de mensajes
   */
  async processMessageQueue() {
    if (this.isProcessingQueue || this.messageQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    try {
      while (this.messageQueue.length > 0) {
        const message = this.messageQueue.shift();
        // Aquí se puede agregar lógica adicional de procesamiento
        this.log("debug", "Procesando mensaje de cola:", message.messageId);
      }
    } catch (error) {
      this.log("error", "Error procesando cola de mensajes:", error);
    } finally {
      this.isProcessingQueue = false;
    }
  }

  /**
   * Maneja la desconexión del bot
   */
  async handleDisconnection() {
    if (this.reconnectAttempts < config.reconnection.maxAttempts) {
      this.reconnectAttempts++;
      this.log(
        "info",
        `Intentando reconexión ${this.reconnectAttempts}/${config.reconnection.maxAttempts}`
      );

      setTimeout(async () => {
        try {
          await this.initialize();
        } catch (error) {
          this.log("error", "Error en reconexión:", error);
        }
      }, config.reconnection.interval);
    } else {
      this.log("error", "Máximo de intentos de reconexión alcanzado");
    }
  }

  /**
   * Envía un mensaje a un número específico
   */
  async sendMessage(to, text) {
    try {
      if (!this.isConnected) {
        throw new Error("Bot no está conectado");
      }

      // Validar número de teléfono
      if (!PhoneValidator.isValidPhoneNumber(to)) {
        throw new Error("Número de teléfono inválido");
      }

      // Formatear número para WhatsApp
      const whatsappNumber = PhoneValidator.toWhatsAppFormat(to);

      // Validar longitud del mensaje
      if (text.length > config.security.messageMaxLength) {
        throw new Error("Mensaje demasiado largo");
      }

      // Enviar mensaje
      const response = await this.client.sendMessage(whatsappNumber, text);

      this.log("info", "Mensaje enviado exitosamente:", {
        to: whatsappNumber,
        messageId: response.id._serialized,
      });

      return {
        success: true,
        messageId: response.id._serialized,
        timestamp: Date.now(),
      };
    } catch (error) {
      this.log("error", "Error enviando mensaje:", error);
      throw error;
    }
  }

  /**
   * Obtiene el estado del bot
   */
  getStatus() {
    return {
      isConnected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      messageQueueLength: this.messageQueue.length,
      timestamp: Date.now(),
    };
  }

  /**
   * Cierra el bot
   */
  async destroy() {
    try {
      this.log("info", "Cerrando bot de WhatsApp...");

      if (this.client) {
        await this.client.destroy();
      }

      this.isConnected = false;
      this.log("info", "Bot cerrado correctamente");
    } catch (error) {
      this.log("error", "Error cerrando bot:", error);
    }
  }

  getQRCode() {
    return this.currentQR;
  }

  async regenerateQR() {
    try {
      if (this.isConnected) {
        return null;
      }
      await this.client.destroy();
      await this.initialize();
      return this.currentQR;
    } catch (error) {
      this.log("error", "Error regenerando QR:", error);
      return null;
    }
  }
}

// Exportar la clase
module.exports = WhatsAppBot;

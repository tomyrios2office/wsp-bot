const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const axios = require("axios");
const winston = require("winston");
const config = require("./config");

/**
 * Clase principal del Bot de WhatsApp
 */
class WhatsAppBot {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.logger = this.setupLogger();
    this.currentQR = null;
  }

  /**
   * Configura el sistema de logging
   */
  setupLogger() {
    return winston.createLogger({
      level: config.logging.level,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: { service: "whatsapp-bot" },
      transports: [
        new winston.transports.File({ filename: "logs/combined.log" }),
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          ),
        }),
      ],
    });
  }

  /**
   * Inicializa el bot de WhatsApp
   */
  async initialize() {
    try {
      this.logger.info("Iniciando bot de WhatsApp...");

      this.client = new Client({
        authStrategy: new LocalAuth({
          dataPath: config.whatsapp.session.dataPath,
          clientId: config.whatsapp.session.clientId,
        }),
        puppeteer: {
          headless: config.whatsapp.puppeteer.headless,
          args: config.whatsapp.puppeteer.args,
          timeout: config.whatsapp.puppeteer.timeout,
        },
      });

      this.setupEvents();
      await this.client.initialize();
      this.logger.info("Bot de WhatsApp inicializado correctamente");
    } catch (error) {
      this.logger.error("Error inicializando bot:", error);
      throw error;
    }
  }

  /**
   * Configura los eventos del cliente de WhatsApp
   */
  setupEvents() {
    this.client.on("qr", (qr) => {
      this.currentQR = qr;
      this.logger.info("QR Code generado. Escanea con WhatsApp:");
      qrcode.generate(qr, { small: true });
    });

    this.client.on("ready", () => {
      this.isConnected = true;
      this.currentQR = null;
      this.reconnectAttempts = 0;
      this.logger.info("Bot de WhatsApp conectado y listo");
    });

    this.client.on("authenticated", () => {
      this.logger.info("Autenticación exitosa");
    });

    this.client.on("auth_failure", (msg) => {
      this.logger.error("Error de autenticación:", msg);
    });

    this.client.on("message", async (message) => {
      await this.handleIncomingMessage(message);
    });

    this.client.on("disconnected", (reason) => {
      this.isConnected = false;
      this.logger.warn("Bot desconectado:", reason);
      this.handleDisconnection();
    });
  }

  /**
   * Maneja los mensajes entrantes
   */
  async handleIncomingMessage(message) {
    try {
      if (!this.isValidMessage(message)) {
        return;
      }

      this.logger.info("Mensaje recibido:", {
        from: message.from,
        type: message.type,
        body: message.body?.substring(0, 100) || "Sin texto",
      });

      const contact = await this.getContactInfo(message.from);
      const chat = await this.getChatInfo(message.from);
      const formattedMessage = this.formatMessageForN8N(message, contact, chat);

      if (formattedMessage) {
        await this.sendToN8N(formattedMessage);
      }
    } catch (error) {
      this.logger.error("Error procesando mensaje entrante:", error);
    }
  }

  /**
   * Valida si un mensaje es válido para procesar
   */
  isValidMessage(message) {
    return (
      message &&
      message.from &&
      !message.fromMe &&
      (message.body || message.hasMedia) &&
      (!message.body || message.body.length <= config.security.messageMaxLength)
    );
  }

  /**
   * Obtiene información del contacto
   */
  async getContactInfo(contactId) {
    try {
      const contact = await this.client.getContactById(contactId);
      return {
        name: contact.pushname || contact.name || "Desconocido",
        number: this.extractPhoneNumber(contactId),
        isMyContact: contact.isMyContact || false,
      };
    } catch (error) {
      this.logger.error("Error obteniendo información del contacto:", error);
      return {
        name: "Desconocido",
        number: this.extractPhoneNumber(contactId),
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
        isGroup: chat.isGroup || false,
      };
    } catch (error) {
      this.logger.error("Error obteniendo información del chat:", error);
      return {
        name: "Chat privado",
        isGroup: false,
      };
    }
  }

  /**
   * Formatea un mensaje para enviar a N8N
   */
  formatMessageForN8N(message, contact, chat) {
    try {
      return {
        messageId: message.id._serialized,
        from: message.from,
        fromNumber: this.extractPhoneNumber(message.from),
        to: message.to,
        body: message.body || "",
        type: message.type,
        timestamp: Math.floor(message.timestamp * 1000),
        isGroupMsg: message.from.includes("@g.us"),
        contact: {
          name: contact?.name || "Desconocido",
          number: this.extractPhoneNumber(message.from),
          isMyContact: contact?.isMyContact || false,
        },
        chat: {
          name: chat?.name || "Chat privado",
          isGroup: chat?.isGroup || false,
        },
        metadata: {
          hasMedia: message.hasMedia,
          mediaType: message.type,
          quotedMessage: message.quotedMsg
            ? {
                id: message.quotedMsg.id._serialized,
                body: message.quotedMsg.body,
              }
            : null,
        },
        ...(message.hasMedia && {
          media: {
            mimetype: message.mimetype,
            filename: message.filename,
            size: message.size,
          },
        }),
      };
    } catch (error) {
      this.logger.error("Error formateando mensaje para N8N:", error);
      return null;
    }
  }

  /**
   * Extrae el número de teléfono de un ID de WhatsApp
   */
  extractPhoneNumber(whatsappId) {
    if (!whatsappId) return "";
    let number = whatsappId.replace("@c.us", "").replace("@g.us", "");
    if (!number.startsWith("54") && !number.startsWith("+54")) {
      number = "54" + number;
    }
    return number.replace("+", "");
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
        },
      });

      this.logger.info("Mensaje enviado a N8N exitosamente");
      return response.data;
    } catch (error) {
      this.logger.error("Error enviando mensaje a N8N:", error.message);
      await this.retryWebhookSend(messageData);
    }
  }

  /**
   * Reintenta el envío del webhook
   */
  async retryWebhookSend(messageData, attempt = 1) {
    if (attempt > config.n8n.retryAttempts) {
      this.logger.error("Máximo de reintentos alcanzado para webhook");
      return;
    }

    try {
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      const response = await axios.post(config.n8n.webhookUrl, messageData, {
        timeout: config.n8n.timeout,
        headers: { "Content-Type": "application/json" },
      });
      this.logger.info(`Reintento ${attempt} exitoso`);
      return response.data;
    } catch (error) {
      this.logger.warn(`Reintento ${attempt} fallido:`, error.message);
      await this.retryWebhookSend(messageData, attempt + 1);
    }
  }

  /**
   * Maneja la desconexión del bot
   */
  async handleDisconnection() {
    if (this.reconnectAttempts < config.reconnection.maxAttempts) {
      this.reconnectAttempts++;
      this.logger.info(
        `Intentando reconectar... (${this.reconnectAttempts}/${config.reconnection.maxAttempts})`
      );

      setTimeout(async () => {
        try {
          await this.initialize();
        } catch (error) {
          this.logger.error("Error en reconexión:", error);
        }
      }, config.reconnection.interval);
    } else {
      this.logger.error("Máximo de intentos de reconexión alcanzado");
    }
  }

  /**
   * Envía un mensaje de texto
   */
  async sendMessage(to, text) {
    try {
      if (!this.isConnected) {
        throw new Error("Bot no conectado");
      }

      const formattedNumber = this.formatPhoneNumberForWhatsApp(to);
      const chat = await this.client.getChatById(formattedNumber);
      const sentMessage = await chat.sendMessage(text);

      this.logger.info("Mensaje enviado exitosamente:", {
        to: formattedNumber,
        messageId: sentMessage.id._serialized,
      });

      return {
        success: true,
        messageId: sentMessage.id._serialized,
        timestamp: Date.now(),
        to: formattedNumber,
      };
    } catch (error) {
      this.logger.error("Error enviando mensaje:", error);
      throw error;
    }
  }

  /**
   * Formatea un número de teléfono para WhatsApp
   */
  formatPhoneNumberForWhatsApp(phoneNumber) {
    if (!phoneNumber) return "";
    let cleanNumber = phoneNumber.replace(/\D/g, "");
    if (!cleanNumber.startsWith("54")) {
      cleanNumber = "54" + cleanNumber;
    }
    return cleanNumber + "@c.us";
  }

  /**
   * Obtiene el estado del bot
   */
  getStatus() {
    return {
      isConnected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      hasQR: !!this.currentQR,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Destruye el bot
   */
  async destroy() {
    try {
      if (this.client) {
        await this.client.destroy();
      }
      this.logger.info("Bot destruido correctamente");
    } catch (error) {
      this.logger.error("Error destruyendo bot:", error);
    }
  }

  /**
   * Obtiene el QR code actual
   */
  getQRCode() {
    return this.currentQR;
  }

  /**
   * Regenera el QR code
   */
  async regenerateQR() {
    try {
      if (this.client) {
        await this.client.destroy();
        this.client = null;
        this.isConnected = false;
        this.currentQR = null;
        await this.initialize();
        return this.currentQR;
      }
    } catch (error) {
      this.logger.error("Error regenerando QR:", error);
      throw error;
    }
  }
}

module.exports = WhatsAppBot;

const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const winston = require("winston");
const config = require("./config");
const WhatsAppBot = require("./bot");
const qrcode = require("qrcode");

/**
 * Servidor Express con API REST para el bot de WhatsApp
 */
class WhatsAppServer {
  constructor() {
    this.app = express();
    this.logger = this.setupLogger();
    this.setupMiddleware();
    this.setupRoutes();
    this.bot = new WhatsAppBot();
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
      defaultMeta: { service: "whatsapp-api" },
      transports: [
        new winston.transports.File({ filename: "logs/api-combined.log" }),
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
   * Configura middleware de Express
   */
  setupMiddleware() {
    this.app.use(
      cors({
        origin: process.env.ALLOWED_ORIGINS
          ? process.env.ALLOWED_ORIGINS.split(",")
          : "*",
        methods: ["GET", "POST", "PUT", "DELETE"],
        allowedHeaders: ["Content-Type", "Authorization"],
      })
    );

    const limiter = rateLimit({
      windowMs: config.security.rateLimit.windowMs,
      max: config.security.rateLimit.maxRequests,
      message: {
        error: "Demasiadas solicitudes. Por favor, intenta de nuevo más tarde.",
        retryAfter: Math.ceil(config.security.rateLimit.windowMs / 1000),
      },
      standardHeaders: true,
      legacyHeaders: false,
    });
    this.app.use(limiter);

    this.app.use(express.json({ limit: "10mb" }));
    this.app.use(express.urlencoded({ extended: true, limit: "10mb" }));

    this.app.use((req, res, next) => {
      this.logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get("User-Agent"),
      });
      next();
    });
  }

  /**
   * Configura las rutas de la API
   */
  setupRoutes() {
    this.app.get("/health", (req, res) => {
      res.json({
        status: "ok",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      });
    });

    this.app.get("/status", (req, res) => {
      try {
        const status = this.bot.getStatus();
        res.json({ success: true, data: status });
      } catch (error) {
        this.logger.error("Error obteniendo estado del bot:", error);
        res.status(500).json({
          success: false,
          error: "Error interno del servidor",
        });
      }
    });

    this.app.post("/send-message", async (req, res) => {
      try {
        const { to, message } = req.body;

        if (!to || !message) {
          return res.status(400).json({
            success: false,
            error: 'Los parámetros "to" y "message" son requeridos',
          });
        }

        if (!this.isValidPhoneNumber(to)) {
          return res.status(400).json({
            success: false,
            error: config.messages.invalidNumber,
          });
        }

        if (message.length > config.security.messageMaxLength) {
          return res.status(400).json({
            success: false,
            error: config.messages.messageTooLong,
          });
        }

        const status = this.bot.getStatus();
        if (!status.isConnected) {
          return res.status(503).json({
            success: false,
            error: "El bot no está conectado. Por favor, intenta más tarde.",
          });
        }

        const result = await this.bot.sendMessage(to, message);
        res.json({ success: true, data: result });
      } catch (error) {
        this.logger.error("Error enviando mensaje:", error);
        res.status(500).json({
          success: false,
          error: error.message || "Error interno del servidor",
        });
      }
    });

    this.app.post("/send-response", async (req, res) => {
      try {
        const { to, message, replyTo } = req.body;

        if (!to || !message) {
          return res.status(400).json({
            success: false,
            error: 'Los parámetros "to" y "message" son requeridos',
          });
        }

        if (!this.isValidPhoneNumber(to)) {
          return res.status(400).json({
            success: false,
            error: config.messages.invalidNumber,
          });
        }

        const status = this.bot.getStatus();
        if (!status.isConnected) {
          return res.status(503).json({
            success: false,
            error: "El bot no está conectado. Por favor, intenta más tarde.",
          });
        }

        const result = await this.bot.sendMessage(to, message);
        res.json({ success: true, data: result });
      } catch (error) {
        this.logger.error("Error enviando respuesta:", error);
        res.status(500).json({
          success: false,
          error: error.message || "Error interno del servidor",
        });
      }
    });

    this.app.post("/send-bulk", async (req, res) => {
      try {
        const { numbers, message } = req.body;

        if (!numbers || !Array.isArray(numbers) || !message) {
          return res.status(400).json({
            success: false,
            error:
              'Los parámetros "numbers" (array) y "message" son requeridos',
          });
        }

        if (numbers.length > 50) {
          return res.status(400).json({
            success: false,
            error: "Máximo 50 números por envío masivo",
          });
        }

        const status = this.bot.getStatus();
        if (!status.isConnected) {
          return res.status(503).json({
            success: false,
            error: "El bot no está conectado. Por favor, intenta más tarde.",
          });
        }

        const results = [];
        const errors = [];

        for (const number of numbers) {
          try {
            if (this.isValidPhoneNumber(number)) {
              const result = await this.bot.sendMessage(number, message);
              results.push({ number, success: true, data: result });
            } else {
              errors.push({ number, success: false, error: "Número inválido" });
            }
          } catch (error) {
            errors.push({ number, success: false, error: error.message });
          }
        }

        res.json({
          success: true,
          data: {
            total: numbers.length,
            successful: results.length,
            failed: errors.length,
            results,
            errors,
          },
        });
      } catch (error) {
        this.logger.error("Error en envío masivo:", error);
        res.status(500).json({
          success: false,
          error: error.message || "Error interno del servidor",
        });
      }
    });

    this.app.get("/contacts", async (req, res) => {
      try {
        const status = this.bot.getStatus();
        if (!status.isConnected) {
          return res.status(503).json({
            success: false,
            error: "El bot no está conectado. Por favor, intenta más tarde.",
          });
        }

        const contacts = await this.bot.client.getContacts();
        const formattedContacts = contacts
          .filter((contact) => contact.isMyContact)
          .map((contact) => ({
            name: contact.pushname || contact.name || "Sin nombre",
            number: this.bot.extractPhoneNumber(contact.id._serialized),
            isMyContact: contact.isMyContact,
          }));

        res.json({
          success: true,
          data: {
            total: formattedContacts.length,
            contacts: formattedContacts,
          },
        });
      } catch (error) {
        this.logger.error("Error obteniendo contactos:", error);
        res.status(500).json({
          success: false,
          error: error.message || "Error interno del servidor",
        });
      }
    });

    this.app.get("/chats", async (req, res) => {
      try {
        const status = this.bot.getStatus();
        if (!status.isConnected) {
          return res.status(503).json({
            success: false,
            error: "El bot no está conectado. Por favor, intenta más tarde.",
          });
        }

        const chats = await this.bot.client.getChats();
        const formattedChats = chats.map((chat) => ({
          id: chat.id._serialized,
          name: chat.name || "Sin nombre",
          isGroup: chat.isGroup,
          unreadCount: chat.unreadCount,
          lastMessage: chat.lastMessage
            ? {
                body: chat.lastMessage.body,
                timestamp: chat.lastMessage.timestamp,
              }
            : null,
        }));

        res.json({
          success: true,
          data: {
            total: formattedChats.length,
            chats: formattedChats,
          },
        });
      } catch (error) {
        this.logger.error("Error obteniendo chats:", error);
        res.status(500).json({
          success: false,
          error: error.message || "Error interno del servidor",
        });
      }
    });

    this.app.get("/qr", async (req, res) => {
      try {
        const qrCode = this.bot.getQRCode();

        if (!qrCode) {
          return res.status(404).json({
            success: false,
            error: "No hay QR code disponible. El bot puede estar conectado.",
          });
        }

        const format = req.query.format || "text";

        if (format === "image") {
          const qrImage = await qrcode.toDataURL(qrCode);
          res.json({
            success: true,
            data: {
              qr: qrImage,
              format: "data-url",
            },
          });
        } else {
          res.json({
            success: true,
            data: {
              qr: qrCode,
              format: "text",
            },
          });
        }
      } catch (error) {
        this.logger.error("Error obteniendo QR:", error);
        res.status(500).json({
          success: false,
          error: error.message || "Error interno del servidor",
        });
      }
    });

    this.app.post("/qr/regenerate", async (req, res) => {
      try {
        const newQR = await this.bot.regenerateQR();

        if (!newQR) {
          return res.status(404).json({
            success: false,
            error: "No se pudo generar un nuevo QR code.",
          });
        }

        const format = req.query.format || "text";

        if (format === "image") {
          const qrImage = await qrcode.toDataURL(newQR);
          res.json({
            success: true,
            data: {
              qr: qrImage,
              format: "data-url",
            },
          });
        } else {
          res.json({
            success: true,
            data: {
              qr: newQR,
              format: "text",
            },
          });
        }
      } catch (error) {
        this.logger.error("Error regenerando QR:", error);
        res.status(500).json({
          success: false,
          error: error.message || "Error interno del servidor",
        });
      }
    });

    this.app.use("*", (req, res) => {
      res.status(404).json({
        success: false,
        error: "Endpoint no encontrado",
        availableEndpoints: [
          "GET /health",
          "GET /status",
          "POST /send-message",
          "POST /send-response",
          "POST /send-bulk",
          "GET /contacts",
          "GET /chats",
          "GET /qr",
          "POST /qr/regenerate",
        ],
      });
    });
  }

  /**
   * Valida si un número de teléfono es válido
   */
  isValidPhoneNumber(phoneNumber) {
    if (!phoneNumber || typeof phoneNumber !== "string") {
      return false;
    }
    const cleanNumber = phoneNumber.replace(/\D/g, "");
    return config.validation.phoneNumberPattern.test(cleanNumber);
  }

  /**
   * Inicia el servidor
   */
  async start() {
    try {
      await this.bot.initialize();

      this.server = this.app.listen(config.server.port, "0.0.0.0", () => {
        this.logger.info(
          `Servidor WhatsApp API iniciado en puerto ${config.server.port}`
        );
        this.logger.info(`Ambiente: ${config.server.environment}`);
        this.logger.info(`Webhook N8N: ${config.n8n.webhookUrl}`);
      });
    } catch (error) {
      this.logger.error("Error iniciando servidor:", error);
      process.exit(1);
    }
  }

  /**
   * Detiene el servidor
   */
  async stop() {
    try {
      if (this.server) {
        this.server.close();
      }
      await this.bot.destroy();
      this.logger.info("Servidor detenido correctamente");
    } catch (error) {
      this.logger.error("Error deteniendo servidor:", error);
    }
  }
}

module.exports = WhatsAppServer;

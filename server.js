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
        new winston.transports.File({
          filename: "logs/api-error.log",
          level: "error",
        }),
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
    // CORS
    this.app.use(
      cors({
        origin: process.env.ALLOWED_ORIGINS
          ? process.env.ALLOWED_ORIGINS.split(",")
          : "*",
        methods: ["GET", "POST", "PUT", "DELETE"],
        allowedHeaders: ["Content-Type", "Authorization"],
      })
    );

    // Rate limiting
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

    // Body parser
    this.app.use(express.json({ limit: "10mb" }));
    this.app.use(express.urlencoded({ extended: true, limit: "10mb" }));

    // Logging middleware
    this.app.use((req, res, next) => {
      this.logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get("User-Agent"),
        body: req.method === "POST" ? req.body : undefined,
      });
      next();
    });
  }

  /**
   * Configura las rutas de la API
   */
  setupRoutes() {
    // Health check
    this.app.get("/health", (req, res) => {
      res.json({
        status: "ok",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      });
    });

    // Estado del bot
    this.app.get("/status", (req, res) => {
      try {
        const status = this.bot.getStatus();
        res.json({
          success: true,
          data: status,
        });
      } catch (error) {
        this.logger.error("Error obteniendo estado del bot:", error);
        res.status(500).json({
          success: false,
          error: "Error interno del servidor",
        });
      }
    });

    // Enviar mensaje individual
    this.app.post("/send-message", async (req, res) => {
      try {
        const { to, message } = req.body;

        this.logger.info("Recibida solicitud de envío de mensaje:", {
          to,
          messageLength: message?.length,
        });

        // Validar parámetros
        if (!to || !message) {
          this.logger.warn("Parámetros faltantes en solicitud");
          return res.status(400).json({
            success: false,
            error: 'Los parámetros "to" y "message" son requeridos',
          });
        }

        // Validar número de teléfono
        if (!this.bot.isValidPhoneNumber(to)) {
          this.logger.warn("Número de teléfono inválido:", to);
          return res.status(400).json({
            success: false,
            error: config.messages.invalidNumber,
          });
        }

        // Validar longitud del mensaje
        if (message.length > config.security.messageMaxLength) {
          this.logger.warn("Mensaje demasiado largo");
          return res.status(400).json({
            success: false,
            error: config.messages.messageTooLong,
          });
        }

        // Verificar estado del bot
        const status = this.bot.getStatus();
        if (!status.isConnected) {
          this.logger.error("Bot no conectado al intentar enviar mensaje");
          return res.status(503).json({
            success: false,
            error: "El bot no está conectado. Por favor, intenta más tarde.",
          });
        }

        this.logger.info("Enviando mensaje a WhatsApp...");

        // Enviar mensaje
        const result = await this.bot.sendMessage(to, message);

        this.logger.info("Mensaje enviado exitosamente:", result);

        res.json({
          success: true,
          data: result,
        });
      } catch (error) {
        this.logger.error("Error enviando mensaje:", error);
        res.status(500).json({
          success: false,
          error: error.message || "Error interno del servidor",
        });
      }
    });

    // Responder a mensaje específico
    this.app.post("/send-response", async (req, res) => {
      try {
        const { to, message, replyTo } = req.body;

        // Validar parámetros
        if (!to || !message) {
          return res.status(400).json({
            success: false,
            error: 'Los parámetros "to" y "message" son requeridos',
          });
        }

        // Validar número de teléfono
        if (!this.bot.isValidPhoneNumber(to)) {
          return res.status(400).json({
            success: false,
            error: config.messages.invalidNumber,
          });
        }

        // Validar longitud del mensaje
        if (message.length > config.security.messageMaxLength) {
          return res.status(400).json({
            success: false,
            error: config.messages.messageTooLong,
          });
        }

        // Formatear número para WhatsApp
        const whatsappNumber = this.bot.toWhatsAppFormat(to);

        // Enviar respuesta
        let result;
        if (replyTo) {
          // Enviar como respuesta a un mensaje específico
          result = await this.bot.client.sendMessage(whatsappNumber, message, {
            quotedMessageId: replyTo,
          });
        } else {
          // Enviar mensaje normal
          result = await this.bot.sendMessage(to, message);
        }

        res.json({
          success: true,
          data: {
            messageId: result.messageId || result.id._serialized,
            timestamp: Date.now(),
          },
        });
      } catch (error) {
        this.logger.error("Error enviando respuesta:", error);
        res.status(500).json({
          success: false,
          error: error.message || "Error interno del servidor",
        });
      }
    });

    // Enviar mensajes masivos
    this.app.post("/send-bulk", async (req, res) => {
      try {
        const { numbers, message, delay = 1000 } = req.body;

        // Validar parámetros
        if (!numbers || !Array.isArray(numbers) || !message) {
          return res.status(400).json({
            success: false,
            error:
              'Los parámetros "numbers" (array) y "message" son requeridos',
          });
        }

        // Validar array de números
        const validation = this.bot.validatePhoneNumbers(numbers);
        if (!validation.valid) {
          return res.status(400).json({
            success: false,
            error: "Algunos números de teléfono son inválidos",
            data: validation,
          });
        }

        // Validar longitud del mensaje
        if (message.length > config.security.messageMaxLength) {
          return res.status(400).json({
            success: false,
            error: config.messages.messageTooLong,
          });
        }

        // Enviar mensajes con delay
        const results = [];
        const errors = [];

        for (let i = 0; i < validation.validNumbers.length; i++) {
          try {
            const number = validation.validNumbers[i].normalized;
            const result = await this.bot.sendMessage(number, message);
            results.push({
              number,
              success: true,
              messageId: result.messageId,
            });

            // Delay entre mensajes para evitar spam
            if (i < validation.validNumbers.length - 1) {
              await new Promise((resolve) => setTimeout(resolve, delay));
            }
          } catch (error) {
            errors.push({
              number: validation.validNumbers[i].normalized,
              error: error.message,
            });
          }
        }

        res.json({
          success: true,
          data: {
            total: validation.validNumbers.length,
            sent: results.length,
            errors: errors.length,
            results,
            errors,
          },
        });
      } catch (error) {
        this.logger.error("Error enviando mensajes masivos:", error);
        res.status(500).json({
          success: false,
          error: error.message || "Error interno del servidor",
        });
      }
    });

    // Obtener información de contacto
    this.app.get("/contact/:phoneNumber", async (req, res) => {
      try {
        const { phoneNumber } = req.params;

        // Validar número de teléfono
        if (!this.bot.isValidPhoneNumber(phoneNumber)) {
          return res.status(400).json({
            success: false,
            error: config.messages.invalidNumber,
          });
        }

        // Formatear número para WhatsApp
        const whatsappNumber = this.bot.toWhatsAppFormat(phoneNumber);

        // Obtener información del contacto
        const contact = await this.bot.getContactInfo(whatsappNumber);

        res.json({
          success: true,
          data: {
            phoneNumber: this.bot.normalizePhoneNumber(phoneNumber),
            whatsappId: whatsappNumber,
            contact,
          },
        });
      } catch (error) {
        this.logger.error("Error obteniendo información de contacto:", error);
        res.status(500).json({
          success: false,
          error: error.message || "Error interno del servidor",
        });
      }
    });

    // Listar chats activos
    this.app.get("/chats", async (req, res) => {
      try {
        const { limit = 50, type } = req.query;

        // Obtener chats
        const chats = await this.bot.client.getChats();

        // Filtrar por tipo si se especifica
        let filteredChats = chats;
        if (type === "group") {
          filteredChats = chats.filter((chat) =>
            this.bot.isGroup(chat.id._serialized)
          );
        } else if (type === "private") {
          filteredChats = chats.filter((chat) =>
            this.bot.isPrivateChat(chat.id._serialized)
          );
        }

        // Limitar resultados
        const limitedChats = filteredChats.slice(0, parseInt(limit));

        // Formatear respuesta
        const formattedChats = limitedChats.map((chat) => ({
          id: chat.id._serialized,
          name: chat.name || "Sin nombre",
          isGroup: this.bot.isGroup(chat.id._serialized),
          unreadCount: chat.unreadCount || 0,
          lastMessage: chat.lastMessage
            ? {
                body: chat.lastMessage.body,
                timestamp: chat.lastMessage.timestamp * 1000,
              }
            : null,
        }));

        res.json({
          success: true,
          data: {
            total: chats.length,
            filtered: filteredChats.length,
            returned: formattedChats.length,
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

    // Validar número de teléfono
    this.app.post("/validate-phone", (req, res) => {
      try {
        const { phoneNumber } = req.body;

        if (!phoneNumber) {
          return res.status(400).json({
            success: false,
            error: 'El parámetro "phoneNumber" es requerido',
          });
        }

        const isValid = this.bot.isValidPhoneNumber(phoneNumber);
        const normalized = this.bot.normalizePhoneNumber(phoneNumber);
        const whatsappFormat = this.bot.toWhatsAppFormat(phoneNumber);

        res.json({
          success: true,
          data: {
            phoneNumber,
            isValid,
            normalized,
            whatsappFormat,
            displayFormat: this.bot.formatForDisplay(phoneNumber),
          },
        });
      } catch (error) {
        this.logger.error("Error validando número de teléfono:", error);
        res.status(500).json({
          success: false,
          error: error.message || "Error interno del servidor",
        });
      }
    });

    // Obtener QR code
    this.app.get("/qr", async (req, res) => {
      try {
        const status = this.bot.getStatus();
        if (status.isConnected) {
          return res.json({
            success: true,
            data: {
              connected: true,
              message: "El bot ya está conectado",
              qrCode: null,
            },
          });
        }
        const qrData = this.bot.getQRCode();
        if (!qrData) {
          return res.json({
            success: false,
            error:
              "No hay QR code disponible. El bot puede estar en proceso de conexión.",
            data: {
              connected: false,
              qrCode: null,
            },
          });
        }
        res.json({
          success: true,
          data: {
            connected: false,
            qrCode: qrData,
            message: "Escanea este QR code con WhatsApp para conectar el bot",
          },
        });
      } catch (error) {
        this.logger.error("Error obteniendo QR code:", error);
        res.status(500).json({
          success: false,
          error: "Error interno del servidor",
        });
      }
    });

    // Obtener imagen QR
    this.app.get("/qr-image", async (req, res) => {
      try {
        const status = this.bot.getStatus();
        if (status.isConnected) {
          return res.status(400).json({
            success: false,
            error: "El bot ya está conectado",
          });
        }
        const qrData = this.bot.getQRCode();
        if (!qrData) {
          return res.status(404).json({
            success: false,
            error: "No hay QR code disponible",
          });
        }
        const qrImageBuffer = await qrcode.toBuffer(qrData, {
          type: "png",
          width: 300,
          margin: 2,
          color: { dark: "#000000", light: "#FFFFFF" },
        });
        res.setHeader("Content-Type", "image/png");
        res.setHeader("Content-Length", qrImageBuffer.length);
        res.send(qrImageBuffer);
      } catch (error) {
        this.logger.error("Error generando imagen QR:", error);
        res.status(500).json({
          success: false,
          error: "Error interno del servidor",
        });
      }
    });

    // Regenerar QR code
    this.app.post("/qr-regenerate", async (req, res) => {
      try {
        const status = this.bot.getStatus();
        if (status.isConnected) {
          return res.json({
            success: false,
            error: "El bot ya está conectado",
          });
        }
        const qrData = await this.bot.regenerateQR();
        if (!qrData) {
          return res.json({
            success: false,
            error: "No se pudo regenerar el QR code",
          });
        }
        res.json({
          success: true,
          data: {
            connected: false,
            qrCode: qrData,
            message: "Nuevo QR code generado. Escanea con WhatsApp.",
          },
        });
      } catch (error) {
        this.logger.error("Error regenerando QR code:", error);
        res.status(500).json({
          success: false,
          error: "Error interno del servidor",
        });
      }
    });

    // Manejo de errores 404
    this.app.use("*", (req, res) => {
      res.status(404).json({
        success: false,
        error: "Endpoint no encontrado",
        availableEndpoints: [
          "GET /health",
          "GET /status",
          "GET /qr",
          "GET /qr-image",
          "POST /qr-regenerate",
          "POST /send-message",
          "POST /send-response",
          "POST /send-bulk",
          "GET /contact/:phoneNumber",
          "GET /chats",
          "POST /validate-phone",
        ],
      });
    });

    // Manejo de errores global
    this.app.use((error, req, res, next) => {
      this.logger.error("Error no manejado:", error);
      res.status(500).json({
        success: false,
        error: "Error interno del servidor",
      });
    });
  }

  /**
   * Inicia el servidor y el bot
   */
  async start() {
    try {
      this.logger.info("Iniciando servidor y bot...");

      // Inicializar bot
      await this.bot.initialize();

      // Iniciar servidor
      const port = config.server.port;
      const host = process.env.HOST || "0.0.0.0";
      this.app.listen(port, host, () => {
        this.logger.info(`Servidor escuchando en ${host}:${port}`);
      });
    } catch (error) {
      this.logger.error("Error iniciando servidor:", error);
      throw error;
    }
  }

  /**
   * Detiene el servidor y el bot
   */
  async stop() {
    try {
      this.logger.info("Deteniendo servidor y bot...");
      await this.bot.destroy();
      this.logger.info("Servidor y bot detenidos correctamente");
    } catch (error) {
      this.logger.error("Error deteniendo servidor:", error);
      throw error;
    }
  }
}

// Crear y exportar instancia del servidor
const server = new WhatsAppServer();

// Manejo de señales para cierre graceful
process.on("SIGINT", () => server.stop());
process.on("SIGTERM", () => server.stop());

// Iniciar servidor si se ejecuta directamente
if (require.main === module) {
  server.start();
}

module.exports = server;

const config = require("../config");

/**
 * Utilidades para formateo y procesamiento de mensajes
 */
class MessageFormatter {
  /**
   * Formatea un mensaje para enviar a N8N
   * @param {Object} message - Objeto de mensaje de WhatsApp
   * @param {Object} contact - Información del contacto
   * @param {Object} chat - Información del chat
   * @returns {Object} Mensaje formateado para N8N
   */
  static formatMessageForN8N(message, contact, chat) {
    try {
      const formattedMessage = {
        messageId: message.id._serialized,
        from: message.from,
        fromNumber: this.extractPhoneNumber(message.from),
        to: message.to,
        body: message.body || "",
        type: message.type,
        timestamp: Math.floor(message.timestamp * 1000), // Convertir a milisegundos
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
      };

      // Agregar información adicional según el tipo de mensaje
      if (message.hasMedia) {
        formattedMessage.media = {
          mimetype: message.mimetype,
          filename: message.filename,
          size: message.size,
        };
      }

      return formattedMessage;
    } catch (error) {
      console.error("Error formateando mensaje para N8N:", error);
      return null;
    }
  }

  /**
   * Extrae el número de teléfono de un ID de WhatsApp
   * @param {string} whatsappId - ID de WhatsApp (ej: 5491123456789@c.us)
   * @returns {string} Número de teléfono formateado
   */
  static extractPhoneNumber(whatsappId) {
    try {
      if (!whatsappId) return "";

      // Remover sufijos de WhatsApp
      let number = whatsappId.replace("@c.us", "").replace("@g.us", "");

      // Asegurar que tenga el código de país
      if (!number.startsWith("54") && !number.startsWith("+54")) {
        number = "54" + number;
      }

      // Remover el + si existe
      number = number.replace("+", "");

      return number;
    } catch (error) {
      console.error("Error extrayendo número de teléfono:", error);
      return whatsappId || "";
    }
  }

  /**
   * Formatea un número de teléfono para uso en WhatsApp
   * @param {string} phoneNumber - Número de teléfono
   * @returns {string} Número formateado para WhatsApp
   */
  static formatPhoneNumberForWhatsApp(phoneNumber) {
    try {
      if (!phoneNumber) return "";

      // Limpiar el número
      let cleanNumber = phoneNumber.replace(/\D/g, "");

      // Asegurar que tenga el código de país
      if (!cleanNumber.startsWith("54")) {
        cleanNumber = "54" + cleanNumber;
      }

      // Agregar sufijo de WhatsApp
      return cleanNumber + "@c.us";
    } catch (error) {
      console.error("Error formateando número para WhatsApp:", error);
      return phoneNumber;
    }
  }

  /**
   * Valida si un mensaje es válido para procesar
   * @param {Object} message - Objeto de mensaje
   * @returns {boolean} True si el mensaje es válido
   */
  static isValidMessage(message) {
    try {
      if (!message || !message.from) return false;

      // Verificar que no sea un mensaje del propio bot
      if (message.fromMe) return false;

      // Verificar que tenga contenido
      if (!message.body && !message.hasMedia) return false;

      // Verificar longitud del mensaje
      if (
        message.body &&
        message.body.length > config.security.messageMaxLength
      ) {
        return false;
      }

      return true;
    } catch (error) {
      console.error("Error validando mensaje:", error);
      return false;
    }
  }

  /**
   * Formatea una respuesta para enviar
   * @param {string} text - Texto de la respuesta
   * @param {Object} options - Opciones adicionales
   * @returns {Object} Respuesta formateada
   */
  static formatResponse(text, options = {}) {
    try {
      const response = {
        text: text || "",
        timestamp: Date.now(),
        ...options,
      };

      // Validar longitud del texto
      if (response.text.length > config.security.messageMaxLength) {
        response.text =
          response.text.substring(0, config.security.messageMaxLength - 3) +
          "...";
      }

      return response;
    } catch (error) {
      console.error("Error formateando respuesta:", error);
      return { text: config.messages.error, timestamp: Date.now() };
    }
  }

  /**
   * Crea un mensaje de error formateado
   * @param {string} error - Mensaje de error
   * @param {string} context - Contexto del error
   * @returns {Object} Mensaje de error formateado
   */
  static createErrorMessage(error, context = "") {
    return {
      text: `${config.messages.error}${context ? ` (${context})` : ""}`,
      timestamp: Date.now(),
      isError: true,
      originalError: error,
    };
  }

  /**
   * Formatea un mensaje de log
   * @param {string} level - Nivel del log
   * @param {string} message - Mensaje
   * @param {Object} data - Datos adicionales
   * @returns {Object} Mensaje de log formateado
   */
  static formatLogMessage(level, message, data = {}) {
    return {
      level,
      message,
      timestamp: new Date().toISOString(),
      data,
    };
  }
}

module.exports = MessageFormatter;

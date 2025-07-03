const config = require("../config");

/**
 * Utilidades para validación y procesamiento de números telefónicos
 */
class PhoneValidator {
  /**
   * Valida si un número de teléfono es válido para Argentina
   * @param {string} phoneNumber - Número de teléfono a validar
   * @returns {boolean} True si el número es válido
   */
  static isValidPhoneNumber(phoneNumber) {
    try {
      if (!phoneNumber || typeof phoneNumber !== "string") {
        return false;
      }

      // Limpiar el número
      const cleanNumber = phoneNumber.replace(/\D/g, "");

      // Validar con el patrón configurado
      return config.validation.phoneNumberPattern.test(cleanNumber);
    } catch (error) {
      console.error("Error validando número de teléfono:", error);
      return false;
    }
  }

  /**
   * Normaliza un número de teléfono al formato estándar
   * @param {string} phoneNumber - Número de teléfono a normalizar
   * @returns {string} Número normalizado
   */
  static normalizePhoneNumber(phoneNumber) {
    try {
      if (!phoneNumber) return "";

      // Limpiar el número
      let cleanNumber = phoneNumber.replace(/\D/g, "");

      // Si ya tiene el código de país 54, mantenerlo completo
      if (cleanNumber.startsWith("54")) {
        return cleanNumber;
      }

      // Si no tiene código de país, agregarlo según el formato
      if (cleanNumber.length === 10 && cleanNumber.startsWith("9")) {
        // Formato: 9112345678 -> 549112345678
        cleanNumber = "54" + cleanNumber;
      } else if (cleanNumber.length === 8) {
        // Formato: 11234567 -> 54911234567
        cleanNumber = "549" + cleanNumber;
      } else if (cleanNumber.length === 11 && cleanNumber.startsWith("9")) {
        // Formato: 91123456789 -> 5491123456789
        cleanNumber = "54" + cleanNumber;
      } else if (cleanNumber.length === 9 && cleanNumber.startsWith("1")) {
        // Formato: 112345678 -> 549112345678
        cleanNumber = "549" + cleanNumber;
      }

      return cleanNumber;
    } catch (error) {
      console.error("Error normalizando número de teléfono:", error);
      return phoneNumber;
    }
  }

  /**
   * Convierte un número de teléfono al formato de WhatsApp
   * @param {string} phoneNumber - Número de teléfono
   * @returns {string} Número en formato WhatsApp
   */
  static toWhatsAppFormat(phoneNumber) {
    try {
      const normalized = this.normalizePhoneNumber(phoneNumber);
      return normalized + "@c.us";
    } catch (error) {
      console.error("Error convirtiendo número a formato WhatsApp:", error);
      return phoneNumber;
    }
  }

  /**
   * Extrae el número de teléfono del formato de WhatsApp
   * @param {string} whatsappId - ID de WhatsApp
   * @returns {string} Número de teléfono limpio
   */
  static fromWhatsAppFormat(whatsappId) {
    try {
      if (!whatsappId) return "";

      // Remover sufijos de WhatsApp
      let number = whatsappId.replace("@c.us", "").replace("@g.us", "");

      // Asegurar que tenga el código de país
      if (!number.startsWith("54")) {
        number = "54" + number;
      }

      return number;
    } catch (error) {
      console.error("Error extrayendo número del formato WhatsApp:", error);
      return whatsappId || "";
    }
  }

  /**
   * Formatea un número de teléfono para mostrar
   * @param {string} phoneNumber - Número de teléfono
   * @returns {string} Número formateado para mostrar
   */
  static formatForDisplay(phoneNumber) {
    try {
      const normalized = this.normalizePhoneNumber(phoneNumber);

      if (normalized.length === 12 && normalized.startsWith("54")) {
        // Formato: +54 9 11 2345-6789
        const areaCode = normalized.substring(2, 4);
        const prefix = normalized.substring(4, 6);
        const firstPart = normalized.substring(6, 10);
        const secondPart = normalized.substring(10, 12);

        return `+54 ${areaCode} ${prefix} ${firstPart}-${secondPart}`;
      }

      return normalized;
    } catch (error) {
      console.error("Error formateando número para mostrar:", error);
      return phoneNumber;
    }
  }

  /**
   * Valida si un número pertenece a un grupo
   * @param {string} whatsappId - ID de WhatsApp
   * @returns {boolean} True si es un grupo
   */
  static isGroup(whatsappId) {
    try {
      return whatsappId && whatsappId.includes("@g.us");
    } catch (error) {
      console.error("Error verificando si es grupo:", error);
      return false;
    }
  }

  /**
   * Valida si un número pertenece a un chat privado
   * @param {string} whatsappId - ID de WhatsApp
   * @returns {boolean} True si es un chat privado
   */
  static isPrivateChat(whatsappId) {
    try {
      return whatsappId && whatsappId.includes("@c.us");
    } catch (error) {
      console.error("Error verificando si es chat privado:", error);
      return false;
    }
  }

  /**
   * Obtiene el tipo de chat basado en el ID
   * @param {string} whatsappId - ID de WhatsApp
   * @returns {string} Tipo de chat ('private', 'group', 'unknown')
   */
  static getChatType(whatsappId) {
    try {
      if (this.isGroup(whatsappId)) {
        return "group";
      } else if (this.isPrivateChat(whatsappId)) {
        return "private";
      } else {
        return "unknown";
      }
    } catch (error) {
      console.error("Error obteniendo tipo de chat:", error);
      return "unknown";
    }
  }

  /**
   * Valida un array de números de teléfono
   * @param {Array} phoneNumbers - Array de números de teléfono
   * @returns {Object} Resultado de la validación
   */
  static validatePhoneNumbers(phoneNumbers) {
    try {
      if (!Array.isArray(phoneNumbers)) {
        return {
          valid: false,
          error: "El parámetro debe ser un array",
          validNumbers: [],
          invalidNumbers: [],
        };
      }

      const validNumbers = [];
      const invalidNumbers = [];

      phoneNumbers.forEach((number, index) => {
        if (this.isValidPhoneNumber(number)) {
          validNumbers.push({
            original: number,
            normalized: this.normalizePhoneNumber(number),
            whatsappFormat: this.toWhatsAppFormat(number),
          });
        } else {
          invalidNumbers.push({
            original: number,
            index,
            reason: "Formato inválido",
          });
        }
      });

      return {
        valid: invalidNumbers.length === 0,
        validNumbers,
        invalidNumbers,
        total: phoneNumbers.length,
        validCount: validNumbers.length,
        invalidCount: invalidNumbers.length,
      };
    } catch (error) {
      console.error("Error validando array de números:", error);
      return {
        valid: false,
        error: error.message,
        validNumbers: [],
        invalidNumbers: phoneNumbers || [],
      };
    }
  }
}

module.exports = PhoneValidator;

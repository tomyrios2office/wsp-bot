/**
 * Ejemplos de integración con N8N
 *
 * Este archivo contiene ejemplos de cómo usar el bot de WhatsApp
 * desde N8N para diferentes casos de uso.
 */

// ============================================================================
// EJEMPLO 1: ATENCIÓN AL CLIENTE AUTOMÁTICA
// ============================================================================

/**
 * En N8N, después de recibir el webhook de WhatsApp:
 *
 * 1. Agregar nodo "Code" después del webhook
 * 2. Usar este código para procesar el mensaje
 */

function processCustomerService() {
  const message = $json.body;
  const fromNumber = $json.fromNumber;
  const contactName = $json.contact.name;

  // Palabras clave para clasificar consultas
  const keywords = {
    ayuda: "¿En qué puedo ayudarte? Tenemos varios servicios disponibles.",
    precio:
      "Nuestros precios varían según el servicio. ¿Qué te interesa específicamente?",
    horario:
      "Nuestro horario de atención es de lunes a viernes de 9:00 a 18:00.",
    contacto:
      "Puedes contactarnos al 011-1234-5678 o por email: info@empresa.com",
    reserva:
      "Para hacer una reserva, necesito algunos datos. ¿Qué fecha te interesa?",
  };

  // Buscar palabra clave en el mensaje
  let response = "Gracias por contactarnos. ¿En qué puedo ayudarte?";

  for (const [keyword, reply] of Object.entries(keywords)) {
    if (message.toLowerCase().includes(keyword)) {
      response = reply;
      break;
    }
  }

  // Enviar respuesta automática
  return {
    to: fromNumber,
    message: `Hola ${contactName}, ${response}`,
    shouldEscalate:
      message.toLowerCase().includes("urgente") || message.length > 100,
  };
}

// ============================================================================
// EJEMPLO 2: SISTEMA DE ENCUESTAS
// ============================================================================

function processSurvey() {
  const message = $json.body;
  const fromNumber = $json.fromNumber;
  const contactName = $json.contact.name;

  // Estado de la encuesta (en producción, esto vendría de una base de datos)
  const surveyState = getSurveyState(fromNumber);

  if (!surveyState) {
    // Iniciar nueva encuesta
    const welcomeMessage = `Hola ${contactName}, gracias por participar en nuestra encuesta.
    
¿Qué tan satisfecho estás con nuestro servicio?
1 - Muy insatisfecho
2 - Insatisfecho  
3 - Neutral
4 - Satisfecho
5 - Muy satisfecho`;

    setSurveyState(fromNumber, { step: "satisfaction", responses: {} });

    return {
      to: fromNumber,
      message: welcomeMessage,
      surveyStep: "satisfaction",
    };
  }

  // Procesar respuesta según el paso actual
  switch (surveyState.step) {
    case "satisfaction":
      if (message.match(/^[1-5]$/)) {
        surveyState.responses.satisfaction = parseInt(message);
        surveyState.step = "recommendation";

        const nextQuestion = `Gracias. ¿Recomendarías nuestro servicio a un amigo?
1 - Definitivamente no
2 - Probablemente no
3 - Tal vez
4 - Probablemente sí
5 - Definitivamente sí`;

        setSurveyState(fromNumber, surveyState);

        return {
          to: fromNumber,
          message: nextQuestion,
          surveyStep: "recommendation",
        };
      }
      break;

    case "recommendation":
      if (message.match(/^[1-5]$/)) {
        surveyState.responses.recommendation = parseInt(message);
        surveyState.step = "comments";

        const finalQuestion = `Excelente. ¿Tienes algún comentario adicional sobre nuestro servicio?`;

        setSurveyState(fromNumber, surveyState);

        return {
          to: fromNumber,
          message: finalQuestion,
          surveyStep: "comments",
        };
      }
      break;

    case "comments":
      surveyState.responses.comments = message;
      surveyState.completed = true;

      // Guardar encuesta completada
      saveSurveyResults(fromNumber, surveyState.responses);

      const thankYouMessage = `¡Gracias ${contactName} por completar nuestra encuesta!
      
Tus respuestas nos ayudarán a mejorar nuestro servicio.
¡Que tengas un excelente día!`;

      clearSurveyState(fromNumber);

      return {
        to: fromNumber,
        message: thankYouMessage,
        surveyCompleted: true,
        results: surveyState.responses,
      };
  }

  // Respuesta por defecto si no coincide con el formato esperado
  return {
    to: fromNumber,
    message: "Por favor, responde con un número del 1 al 5.",
    surveyStep: surveyState.step,
  };
}

// ============================================================================
// EJEMPLO 3: SISTEMA DE RESERVAS
// ============================================================================

function processReservation() {
  const message = $json.body;
  const fromNumber = $json.fromNumber;
  const contactName = $json.contact.name;

  const reservationState = getReservationState(fromNumber);

  if (!reservationState) {
    // Iniciar proceso de reserva
    const welcomeMessage = `Hola ${contactName}, te ayudo a hacer tu reserva.
    
¿Para qué fecha te gustaría reservar? (formato: DD/MM/YYYY)`;

    setReservationState(fromNumber, { step: "date", data: {} });

    return {
      to: fromNumber,
      message: welcomeMessage,
      reservationStep: "date",
    };
  }

  switch (reservationState.step) {
    case "date":
      // Validar formato de fecha
      const dateMatch = message.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (dateMatch) {
        const [, day, month, year] = dateMatch;
        const date = new Date(year, month - 1, day);

        if (date > new Date()) {
          reservationState.data.date = date;
          reservationState.step = "time";

          const timeQuestion = `Perfecto. ¿A qué hora te gustaría reservar?
Opciones disponibles:
- 12:00
- 13:00
- 14:00
- 15:00
- 16:00`;

          setReservationState(fromNumber, reservationState);

          return {
            to: fromNumber,
            message: timeQuestion,
            reservationStep: "time",
          };
        } else {
          return {
            to: fromNumber,
            message:
              "La fecha debe ser futura. Por favor, ingresa una fecha válida (DD/MM/YYYY).",
            reservationStep: "date",
          };
        }
      } else {
        return {
          to: fromNumber,
          message: "Por favor, ingresa la fecha en formato DD/MM/YYYY.",
          reservationStep: "date",
        };
      }
      break;

    case "time":
      const timeMatch = message.match(/^(\d{1,2}):(\d{2})$/);
      if (timeMatch) {
        const [, hour, minute] = timeMatch;
        const time = `${hour}:${minute}`;

        if (["12:00", "13:00", "14:00", "15:00", "16:00"].includes(time)) {
          reservationState.data.time = time;
          reservationState.step = "guests";

          const guestsQuestion = `Excelente. ¿Cuántas personas serán?`;

          setReservationState(fromNumber, reservationState);

          return {
            to: fromNumber,
            message: guestsQuestion,
            reservationStep: "guests",
          };
        } else {
          return {
            to: fromNumber,
            message: "Por favor, selecciona una hora disponible de la lista.",
            reservationStep: "time",
          };
        }
      } else {
        return {
          to: fromNumber,
          message: "Por favor, ingresa la hora en formato HH:MM.",
          reservationStep: "time",
        };
      }
      break;

    case "guests":
      const guestsMatch = message.match(/^(\d+)$/);
      if (guestsMatch) {
        const guests = parseInt(guestsMatch[1]);
        if (guests > 0 && guests <= 10) {
          reservationState.data.guests = guests;
          reservationState.completed = true;

          // Guardar reserva
          const reservationId = saveReservation(
            fromNumber,
            reservationState.data
          );

          const confirmationMessage = `¡Perfecto ${contactName}! Tu reserva ha sido confirmada.

📅 Fecha: ${reservationState.data.date.toLocaleDateString()}
🕐 Hora: ${reservationState.data.time}
👥 Personas: ${reservationState.data.guests}
🆔 ID de Reserva: ${reservationId}

Te esperamos. ¡Que tengas un excelente día!`;

          clearReservationState(fromNumber);

          return {
            to: fromNumber,
            message: confirmationMessage,
            reservationCompleted: true,
            reservationId,
          };
        } else {
          return {
            to: fromNumber,
            message: "Por favor, ingresa un número válido de personas (1-10).",
            reservationStep: "guests",
          };
        }
      } else {
        return {
          to: fromNumber,
          message: "Por favor, ingresa un número válido de personas.",
          reservationStep: "guests",
        };
      }
      break;
  }
}

// ============================================================================
// EJEMPLO 4: NOTIFICACIONES MASIVAS
// ============================================================================

function sendBulkNotification() {
  // Este ejemplo se ejecutaría desde N8N para enviar notificaciones masivas

  const notificationData = {
    numbers: ["5491123456789", "5491123456790", "5491123456791"],
    message: `¡Hola! Tenemos una promoción especial para ti.

🎉 20% de descuento en todos nuestros productos
📅 Válido hasta el 31 de diciembre
🛒 Código: PROMO2024

¡No te lo pierdas!`,
    delay: 2000, // 2 segundos entre mensajes
  };

  return {
    action: "send_bulk",
    data: notificationData,
  };
}

// ============================================================================
// FUNCIONES AUXILIARES (simuladas)
// ============================================================================

function getSurveyState(phoneNumber) {
  // En producción, esto consultaría una base de datos
  return null;
}

function setSurveyState(phoneNumber, state) {
  // En producción, esto guardaría en una base de datos
  console.log(`Survey state set for ${phoneNumber}:`, state);
}

function clearSurveyState(phoneNumber) {
  // En producción, esto limpiaría la base de datos
  console.log(`Survey state cleared for ${phoneNumber}`);
}

function saveSurveyResults(phoneNumber, results) {
  // En producción, esto guardaría en una base de datos
  console.log(`Survey results saved for ${phoneNumber}:`, results);
}

function getReservationState(phoneNumber) {
  // En producción, esto consultaría una base de datos
  return null;
}

function setReservationState(phoneNumber, state) {
  // En producción, esto guardaría en una base de datos
  console.log(`Reservation state set for ${phoneNumber}:`, state);
}

function clearReservationState(phoneNumber) {
  // En producción, esto limpiaría la base de datos
  console.log(`Reservation state cleared for ${phoneNumber}`);
}

function saveReservation(phoneNumber, data) {
  // En producción, esto guardaría en una base de datos
  const reservationId = "RES-" + Date.now();
  console.log(`Reservation saved for ${phoneNumber}:`, {
    id: reservationId,
    ...data,
  });
  return reservationId;
}

// ============================================================================
// EJEMPLO DE USO EN N8N
// ============================================================================

/**
 * En N8N, puedes usar estos ejemplos así:
 *
 * 1. Webhook → Code (con el código de arriba) → HTTP Request (para enviar respuesta)
 *
 * Ejemplo de HTTP Request en N8N:
 *
 * Method: POST
 * URL: http://localhost:3000/send-message
 * Headers: Content-Type: application/json
 * Body: {
 *   "to": "{{ $json.to }}",
 *   "message": "{{ $json.message }}"
 * }
 */

module.exports = {
  processCustomerService,
  processSurvey,
  processReservation,
  sendBulkNotification,
};

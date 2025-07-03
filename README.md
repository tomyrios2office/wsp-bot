# Sistema Bot WhatsApp + N8N

Sistema completo de bot de WhatsApp que se integra con N8N para automatización de mensajes y respuestas.

## 🚀 Características

- **Conexión WhatsApp Web**: Usando `whatsapp-web.js` con autenticación QR
- **API REST Completa**: Endpoints para envío y gestión de mensajes
- **Integración N8N**: Webhook automático para mensajes entrantes
- **Validación de Números**: Soporte para números argentinos (+54)
- **Logging Detallado**: Winston para logs estructurados
- **Rate Limiting**: Protección contra spam
- **Reconexión Automática**: Manejo robusto de desconexiones
- **Sesiones Persistentes**: Autenticación automática después del primer login

## 📋 Requisitos

- Node.js 16 o superior
- Chrome/Chromium instalado
- Conexión estable a internet
- N8N configurado (opcional)

## 🛠️ Instalación

1. **Clonar o descargar el proyecto**

```bash
cd wsp-bot
```

2. **Instalar dependencias**

```bash
npm install
```

3. **Configurar variables de entorno**

```bash
cp env.example .env
```

4. **Editar archivo .env**

```env
# Configuración del Webhook N8N
N8N_WEBHOOK_URL=https://tu-n8n.com/webhook/whatsapp

# Configuración del Servidor
PORT=3000
NODE_ENV=production

# Configuración Regional
COUNTRY_CODE=54

# Configuración de Logs
LOG_LEVEL=info

# Configuración de WhatsApp Web
PUPPETEER_HEADLESS=true
PUPPETEER_ARGS=--no-sandbox,--disable-setuid-sandbox,--disable-dev-shm-usage,--disable-accelerated-2d-canvas,--no-first-run,--no-zygote,--disable-gpu

# Configuración de Seguridad
RATE_LIMIT_WINDOW=60000
RATE_LIMIT_MAX_REQUESTS=100
MESSAGE_MAX_LENGTH=4096

# Configuración de Reconexión
RECONNECT_INTERVAL=5000
MAX_RECONNECT_ATTEMPTS=10

# Configuración de Webhook
WEBHOOK_TIMEOUT=10000
WEBHOOK_RETRY_ATTEMPTS=3
```

## 🚀 Uso

### Iniciar solo el bot

```bash
npm start
# o
npm run dev
```

### Iniciar servidor API completo

```bash
npm run server
# o
npm run dev-server
```

### Primera ejecución

1. Ejecutar el bot
2. Escanear el código QR que aparece en la terminal
3. El bot se conectará automáticamente
4. Los mensajes entrantes se enviarán al webhook N8N

## 📡 API REST

### Endpoints Disponibles

#### Health Check

```http
GET /health
```

Respuesta:

```json
{
  "status": "ok",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "uptime": 3600
}
```

#### Estado del Bot

```http
GET /status
```

Respuesta:

```json
{
  "success": true,
  "data": {
    "isConnected": true,
    "reconnectAttempts": 0,
    "messageQueueLength": 0,
    "timestamp": 1704067200000
  }
}
```

#### Enviar Mensaje Individual

```http
POST /send-message
Content-Type: application/json

{
  "to": "5491123456789",
  "message": "Hola, este es un mensaje de prueba"
}
```

#### Responder a Mensaje

```http
POST /send-response
Content-Type: application/json

{
  "to": "5491123456789",
  "message": "Respuesta al mensaje",
  "replyTo": "message_id_optional"
}
```

#### Enviar Mensajes Masivos

```http
POST /send-bulk
Content-Type: application/json

{
  "numbers": ["5491123456789", "5491123456790"],
  "message": "Mensaje masivo",
  "delay": 1000
}
```

#### Información de Contacto

```http
GET /contact/5491123456789
```

#### Listar Chats

```http
GET /chats?limit=50&type=private
```

#### Validar Número

```http
POST /validate-phone
Content-Type: application/json

{
  "phoneNumber": "5491123456789"
}
```

## 🔗 Integración con N8N

### Estructura de Datos del Webhook

El webhook N8N recibirá esta estructura de datos:

```json
{
  "messageId": "3EB0C767D82B8F6C8C1C",
  "from": "5491123456789@c.us",
  "fromNumber": "5491123456789",
  "to": "5491123456789@c.us",
  "body": "Hola, necesito ayuda",
  "type": "chat",
  "timestamp": 1704067200000,
  "isGroupMsg": false,
  "contact": {
    "name": "Juan Pérez",
    "number": "5491123456789",
    "isMyContact": true
  },
  "chat": {
    "name": "Juan Pérez",
    "isGroup": false
  },
  "metadata": {
    "hasMedia": false,
    "mediaType": "chat",
    "quotedMessage": null
  }
}
```

### Ejemplo de Respuesta desde N8N

Para responder desde N8N, usa el endpoint `/send-message`:

```javascript
// En N8N, después de procesar el webhook
const response = await fetch("http://localhost:3000/send-message", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    to: $json.fromNumber,
    message: "Gracias por tu mensaje. Te responderemos pronto.",
  }),
});
```

## 📱 Formato de Números

### Números Argentinos Soportados

- `5491123456789` (formato completo)
- `91123456789` (sin código de país)
- `1123456789` (sin 9 inicial)
- `+5491123456789` (con +)

### Validación Automática

El sistema valida y normaliza automáticamente los números al formato estándar.

## 🔧 Configuración Avanzada

### Variables de Entorno Adicionales

```env
# Orígenes permitidos para CORS
ALLOWED_ORIGINS=http://localhost:3000,https://tu-dominio.com

# Configuración de Puppeteer
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Configuración de logs
LOG_FILE_PATH=./logs
```

### Configuración de Puppeteer

Para servidores sin interfaz gráfica:

```env
PUPPETEER_HEADLESS=true
PUPPETEER_ARGS=--no-sandbox,--disable-setuid-sandbox,--disable-dev-shm-usage
```

## 📊 Logs

Los logs se guardan en la carpeta `logs/`:

- `combined.log`: Todos los logs
- `error.log`: Solo errores
- `api-combined.log`: Logs de la API
- `api-error.log`: Errores de la API

### Niveles de Log

- `error`: Errores críticos
- `warn`: Advertencias
- `info`: Información general
- `debug`: Información detallada

## 🛡️ Seguridad

### Rate Limiting

- 100 requests por minuto por IP
- Configurable via variables de entorno

### Validaciones

- Números de teléfono argentinos
- Longitud máxima de mensajes (4096 caracteres)
- Tipos de archivo permitidos
- Tamaño máximo de archivos (16MB)

### CORS

- Configurable via `ALLOWED_ORIGINS`
- Por defecto permite todos los orígenes

## 🔄 Casos de Uso

### 1. Atención al Cliente

```javascript
// N8N recibe consulta → Procesa → Responde automáticamente
if (message.body.includes("ayuda")) {
  await sendResponse(message.fromNumber, "¿En qué puedo ayudarte?");
}
```

### 2. Notificaciones Masivas

```javascript
// N8N → Bot → Envío masivo
const numbers = ["5491123456789", "5491123456790"];
await sendBulkMessage(numbers, "Nueva promoción disponible");
```

### 3. Encuestas

```javascript
// Recopilar respuestas → N8N → Base de datos
if (message.body.match(/^[1-5]$/)) {
  await saveSurveyResponse(message.fromNumber, message.body);
}
```

### 4. Reservas

```javascript
// Solicitud → N8N → Confirmación automática
if (message.body.includes("reservar")) {
  const confirmation = await processReservation(message.body);
  await sendResponse(message.fromNumber, confirmation);
}
```

## 🚨 Troubleshooting

### Problemas Comunes

#### Bot no se conecta

1. Verificar conexión a internet
2. Asegurar que Chrome/Chromium esté instalado
3. Revisar logs en `logs/error.log`

#### QR Code no aparece

1. Verificar configuración de Puppeteer
2. En servidores headless, usar `PUPPETEER_HEADLESS=true`

#### Mensajes no llegan a N8N

1. Verificar URL del webhook en `.env`
2. Revisar conectividad de red
3. Verificar logs de webhook

#### Error de autenticación

1. Eliminar carpeta `.wwebjs_auth/`
2. Reiniciar el bot
3. Escanear QR nuevamente

#### Rate limit excedido

1. Aumentar `RATE_LIMIT_MAX_REQUESTS` en `.env`
2. Implementar delays entre mensajes

### Logs Útiles

```bash
# Ver logs en tiempo real
tail -f logs/combined.log

# Ver solo errores
tail -f logs/error.log

# Buscar errores específicos
grep "Error" logs/combined.log
```

## 📦 Estructura del Proyecto

```
wsp-bot/
├── bot.js                 # Bot principal de WhatsApp
├── server.js              # Servidor API Express
├── config.js              # Configuración centralizada
├── package.json           # Dependencias y scripts
├── env.example            # Variables de entorno de ejemplo
├── .gitignore            # Archivos ignorados por Git
├── README.md             # Documentación
├── utils/
│   ├── messageFormatter.js # Formateo de mensajes
│   └── phoneValidator.js   # Validación de números
└── logs/                  # Archivos de log (se crea automáticamente)
```

## 🤝 Contribuir

1. Fork el proyecto
2. Crear rama para feature (`git checkout -b feature/nueva-funcionalidad`)
3. Commit cambios (`git commit -am 'Agregar nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Crear Pull Request

## 📄 Licencia

MIT License - ver archivo LICENSE para detalles.

## 🆘 Soporte

Para soporte técnico:

- Revisar la sección de Troubleshooting
- Verificar logs en `logs/`
- Crear issue en el repositorio

---

**Desarrollado por Landot** 🚀

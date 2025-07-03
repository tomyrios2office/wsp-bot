# Bot de WhatsApp con N8N

Bot de WhatsApp ligero y optimizado que se integra con N8N para automatización de mensajes.

## Características

- ✅ **Conexión a WhatsApp Web** usando whatsapp-web.js
- ✅ **Servidor API REST** con Express.js
- ✅ **Integración con N8N** mediante webhooks
- ✅ **Sesiones persistentes** con LocalAuth
- ✅ **Reconexión automática** en caso de desconexión
- ✅ **Validación de números argentinos** (+54)
- ✅ **Logging optimizado** con Winston
- ✅ **Rate limiting** para protección
- ✅ **Endpoints para QR** (texto e imagen)
- ✅ **Envío masivo** de mensajes
- ✅ **Gestión de contactos y chats**

## Estructura del Proyecto

```
wsp-bot/
├── bot.js              # Clase principal del bot
├── server.js           # Servidor API REST
├── config.js           # Configuración centralizada
├── index.js            # Punto de entrada
├── package.json        # Dependencias
├── .env.example        # Variables de entorno
└── logs/               # Archivos de log
```

## Instalación

1. **Clonar e instalar dependencias:**

```bash
cd wsp-bot
npm install
```

2. **Configurar variables de entorno:**

```bash
cp .env.example .env
# Editar .env con tus configuraciones
```

3. **Iniciar el bot:**

```bash
npm start
```

## Configuración

### Variables de Entorno (.env)

```env
# Servidor
PORT=3000
NODE_ENV=development

# N8N Webhook
N8N_WEBHOOK_URL=https://tu-n8n-instance.com/webhook/abc123

# WhatsApp
PUPPETEER_HEADLESS=true
PUPPETEER_ARGS=--no-sandbox,--disable-setuid-sandbox

# Logging
LOG_LEVEL=info

# Seguridad
RATE_LIMIT_WINDOW=60000
RATE_LIMIT_MAX_REQUESTS=100
MESSAGE_MAX_LENGTH=4096

# Reconexión
RECONNECT_INTERVAL=5000
MAX_RECONNECT_ATTEMPTS=10
```

## API REST

### Endpoints Principales

#### 1. Estado del Bot

```http
GET /status
```

**Respuesta:**

```json
{
  "success": true,
  "data": {
    "isConnected": true,
    "reconnectAttempts": 0,
    "hasQR": false,
    "timestamp": "2024-01-01T12:00:00.000Z"
  }
}
```

#### 2. Enviar Mensaje

```http
POST /send-message
Content-Type: application/json

{
  "to": "5491123456789",
  "message": "Hola desde el bot!"
}
```

#### 3. Envío Masivo

```http
POST /send-bulk
Content-Type: application/json

{
  "numbers": ["5491123456789", "5491123456790"],
  "message": "Mensaje masivo"
}
```

#### 4. Obtener QR Code

```http
GET /qr?format=text
GET /qr?format=image
```

#### 5. Regenerar QR

```http
POST /qr/regenerate?format=text
POST /qr/regenerate?format=image
```

#### 6. Listar Contactos

```http
GET /contacts
```

#### 7. Listar Chats

```http
GET /chats
```

## Integración con N8N

### Webhook de Entrada

El bot envía automáticamente todos los mensajes recibidos a tu webhook de N8N:

```json
{
  "messageId": "3EB0C767D82B8F6C8C1C",
  "from": "5491123456789@c.us",
  "fromNumber": "5491123456789",
  "to": "5491123456789@c.us",
  "body": "Hola bot!",
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

### Nodo HTTP Request en N8N

Para enviar mensajes desde N8N:

```json
{
  "method": "POST",
  "url": "http://localhost:3000/send-message",
  "headers": {
    "Content-Type": "application/json"
  },
  "body": {
    "to": "5491123456789",
    "message": "Respuesta automática desde N8N"
  }
}
```

## Optimizaciones Implementadas

### 1. **Código Consolidado**

- Eliminadas utilidades redundantes (`messageFormatter.js`, `phoneValidator.js`)
- Funciones integradas directamente en las clases principales
- Reducción de ~200 líneas de código

### 2. **Logging Simplificado**

- Un solo archivo de log (`combined.log`)
- Eliminado logging separado por errores
- Reducción de overhead de I/O

### 3. **Configuración Optimizada**

- Eliminadas configuraciones redundantes
- Consolidadas opciones similares
- Configuración más limpia y mantenible

### 4. **Manejo de Eventos Mejorado**

- Eliminados eventos innecesarios (`change_state`, `loading_screen`)
- Código más directo y eficiente
- Menor uso de memoria

### 5. **Validaciones Integradas**

- Validación de números integrada en el servidor
- Eliminada dependencia de utilidades externas
- Código más cohesivo

## Uso con Postman

### 1. Obtener QR Code

```http
GET http://localhost:3000/qr?format=image
```

### 2. Enviar Mensaje

```http
POST http://localhost:3000/send-message
Content-Type: application/json

{
  "to": "5491123456789",
  "message": "Test desde Postman"
}
```

### 3. Ver Estado

```http
GET http://localhost:3000/status
```

## Troubleshooting

### Bot no se conecta

1. Verifica que el QR code se genere: `GET /qr`
2. Escanea el QR con WhatsApp
3. Revisa los logs en `logs/combined.log`

### Mensajes no se envían

1. Verifica el estado: `GET /status`
2. Asegúrate de que `isConnected` sea `true`
3. Valida el formato del número (+54)

### Error de webhook

1. Verifica la URL del webhook en `.env`
2. Asegúrate de que N8N esté accesible
3. Revisa los logs para errores de red

## Scripts Disponibles

```bash
npm start          # Iniciar bot
npm run dev        # Modo desarrollo
npm run stop       # Detener bot
```

## Contribuir

1. Fork el proyecto
2. Crea una rama para tu feature
3. Commit tus cambios
4. Push a la rama
5. Abre un Pull Request

## Licencia

MIT License - ver archivo LICENSE para detalles.

# WhatsApp Bot con N8N - Optimizado para Railway

Sistema completo de bot de WhatsApp con integración N8N, optimizado para despliegue rápido en Railway.

## 🚀 Optimizaciones Implementadas

### Reducción de Dependencias

- **Winston removido**: Reemplazado con logging simple usando `console.log`
- **qrcode-terminal opcional**: Solo se instala si está disponible
- **Dependencias actualizadas**: Versiones más ligeras y estables

### Optimización de Puppeteer

- **Configuración optimizada**: Argumentos específicos para entornos cloud
- **Chromium pre-instalado**: Usa el navegador del sistema en lugar de descargar
- **Variables de entorno**: Configuración flexible para diferentes entornos

### Docker Optimizado

- **Imagen Alpine**: Base más ligera que reduce el tamaño del contenedor
- **Multi-stage build**: Instalación eficiente de dependencias
- **Cache optimizado**: Limpieza automática de cache de npm

## 📦 Instalación

```bash
# Clonar repositorio
git clone <tu-repositorio>
cd wsp-bot

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env
```

## ⚙️ Configuración

### Variables de Entorno

```env
# Servidor
PORT=3000
HOST=0.0.0.0

# N8N
N8N_WEBHOOK_URL=https://tu-n8n-instance.com/webhook/whatsapp

# WhatsApp
WHATSAPP_SESSION_PATH=./sessions
WHATSAPP_CLIENT_ID=bot-client

# Puppeteer (para Railway)
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
```

## 🚀 Despliegue en Railway

### Método 1: Docker (Recomendado)

1. Conecta tu repositorio a Railway
2. Railway detectará automáticamente el `Dockerfile`
3. El build se completará en ~5-10 minutos

### Método 2: Buildpack de Node.js

1. Conecta tu repositorio a Railway
2. Railway usará el buildpack de Node.js
3. Configura las variables de entorno necesarias

### Variables de Entorno para Railway

```env
N8N_WEBHOOK_URL=https://tu-n8n-instance.com/webhook/whatsapp
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
```

## 🔧 Uso

### Iniciar la Aplicación

```bash
# Desarrollo
npm run dev

# Producción
npm start

# Solo servidor API
npm run server
```

### Endpoints Disponibles

#### Estado del Bot

```bash
GET /status
```

#### Enviar Mensaje

```bash
POST /send-message
{
  "to": "5491112345678",
  "message": "Hola desde el bot!"
}
```

#### Obtener QR Code

```bash
GET /qr
GET /qr-image
POST /qr-regenerate
```

#### Mensajes Masivos

```bash
POST /send-bulk
{
  "numbers": ["5491112345678", "5491187654321"],
  "message": "Mensaje masivo"
}
```

## 📱 Autenticación WhatsApp

1. **Iniciar el bot**: `npm start`
2. **Obtener QR**: `GET /qr` o `GET /qr-image`
3. **Escanear QR**: Con WhatsApp en tu teléfono
4. **Verificar conexión**: `GET /status`

## 🔗 Integración con N8N

### Webhook de Entrada

Los mensajes recibidos se envían automáticamente a:

```
POST ${N8N_WEBHOOK_URL}
```

### Formato del Mensaje

```json
{
  "messageId": "3EB0C767D82B8A6B",
  "from": "5491112345678@c.us",
  "contact": {
    "name": "Juan Pérez",
    "number": "5491112345678",
    "isMyContact": false
  },
  "chat": {
    "name": "Juan Pérez",
    "type": "individual"
  },
  "message": {
    "type": "chat",
    "body": "Hola bot!",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "hasMedia": false
  }
}
```

## 🛠️ Desarrollo

### Estructura del Proyecto

```
wsp-bot/
├── bot.js              # Clase principal del bot
├── server.js           # Servidor Express con API
├── config.js           # Configuración centralizada
├── start.js            # Punto de entrada
├── utils/              # Utilidades
│   ├── messageFormatter.js
│   └── phoneValidator.js
├── Dockerfile          # Configuración Docker
├── railway.json        # Configuración Railway
└── package.json        # Dependencias
```

### Logs

Los logs se muestran en la consola con formato JSON para fácil parsing:

```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "level": "info",
  "service": "whatsapp-bot",
  "message": "Bot de WhatsApp conectado y listo"
}
```

## 🚨 Solución de Problemas

### Bot no se conecta

1. Verifica que el QR se genere: `GET /qr`
2. Asegúrate de escanear el QR con WhatsApp
3. Revisa los logs para errores de autenticación

### Errores de Puppeteer en Railway

1. Verifica que `PUPPETEER_EXECUTABLE_PATH` esté configurado
2. Asegúrate de que `PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true`
3. Revisa que el Dockerfile esté usando la imagen Alpine

### Webhook N8N no recibe mensajes

1. Verifica la URL del webhook en `N8N_WEBHOOK_URL`
2. Asegúrate de que N8N esté accesible desde Railway
3. Revisa los logs para errores de conexión

## 📊 Monitoreo

### Health Check

```bash
GET /health
```

### Métricas de Estado

```bash
GET /status
```

## 🔒 Seguridad

- **Rate Limiting**: 100 requests por 15 minutos
- **Validación de números**: Solo números argentinos válidos
- **Límite de mensajes**: Máximo 4096 caracteres
- **CORS configurado**: Para integración con frontends

## 📈 Rendimiento

### Optimizaciones Implementadas

- **Logging simplificado**: Sin archivos de log
- **Puppeteer optimizado**: Configuración específica para cloud
- **Dependencias reducidas**: Solo lo esencial
- **Docker optimizado**: Imagen Alpine + multi-stage build

### Tiempos de Despliegue

- **Railway con Docker**: ~5-10 minutos
- **Railway con buildpack**: ~3-5 minutos
- **Tamaño del contenedor**: ~200-300MB

## 🤝 Contribución

1. Fork el proyecto
2. Crea una rama para tu feature
3. Commit tus cambios
4. Push a la rama
5. Abre un Pull Request

## 📄 Licencia

MIT License - ver archivo LICENSE para detalles.

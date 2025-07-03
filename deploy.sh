#!/bin/bash

# Script de despliegue para VPS
# Uso: ./deploy.sh

set -e

echo "🚀 Iniciando despliegue del Bot de WhatsApp..."

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Función para imprimir mensajes
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Verificar si Docker está instalado
if ! command -v docker &> /dev/null; then
    print_error "Docker no está instalado. Instalando..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    print_warning "Docker instalado. Por favor, reinicia la sesión y ejecuta el script nuevamente."
    exit 1
fi

# Verificar si Docker Compose está instalado
if ! command -v docker-compose &> /dev/null; then
    print_status "Instalando Docker Compose..."
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
fi

# Verificar archivo .env
if [ ! -f .env ]; then
    print_warning "Archivo .env no encontrado. Creando desde .env.example..."
    if [ -f .env.example ]; then
        cp .env.example .env
        print_status "Archivo .env creado. Por favor, edítalo con tus configuraciones."
    else
        print_error "No se encontró .env.example. Creando .env básico..."
        cat > .env << EOF
# Configuración del Webhook N8N
N8N_WEBHOOK_URL=https://tu-n8n-instance.com/webhook/abc123

# Configuración del Servidor
PORT=3000
NODE_ENV=production

# Configuración de WhatsApp
PUPPETEER_HEADLESS=true
PUPPETEER_ARGS=--no-sandbox,--disable-setuid-sandbox,--disable-dev-shm-usage,--disable-accelerated-2d-canvas,--no-first-run,--no-zygote,--disable-gpu

# Configuración de Logs
LOG_LEVEL=info

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
EOF
        print_warning "Archivo .env creado con configuración básica. Por favor, edítalo."
    fi
    exit 1
fi

# Crear directorio de logs si no existe
mkdir -p logs

# Detener contenedores existentes
print_status "Deteniendo contenedores existentes..."
docker-compose down --remove-orphans 2>/dev/null || true

# Limpiar imágenes antiguas (opcional)
read -p "¿Deseas limpiar imágenes Docker antiguas? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_status "Limpiando imágenes antiguas..."
    docker system prune -f
fi

# Construir y levantar contenedores
print_status "Construyendo imagen Docker..."
docker-compose build --no-cache

print_status "Levantando contenedores..."
docker-compose up -d

# Esperar a que el contenedor esté listo
print_status "Esperando a que el servicio esté listo..."
sleep 10

# Verificar estado del contenedor
if docker-compose ps | grep -q "Up"; then
    print_status "✅ Bot desplegado exitosamente!"
    print_status "📱 API disponible en: http://$(hostname -I | awk '{print $1}'):3000"
    print_status "🔍 Estado del bot: http://$(hostname -I | awk '{print $1}'):3000/status"
    print_status "📋 QR Code: http://$(hostname -I | awk '{print $1}'):3000/qr"
    
    echo
    print_status "Comandos útiles:"
    echo "  Ver logs: docker-compose logs -f"
    echo "  Detener: docker-compose down"
    echo "  Reiniciar: docker-compose restart"
    echo "  Ver estado: docker-compose ps"
    
else
    print_error "❌ Error al desplegar el bot. Revisando logs..."
    docker-compose logs
    exit 1
fi 
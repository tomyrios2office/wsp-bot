#!/usr/bin/env node

/**
 * Script de inicio para el Sistema Bot WhatsApp + N8N
 * Permite elegir entre ejecutar solo el bot o el servidor completo
 */

const readline = require("readline");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const WhatsAppServer = require("./server");

// Colores para la terminal
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
};

function log(message, color = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function createLogsDirectory() {
  const logsDir = path.join(__dirname, "logs");
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
    log("✓ Directorio de logs creado", "green");
  }
}

function checkEnvironment() {
  const envFile = path.join(__dirname, ".env");
  if (!fs.existsSync(envFile)) {
    log("⚠️  Archivo .env no encontrado", "yellow");
    log("Copiando env.example a .env...", "cyan");

    const envExample = path.join(__dirname, "env.example");
    if (fs.existsSync(envExample)) {
      fs.copyFileSync(envExample, envFile);
      log("✓ Archivo .env creado desde env.example", "green");
      log(
        "⚠️  Por favor, edita el archivo .env con tu configuración",
        "yellow"
      );
    } else {
      log("❌ Archivo env.example no encontrado", "red");
      process.exit(1);
    }
  }
}

function checkDependencies() {
  const packageJson = path.join(__dirname, "package.json");
  if (!fs.existsSync(packageJson)) {
    log("❌ package.json no encontrado", "red");
    process.exit(1);
  }

  const nodeModules = path.join(__dirname, "node_modules");
  if (!fs.existsSync(nodeModules)) {
    log("⚠️  Dependencias no instaladas", "yellow");
    log("Instalando dependencias...", "cyan");

    const install = spawn("npm", ["install"], {
      stdio: "inherit",
      cwd: __dirname,
    });

    install.on("close", (code) => {
      if (code === 0) {
        log("✓ Dependencias instaladas correctamente", "green");
        showMenu();
      } else {
        log("❌ Error instalando dependencias", "red");
        process.exit(1);
      }
    });
    return false;
  }
  return true;
}

function showMenu() {
  console.clear();
  log(
    "╔══════════════════════════════════════════════════════════════╗",
    "cyan"
  );
  log(
    "║                Sistema Bot WhatsApp + N8N                    ║",
    "cyan"
  );
  log(
    "║                        Landot                                ║",
    "cyan"
  );
  log(
    "╚══════════════════════════════════════════════════════════════╝",
    "cyan"
  );
  console.log();
  log("Selecciona una opción:", "bright");
  console.log();
  log("1. 🚀 Iniciar servidor completo (Bot + API)", "green");
  log("2. 🤖 Iniciar solo el bot de WhatsApp", "blue");
  log("3. 📡 Iniciar solo el servidor API", "magenta");
  log("4. 🔧 Instalar dependencias", "yellow");
  log("5. 📋 Ver estado del sistema", "cyan");
  log("6. 🚪 Salir", "red");
  console.log();
}

/**
 * Punto de entrada principal de la aplicación
 */
async function main() {
  try {
    console.log("🚀 Iniciando WhatsApp Bot con N8N...");

    const server = new WhatsAppServer();

    // Manejar señales de terminación
    process.on("SIGINT", async () => {
      console.log("\n🛑 Recibida señal SIGINT, cerrando aplicación...");
      await server.stop();
      process.exit(0);
    });

    process.on("SIGTERM", async () => {
      console.log("\n🛑 Recibida señal SIGTERM, cerrando aplicación...");
      await server.stop();
      process.exit(0);
    });

    // Iniciar servidor
    await server.start();

    console.log("✅ Aplicación iniciada correctamente");
    console.log("📱 Bot de WhatsApp listo para recibir mensajes");
    console.log("🔗 API REST disponible en el puerto configurado");
  } catch (error) {
    console.error("❌ Error iniciando la aplicación:", error.message);
    process.exit(1);
  }
}

function installDependencies() {
  log("📦 Instalando dependencias...", "cyan");

  const install = spawn("npm", ["install"], {
    stdio: "inherit",
    cwd: __dirname,
  });

  install.on("close", (code) => {
    if (code === 0) {
      log("✓ Dependencias instaladas correctamente", "green");
    } else {
      log("❌ Error instalando dependencias", "red");
    }
    setTimeout(showMenu, 2000);
  });
}

function showSystemStatus() {
  log("📋 Estado del sistema:", "cyan");
  console.log();

  // Verificar archivos importantes
  const files = [
    { name: "package.json", path: "package.json" },
    { name: ".env", path: ".env" },
    { name: "bot.js", path: "bot.js" },
    { name: "server.js", path: "server.js" },
    { name: "config.js", path: "config.js" },
    { name: "node_modules", path: "node_modules" },
    { name: "logs", path: "logs" },
  ];

  files.forEach((file) => {
    const exists = fs.existsSync(path.join(__dirname, file.path));
    const status = exists ? "✓" : "❌";
    const color = exists ? "green" : "red";
    log(`${status} ${file.name}`, color);
  });

  console.log();

  // Verificar configuración
  try {
    require("./config");
    log("✓ Configuración cargada correctamente", "green");
  } catch (error) {
    log("❌ Error cargando configuración", "red");
    log(`   ${error.message}`, "red");
  }

  console.log();
  log("Presiona Enter para volver al menú...", "yellow");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question("", () => {
    rl.close();
    showMenu();
  });
}

// Ejecutar si se llama directamente
if (require.main === module) {
  main();
}

module.exports = {
  installDependencies,
  showSystemStatus,
};

const PhoneValidator = require("./utils/phoneValidator");

// Probar el número problemático
const testNumber = "5491134083140";

console.log("=== PRUEBA DE VALIDACIÓN DE NÚMERO ===");
console.log("Número original:", testNumber);
console.log("¿Es válido?", PhoneValidator.isValidPhoneNumber(testNumber));
console.log("Normalizado:", PhoneValidator.normalizePhoneNumber(testNumber));
console.log("Formato WhatsApp:", PhoneValidator.toWhatsAppFormat(testNumber));
console.log(
  "Formato para mostrar:",
  PhoneValidator.formatForDisplay(testNumber)
);

console.log("\n=== PRUEBA CON DIFERENTES FORMATOS ===");

const testNumbers = ["5491134083140", "91134083140", "1134083140", "134083140"];

testNumbers.forEach((number) => {
  console.log(`\nNúmero: ${number}`);
  console.log(`  Válido: ${PhoneValidator.isValidPhoneNumber(number)}`);
  console.log(`  Normalizado: ${PhoneValidator.normalizePhoneNumber(number)}`);
  console.log(`  WhatsApp: ${PhoneValidator.toWhatsAppFormat(number)}`);
});

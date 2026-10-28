# Plugger · Edición Gótica

Red social sencilla: cuentas, perfiles, muro de estados y chat en tiempo real con una temática mística y gótica.

## Notas de cambios y diseño gótico
- **Paleta de Colores Gótica:** Integración de tonos ciruela profundo, malva, grises plateados y acentos en rojo vino.
- **Fondo Atmosférico:** Incorporación de la escena gótica nocturna con castillo, luna y murciélagos animados.
- **Tarjeta de Inicio de Sesión Translúcida:** El menú de acceso se encuentra centrado con transparencia translúcida para destacar el fondo gótico sin sacrificar la legibilidad de los campos de datos.

## Cómo correrlo en Visual Studio Code
1. Instala Node.js (https://nodejs.org, versión LTS).
2. Abre esta carpeta en VS Code (Archivo > Abrir carpeta).
3. Abre la terminal (Ctrl + `) y ejecuta:
   npm install
   npm start
4. Entra a http://localhost:3000 y crea una cuenta.

Los datos se guardan en `data.json` (se crea solo). Para desarrollar con recarga automática usa `npm run dev`.

## Archivos
- server.js: servidor (Express + Socket.IO), cuentas, estados y chat
- public/index.html, style.css, app.js: la interfaz y estilos góticos
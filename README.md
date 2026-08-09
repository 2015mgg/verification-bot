# Bot de verificacion por email (OAuth2)

Bot que verifica usuarios pidiendo su email con el consentimiento **explicito** del usuario (pantalla oficial de Discord).

> Nota importante: es imposible obtener la IP de un usuario por la API de Discord. No existe ningun permiso que la exponga. Este bot NO recoge IPs.

## Que hace

1. El usuario ejecuta `/verificar`.
2. Recibe un boton que abre la pantalla oficial de Discord donde aprueba compartir su email.
3. Al aprobar, el bot asigna el rol de verificado y registra usuario + email + navegador/SO (de la cabecera User-Agent de la propia peticion) en el canal de logs.

## Configuracion

1. Crea una aplicacion en https://discord.com/developers/applications
2. En **OAuth2 > General**: guarda `Client ID` y `Client Secret`.
3. En **OAuth2 > Redirects**: anade `http://localhost:3000/callback`.
4. Invita al bot al servidor (scope `applications.commands` y `bot`, permiso para gestionar roles y enviar mensajes).
5. Copia `.env.example` a `.env` y rellena todos los valores.

## Instalacion y uso

```bash
npm install
npm run deploy
npm start
```

## Notas

- `ALLOWED_DOMAINS` (opcional): lista separada por comas de dominios permitidos, ej. `gmail.com,hotmail.com`. Vacio = cualquier correo.
- El enlace de verificacion expira a los 10 minutos.
- Si usas un hosting (no localhost), cambia `REDIRECT_URI` y registrala en el portal de desarrolladores.

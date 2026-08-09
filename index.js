const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  Events,
} = require('discord.js');
const express = require('express');
const crypto = require('crypto');
require('dotenv').config();

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

const {
  BOT_TOKEN,
  CLIENT_ID,
  CLIENT_SECRET,
  GUILD_ID,
  VERIFIED_ROLE_ID,
  LOG_CHANNEL_ID,
  REDIRECT_URI,
  PORT = 3000,
  STATE_SECRET,
  ALLOWED_DOMAINS,
} = process.env;

const app = express();

function createState(payload) {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', STATE_SECRET).update(data).digest('base64url');
  return `${data}.${sig}`;
}

function verifyState(state) {
  if (!state || typeof state !== 'string') return null;
  const [data, sig] = state.split('.');
  if (!data || !sig) return null;
  const expected = crypto.createHmac('sha256', STATE_SECRET).update(data).digest('base64url');
  if (sig !== expected) return null;
  try {
    return JSON.parse(Buffer.from(data, 'base64url').toString());
  } catch {
    return null;
  }
}

function buildOAuthURL(uid) {
  const state = createState({ uid, guild: GUILD_ID, exp: Date.now() + 10 * 60 * 1000 });
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: 'identify email',
    state,
  });
  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

function parseUserAgent(ua) {
  if (!ua) return 'Desconocido';
  let browser = 'Otro';
  if (/Edg\//.test(ua)) browser = 'Edge';
  else if (/Firefox\//.test(ua)) browser = 'Firefox';
  else if (/OPR\//.test(ua) || /Opera/.test(ua)) browser = 'Opera';
  else if (/Chrome\//.test(ua)) browser = 'Chrome';
  else if (/Safari\//.test(ua)) browser = 'Safari';
  let os = 'Desconocido';
  if (/Windows NT 10/.test(ua)) os = 'Windows 10/11';
  else if (/Windows NT 6\.1/.test(ua)) os = 'Windows 7';
  else if (/Mac OS X/.test(ua)) os = 'macOS';
  else if (/Android/.test(ua)) os = 'Android';
  else if (/iPhone|iPad|iPod/.test(ua)) os = 'iOS';
  else if (/Linux/.test(ua)) os = 'Linux';
  return `${browser} en ${os}`;
}

app.get('/health', (req, res) => {
  res.send('ok');
});

app.get('/callback', async (req, res) => {
  const { code, state, error } = req.query;
  const userAgent = parseUserAgent(req.get('user-agent'));
  if (error) return res.status(400).send(`Verificacion cancelada o fallo: ${error}`);
  const payload = verifyState(state);
  if (!payload) return res.status(400).send('Enlace invalido o expirado. Usa /verificar de nuevo.');
  if (payload.exp < Date.now()) return res.status(400).send('Enlace expirado. Usa /verificar de nuevo.');

  try {
    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) return res.status(400).send('No se pudo completar la verificacion.');

    const meRes = await fetch('https://discord.com/api/oauth2/@me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const me = await meRes.json();
    const email = me.email;
    const username = `${me.user.username}#${me.user.discriminator === '0' ? '0' : me.user.discriminator}`;
    const userId = payload.uid;

    if (ALLOWED_DOMAINS) {
      const allowed = ALLOWED_DOMAINS.split(',').map((d) => d.trim().toLowerCase());
      const domain = email.split('@')[1].toLowerCase();
      if (!allowed.includes(domain)) {
        return res.status(403).send('Tu correo no pertenece a un dominio permitido en este servidor.');
      }
    }

    const guild = client.guilds.cache.get(GUILD_ID);
    if (!guild) return res.status(500).send('El bot no esta en el servidor.');

    const member = await guild.members.fetch(userId);
    await member.roles.add(VERIFIED_ROLE_ID);

    const logChannel = guild.channels.cache.get(LOG_CHANNEL_ID);
    if (logChannel) {
      const embed = new EmbedBuilder()
        .setColor(0x00ff88)
        .setTitle('Usuario verificado')
        .addFields(
          { name: 'Usuario', value: username, inline: true },
          { name: 'ID de Discord', value: userId, inline: true },
          { name: 'Email', value: email, inline: true },
          { name: 'Navegador', value: userAgent, inline: true },
          { name: 'Fecha', value: new Date().toLocaleString('es-ES'), inline: true }
        );
      await logChannel.send({ embeds: [embed] });
    }

    res.send('Verificado correctamente. Ya puedes cerrar esta pestana y volver a Discord.');
  } catch (err) {
    console.error(err);
    res.status(500).send('Ocurrio un error durante la verificacion.');
  }
});

app.listen(PORT, () => {
  console.log(`Servidor de callback escuchando en el puerto ${PORT}`);
});

client.once(Events.ClientReady, () => {
  console.log(`Bot conectado como ${client.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== 'verificar') return;

  const url = buildOAuthURL(interaction.user.id);
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel('Verificar con Discord')
      .setStyle(ButtonStyle.Link)
      .setURL(url)
  );
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('Verificacion de cuenta')
    .setDescription(
      'Pulsa el boton y autoriza el acceso a tu email.\n' +
      'Discord te mostrara una pantalla oficial donde apruebas compartir tu correo.\n' +
      'Al completar la verificacion se registra tambien tu navegador y sistema operativo.\n' +
      'No se almacena ninguna otra informacion personal (IP, direccion, etc.).'
    );

  await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
});

client.login(BOT_TOKEN);

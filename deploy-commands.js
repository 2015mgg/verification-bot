const { REST, Routes, SlashCommandBuilder } = require('discord.js');
require('dotenv').config();

const commands = [
  new SlashCommandBuilder()
    .setName('verificar')
    .setDescription('Inicia la verificacion de tu cuenta')
    .setDefaultMemberPermissions(0),
  new SlashCommandBuilder()
    .setName('solo-ver')
    .setDescription('Bloquea la escritura en todos los canales para el rol Sin verificar')
    .setDefaultMemberPermissions(16),
];

const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);

(async () => {
  try {
    await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), {
      body: commands.map((c) => c.toJSON()),
    });
    console.log('Comandos registrados correctamente');
  } catch (error) {
    console.error(error);
  }
})();

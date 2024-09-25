const { REST, Routes } = require("discord.js");
const { log, isSnowflake } = require("../functions.js");
const config = require("../config");
const ExtendedClient = require("../class/ExtendedClient");

/**
 *
 * @param {ExtendedClient} client
 */
module.exports = async (client) => {
    const rest = new REST({ version: "10" }).setToken(
        process.env.CLIENT_TOKEN || config.client.token
    );

    try {
        log("Started loading application commands... (this might take minutes!)", "info");

        const guildId = config.handler.tmpGuildId
        console.log(guildId)

        if (config.development.enabled && guildId) {
            if (!isSnowflake(guildId)) {
                log("Guild ID is missing. Please set it in .env or config file or disable development in the config", "err");
                return;
            };
            
            console.log("CLIENT_ID:", process.env.CLIENT_ID || config.client.id); 
            console.log("Guild ID:", guildId); 
            console.log("Application Commands Array:", client.applicationcommandsArray); 

            await rest.put(
                Routes.applicationGuildCommands(process.env.CLIENT_ID || config.client.id, guildId), {
                    body: client.applicationcommandsArray,
                }
            );

            log(`Successfully loaded application commands to guild ${guildId}.`, "done");
            
        } else {
            await rest.put(
                Routes.applicationCommands(process.env.CLIENT_ID || config.client.id), {
                    body: client.applicationcommandsArray,
                }
            );

            await client.rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID || config.client.id, guildId), { body: [] })
            .then(() => console.log('Successfully deleted all guild commands.'))
            .catch(console.error);

            log("Successfully loaded application commands globally to Discord API.", "done");
        }
    } catch (e) {
        log(`Unable to load application commands to Discord API: ${e.message}`, "err");
    }
};

const config = require("../../config");
const { log } = require("../../functions");
const ExtendedClient = require("../../class/ExtendedClient");
const { EmbedBuilder } = require('discord.js');

const cooldown = new Map();



module.exports = {
    event: "interactionCreate",
    /**
     *
     * @param {ExtendedClient} client
     * @param {import('discord.js').Interaction} interaction
     * @returns
     */
    run: async (client, interaction) => {
        if (!interaction.isCommand()) return;

        if (
            config.handler.commands.slash === false &&
            interaction.isChatInputCommand()
        )
            return;
        if (
            config.handler.commands.user === false &&
            interaction.isUserContextMenuCommand()
        )
            return;
        if (
            config.handler.commands.message === false &&
            interaction.isMessageContextMenuCommand()
        )
            return;

        const command = client.collection.interactioncommands.get(
            interaction.commandName
        );

        if (!command) return;

        try {
            if (command.options?.ownerOnly) {
                const noPermission = new EmbedBuilder()
                    .setTitle('This command is for the server owner only.')
                    .setColor(config.embedSettings.red)
                    
                if (interaction.user.id !== interaction.guild.ownerId) {
                    await interaction.reply({
                        embeds: [noPermission],
                        ephemeral: true
                    });

                    return;
                }
            }

            if (command.options?.developerOnly) {
                const noPermission = new EmbedBuilder()
                    .setTitle('Dev only.')
                    .setColor(config.embedSettings.red)

                if (
                    process.env.OWNER_IDS?.length > 0 &&
                    !process.env.OWNER_IDS?.includes(interaction.user.id)
                ) {
                    await interaction.reply({
                        embeds: [noPermission],
                        ephemeral: true,
                    });

                    return;
                }
            }

            if (command.options?.authorizedOnly) {
                const noPermission = new EmbedBuilder()
                    .setTitle('Haha no you can\'t use this...')
                    .setColor(config.embedSettings.red)
                
                // Replace following with a role check cmd
                /*
                const user = await users.findOne({ userID: interaction.user.id })

                if (
                    !user ||
                    !user.codesActive.length > 0
                ) {
                    await interaction.reply({
                        embeds: [noPermission],
                        ephemeral: true,
                    });

                    return;
                }
                */
            }


            if (command.options?.cooldown) {
                const isGlobalCooldown = command.options.globalCooldown;
                const cooldownKey = isGlobalCooldown ? 'global_' + command.structure.name : interaction.user.id;
                const cooldownFunction = () => {
                    let data = cooldown.get(cooldownKey);

                    data.push(interaction.commandName);

                    cooldown.set(cooldownKey, data);

                    setTimeout(() => {
                        let data = cooldown.get(cooldownKey);

                        data = data.filter((v) => v !== interaction.commandName);

                        if (data.length <= 0) {
                            cooldown.delete(cooldownKey);
                        } else {
                            cooldown.set(cooldownKey, data);
                        }
                    }, command.options.cooldown);
                };

                if (cooldown.has(cooldownKey)) {
                    let data = cooldown.get(cooldownKey);

                    if (data.some((v) => v === interaction.commandName)) {
                        const cooldownMessage = (isGlobalCooldown
                            ? "Jeez slow down! This command is on a global cooldown. ({cooldown}s)."
                            : "Jeez slow down! Our servers can't handle this 😂 ({cooldown}s).").replace(/{cooldown}/g, command.options.cooldown / 1000);

                        await interaction.reply({
                            content: cooldownMessage,
                            ephemeral: true,
                        });

                        return;
                    } else {
                        cooldownFunction();
                    }
                } else {
                    cooldown.set(cooldownKey, [interaction.commandName]);
                    cooldownFunction();
                }
            }

            command.run(client, interaction);
        } catch (error) {
            log(error, "err");
        }
    },
};
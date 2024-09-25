const {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
  ButtonStyle,
  ButtonBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} = require("discord.js");
const { isUrl } = require("check-valid-url");
const ExtendedClient = require("../../../class/ExtendedClient");
const resources = require("../../../schemas/resources");
const config = require("../../../config.json");

const createStringOption = (name, description, required = true) => {
  return (option) =>
    option.setName(name).setDescription(description).setRequired(required);
};

module.exports = {
  structure: new SlashCommandBuilder()
    .setName("resources")
    .setDescription("commands for the resources")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("add")
        .setDescription("Add resource to current channel")
        .addStringOption(createStringOption("title", "Resource title"))
        .addStringOption(
          createStringOption("description", "Short description of resource")
        )
        .addStringOption(createStringOption("link", "Message link"))
        .addStringOption(createStringOption("tag", "Short identifier"))
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("list")
        .setDescription("Lists all current resources in current channel")
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("remove")
        .setDescription("Removes a resource from the current channel")
        .addStringOption(
          createStringOption(
            "tag",
            "Short identifier of the resource you wish to remove"
          )
        )
        .addStringOption(
          createStringOption("why", "Why you wish to remove such resource")
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("view")
        .setDescription("Views a current resource in the channel")
        .addStringOption(
          createStringOption(
            "tag",
            "Short identifier of the resource you wish to view",
            false
          )
        )
    ),
  options: {
    cooldown: 5000,
  },
  /**
   * @param {ExtendedClient} client
   * @param {ChatInputCommandInteraction} interaction
   */
  run: async (client, interaction) => {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "add") {
      // Collect user input for adding a resource
      const title = interaction.options.getString("title");
      const msgLink = interaction.options.getString("link");
      const description = interaction.options.getString("description");
      const tag = interaction.options.getString("tag").toUpperCase();

      const tagSearch = await resources.findOne({
        tag: tag,
        category: interaction.channel.id,
      });

      if (!msgLink.startsWith("https://") && !msgLink.startsWith("http://")) {
        console.log(msgLink.startsWith("https://"))
        return await interaction.reply({
          content: "You must provide a valid message link",
        });
      }

      if (tagSearch) {
        return await interaction.reply({
          content: "There is already a resource with that tag",
        });
      }

      // Example category object (you can get this dynamically from interaction options if needed)
      const category = interaction.channel.id;

      // Create Confirm and Cancel buttons
      const confirm = new ButtonBuilder()
        .setCustomId("confirm")
        .setLabel("Confirm")
        .setStyle(ButtonStyle.Success);

      const cancel = new ButtonBuilder()
        .setCustomId("cancel")
        .setLabel("Cancel")
        .setStyle(ButtonStyle.Danger);

      const row = new ActionRowBuilder().addComponents(cancel, confirm);

      // Create the confirmation embed
      const embed = new EmbedBuilder()
        .setColor(config.embeds.color)
        .setTitle("Confirm")
        .setDescription(
          "Are you sure that you want to create a new resource with these details?"
        )
         .setFooter({ text: 'Called by '+interaction.user.displayName, iconURL: interaction.user.displayAvatarURL({ dynamic: true, size: 1024}) })
        .addFields(
          { name: "Title", value: "`" + title + "`" },
          { name: "Description", value: "`" + description + "`" },
          { name: "Link", value: msgLink },
          { name: "Tag", value: "`" + tag + "`" }
        );

      // Send the confirmation message
      await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });

      // Set up a button collector for interaction
      const filter = (i) => i.customId === "confirm" || i.customId === "cancel";
      const collector = interaction.channel.createMessageComponentCollector({
        filter,
        time: 15000,
      });

      collector.on("collect", async (i) => {
        if (i.customId === "confirm") {
          // Logic for adding the resource to the database
          try {
            // Create a new instance of the resource model
            let newPush = new resources({
              title: title,
              description: description,
              link: msgLink,
              tag: tag.toUpperCase(),
              category: category,
            });

            // Save the new resource instance to the database
            await newPush.save();

            console.log("Resource saved:", newPush);
            await i.update({
              content: "Resource added successfully!",
              components: [],
              embeds: [],
              ephemeral: true,
            });
          } catch (error) {
            console.error("Error saving resource:", error);
            await i.update({
              content: "Failed to add resource. Please try again later.",
              components: [],
              embeds: [],
              ephemeral: true,
            });
          }
        } else if (i.customId === "cancel") {
          await i.update({
            content: "Resource creation canceled.",
            components: [],
            embeds: [],
          });
        }
      });

      collector.on("end", (collected) => {
        if (collected.size === 0) {
          interaction.editReply({
            content: "Timed out, no action taken.",
            components: [],
          });
        }
      });
    } else if (subcommand === "list") {
      // Logic for listing resources
      const channelResources = await resources.find({
        category: interaction.channel.id,
      });
      if (!channelResources.length) {
        return interaction.reply({
          content: "No resources found in this channel.",
          ephemeral: true,
        });
      }

      const listEmbed = new EmbedBuilder()
        .setColor(config.embeds.color)
        .setTitle("Resources List")
        .setDescription("Here are the current resources for this channel:")
         .setFooter({ text: 'Called by '+interaction.user.displayName, iconURL: interaction.user.displayAvatarURL({ dynamic: true, size: 1024}) })
        .addFields(
          channelResources.map((res) => ({
            name: res.title,
            value: `**[Message Link](${res.link})** - Tag: \`${res.tag}\``,
          }))
        );

      interaction.reply({ embeds: [listEmbed], ephemeral: true });
    } else if (subcommand === "remove") {
      const tag = interaction.options.getString("tag").toUpperCase();
      const reason = interaction.options.getString("why"); // Optional reason for removal

      // Fetch the resource based on tag and channel
      const resource = await resources.findOne({
        tag: tag,
        category: interaction.channel.id,
      });

      if (!resource) {
        return interaction.reply({
          content: `No resource found with tag \`${tag}\``,
          ephemeral: true,
        });
      }

      // Create Confirm and Cancel buttons
      const confirm = new ButtonBuilder()
        .setCustomId("confirm-remove")
        .setLabel("Confirm")
        .setStyle(ButtonStyle.Success);

      const cancel = new ButtonBuilder()
        .setCustomId("cancel-remove")
        .setLabel("Cancel")
        .setStyle(ButtonStyle.Danger);

      const row = new ActionRowBuilder().addComponents(cancel, confirm);

      // Create the confirmation embed
      const embed = new EmbedBuilder()
        .setColor(config.embeds.color)
        .setTitle("Confirm Resource Deletion")
         .setFooter({ text: 'Called by '+interaction.user.displayName, iconURL: interaction.user.displayAvatarURL({ dynamic: true, size: 1024}) })
        .setDescription(
          `Are you sure you want to remove the resource with tag \`${tag}\`?`
        )
        .addFields(
          { name: "Title", value: resource.title },
          { name: "Reason", value: reason || "No reason provided." }
        );

      // Send the confirmation message
      await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });

      // Set up a button collector for interaction
      const filter = (i) =>
        i.customId === "confirm-remove" || i.customId === "cancel-remove";
      const collector = interaction.channel.createMessageComponentCollector({
        filter,
        time: 15000,
      });

      collector.on("collect", async (i) => {
        if (i.customId === "confirm-remove") {
          // Logic for removing the resource from the database
          try {
            await resources.findOneAndDelete({
              tag: tag,
              category: interaction.channel.id,
            });

            await i.update({
              content: `Resource with tag \`${tag}\` has been removed successfully.`,
              components: [],
              embeds: [],
              ephemeral: true,
            });
          } catch (error) {
            console.error("Error removing resource:", error);
            await i.update({
              content: "Failed to remove resource. Please try again later.",
              components: [],
              embeds: [],
              ephemeral: true,
            });
          }
        } else if (i.customId === "cancel-remove") {
          await i.update({
            content: "Resource removal canceled.",
            components: [],
            embeds: [],
          });
        }
      });

      collector.on("end", (collected) => {
        if (collected.size === 0) {
          interaction.editReply({
            content: "Timed out, no action taken.",
            components: [],
          });
        }
      });
    } else if (subcommand === "view") {
      const tag = interaction.options.getString("tag"); // Get the tag option provided by the user
      const channelResources = await resources.find({
        category: interaction.channel.id,
      });

      // Check if resources exist in the channel
      if (!channelResources.length) {
        return interaction.reply({
          content: "No resources found in this channel.",
          ephemeral: true,
        });
      }

      if (tag) {
        // If a tag is provided, fetch the resource directly
        const resource = await resources.findOne({
          tag: tag.toUpperCase(),
          category: interaction.channel.id,
        });

        if (!resource) {
          return interaction.reply({
            content: `No resource found with tag \`${tag}\``,
            ephemeral: true,
          });
        }

        // Create and send the embed for the resource associated with the tag
        const viewEmbed = new EmbedBuilder()
          .setColor(config.embeds.color)
          .setTitle(resource.title)
           .setFooter({ text: 'Called by '+interaction.user.displayName, iconURL: interaction.user.displayAvatarURL({ dynamic: true, size: 1024}) })
          .addFields(
            { name: "Link", value: resource.link },
            {
              name: "Description",
              value: resource.description || "No description provided.",
            },
            { name: "Tag", value: resource.tag },
            { name: "Category", value: resource.category }
          );

        return interaction.reply({ embeds: [viewEmbed], ephemeral: false }); // Directly send the embed
      } else {
        // Create a select menu for tags if no tag is provided
        const tagOptions = channelResources.map((res) =>
          new StringSelectMenuOptionBuilder()
            .setLabel(res.tag)
            .setValue(res.tag)
        );

        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId("selectTag")
          .setPlaceholder("Select a tag to view")
          .addOptions(tagOptions);

        const row = new ActionRowBuilder().addComponents(selectMenu);

        // Send the select menu to the user
        await interaction.reply({
          content: "Please select a tag to view:",
          components: [row],
          ephemeral: true
        });

        // Set up a collector for the select menu
        const filter = (i) =>
          i.customId === "selectTag" && i.user.id === interaction.user.id;
        const collector = interaction.channel.createMessageComponentCollector({
          filter,
          time: 15000,
        });

        collector.on("collect", async (i) => {
          const selectedTag = i.values[0]; // Get the selected tag value

          // Fetch the resource associated with the selected tag
          const resource = await resources.findOne({
            tag: selectedTag,
            category: interaction.channel.id,
          });

          if (!resource) {
            return i.reply({
              content: `No resource found with tag \`${selectedTag}\``,
              ephemeral: true,
            });
          }

          // Create and send the embed for the selected resource
          const viewEmbed = new EmbedBuilder()
            .setColor(config.embeds.color)
            .setTitle(resource.title)
             .setFooter({ text: 'Called by '+interaction.user.displayName, iconURL: interaction.user.displayAvatarURL({ dynamic: true, size: 1024}) })
            .addFields(
              { name: "Link", value: resource.link },
              {
                name: "Description",
                value: resource.description || "No description provided.",
              },
              { name: "Tag", value: resource.tag },
              { name: "Category", value: resource.category }
            );

          await i.reply({ embeds: [viewEmbed], ephemeral: false });
          collector.stop(); // Stop the collector after a selection
        });

        collector.on("end", (collected) => {
          if (collected.size === 0) {
            interaction.editReply({
              content: "Timed out, no action taken.",
              components: [],
            });
          }
        });
      }
    } else {
      interaction.reply({ content: "Unknown subcommand.", ephemeral: true });
    }
  },
};

const { Client, Intents } = require("discord.js");
const Discord = require("discord.js");
const { MessageEmbed } = require("discord.js");
const express = require("express");
const {
  token,
  embedColor,
  adminRole,
  adminUser,
  verifiedUser,
  prefix,
  SPREADSHEET_ID,
} = require("./config.js");
const authorize = require("./sheets.js");
const { google } = require("googleapis");
const { auth } = require("google-auth-library");
const fs = require("fs");

const app = express();
const client = new Client({
  intents: [
    Intents.FLAGS.GUILDS,
    Intents.FLAGS.GUILD_MEMBERS,
    Intents.FLAGS.GUILD_MESSAGES,
    Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
  ],
});

client.on("ready", () => {
  console.log(`Logged in as ${client.user.tag}!`);
  client.user.setPresence({
    status: "online",
    activities: [
      {
        name: "Wild Rift In-House",
        type: "WATCHING",
      },
    ],
  });
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  let command = args.shift().toLowerCase();

  const embed = new Discord.MessageEmbed().setColor(embedColor);

  if (command === "nick") {
    const newNickname = args.join(" ");

    if (!newNickname) {
      const embed = new Discord.MessageEmbed()
        .setColor(embedColor)
        .setTitle("Please provide a new nickname.")
        .setDescription("Kindly follow the example below.")
        .addFields(
          {
            name: `Usage:`,
            value: `${prefix}nick [IGN#TAG]`,
          },
          {
            name: `Example:`,
            value: `${prefix}nick KUZAKEN#1014`,
          }
        );

      return message.reply({ embeds: [embed] });
    }

    // Ask the user to attach or send a file
    const attachmentEmbed = new MessageEmbed()
      .setColor(embedColor)
      .setDescription(
        `Please send the screenshot of your **wild rift profile** to proceed with your nickname request. You have 1 hour to do so.`
      )
      .setFooter({ text: "DO NOT DELETE YOUR MESSAGE" });

    const attachmentMessage = await message.reply({
      embeds: [attachmentEmbed],
    });

    try {
      // Create a message collector to listen for file attachments
      const attachmentFilter = (msg) =>
        msg.author.id === message.author.id && msg.attachments.size > 0;
      const attachmentCollector = message.channel.createMessageCollector({
        filter: attachmentFilter,
        time: 60 * 60 * 1000,
      }); // Collector will last for 1 hour

      attachmentCollector.on("collect", async (msg) => {
        try {
          // Stop the attachment collector when a file is attached
          attachmentCollector.stop();

          // Continue with the nickname change request

          // Send an embed with the nickname request
          const embed = new MessageEmbed()
            .setColor(embedColor)
            .setTitle("Nickname Request")
            .setDescription(
              `${msg.author.username} has requested to change their nickname to: \`${newNickname}\``
            )
            .setFooter({ text: "React with ✅ to accept or ❌ to deny." });

          const nickRequestMessage = await message.reply({
            content: "<@&864451453493444608> <@&769232252331884585>",
            embeds: [embed],
          });

          // Add reaction buttons to the message
          await nickRequestMessage.react("✅"); // Accept button
          await nickRequestMessage.react("❌"); // Deny button

          // Create a collector to listen for reaction interactions
          const filter = (reaction, user) =>
            ["✅", "❌"].includes(reaction.emoji.name) &&
            user.id !== client.user.id;
          const collector = nickRequestMessage.createReactionCollector({
            filter,
            time: 24 * 60 * 60 * 1000,
          }); // Collector will last for 24 hours

          collector.on("collect", async (reaction, user) => {
            try {
              // Ensure that the user has the admin role
              if (
                adminRole.some((roleId) =>
                  message.guild.members.cache
                    .get(user.id)
                    ?.roles.cache.has(roleId)
                )
              ) {
                if (reaction.emoji.name === "✅") {
                  const member = message.guild.members.cache.get(msg.author.id);

                  if (member) {
                    try {
                      await member.setNickname(newNickname);

                      // Give the user the specified role
                      const roleToAdd =
                        message.guild.roles.cache.get("933996717639077909"); // Replace with the actual role ID
                      if (roleToAdd) {
                        member.roles.add(roleToAdd);
                      }

                      // Send an embed DM to the requestor
                      const acceptEmbed = new MessageEmbed()
                        .setColor(embedColor)
                        .setDescription(
                          `Your nickname request for \`${newNickname}\` has been approved.`
                        );

                      await msg.author.send({ embeds: [acceptEmbed] });

                      // Log the accepted nickname change with attachment
                      const logsChannel = message.guild.channels.cache.get(
                        "1143424075696451604"
                      ); // Replace with the actual channel ID
                      if (logsChannel) {
                        const logEmbed = new MessageEmbed()
                          .setColor(embedColor)
                          .setTitle("Nickname Change Accepted")
                          .addFields(
                            {
                              name: "Username",
                              value: `${msg.author.tag} (<@${msg.author.id}>)`,
                              inline: false,
                            },
                            {
                              name: "New Nickname",
                              value: `${newNickname}`,
                              inline: false,
                            },
                            {
                              name: "Moderator",
                              value: `${user.tag}`,
                              inline: false,
                            }
                          )
                          .setImage(msg.attachments.first().url) // Set the image URL
                          .setFooter({
                            text: `ID: ${
                              msg.author.id
                            } | ${new Date().toLocaleString()}`,
                          }); // Add user ID and time to the footer
                        logsChannel.send({ embeds: [logEmbed] });
                      }

                      // Log the accepted nickname change with attachment
                      const logsScreenshots = message.guild.channels.cache.get(
                        "1148231289028227132"
                      ); // Replace with the actual channel ID
                      if (logsScreenshots) {
                        logsScreenshots.send(
                          `${msg.author.id}\n` + msg.attachments.first().url
                        );
                      }
                    } catch (error) {
                      console.error("Failed to send DM or add role:", error);
                      // Handle the error, perhaps send a message to the channel
                      message.channel.send(
                        "Failed to send a direct message, but the nickname change was processed."
                      );
                    }

                    // Send the replyEmbed to the channel even if DM is closed
                    const replyEmbed = new MessageEmbed()
                      .setColor(embedColor)
                      .setTitle("Nickname Request Approved")
                      .setDescription(`Kindly close this ticket. Thank you!`);

                    await message.reply({ embeds: [replyEmbed] });
                  }

                  collector.stop();
                } else if (reaction.emoji.name === "❌") {
                  // Send an embed DM to the requestor
                  const denyEmbed = new MessageEmbed()
                    .setColor(embedColor)
                    .setDescription(
                      `Your nickname request for \`${newNickname}\` has been denied.`
                    );
                  msg.author.send({ embeds: [denyEmbed] });

                  const replyEmbed = new MessageEmbed()
                    .setColor(embedColor)
                    .setTitle("Nickname Request Denied")
                    .setDescription(`Please try again.`);

                  await message.reply({ embeds: [replyEmbed] });
                  collector.stop();
                }
              } else {
                const embed = new MessageEmbed()
                  .setColor(embedColor)
                  .setDescription(
                    "You do not have permission to accept or deny nickname requests."
                  );
                message.reply({ embeds: [embed] }).then((reply) => {
                  setTimeout(() => {
                    reply.delete();
                  }, 5000); // 5 seconds (5,000 milliseconds)
                });
              }
            } catch (error) {
              console.error(
                "An error occurred while handling the collector collect event:",
                error
              );
            }
          });

          collector.on("end", async () => {
            try {
              // Ensure that the channel still exists
              const channel = message.client.channels.cache.get(
                message.channel.id
              );
              if (!channel) {
                console.error("Channel not found.");
                collector.stop();
                return;
              }

              // Remove the reactions after the collector ends
              await nickRequestMessage.reactions
                .removeAll()
                .catch(console.error);

              // Edit the message to remove the footer
              await nickRequestMessage.edit({
                embeds: [
                  embed.setDescription(
                    `${msg.author.username} has requested to change their nickname to: ${newNickname}`
                  ),
                ],
                components: [],
              });
            } catch (error) {
              console.error(
                "An error occurred while handling the collector end event:",
                error
              );
            }
          });
        } catch (error) {
          console.error(
            "An error occurred while handling the collector collect event:",
            error
          );
        }
      });

      attachmentCollector.on("end", (collected, reason) => {
        try {
          if (reason === "time" && collected.size === 0) {
            message.channel.send(
              "Nickname change request has been canceled due to inactivity."
            );
            attachmentMessage
              .delete()
              .catch((error) =>
                console.error("Failed to delete attachment message:", error)
              );
          }
        } catch (error) {
          console.error(
            "An error occurred while handling the collector end event:",
            error
          );
        }
      });
    } catch (error) {
      console.error(
        "An error occurred while handling the attachment collector:",
        error
      );
    }
    } else if (command === "stats") {
      const os = require("os");

      const botUptime = process.uptime();
      const botPing = message.client.ws.ping;
      const systemUptime = os.uptime();
      const botMemoryUsage = process.memoryUsage().rss / 1024 / 1024;
      const systemMemoryUsage = (os.totalmem() - os.freemem()) / 1024 / 1024;

      const embed = new Discord.MessageEmbed()
        .setColor(embedColor)
        .setTitle("Wild Rift Automate Stats")
        .addFields(
          {
            name: "Bot Uptime",
            value: `\`\`\`${Math.floor(botUptime / 3600)}h ${Math.floor(
              (botUptime % 3600) / 60
            )}m ${Math.floor(botUptime % 60)}s\`\`\``,
            inline: true,
          },
          {
            name: "Bot Ping",
            value: `\`\`\`${botPing}ms\`\`\``,
            inline: true,
          },
          {
            name: "System Uptime",
            value: `\`\`\`${Math.floor(systemUptime / 3600)}h ${Math.floor(
              (systemUptime % 3600) / 60
            )}m ${Math.floor(systemUptime % 60)}s\`\`\``,
            inline: true,
          },
          {
            name: "Bot Memory Usage",
            value: `\`\`\`${botMemoryUsage.toFixed(2)} MB\`\`\``,
            inline: true,
          },
          {
            name: "System Memory Usage",
            value: `\`\`\`${systemMemoryUsage.toFixed(2)} MB\`\`\``,
            inline: true,
          },
          {
            name: "Bot Version",
            value: `\`\`\`${Discord.version}\`\`\``,
            inline: true,
          }
        )
        .setFooter({
          text: "Wild Rift In-House • " + new Date().toLocaleString(),
          iconURL:
            "https://media.discordapp.net/attachments/987317494039592972/987384673258836068/IN_HOUSE_LOGO.png?width=468&height=468",
        });

      message.reply({ embeds: [embed] });
    }
});

client.login(token);

app.get("/", (req, res) => {
  res.send("Bot is running!");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

//Discord
require('dotenv').config();
const Discord = require('discord.js');
const client = new Discord.Client();
client.login(process.env.DISCORDJS_BOT_TOKEN);
//Manga

const {getManga} = require('./scrapper');

const pref = '$';

function getMessageContent(message, starter) {

    return message.content.split(starter).pop().trim();
}

function views(num) {
    if (num >= 1000000000) {
        return (num / 1000000000).toFixed(1).replace(/\.0$/, '') + 'G';
    }
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    }
    if (num >= 1000) {
        return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    }
    return num;
}

async function runBot () {

    client.on('ready', () => {

        console.log(`${client.user.tag} has logged in.`)
    })
    client.on('unhandledRejection', (err) => {

        console.log(err)
    })

    client.on('message', async (message) => {

        if (!message.content.startsWith(pref) || message.author.bot) return;

        const content = message.content.slice(pref.length).trim().split(/ +/);
        const command = content.shift().toLowerCase();
        const name = content.join(' ');

        //DISPLAY MANGA
        if (command === 'm') {

            const loading = new Discord.MessageEmbed()
                .setTitle(`Searching for ${name}`)
                .setThumbnail('https://media0.giphy.com/media/Xdv29zqFlaSlO/giphy.gif?cid=ecf05e479dd4e5dd356363eb0e82be3f6244d7245a2e966b&rid=giphy.gif');

            const embed = await message.channel.send(loading);

            if (!name || !name.length){
                await sendMessage(message, `\nPlease provide a correct name`, false);
                return;
            }

            await displayManga(message, name, null, embed, 0)
        }
    })
/*
    client.on('messageReactionAdd' || 'messageReactionRemove', async (reaction, user) => {

        let message = reaction.message, emoji = reaction.emoji;

        const filter = (reaction, user) => {
            return ['⬅️', '➡️'].includes(reaction.emoji.name) && user.id === message.author.id;
        };
        if (filter) {

            if (emoji.name === '➡️') {
                if (actualManga.mangaList[counter] !== actualManga.mangaList[actualManga.mangaList.length-1]) {
                    await displayManga(message, name, actualManga, embed, counter + 1);
                }
            }

            if (emoji.name === '⬅') {
                if (actualManga.mangaList[counter] !== actualManga.mangaList[actualManga.mangaList.length-1]) {
                    await displayManga(message, name, actualManga, embed, counter - 1);
                }
            }

        }
    })*/
}

async function displayManga (message, name, manga, embed, counter) {

    let actualManga = {};

    if (manga)
        actualManga = await getManga(name, manga.mangaList, counter);
    else
        actualManga = await getManga(name, [], counter);

    if(!actualManga.title) {
        await sendMessage(message, `\n'${name}' was not foud\n\nTry something else`, false);
        return;
    }
    const filter = (reaction, user) => {
        return ['⬅️', '➡️'].includes(reaction.emoji.name) && user.id === message.author.id;
    };
    const actualEmbed = createEmbedManga(actualManga);

    //await embed.edit(loading);
    embed.edit(actualEmbed).then( async embed => {

        await embed.react('⬅️');
        await embed.react('➡️');



        embed.awaitReactions(filter, {
            max: 1,
            time: 15000,
            errors: ['time']
        }).then(async collected => {

            const reaction = collected.first()

            switch (reaction.emoji.name) {

                case '⬅️':
                    if (actualManga.mangaList[counter] !== actualManga.mangaList[0]){

                        await displayManga(message, name, actualManga, embed, counter - 1);
                    }

                    break;
                case '➡️':
                    if (actualManga.mangaList[counter] !== actualManga.mangaList[actualManga.mangaList.length-1]) {
                        await displayManga(message, name, actualManga, embed, counter + 1);
                    }

                    break;
            }
        })
            .catch(async collected =>{
                await embed.reactions.removeAll();
            })
    });
}

function createEmbedManga(manga) {

    return new Discord.MessageEmbed()
        .setColor('BLUE')
        .setTitle(`${manga.title}`)
        .setURL(manga.titleUrl)
        .setThumbnail(manga.image)
        .addField(`Chapter ${manga.latestChapter} available on`, `${manga.hyperLink}`)
        .addField('Views', `:eye: ${views(manga.views)}`, true)
        .addField('Rating', `:star: ${manga.rating}`, true)
        .addField(`Author`, `${manga.flag} ${manga.author}`, true)
        .addField(`Theme: `, `${manga.tags}`)
}

async function sendMessage(message, title, success = true) {

    const badge = success ? ' Success :white_check_mark:' : 'Error :no_entry:';
    await message.channel.send(new Discord.MessageEmbed().addField(badge , title).setColor(success ? 'GREEN' : 'RED'));
}

function sendManga() {

}

module.exports = {
    runBot
}
/*

    Tea-bot
    © Fajsiex 2018-2019
    Licensed under MIT license
    For a full license, go to LICENSE file.
    TL;DR of license: use this as you want just include the license somewhere.
    
*/

// As soon as the bot starts up we print a message so we know at least it's working
console.log("Tea-bot project");
console.log("Copyright 2018-2019 FajsiEx (Licensed under MIT license - see LICENSE.md for more information)");
console.log("[BOT] Starting...");

// Import modules

const colors = require('colors');
const discord = require('discord.js');
const discordClient = new discord.Client(); // Creates a discordClient

// Configuration
const discordBotCongig = {
    token: process.env.DISCORD_BOT_TOKEN // Gets discord bot token from the enviromental variables
};
colors.setTheme({
    debug: 'grey',
    info: 'blue',
    success: 'green',
    interval: 'magenta',
    event: 'cyan',
    warn: ['bgYellow', 'black'],
    error: 'bgRed'
});

// Global veriables definition
let starting = true;

require('./modules/globalVariables').init();

const msgHandler = require('./modules/msgHandler');
const globalVariables = require("./modules/globalVariables");
const COLORS = require("./modules/consts").COLORS;
const VERSION = require("./modules/consts").VERSION;

const startupTest = require("./modules/tests/startup");
if (!startupTest()) {
    console.error("[TEST_FAIL] Startup test failed. Exiting.");
    process.exit(201);
}

discordClient.on('error', console.error);

// GREETING
discordClient.on('guildMemberAdd', member => {
    let channel = member.guild.channels.find(ch => ch.name === 'talk');
    if (!channel) {return;}
    channel.send(`Vítaj, ${member}! Nezabudni si dať svoje IRL meno ako nickname.`);
});

// Discord client init
discordClient.on('ready', ()=>{
    console.log(`[EVENT] Ready`.event);

    if (process.env.DISABLE_SAVE != "yes") {
        discordClient.fetchUser("342227744513327107").then((user)=>{ // Fetch the admin user
            user.send({
                "embed": {
                    "title": "Bot launched",
                    "color": COLORS.GREEN,
                    "description": `
                        Tea-bot (version ${VERSION}) has been launched and is ready for use.
                    `
                }
            });
        });
    }
    
    if (process.env.DISABLE_SAVE == "yes") {
        discordClient.channels.get("527170494613422092").send({
            "embed": {
                "title": "Bot launched",
                "color": COLORS.YELLOW,
                "description": `
                    Tea-bot launched in beta mode.
                    Saving is therefore disabled.
                `
            }
        });
    }

    starting = false;
    setStatus();
});

discordClient.on('message', (msg)=>{
    console.log(`[EVENT] Message: ${msg.author.username + "#" + msg.author.discriminator}: ${msg.content}`.event);
    msgHandler(msg, discordClient);
});

discordClient.on('presenceUpdate', (oldMember, newMember)=>{
    if (newMember.presence.game) {
        console.log(`[EVENT] Presence update: ${newMember.user.username}#${newMember.user.discriminator} [${newMember.presence.status}] - Playing ${newMember.presence.game.toString()}`.event);
    }else{
        console.log(`[EVENT] Presence update: ${newMember.user.username}#${newMember.user.discriminator} [${newMember.presence.status}] - Playing nothing`.event);
    }
    
});

// TODO: move this to it's own module
let setStatus = ()=>{
    console.log("[SET_STATUS] Setting activity...".interval);

    if (globalVariables.get('disableStatus')) {
        console.warn("[SET_STATUS] Status disabled. ABORT!".warn);
        return;
    }
    if (starting) {
        console.warn("[SET_STATUS] Bot starting. ABORT!".warn);
        return;
    }
    
    let hours = new Date().getHours();

    let statusText = "your messages";
    let statusType = "WATCHING";
    let statusStatus = "online";

    if (hours < 5) {
        statusText = "you sleep";
    }

    let modModeOn = globalVariables.get("modModeOn");

    if (modModeOn) {
        statusStatus = "dnd";
        statusText = "nothing";
    }

    /*
    endStamp = new Date("Sun Jan 08 2019 08:00:00 GMT+0100").getTime();
    nowStamp = new Date().getTime();
    deltaStamp = endStamp - nowStamp;

    days = Math.floor(deltaStamp / 86400000);
    deltaStamp -= days * 86400000;

    hours = Math.floor(deltaStamp / 3600000);
    deltaStamp -= hours * 3600000;      
    minutes = Math.floor(deltaStamp / 60000);
    deltaStamp -= minutes * 60000;

    seconds = Math.floor(deltaStamp / 1000);

    statusText += `${days} dní, ${hours} hodín, ${minutes} minút do konca prázdnin`
    */

    let commsServed = globalVariables.get("commandsServed");
    if (!commsServed) {
        commsServed = "loading number of";
    }
    
    discordClient.user.setStatus(statusStatus).then(()=>{
        discordClient.user.setActivity(statusText + " | !help | v." + VERSION + " | " + commsServed + " commands served", { type: statusType }).then(()=>{
            console.log("[SET_STATUS] Completed.".success);
        });
    });
};

let request = require("request");
let prevLvl = 0;

let setRankNick = ()=>{
    let osuRankMember = globalVariables.get('osuRankMember');
    if (!osuRankMember) {
        console.log("[OSU_RANK] No member. Aborting.".warn);
        return;
    }

    request({
        url: `https://osu.ppy.sh/api/get_user?k=${process.env.OSUAPI}&u=fajsiex`,
        json: true
    }, (err, res, data)=>{
        if (!err && res.statusCode == 200) {
            console.dir(data);

            let lvl = Math.round(data[0].level * 1000) / 1000;
            if (lvl == prevLvl) {
                console.log("[OSU_RANK] Lvl same as prevLvl. Aborting.".info);
                return;
            }
            prevLvl = lvl;

            let nick = `FajsiEx [lvl.${lvl} osu! boss]`;
            console.log(`[OSU_RANK] Set nick to "${nick}"`.success);

            osuRankMember.setNickname(nick);
        }else{
            console.log("[OSU_RANK] Failed to connect to Bancho.".warn);
        }
    });
};

setInterval(setStatus, 15000);
setInterval(setRankNick, 15000);

let express = require("express");
let app = express();

app.get("/logs", (req, res)=>{
    let logData = globalVariables.get("logData");
    let logString = "";

    logData.forEach(e => {
        console.log("D: [EXPRESS] getLogs route E:" + JSON.stringify(e));
        logString+=`[${new Date(e.time).toString()}] <b>${e.type}</b> - ${e.data} <br>`;
    });

    res.send("<h1>Logs</h1>" + logString);
});

globalVariables.set("startTime", new Date().getTime());

let port = process.env.PORT || 3000;
app.listen(port, function() {
    console.log(("[WEB_SERVER] Listening. Port:" + port).success);
});

// ED
discordClient.login(discordBotCongig.token);
console.log("[BOT] Started.".success);

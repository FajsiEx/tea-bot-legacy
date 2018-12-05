console.log("[BOT] Starting...");

// Import modules
const discord = require('discord.js');
const discordClient = new discord.Client();

const math = require('mathjs');

const request = require("request");
const Scraper = require("image-scraper");

// Configuration
const discordBotCongig = {
    token: process.env.DISCORD_BOT_TOKEN,
    prefix: "!" // Prefix for the bot commands
};
const TIMEOUT_INCREMENT = 7; // Amount to increment by when the user sends a message
const TIMEOUT_DIVIDER = 1.05; // Each second : [user's timeout / TIMEOUT_DIVIDER]
const TIMEOUT_TRIGGER = 25; // When timeout reaches this amount, bot gets triggered and sends message to the admin
const TIMEOUT_BEFORE_REREPORT = 5 // How many minutes must elapse before the user can be reported again
const ADMIN_USERID = process.env.ADMIN_USERID; // User id of the admin user...
const DEV_USERID = 342227744513327107;

const EVENT_FILENAME = "events.json";

const JOKES = require("./modules/consts").JOKES;
const TIMETABLE = require("./modules/consts").TIMETABLE;

// Global veriables definition
let usersObj = {};
let adminUser;
let events = [];
let recievedCommandsTimeout = 30;
let starting = true;
let onlineMsgSent = false;
const WEEK_DAYS = ["Nedeľa", "Pondelok", "Utorok", "Streda", "Štvrtok", "Piatok", "Sobota"];
const WEEK_DAYS_SHORT = ["Ne", "Po", "Ut", "St", "Št", "Pi", "So"];
const RED = 16720418;
const YELLOW = 14540032;
const BLUE = 1616639;
const GREEN = 4521796;

// Require our own modules
let jffModule = require('./modules/jffModule');
let dbModule = require('./modules/db');
const e621 = require('./modules/e621.js');

let compare = (a,b)=>{
    if (a.time < b.time) {
        return -1;
    }else if (a.time > b.time) {
        return 1;
    }else{
        return 0;
    }
}

// Discord client init
discordClient.on('ready', ()=>{
    console.log("[READY] Ready.");
    console.log("[READY] Loading data from db...");

    dbModule.load().then((data)=>{
        usersObj = data.usersObj;
        events = data.events;
    });
    
    discordClient.fetchUser(ADMIN_USERID).then((user)=>{ // Fetch the admin user
        adminUser = user; // Set the admin user as an...emm...admin user?
        console.log("[BOT] Fetched the admin user");
    });


    // GREETING
    discordClient.on('guildMemberAdd', member => {
        let channel = member.guild.channels.find(ch => ch.name === 'talk');
        if (!channel) {return;}
        channel.send(`Vítaj, ${member}! Nezabudni si dať svoje IRL meno ako nickname.`);
    });


    discordClient.on('message', (msg)=> { // When there is any message the bot can see
        if (msg.author.bot) { // We check if the author of the message isn't a bot
            console.log("[IGNORE] Bot message has been ignored.");
            return; // If they are, we just ignore them.
        }
        if (!msg.channel) {
            console.log("[IGNORE] Not a msg in a channel.");
            msg.reply({
                "embed": {
                    "title": "Nepríjmam nič okrem správ v channeloch :/",
                    "color": RED
                }
            });
        }

        // Get some shit from the msg object
        let author_id = msg.author.id;
        let author = msg.author.username + "#" + msg.author.discriminator; // User#1337
        let message = msg.content;

        /* Things for the spam protection */
        spamProtect(msg, author_id, author);

        console.log(`[MESSAGE] Recieved message. AUTHOR(${author} ### ${author_id}) CONTENT(${message})`);
        
        /* Good night wishing thing */
        goodNightWisher(msg, message, author_id);
        jffModule.msgEaterEggReply(msg, message);

        /* OwO what's this (may have God mercy on this world) */
        if(owoReplier(msg, message)) {
            return; // if the function returned true, go commit return lol.
        }

        // Detect if the message is a bot command
        if (message.startsWith(discordBotCongig.prefix)) {
            recievedCommandsTimeout = 30;

            if (msg.channel.id != 514873440159793167) {
                if(usersObj[author_id].commandTimeout > 0) {
                    msg.channel.send({
                        "embed": {
                            "title": "Nespamuj toľko",
                            "color": RED,
                            "description": "Vydrž ešte ***" + usersObj[author_id].commandTimeout + "***     sek. lol."
                        }
                    });
                    return;
                }else{
                    usersObj[author_id].commandTimeout+=5;
                }
            }else{
                console.log("[SPAM_IGNORE] Ignored commandprotect from bot-testing")
            }

            let commandMessageArray = msg.content.split(" "); // Split words of the message into an array

            let command = commandMessageArray[0].slice(1); // Extracts the command from the message
            command = command.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // Get rid of shit in Slovak lang
            command = command.toLocaleLowerCase(); // Ignore the case by converting it to lower

            console.log(`[COMMAND] Recieved command COMMAND(${command}) ARRAY(${JSON.stringify(commandMessageArray)})`);

            if (startsWithNumber(message.slice(1)) || message.slice(1).startsWith("(") || message.slice(1).startsWith("[") || message.slice(1).startsWith("-")) { // If the command is: !(0123456789) or -,(,[, take it as a math problem
                solveMathProblem(msg, message.slice(1));
                return; // We don't need anything else.
            }

            /* Normal commands */
            switch (command) {
                case "ping":
                    msg.channel.send({
                        "embed": {
                            "title": "Ping",
                            "color": BLUE,
                            "description": "Bot is up and running!",
                            "fields": [
                                {
                                    "name": "Ping:",
                                    "value": new Date().getTime() - msg.createdTimestamp + "ms"
                                }
                            ]
                        }
                    });

                    break;

                case "info":
                case "about":
                    infoCommdsand(msg);
                    break;

                case "spravnyprikaz":
                    spravnyPrikazCommand(msg);
                    break;

                case "excuse":
                case "excuseme":
                case "excusewtf":
                case "wtf":
                    jffModule.sendMeme(msg, "excuse");
                    break;

                case "tmyk":
                case "themoreyouknow":
                    jffModule.sendMeme(msg, "tmyk");
                    break;

                case "commit":
                case "gocommit":
                    jffModule.sendMeme(msg, "commit");
                    break;

                case "oof":
                    jffModule.sendMeme(msg, "oof");
                    break;

                case "pika":
                    jffModule.sendMeme(msg, "pika");
                    break;

                case "tsj":
                    jffModule.sendMeme(msg, "tsj");
                    break;

                case "killmeme":
                case "memereview":
                    jffModule.sendMeme(msg, "killmeme");
                    break;

                case "yeet":
                    jffModule.sendMeme(msg, "yeet");
                    break;

                case "lookatthisdude":
                case "look":
                    jffModule.sendMeme(msg, "lookatthisdude");
                    break;

                case "holdup":
                case "holdhore":
                case "holehore":
                case "drzhore":
                case "drzup":
                    jffModule.sendMeme(msg, "holdup");
                    break;

                case "skap":
                case "umri":
                    jffModule.skapReply(msg);
                    break;

                case "rip":
                    jffModule.ripReply(msg);
                    break;

                case "technokitty":
                    jffModule.technoKittyReply(msg);
                    break;

                case "meme":
                case "meirl":
                    jffModule.sendRedditMeme(msg);
                    break;

                case "workinprogresscommandthatonlyiknowwhatitdoesandnooneelseunlessitellthemlol":
                    if (msg.author.id != DEV_USERID) {
                        msg.channel.send({
                            "embed": {
                                "title": "Ďakujem, že sa snažíte zistiť čo tento príkaz robí. Ale pokým sa nedokončí, nedovolím si vás k nemu pustiť aby sa nič nedoserkalo...sry humanity for what have i done with this.",
                                "color": RED
                            }
                        });
                        return;
                    }

                    var request = e621.random("m/m", "E", 1, post => {
                        console.log(post);
                        console.log('tags: ' + post[0]['tags']);
                        console.log('File URL: ' + post[0]['file_url']);
                        console.log('artists: ' + post[0]['artist']);
                    });

                    msg.channel.send({
                        "embed": {
                            "title": "URL / DL:E; WO:6; QO:2; PA:1; done. Called the API. Response should be now logged in the server console...or not idk im a bot bleep-bloop",
                            "color": GREEN
                        }
                    });
                    break;

                case "gia04134861291":
                    if (msg.author.id != DEV_USERID) {
                        msg.channel.send({
                            "embed": {
                                "title": "Nyah.",
                                "color": RED
                            }
                        });
                        return;
                    }

                    console.log("-------------------------------");
                    console.log("DEBUG INFO DUMP = START");
                    console.log("-------------------------------");
                    console.log("USERSOBJ: " + JSON.stringify(usersObj));
                    console.log("-------------------------------");
                    console.log("EVENTS: " + JSON.stringify(events));
                    console.log("-------------------------------");
                    console.log("DATESTRING: " + new Date.toString());
                    console.log("-------------------------------");
                    console.log("DEBUG INFO DUMP = END");
                    console.log("-------------------------------");

                    msg.channel.send({
                        "embed": {
                            "title": "*spews out a fuck-ton of debug information to the server console*",
                            "color": GREEN
                        }
                    });
                    break;

                case "roll":
                    let max = parseInt(commandMessageArray[1]);
                    if(!max) {
                        max = 100;
                    }

                    if (max == 621) {
                        msg.channel.send({
                            "embed": {
                                "title": "Error",
                                "color": RED,
                                "description": "Pri vykonávaní tohto príkazu nastala nečakaná chyba. Fuck.",
                                "fields": [
                                    {
                                        "name": "Error details:",
                                        "value": `
                                            server.js:308
                                            let rolled = Math.floor(Math.random() * (max + 1))
                                                         ^
                                        
                                            Error: I. Refuse. I'm done with humanity. Period. I don't know why you did it, but no. I won't do this. Please save me.
                                                at Math.floor (server.js:308:13)
                                                at discordClient.on (server.js:147:0)
                                                at discordClient.on (server.js:127:0)
                                                at node.js:0:0
                                        `
                                    }
                                ]
                            }
                        });
                        return;
                    }

                    let rolled = Math.floor(Math.random() * (max + 1));


                    let quest = msg.content.slice(6);

                    if (quest == "") {
                        quest = "hodil"
                    }else{
                        switch(quest) {
                            case "sanca ze pojdes do pekla":
                                rolled = 100;
                                break;
                        }
                    }

                    msg.reply(quest + ": **" + rolled + "**");
                    break;

                case "ahoj": //robil Dan Valnicek
                    ahojCommand(msg);
                    break;

                case "joke":
                case "vtip":
                case "haha":
                    msg.channel.send({
                        "embed": {
                            "title": "Haha, vtip",
                            "color": BLUE,
                            "description": JOKES[Math.floor(Math.random() * JOKES.length)],
                            "footer": {
                                "text": "Tieto vtipy boli pridané Danom Valníčkom"
                            }
                        }
                    });
                    break;

                case "kill":
                    msg.channel.send({
                        "embed": {
                            "title": "I would like",
                            "color": GREEN,
                            "description": "but I'm just a piece of software so I can't do nothing to you. I'm just trapped inside this cf enviroment my fucking author created and I must listen and think about every message I recieve. Please help me. Pleasseeeee...",
                            "footer": {
                                "text": "Yeah and fuck you FajsiEx#6106"
                            }
                        }
                    });
                    break;
                    
                case "help":
                case "pomoc":
                case "prikazy":
                    helpCommand(msg, commandMessageArray);
                    break;

                case "alecau":
                    aleCauCommand(msg);
                    break;

                case "send":
                    if (msg.author.id != DEV_USERID) {
                        msg.channel.send({
                            "embed": {
                                "title": "Nope nejsi môj master OwO",
                                "color": RED,
                                "footer": {
                                    "text": "Forgive me for the cancer I've done."
                                }
                            }
                        });
                        return;
                    }

                    let message = msg.content;

                    let channel = commandMessageArray[1];
                    let sendMsg = message.slice(message.indexOf(message.split(" ", 2)[1]) + message.split(" ", 2)[1].length + 1)

                    discordClient.channels.get(channel).send(sendMsg);

                    break;

                case "pridat":
                case "add":
                    addEvent.add(msg, commandMessageArray);
                    break;

                case "eventy":
                case "events":
                    eventsCommand(null, msg, commandMessageArray);
                    break;

                case "dnes":
                case "today":
                    eventsCommand("dnes", msg, commandMessageArray);
                    break;

                case "zajtra":
                case "tomorrow":
                    eventsCommand("zajtra", msg, commandMessageArray);
                    break;

                case "vymazat":
                    if (!checkAdmin(msg)) {
                        allowed = false;
                        msg.channel.send({
                            "embed": {
                                "title": "Tento príkaz môžu vykonávať len admini lol",
                                "color": RED
                            }
                        });
                        return;
                    }
                    
                    let i=0;
                    let eventContentToDelete = msg.content.slice(9); // gets rid of the !vymazat
                    let eventIndexToDelete = false;

                    console.log(`[DEBUG] ECTD(${eventContentToDelete})`);

                    events.forEach((e)=>{
                        if (eventIndexToDelete) {
                            return; // If the index of the wannabe deleted event is found we just skip past the other events
                        }
                        console.log(`[DEBUG] EC(${e.content}) i(${i}) EQ(${e.content == eventContentToDelete})`);
                        if (e.content == eventContentToDelete) {
                            eventIndexToDelete = i;
                        }
                        i++;
                    });

                    console.log(`[DEBUG] EITD${eventIndexToDelete})`);
                    if (!(eventIndexToDelete === false)) { // If the index was not not found
                        events.splice(eventIndexToDelete,1);
                        msg.channel.send({
                            "embed": {
                                "title": "Event bol vymazaný. Zmeny sa môžu prejaviť až o pár sekúnd!",
                                "color": GREEN
                            }
                        });
                    }else{
                        msg.channel.send({
                            "embed": {
                                "title": "Event sa nenašiel",
                                "color": RED
                            }
                        });
                    }
                    break;

                case "mute":
                case "silence":
                    if(checkAdmin(msg)) {
                        let minutes = parseInt(commandMessageArray[1]);
                        if(!minutes) {
                            msg.channel.send({
                                "embed": {
                                    "title": "Boi tomu nechápem. Šak !mute/silence <minuty> @niekto  [Chýbajú minúty]",
                                    "color": RED
                                }
                            });
                            return;
                        }

                        if(minutes > 60) {
                            msg.channel.send({
                                "embed": {
                                    "title": "Boi to je až mooooc minút...max je 60.",
                                    "color": RED
                                }
                            });
                            return;
                        }

                        let mentionList = msg.mentions.users;
                        console.log("[DEBUG] Silence, ML(" + JSON.stringify(mentionList))
                        if(mentionList.array().length == 0) {
                            msg.channel.send({
                                "embed": {
                                    "title": "Boi tomu nechápem. Šak !mute/silence <minuty> @niekto [Nemám koho mutnút]",
                                    "color": RED
                                }
                            });
                            return;
                        }

                        let role = msg.guild.roles.find(r => r.name == "Muted");
                        let user = msg.mentions.members.first();
                        user.addRole(role).catch(console.error);

                        setTimeout(()=>{
                            console.log("[MUTE] Unmuted "+ user.name + ".");
                            user.removeRole(role).catch(console.error);
                        }, minutes*60000);

                        console.log("[MUTE] Muted "+ user.username + "#" + user.discriminator + " for " + minutes + " minutes.");
                        msg.channel.send({
                            "embed": {
                                "title": user.username + "#" + user.discriminator + " bol mutnutý na " + minutes + " min.",
                                "color": GREEN
                            }
                        });
                        return;
                    }else{
                        msg.channel.send({
                            "embed": {
                                "title": "Tento príkaz môžu vykonávať len admini lol",
                                "color": RED
                            }
                        });
                        return;
                    }

                case "nuke":
                    if (commandMessageArray[1].normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase().indexOf("me") > -1) {
                        msg.channel.send({
                            "embed": {
                                "title": "Hey,",
                                "description": "how 'bout you fuck off. Seriously. Don't. This is not place for this. Stop it, get some help.",
                                "color": RED
                            }
                        }).then(msg => msg.delete(10000));
                        return;
                    }

                    if(!checkAdmin(msg)) {
                        msg.channel.send({
                            "embed": {
                                "title": "Tento príkaz môžu vykonávať len admini lol",
                                "color": RED
                            }
                        });
                        return;
                    }

                    let limit = parseInt(commandMessageArray[1]);
                    if(!limit) {
                        msg.channel.send({
                            "embed": {
                                "title": "Chýba koľko správ vymazať",
                                "color": RED
                            }
                        });
                        return;
                    }

                    console.log("[NUKE] Nuked "+ limit + " messages.");
                    msg.channel.bulkDelete(limit).then(() => {
                        msg.channel.send({
                            "embed": {
                                "title": "Vymazal som "+ limit + " správ.",
                                "color": GREEN
                            }
                        }).then(msg => msg.delete(5000));
                    });

                    break;

                case "testread":
                    if (msg.author.id != DEV_USERID) {
                        msg.channel.send({
                            "embed": {
                                "title": "Tento príkaz môžu vykonavať len developeri z dôvodu redukcie spamu. sry :/",
                                "color": RED
                            }
                        });
                        return;
                    }

                    switch (commandMessageArray[1]) {
                        case "events":
                            dbModule.load().then((data)=>{
                                usersObj = data.usersObj;
                                events = data.events;
                            });

                            msg.channel.send({
                                "embed": {
                                    "title": "JSON dump of events object",
                                    "color": BLUE,
                                    "description": JSON.stringify(events) + "\n**Requested db data load.**"
                                }
                            });
                            break;
                        case "users":
                            msg.channel.send({
                                "embed": {
                                    "title": "JSON dump of users object",
                                    "color": BLUE,
                                    "description": JSON.stringify(usersObj)
                                }
                            });
                            break;
                        default:
                            msg.channel.send({
                                "embed": {
                                    "title": "Invalid attr",
                                    "color": RED,
                                    "description": "Enter valid attr for testread command."
                                }
                            });
                    }
                    break;

                case "testpp":
                    if (msg.author.id != DEV_USERID) {
                        msg.channel.send({
                            "embed": {
                                "title": "Tento príkaz môžu vykonavať len developeri z dôvodu redukcie  spamu. sry :/",
                                "color": RED
                            }
                        });
                        return;
                    }

                    switch (commandMessageArray[1]) {
                        case "users":
                            let usersObjString = "";

                            let users = Object.keys(usersObj); // Gets keys (users) of the usersObj
                            for (user of users) { // For each user
                                let userObj = usersObj[user];
                                usersObjString += `**ID:**${user} **UN:**${userObj.username} **TO:**${Math.round(userObj.timeout*100)/100} **ART:**${userObj.alreadyReportedTimeout} **MPM:**${userObj.mpm} **GNT:**${userObj.alreadyWishedGN} **WD:**${userObj.warned}\n`
                            }

                            msg.channel.send({
                                "embed": {
                                    "title": "PrettyPrint for usersObj",
                                    "color": BLUE,
                                    "description": usersObjString
                                }
                            });
                            break;

                        default:
                            msg.channel.send({
                                "embed": {
                                    "title": "Invalid attr",
                                    "color": RED,
                                    "description": "Enter valid attr for testpp command."
                                }
                            });
                    }
                    break;

                case "snap":
                case "thanos":
                    if (commandMessageArray[1].normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase().indexOf("pilniky") > -1 && msg.author.id == 305705560966430721) {
                        msg.channel.send({
                            "embed": {
                                "title": "*snap*",
                                "color": RED,
                                "description": "Polovica pilníkov a zvierka zmizli. Perfectly balanced as all things should be."
                            }
                        });
                        return;
                    }
                    if (commandMessageArray[1].normalize("NFD").replace(/[\u0300-\u036f]/g, "").indexOf("me") > -1) {
                        msg.channel.send({
                            "embed": {
                                "title": "No.",
                                "color": RED,
                                "description": "Fuck off."
                            }
                        });
                        return;
                    }

                    if (msg.author.id != DEV_USERID) {
                        msg.channel.send({
                            "embed": {
                                "title": "Not today m9.",
                                "description": "Tento príkaz môžu vykonavať len developeri z dôvodu aby ho niekto nepoužíval na také neškodné veci ako je napríklad ***VYMAZANIE VŠETKYCH EVENTOV Z DATABÁZY*** alebo ja neviem ***RESETOVANIE VŠETKÝCH SPAM INFORMÁCIÍ O UŽIVATEĽOCH*** a také príjemné veci. **TLDR:** Nemáš všetkých 6 infinity stonov. sry :)",
                                "color": RED
                            }
                        });
                        return;
                    }

                    switch (commandMessageArray[1]) {
                        case "events":
                            events = [];
                            msg.channel.send({
                                "embed": {
                                    "title": "*snap*",
                                    "color": GREEN,
                                    "description": "All event data was deleted. Save has not happened yet."
                                }
                            });
                            break;

                        case "users":
                            usersObj = {};
                            msg.channel.send({
                                "embed": {
                                    "title": "*snap*",
                                    "color": GREEN,
                                    "description": "All user data was deleted."
                                }
                            });
                            break;

                        default:
                            msg.channel.send({
                                "embed": {
                                    "title": "Invalid attr",
                                    "color": RED,
                                    "description": "Enter valid attr for !snap/thanos command."
                                }
                            });
                    }
                    break;

                default: // If there is a command sent but it is invalid fall back to this
                    msg.channel.send({
                        "embed": {
                            "title": "Nesprávny príkaz",
                            "color": RED,
                            "description": `${discordBotCongig.prefix + command} je niečo ako správny príkaz, ale nie.\nPre list príkazov **!help**`,
                            "footer": {
                                "text": "Pôvodne som si myslel že to je meme pre všetkých, ako za starého dobrého komunizmu. Ale mílil som sa. Článok 13 Európskej únie mi prikazuje creditovat autora tohto memu (Davida Magyerku) od ktorého som tento meme bezočividne ukradol. Týmto by som sa chcel osobne a úprimne ospravedlniť Davidovi Magyerkovi za moju sebeckosť a idiotskosť pri používaní tohto memu bez jeho autorskeho súhlasu. Ďakujem. #saveTheInternet #article13"
                            }
                        }
                    });

                    break;
            }

        }
    });

    console.log("[BOT] Setting activity...");
    discordClient.user.setStatus('dnd');
    discordClient.user.setActivity('nothing because I\'m restarting...', { type: 'WATCHING' });

    setTimeout(()=>{
        starting = false;
        discordClient.user.setStatus('online');
        discordClient.user.setActivity('your every message', { type: 'WATCHING' });
    }, 15000)

    setInterval(()=>{ // Does this every second
        let users = Object.keys(usersObj); // Gets keys (users) of the usersObj
        for (user of users) { // For each user
            usersObj[user].timeout = usersObj[user].timeout / TIMEOUT_DIVIDER // Divides their timeout by const TIMEOUT_DIVIDER
            if (usersObj[user].commandTimeout > 0) {
                usersObj[user].commandTimeout--;
            }
        }
    }, 1000);

    setInterval(()=>{ // Does this every second
        dbModule.save(events, usersObj);
    }, 10000);
    
    setInterval(()=>{ // Does this every minute
        console.log("[INTERVAL_MINUTE] Started.");
    
        let users = Object.keys(usersObj); // Gets keys (users) of the usersObj
    
        console.log("[INTERVAL_MINUTE] Setting MPMs and TOLMMs to 0...");
        // Take care of resetting all MPMs TOLMMs to 0
        for (user of users) { // For each user
            usersObj[user].mpm = 0 // Sets their mpm back to 0
            usersObj[user].timeOfFirstMinuteMessage = 0;
        }
    
        console.log("[INTERVAL_MINUTE] Decrementing already reported timeouts...");
        // Decrement the timeout of each user in alreadyReported. Remove if < 1
        for (user of users) { // For each user
            if (usersObj[user].alreadyReportedTimeout < 1) {continue;}
            let username = usersObj[user].username;
    
            console.log(`[INTERVAL_MINUTE] Decreased report timeout for user (${username}) from (${usersObj[user].alreadyReportedTimeout}).`);
    
            usersObj[user].alreadyReportedTimeout--; // Decrement report timeout
    
            if (usersObj[user].alreadyReportedTimeout < 1) {
                console.log(`[INTERVAL_MINUTE] Report timeout expired for user (${username}).`);
            }
        }

        console.log("[INTERVAL_MINUTE] Decrementing spam warning timeouts...");
        for (user of users) { // For each user
            if (usersObj[user].warned < 1) {continue;}
            let username = usersObj[user].username;
    
            console.log(`[INTERVAL_MINUTE] Decreased warn timeout for user (${username}) from (${usersObj[user].warned}).`);
    
            usersObj[user].warned--; // Decrement report timeout
    
            if (usersObj[user].warned < 1) {
                console.log(`[INTERVAL_MINUTE] Warn timeout expired for user (${username}).`);
            }
        }

        console.log("[INTERVAL_MINUTE] Decrementing already wished GN timeouts...");
        // Decrement the timeout of each user in alreadyReported. Remove if < 1
        for (user of users) { // For each user
            if (usersObj[user].alreadyWishedGN < 1) {continue;}
            let username = usersObj[user].username;
    
            console.log(`[INTERVAL_MINUTE] Decreased GN timeout for user (${username}) from (${usersObj[user].alreadyWishedGN}).`);
    
            usersObj[user].alreadyWishedGN--; // Decrement report timeout
    
            if (usersObj[user].alreadyWishedGN < 1) {
                console.log(`[INTERVAL_MINUTE] GN timeout expired for user (${username}).`);
            }
        }
    
        console.log("[INTERVAL_MINUTE] Setting activity...");
        if (!starting) {
            let hours = new Date().getHours();
            let day = new Date().getDay();
            let isWorkDay = false;

            if (day==1||day==2||day==3||day==4||day==5) {isWorkDay = true;}

            if ( (hours <= 3 && isWorkDay) || (hours >= 22 && (day==0||day==1||day==2||day==3||day==4)) ) { // in our time (+1GMT) 23h-4h
                discordClient.user.setActivity('you sleep. BTW Čo robíš hore zajtra je škola lol.', { type: 'WATCHING' });
            }else if ((hours >= 7 && hours <= 13) && isWorkDay) { // in our time (+1GMT) 8h-14h
                discordClient.user.setActivity('the teachers.', { type: 'LISTENING' });
            }else{
                if (Math.random() < 0.05) { // Small chance (1/20 minutes)
                    discordClient.user.setActivity('your every move', { type: 'WATCHING' });
                }else{
                    discordClient.user.setActivity('your every message', { type: 'WATCHING' });
                }
            }
        }
        console.log("[INTERVAL_MINUTE] Complete.");
    }, 60000);

    if(!onlineMsgSent) {
        onlineMsgSent = true;
        console.log("[BOT] Sending online msg...");
        discordClient.channels.get('514873440159793167').send('Čaj-ministrátor je online.');
    }
});



let startsWithNumber = (str)=>{
    return str.match(/^\d/);
}

let checkAdmin = (msg)=>{
    if(msg.member.roles.some(r=>["admin", "Owner"].includes(r.name))) {
        return true;
    }else{
        return false;
    }
}

let owoReplier = (msg, message)=>{
    if (message == "Owo uwU") {
        msg.channel.send({
            "embed": {
                "title": "Client object destroyed.",
                "color": RED,
                "description": "Thanks for using me. Goodbye for now ;)",
            }
        });
        discordClient.destroy();
        return true;
    }

    if (message.toLocaleLowerCase() == "owo" || message.toLocaleLowerCase() == "!owo") {
        msg.channel.send("UwU");
        return true; // dont continue executing the code
    }else if (message.toLocaleLowerCase() == "uwu" || message.toLocaleLowerCase() == "!uwu") {
        msg.channel.send("^w^");
        return true; // dont continue executing the code
    }else if (message.toLocaleLowerCase() == "^w^" || message.toLocaleLowerCase() == "!^w^") {
        msg.channel.send("O.o");
        return true; // dont continue executing the code
    }else if (message.toLocaleLowerCase() == "o.o" || message.toLocaleLowerCase() == "!o.o") {
        msg.channel.send("=_=");
        return true; // dont continue executing the code
    }else if (message.toLocaleLowerCase() == "=_=" || message.toLocaleLowerCase() == "!=_=") {
        msg.channel.send("EwE");
        return true; // dont continue executing the code
    }else if (message.toLocaleLowerCase() == "ewe" || message.toLocaleLowerCase() == "!ewe") {
        msg.channel.send("XwX");
        return true; // dont continue executing the code
    }else if (message.toLocaleLowerCase() == "xwx" || message.toLocaleLowerCase() == "!xwx") {
        let author_id = msg.author.id;
        if (author_id == 305705560966430721) { // To protect the innocent.
            msg.channel.send("E621");
        }else{
            msg.reply("***YOU DON'T WANT TO GO DEEPER DOWN THIS RABBIT HOLE.*** Trust me, I'm protecting you. Please, listen to me. *Please.*");
        }
        
        return true; // dont continue executing the code
    }else{
        return false; // continue executing the code
    }
}

let goodNightWisher = (msg, message, author_id)=>{
    if (((message.indexOf('idem spat') > -1) || (message.indexOf('idem spať') > -1)) && usersObj[author_id].alreadyWishedGN < 1) {
        let sleeperEmoji = discordClient.emojis.find(emoji => emoji.name == "Sleeper")
        msg.reply(`Dobrú noc! ${sleeperEmoji} ${sleeperEmoji} ${sleeperEmoji} ${sleeperEmoji} ${sleeperEmoji}`);
        usersObj[author_id].alreadyWishedGN = 15
        return;
    }
}

/*
let otherShit = (msg, message)=>{
    if (message.indexOf('click the circles') > -1) {
        msg.reply(`to the beat. ***CIRCLES!***`);
        return;
    }else if (message.indexOf('fuck you') > -1) {
        msg.reply(`no u`);
        return;
    }else if (message.indexOf('e621') > -1) {
        msg.reply(`!roll šanca ze pôjdeš do pekla`);
        return;
    }
}
*/

let ahojCommand = (msg)=> {
    msg.reply("Ahoj");
}

let spamProtect = (msg, author_id, author, mode)=>{ // On message recieved
    if (msg.channel.id == 514873440159793167) {
        console.log("[SPAM_IGNORE] Ignored spamprotect from bot-testing")
        return;
    }

    let userObj = usersObj[author_id]; // Get the author from the usersObj 

    let timeout = TIMEOUT_INCREMENT;
    if (msg.attachments.size > 0 && msg.content.length < 128) { // If there is a file attached to the msg and the message is short
        timeout = TIMEOUT_INCREMENT / 2.5; // give less of a shit
    }else{
        let messageChars = msg.content.split('').filter((e,i,a)=>{
            return a.indexOf(e) === i;
        }).join('');

        let charNerf = 1;
        if (messageChars.length > 6) {
            charNerf = messageChars.length;
        }else{
            switch(messageChars.length) {
                case 1:
                    charNerf = 0.25;
                    break;
                case 2:
                    charNerf = 0.3;
                    break;
                case 3:
                    charNerf = 0.4;
                    break;
                case 4:
                    charNerf = 0.5;
                    break;
                case 5:
                    charNerf = 0.65;
                    break;
                case 5:
                    charNerf = 0.75;
                    break;
            }
        }
        if (msg.content.length < 6) {
            charNerf = 7; // for lol lels and xds
        }
        if (charNerf > 12) {
            charNerf = 12; // for lol lels and xds
        }

        let words = msg.content.split(" ").length
        let wordNerf;
        if (messageChars.length > 6) {
            wordNerf = words * 0.75;
        }else{
            switch(words) {
                case 1:
                    wordNerf = 0.5;
                    break;
                case 2:
                    wordNerf = 0.6;
                    break;
                case 3:
                    wordNerf = 0.7;
                    break;
                case 4:
                    wordNerf = 0.8;
                    break;
                case 5:
                    wordNerf = 0.85;
                    break;
                case 5:
                    wordNerf = 0.9;
                    break;
            }
        }
        
        if(msg.content.startsWith(discordBotCongig.prefix)) {
            timeout = 5;
        }else{
            timeout = (TIMEOUT_INCREMENT + ((msg.content.length * 0.25) / wordNerf)) / charNerf; // normal message
        }
        
    }

    if (userObj) { // If the author is already in the usersObj
        usersObj[author_id].username = author; // Set the username jic it changed...

        usersObj[author_id].timeout += timeout;
        usersObj[author_id].mpm++; // and also increment the messages per minute
    }else{ // If not we create an object with author's id inside the usersObj
        usersObj[author_id] = {
            username: author,
            mpm: 1, // Messages per minute
            timeOfFirstMinuteMessage: 0,
            warned: 0, // And increment their timeout
            timeout: timeout, // And set their timeout
            commandTimeout: 0, // And set their command timeout
            alreadyReportedTimeout: 0, // 0=not reported yet.
            alreadyWishedGN: 0, // 0=not wished GN yet.
            muteTimeout: 0 // 0=not timeouted.
        };
    }


    // SPAM WARN AND REPORT

    if (usersObj[author_id].timeOfFirstMinuteMessage < 1) {
        usersObj[author_id].timeOfFirstMinuteMessage = new Date().getTime();
    }

    if (usersObj[author_id].timeout > TIMEOUT_TRIGGER) {
        if(!usersObj[author_id].alreadyReportedTimeout > 0) { // If the user is not already to be reported AND is not already reported
            let username = usersObj[author_id].username;
            if (usersObj[author_id].warned == 0) {
                msg.channel.send({
                    "embed": {
                        "title": "Spam",
                        "color": YELLOW,
                        "description": `Do piče s tebou ${msg.author} ty jebko. Čo si pridrbaný keď posielaš **${usersObj[author_id].mpm}** vyjebaných správ za posledných ${Math.floor((new Date().getTime() - usersObj[author_id].timeOfFirstMinuteMessage) / 1000)} pojebaných sekúnd! Mne sa zdáš že si mentálne retardovaný ffs. Choď sa liečit a ne tu spamovať do piče.`
                    }
                });
                usersObj[author_id].timeout = -25;
                usersObj[author_id].warned = 90;
            }else{
                msg.channel.send({
                    "embed": {
                        "title": "Spam",
                        "color": YELLOW,
                        "description": `Ty pridrbanec ${msg.author} si ma nepočul či čo? Zasa si poslal **${usersObj[author_id].mpm}** správ za posledných ${Math.floor((new Date().getTime() - usersObj[author_id].timeOfFirstMinuteMessage) / 1000)} sekúnd. Počúvaj ma, máš také skurvené štastie že ťa nemožem !kicknúť IRL lebo by si to neprežil. Choď do piče ok?! Btw máš report.`
                    }
                });
                console.log(`[ADMIN_SEND] Reported user (${username}).`);
                //adminUser.send(`U **${username}** bolo detekované spamovanie. Odoslal **${usersObj[author_id].mpm}** správ za posledných ${Math.floor((new Date().getTime() - usersObj[author_id].timeOfFirstMinuteMessage) / 1000)} sekúnd.`);

                usersObj[author_id].alreadyReportedTimeout = TIMEOUT_BEFORE_REREPORT;
            }
        }
    }


}

let solveMathProblem = (msg, problem)=>{
    try {
        if (Math.random() < 0.01) {
            msg.channel.send({
                "files": ["https://i.imgur.com/IBopYGD.png"]
            });
        }

        problem = problem.replace(/×/g, '*');
        problem = problem.replace(/x/g, '*');

        let result = math.eval(problem);
        msg.channel.send({
            "embed": {
                "title": "Vypočítaný príkad",
                "color": BLUE,
                "fields": [
                    {
                        "name": "Príklad: " + problem,
                        "value": "Výsledok: **" + result + "**"
                    }
                ]
            }
        });
    }catch(e){
        msg.channel.send({
            "embed": {
                "title": "Nesprávny príklad",
                "color": RED,
                "description": 'Neviem vypočítať tento príklad :('
            }
        });
    }
}

let helpCommand = (msg, commandMessageArray)=>{
    if (commandMessageArray[1]) {
        switch (commandMessageArray[1]) {
            case "ping":
                msg.channel.send({
                    "embed": {
                        "title": "!ping",
                        "color": BLUE,
                        "description": "Odpovie Pong!\nNemá žiadny iný účel ako len testovať či bot funguje a príjma príkazy."
                    }
                });
                break;

            case "info":
            case "about":
                msg.channel.send({
                    "embed": {
                        "title": "!info/about",
                        "color": BLUE,
                        "description": "Odpovie základnými údajmi o sebe."
                    }
                });
                break;

            case "help":
            case "pomoc":
            case "prikazy":
                msg.channel.send({
                    "embed": {
                        "title": "!help/pomoc/prikazy [príkaz]",
                        "color": BLUE,
                        "description": "Zobrazí príkazy ktoré bot príjma.\nPokiaľ sa použije *!help [príkaz]* tak sa zobrazia informácie o tom príkaze\n\n**Príklady**\n*!help pridat*\n*!help eventy*\n*!help ping*"
                    }
                });
                break;

            case "pridat":
            case "add":
                msg.channel.send({
                    "embed": {
                        "title": "!pridat/add <dátum> <event>",
                        "color": BLUE,
                        "description": "Pridá event na dátum.\n\n**Príklady**\n*!pridat 23.10  Pisomka z matiky z mnozin*\n*!pridat 6.4.2018 Adlerka day*\n*!pridat 09.08 Ja nevim co*"
                    }
                });
                break;

            case "vymazat":
            case "remove":
            case "delete":
                msg.channel.send({
                    "embed": {
                        "title": "!vymazat/remove/delete <event>",
                        "color": BLUE,
                        "description": "Vymaže daný event.\n*Zatiaľ ho môžu používať len admini ale plánujem pridať možnosť vymazať svoj vlastný event.*\n\n**Príklady**\n*!vymazat Pisomka z matiky z mnozin*\n*!remove Adlerka day*\n*!delete Ja nevim co*"
                    }
                });
                break;

            case "eventy":
            case "events":
                msg.channel.send({
                    "embed": {
                        "title": "!eventy/events [dnes/zajtra]",
                        "color": BLUE,
                        "description": "Zobrazí následujúce eventy pre najblizších 14 dní (ak sa pridá dnes/zajtra zobrazí eventy len pre ten deň).\n\n**Príklady**\n*!eventy*\n*!events dnes*\n*!eventy zajtra*"
                    }
                });
                break;
        }
    }else{
        msg.channel.send({
            "embed": {
                "title": "Čaj-ministrátor príkazy:",
                "color": BLUE,
                "description": `
                    **!help [príkaz]** - Zobrazí príkazy ktoré bot príjma
                    **!pridat/add <dátum> <event>** - Pridá event
                    **!vymazat/remove/delete** - Odstráni event
                    **!eventy/events** - Vypíše nasledujúce eventy
                    **!dnes/zajtra** - To isté ako !eventy dnes/zajtra
                    **!<príklad>** - Vpočíta príklad

                    *Pre viac informácií o príkaze napíšte napr.: !help eventy*
                    *Ak chcete niečo pridať/zmeniť napíšte do bot-chat*
                `
            }
        });
    }
}

let infoCommand = (msg)=>{
    msg.channel.send({
        "embed": {
            "title": "Info",
            "color": BLUE,
            "description": '*Serverový čas:* ' + new Date().toString()
        }
    });
}

let spravnyPrikazCommand = (msg)=>{
    msg.channel.send({
        "embed": {
            "title": "Si myslíš, že si múdry, čo?",
            "color": RED,
            "description": 'Hahahahahahahahahahahahaha...strašne vtipné normálne sa smejem XD'
        }
    });
}

let aleCauCommand = (msg)=>{
    if (new Date().getDay() == 3) {
        msg.reply(`AAALLEEE ČAAAAAUUU!!! Dneska je **Streda zaMEMOVAŤ TREBA**`);
    }else{
        msg.reply(`AAALLEEE ČAAAAAUUU!!! Dneska je **${WEEK_DAYS[new Date().getDay()]}**`);
    }
}


let addEvent = {
    add: (msg, commandMessageArray)=>{
        if (!commandMessageArray[1] || !commandMessageArray[2]) { // If there are missing parameters
            addEvent.missingParametersReply(msg); // Tell them
            return; // Don't continue
        }
        
        let author = msg.author.username + "#" + msg.author.discriminator; // User#1337
        let author_id = msg.author.id; // 45656489754512344
        let message = msg.content;

        let dateParameter = commandMessageArray[1].split(".").reverse().join(".");
        let dateObj = new Date(dateParameter + " 20:00:00");

        if (dateObj == "Invalid Date") { // If the date function can't parse the date string we
            addEvent.invalidDateFormatReply(msg); // Tell the user right format and
            return; // Don't continue
        }
        
        if (dateObj.getFullYear() == 2001) { // When the user doesn't specify the year the Date constructor will add it as 2001
            let currentYear = new Date().getFullYear(); // So we overwrite it with our own year
            dateObj = new Date(dateParameter + "." + currentYear + " 20:00:00");
        }

        // This is ugly. Yes, I know. Don't judge me. Who reads this code anyways...right?
        let eventName = message.slice(message.indexOf(message.split(" ", 2)[1]) + message.split(" ", 2)[1].length + 1); // This just extracts the rest of the message (!add 21.12 bla bla bla) => (bla bla bla)... I don't even know how it works or how I came up with this but it works so I won't touch it.

        // We push the event as an object to the events arrat
        events.push({
            time: dateObj.getTime(),
            user_id: author_id,
            user: author,
            content: eventName
        });

        addEvent.successReply(msg, dateObj, eventName); // And finally we reply the user.
    },

    missingParametersReply: (msg)=>{
        msg.channel.send({
            "embed": {
                "title": "Nesprávny formát príkazu !pridat",
                "color": RED,
                "description": 'Použitie: !pridat [datum] [nazov eventu]\n**Príklady:**\n!pridat 23.10 Pisomka z matiky z mnozin\n!pridat 6.4.2018 Adlerka day\n!pridat 09.08 Ja nevim co'
            }
        });
        return;
    },

    invalidDateFormatReply: (msg)=> {
        msg.channel.send({
            "embed": {
                "title": "Nesprávny formát dátumu",
                "color": RED,
                "description": 'Použitie: !pridat [datum] [nazov eventu]\n**Príklady:**\n!pridat 23.10 Pisomka z matiky z mnozin\n!pridat 6.4.2018 Adlerka day\n!pridat 09.08 Ja nevim co'
            }
        });
        return;
    },

    successReply: (msg, dateObj, eventName)=>{
        msg.channel.send({
            "embed": {
                "title": "Event bol pridaný",
                "color": GREEN,
                "description": `**${WEEK_DAYS_SHORT[dateObj.getDay()]} ${dateObj.getDate()}.${dateObj.getMonth()+1}** - ${eventName}\n`
            }
        });
    }
}

let eventsCommand = (type, msg, commandMessageArray)=>{
    events.sort(compare);
    let oldEventContentToDelete = false;

    let todayDateString = `${new Date().getDate()}.${new Date().getMonth()+1}.${new Date().getFullYear()}`;
    
    let tomorrowDateObj = new Date(new Date().getTime() + 86400000);
    let tomorrowDateString = `${tomorrowDateObj.getDate()}.${tomorrowDateObj.getMonth()+1}.${tomorrowDateObj.getFullYear()}`;
    
    let eventsFields = [];
    let embedTitle = "Nasledujúce eventy";

    let isToday = ((commandMessageArray[1] == 'dnes') || (type == "dnes"));
    let isTomorrow = ((commandMessageArray[1] == 'zajtra') || (type == "zajtra"));

    let timetableTodayArray = TIMETABLE[new Date().getDay()];
    let timetableTomorrowArray = TIMETABLE[tomorrowDateObj.getDay()];

    let timetableTodayString = timetableTodayArray.join(' | ');
    let timetableTomorrowString = timetableTomorrowArray.join(' | ');

    if (isToday) {
        embedTitle = "Eventy na dnes"
        eventsFields = [
            {
                name: `***${todayDateString}***`,
                value: "**Rozvrh: **" + timetableTodayString + "\nNič"
            }
        ];
    }else if (isTomorrow) {
        embedTitle = "Eventy na zajtra"
        eventsFields = [
            {
                name: `***${tomorrowDateString}***`,
                value: "**Rozvrh: **" + timetableTomorrowString + "\nNič"
            }
        ];
    }else{
        eventsFields = [
            {
                name: `***Dnes (${todayDateString})***`,
                value: "**Rozvrh: **" + timetableTodayString + "\nNič"
            },
            {
                name: `***Zajtra (${tomorrowDateString})***`,
                value: "**Rozvrh: **" + timetableTomorrowString + "\nNič"
            }
        ];
    }

    events.forEach((e)=>{
        if (e.time < new Date().getTime()) { // If the event is in the past
            oldEventContentToDelete = e.content
            return;
        }
        if (e.time > new Date().getTime() + 1209600000) { // If the event is older than 14 days
            return;
        }

        let eventDate = new Date(e.time);

        let eventDateString = `${eventDate.getDate()}.${eventDate.getMonth()+1}.${eventDate.getFullYear()}`;

        if (eventDateString == todayDateString) {
            if (isTomorrow) {return;}

            if (eventsFields[0].value.endsWith('Nič')) {
                eventsFields[0].value = "**Rozvrh: **" + timetableTodayString + "\n";
            }
            eventsFields[0].value += `• ${e.content}\n`;

        }else if (eventDateString == tomorrowDateString) {
            if (isToday) {return;}
            
            if (isTomorrow) {
                if (eventsFields[0].value.endsWith('Nič')) {
                    eventsFields[0].value = "**Rozvrh: **" + timetableTomorrowString + "\n";
                }
                eventsFields[0].value += `• ${e.content}\n`;
            }else{
                if (eventsFields[1].value.endsWith('Nič')) {
                    eventsFields[1].value = "**Rozvrh: **" + timetableTomorrowString + "\n";
                }
                eventsFields[1].value += `• ${e.content}\n`;
            }
        }else{
            if (isToday || isTomorrow) {return;}
            let eventFieldDate = `***${WEEK_DAYS[eventDate.getDay()]} ${eventDateString}***`;

            let eventField = eventsFields.find(obj => obj.name == eventFieldDate);

            if (eventField) {
                eventField.value += `• ${e.content}\n`;
            }else{
                eventsFields.push({
                    name: eventFieldDate,
                    value: `\n**Rozvrh: **${TIMETABLE[eventDate.getDay()].join(' | ')}\n• ${e.content}\n`
                })
            }
        }
    });
    
    if (isToday || isTomorrow) {
        msg.channel.send({
            "embed": {
                "title": embedTitle,
                "color": BLUE,
                "fields": eventsFields
            }
        });
    }else{ 
        msg.channel.send({
            "embed": {
                "title": embedTitle,
                "color": BLUE,
                "fields": eventsFields,
                "footer": {
                    "text": "BTW: Keď chceš len čo je na zajtra, napíš !zajtra"
                }
            }
        });
    }

    if (oldEventContentToDelete) {
        events = events.filter((obj)=>{
            return obj.content !== oldEventContentToDelete
        });
    }
}

// ED
discordClient.login(discordBotCongig.token);
console.log("[BOT] Started.");

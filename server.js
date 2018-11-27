console.log("[BOT] Starting...");

// Import modules
const discord = require('discord.js');
const discordClient = new discord.Client();

const mongo = require('mongodb');
const MongoClient = require('mongodb').MongoClient;
const ObjectId = require('mongodb').ObjectID;

const math = require('mathjs');
const ytdl = require('ytdl-core');

// Configuration
const discordBotCongig = {
    token: process.env.DISCORD_BOT_TOKEN,
    prefix: "!" // Prefix for the bot commands
};
const TIMEOUT_INCREMENT = 6.5; // Amount to increment by when the user sends a message
const TIMEOUT_DIVIDER = 1.1; // Each second : [user's timeout / TIMEOUT_DIVIDER]
const TIMEOUT_TRIGGER = 25; // When timeout reaches this amount, bot gets triggered and sends message to the admin
const TIMEOUT_BEFORE_REREPORT = 5 // How many minutes must elapse before the user can be reported again
const ADMIN_USERID = process.env.ADMIN_USERID; // User id of the admin user...
const DEV_USERID = 342227744513327107;

const EVENT_FILENAME = "events.json";

const DATABASE_URI = process.env.DATABASE_URI;

const JOKES = [ // Credits to Dan Valnicek
    `Spýtal som sa mojej dcéry, či by mi podala noviny. Povedala mi, že noviny sú stará škola. Povedala, že ľudia dnes používajú tablety a podala im iPad. Mucha nemala šancu.`,
    `Vždy som si myslela, že moji susedia sú celkom milí ľudia. Ale potom si dali heslo na Wi-Fi.`,
    `Pred dvoma rokmi som sa pozval dievča svojich snov na rande, dnes som ju požiadal o ruku.
    Obidva krát povedala nie.`,
    `"Mami, neľakaj sa, ale som v nemocnici."
    "Synu, prosím ťa. Si tam chirurg už 8 rokov. Môžeme začať naše telefonáty inak?"`,
    `Muž hovorí žene: "Vieš, čim chce byť náš 6-ročný syn, keď bude veľký?"
    Manželka: "Nie"
    Muž: "Smetiarom. A vieš prečo? "
    Manželka: "Nie, prečo?"
    Muž: "Pretože si myslí, že pracujú iba v utorok."`,
    // haha jokes
    `Stretnú sa dvaja povaľači. Prvý sa tak zamyslí a vraví:
    - Človeče, keby nebol ten INTERNET, sedel by som celý deň pri telke!`,
    `Čo znamená názov systému WINDOWS? Nenechajte sa oblafnúť, že Microsoftu ide o nejaké okná. V skutočnosti ide o akronym z posledných slov indiánskeho náčelníka sediaceho býka, ktoré povedal vo svojom rodnom siouxskom nárečí. V slovenskom preklade veštba znie:
    "Zvíťazí Biely Muž Čumiaci Na Presýpacie Hodiny!"`,
    `- Viete, ako sa prežehnáva počítačový fanatik?
    - V mene otca i syna, i ducha enter.`,
    `Ide programátor o 18.00 z práce a stretne šéfa, ktorý sa ho pýta: 
    - Čo ty tak zavčasu? Zobral si si pol dňa dovolenky? 
    - Nie, len si skočím na obed.`,
    `- Viete, ako sa povie Linux po španielsky?
    - Adios BIOS.`,
    `Život by bol jednoduchší, keby sme k nemu mali zdrojový kód.`,
    `Programátor hovorí programátorovi:
    - Moja babka má dnes 64 rokov.
    - Že gratulujem k peknému okrúhlemu výročiu...`,
]


// Global veriables definition
let usersObj = {};
let adminUser;
let events = [];
let recievedCommandsTimeout = 30;
let starting = true;
const WEEK_DAYS = ["Nedeľa", "Pondelok", "Utorok", "Streda", "Štvrtok", "Piatok", "Sobota"];
const WEEK_DAYS_SHORT = ["Ne", "Po", "Ut", "St", "Št", "Pi", "So"];
const RED = 16720418;
const YELLOW = 14540032;
const BLUE = 1616639;
const GREEN = 4521796;

// Function delcarations
let loadData = ()=>{ // Loads data from the DB to the memory
    MongoClient.connect(DATABASE_URI, (err, client) => {
        console.log("[LOAD] Loading events...");
        if (err) return console.error(err)
        let database = client.db('caj-ministrator');
        database.collection("data").find({}).toArray((err, docs)=> {
            if (err) {console.log(err); return;}
            console.log(`[DEBUG] DOCS(${JSON.stringify(docs)})`);
            let doc = docs[0];
            console.log(`[DEBUG] DOC(${JSON.stringify(doc)})`);
            events = doc.events; 
            console.log(`[DEBUG] DOCS(${JSON.stringify(events)})`);
            console.log("[LOAD] Events loaded.");
            client.close();
        });
    });
}
let saveData = ()=>{
    console.log("[SAVE] Saving events...");
    MongoClient.connect(DATABASE_URI, (err, client) => {
        if (err) return console.error(err)
        let database = client.db('caj-ministrator');
        
        // Replace the object with your field objectid...because it won't work otherwise...
        database.collection("data").update({_id: ObjectId("5bf58c9f42400f046cb2d2c1")}, {
            $set: {
                "events": events
            }
        });
        console.log("[SAVE] Events saved.");
    });
}

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
    console.log("[BOT] Ready.");
    console.log("[BOT] Calling loadData...");

    loadData();

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

        // Get some shit from the msg object
        let author_id = msg.author.id; // 45656489754512344
        let author = msg.author.username + "#" + msg.author.discriminator; // User#1337
        let message = msg.content;

        /* Things for the spam protection */
        spamProtect(msg, author_id, author);

        console.log(`[MESSAGE] Recieved message. AUTHOR(${author} ### ${author_id}) CONTENT(${message}) TIMEOUT(${usersObj[author_id].timeout})`);
        
        /* Good night wishing thing */
        goodNightWisher(msg, message, author_id);

        /* OwO what's this (may have God mercy on this world) */
        if(owoReplier(msg, message)) {
            return; // if the function returned true, go commit return lol.
        }

        // Detect if the message is a bot command
        if (message.startsWith(discordBotCongig.prefix)) {
            recievedCommandsTimeout = 30;

            let commandMessageArray = msg.content.split(" "); // Split words of the message into an array

            let command = commandMessageArray[0].slice(1); // Extracts the command from the message

            console.log(`[COMMAND] Recieved command COMMAND(${command}) ARRAY(${JSON.stringify(commandMessageArray)})`);

            if (startsWithNumber(message.slice(1))) { // If the command is: !(0123456789) take it as a math problem
                solveMathProblem(msg, message.slice(1));
                return; // We don't need anything else.
            }

            /* Normal commands */
            switch (command) {
                case "ping":
                    msg.reply("Pong!");
                    break;

                case "info":
                case "about":
                    infoCommand(msg);
                    break;

                case "spravnyprikaz":
                    spravnyPrikazCommand(msg);
                    break;

                case "excuse":
                case "excuseme":
                case "excusewtf":
                case "wtf":
                    msg.channel.send({
                        "files": ["https://i.kym-cdn.com/entries/icons/original/000/026/913/excuse.jpg"]
                    });
                    break;

                case "tmyk":
                case "themoreyouknow":
                    msg.channel.send({
                        "files": ["https://i.ytimg.com/vi/GD6qtc2_AQA/maxresdefault.jpg"]
                    });
                    break;

                case "commit":
                case "gocommit":
                    msg.channel.send({
                        "files": ["https://i.kym-cdn.com/photos/images/newsfeed/001/394/620/475.png"]
                    });
                    break;

                case "oof":
                    msg.channel.send({
                        "files": ["https://i.imgur.com/p7yQqZ8.png"]
                    });
                    break;

                case "tsj":
                    msg.channel.send({
                        "files": ["https://i.imgur.com/8y9Uji5.jpg"]
                    });
                    break;

                case "yeet":
                    msg.channel.send({
                        "files": ["https://ih0.redbubble.net/image.562324831.7631/flat,550x550,075,f.u3.jpg"]
                    });
                    break;

                case "rip":
                    msg.channel.send("Rest in piss, forever miss...");
                    break;

                case "ahoj": //robil Dan Valnicek
                    ahojCommand(msg);
                    break;

                case "joke":
                case "haha":
                    msg.reply({
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
                    
                case "help":
                case "pomoc":
                case "prikazy":
                    helpCommand(msg, commandMessageArray);
                    break;

                case "alecau":
                    aleCauCommand(msg);
                    break;

                case "pridat":
                case "add":
                    addEvent.add(msg, commandMessageArray, message);
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
                case "remove":
                case "delete":
                    let allowed = true;
                    try{
                        if (!(msg.channel.name == "admin-commandy")) {
                            allowed = false;
                            msg.reply({
                                "embed": {
                                    "title": "Tento príkaz sa môže vykonávať len v #admin-commandy",
                                    "color": RED
                                }
                            });
                            return;
                        }
                    }catch(e){
                        allowed = false;
                        msg.reply({
                            "embed": {
                                "title": "Tento príkaz sa môže vykonávať len v #admin-commandy",
                                "color": RED
                            }
                        });
                        return;
                    }
                    if (!allowed) {return;} // JIC
                    
                    loadData();
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
                        saveData();
                        msg.reply({
                            "embed": {
                                "title": "Event bol vymazaný. Zmeny sa môžu prejaviť až o pár sekúnd!",
                                "color": GREEN
                            }
                        });
                        setTimeout(()=>{
                            loadData();
                        }, 2500) // Update data in 5 seconds
                    }else{
                        msg.reply({
                            "embed": {
                                "title": "Event sa nenašiel",
                                "color": RED
                            }
                        });
                    }
                    break;

                case "testread":
                    if (msg.author.id != DEV_USERID) {
                        msg.reply({
                            "embed": {
                                "title": "Tento príkaz môžu vykonavať len developeri z dôvodu redukcie spamu. sry :/",
                                "color": RED
                            }
                        });
                        return;
                    }

                    switch (commandMessageArray[1]) {
                        case "events":
                            loadData();
                            msg.reply({
                                "embed": {
                                    "title": "JSON dump of events object",
                                    "color": BLUE,
                                    "description": JSON.stringify(events) + "\n**Warning! Event data will load after this message!**"
                                }
                            });
                            break;
                        case "users":
                            msg.reply({
                                "embed": {
                                    "title": "JSON dump of users object",
                                    "color": BLUE,
                                    "description": JSON.stringify(usersObj)
                                }
                            });
                            break;
                        default:
                            msg.reply({
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
                        msg.reply({
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

                            msg.reply({
                                "embed": {
                                    "title": "PrettyPrint for usersObj",
                                    "color": BLUE,
                                    "description": usersObjString
                                }
                            });
                            break;

                        default:
                            msg.reply({
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
                    if (msg.author.id != DEV_USERID) {
                        msg.reply({
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
                            msg.reply({
                                "embed": {
                                    "title": "*snap*",
                                    "color": GREEN,
                                    "description": "All event data was deleted. Save has not happened yet."
                                }
                            });
                            break;

                        case "users":
                            usersObj = {};
                            msg.reply({
                                "embed": {
                                    "title": "*snap*",
                                    "color": GREEN,
                                    "description": "All user data was deleted."
                                }
                            });
                            break;

                        default:
                            msg.reply({
                                "embed": {
                                    "title": "Invalid attr",
                                    "color": RED,
                                    "description": "Enter valid attr for !snap/thanos command."
                                }
                            });
                    }
                    break;

                default: // If there is a command sent but it is invalid fall back to this
                    msg.reply({
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
        }
    }, 1000);
    
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
});



let startsWithNumber = (str)=>{
    return str.match(/^\d/);
}

let owoReplier = (msg, message)=>{
    if (message.toLocaleLowerCase() == "owo" || message.toLocaleLowerCase() == "!owo") {
        msg.reply("UwU");
        return true; // dont continue executing the code
    }else if (message.toLocaleLowerCase() == "uwu" || message.toLocaleLowerCase() == "!uwu") {
        msg.reply("^w^");
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

let ahojCommand = (msg)=> {
    msg.reply("Ahoj");
}

let spamProtect = (msg, author_id, author)=>{ // On message recieved
    let userObj = usersObj[author_id]; // Get the author from the usersObj

    if (userObj) { // If the author is already in the usersObj
        usersObj[author_id].username = author; // Set the username jic it changed...
        usersObj[author_id].timeout += TIMEOUT_INCREMENT; // We just increment the timeout
        usersObj[author_id].mpm++; // and also increment the messages per minute

        if (usersObj[author_id].timeOfFirstMinuteMessage < 1) {
            usersObj[author_id].timeOfFirstMinuteMessage = new Date().getTime();
        }

        if (usersObj[author_id].timeout > TIMEOUT_TRIGGER) {
            if(!usersObj[author_id].alreadyReportedTimeout > 0) { // If the user is not already to be reported AND is not already reported
                let username = usersObj[author_id].username;
                if (usersObj[author_id].warned == 0) {
                    msg.reply({
                        "embed": {
                            "title": "Spam",
                            "color": YELLOW,
                            "description": `Hej ${msg.author} sa ukludni sa do piče. Odoslal si **${usersObj[author_id].mpm}** skurvených správ za posledných ${Math.floor((new Date().getTime() - usersObj[author_id].timeOfFirstMinuteMessage) / 1000)} prijebaných sekúnd! Máš štastie že ťa len varujem. Nabudúce keď budeš spamovať ťa reportnem. Fuck.`
                        }
                    });
                    usersObj[author_id].timeout = -25;
                    usersObj[author_id].warned = 90;
                }else{
                    msg.reply({
                        "embed": {
                            "title": "Spam",
                            "color": YELLOW,
                            "description": `Hej ${msg.author} ty pičus si ma nepočul či čo. Odoslal si **${usersObj[author_id].mpm}** správ za posledných ${Math.floor((new Date().getTime() - usersObj[author_id].timeOfFirstMinuteMessage) / 1000)} sekúnd. Ale ja už toho mám skurvene dosť! Report.`
                        }
                    });
                    console.log(`[ADMIN_SEND] Reported user (${username}).`);
                    //adminUser.send(`U **${username}** bolo detekované spamovanie. Odoslal **${usersObj[author_id].mpm}** správ za posledných ${Math.floor((new Date().getTime() - usersObj[author_id].timeOfFirstMinuteMessage) / 1000)} sekúnd.`);
    
                    usersObj[author_id].alreadyReportedTimeout = TIMEOUT_BEFORE_REREPORT;
                }

                
            }
        }
    }else{ // If not we create an object with author's id inside the usersObj
        usersObj[author_id] = {
            username: author,
            mpm: 1, // Messages per minute
            timeOfFirstMinuteMessage: 0,
            warned: 0, // And increment their timeout
            timeout: TIMEOUT_INCREMENT, // And increment their timeout
            alreadyReportedTimeout: 0, // 0=not reported yet.
            alreadyWishedGN: 0 // 0=not wished GN yet.
        };
    }
}

let solveMathProblem = (msg, problem)=>{
    try {
        if (Math.random() < 0.01) {
            msg.channel.send({
                "files": ["https://i.imgur.com/IBopYGD.png"]
            });
        }

        let result = math.eval(problem);
        msg.reply({
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
        msg.reply({
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
                msg.reply({
                    "embed": {
                        "title": "!ping",
                        "color": BLUE,
                        "description": "Odpovie Pong!\nNemá žiadny iný účel ako len testovať či bot funguje a príjma príkazy."
                    }
                });
                break;

            case "info":
            case "about":
                msg.reply({
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
                msg.reply({
                    "embed": {
                        "title": "!help/pomoc/prikazy [príkaz]",
                        "color": BLUE,
                        "description": "Zobrazí príkazy ktoré bot príjma.\nPokiaľ sa použije *!help [príkaz]* tak sa zobrazia informácie o tom príkaze\n\n**Príklady**\n*!help pridat*\n*!help eventy*\n*!help ping*"
                    }
                });
                break;

            case "pridat":
            case "add":
                msg.reply({
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
                msg.reply({
                    "embed": {
                        "title": "!vymazat/remove/delete <event>",
                        "color": BLUE,
                        "description": "Vymaže daný event.\n*Zatiaľ ho môžu používať len admini ale plánujem pridať možnosť vymazať svoj vlastný event.*\n\n**Príklady**\n*!vymazat Pisomka z matiky z mnozin*\n*!remove Adlerka day*\n*!delete Ja nevim co*"
                    }
                });
                break;

            case "eventy":
            case "events":
                msg.reply({
                    "embed": {
                        "title": "!eventy/events [dnes/zajtra]",
                        "color": BLUE,
                        "description": "Zobrazí následujúce eventy pre najblizších 14 dní (ak sa pridá dnes/zajtra zobrazí eventy len pre ten deň).\n\n**Príklady**\n*!eventy*\n*!events dnes*\n*!eventy zajtra*"
                    }
                });
                break;
        }
    }else{
        msg.reply({
            "embed": {
                "title": "Čaj-ministrátor príkazy:",
                "color": BLUE,
                "description": `
                    **!ping** - Odpovie Pong!
                    **!info** - Odpovie základnými údajmi o sebe
                    **!help [príkaz]** - Zobrazí príkazy ktoré bot príjma
                    **!pridat/add <dátum> <event>** - Pridá event
                    **!vymazat/remove/delete** - Odstráni event
                    **!eventy/events** - Vypíše nasledujúce eventy
                    **!dnes/zajtra** - To isté ako !eventy dnes/zajtra
                    **!<príklad>** - Vpočíta príklad

                    *Pre viac informácií o príkaze napíšte napr.: !help eventy*
                    *Ak chcete niečo pridať/zmeniť napíšte do bot-testing*
                `
            }
        });
    }
}

let infoCommand = (msg)=>{
    msg.reply({
        "embed": {
            "title": "Info",
            "color": BLUE,
            "description": '*Serverový čas:* ' + new Date().toString()
        }
    });
}

let spravnyPrikazCommand = (msg)=>{
    msg.reply({
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
    add: (msg, commandMessageArray, message)=>{
        if (!commandMessageArray[1] || !commandMessageArray[2]) { // If there are missing parameters
            addEvent.missingParametersReply(msg); // Tell them
            return; // Don't continue
        }
        
        let author = msg.author.username + "#" + msg.author.discriminator; // User#1337
        let author_id = msg.author.id; // 45656489754512344

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

        saveData(); // And request save of our data

        addEvent.successReply(msg, dateObj, eventName); // And finally we reply the user.
    },

    missingParametersReply: (msg)=>{
        msg.reply({
            "embed": {
                "title": "Nesprávny formát príkazu !pridat",
                "color": RED,
                "description": 'Použitie: !pridat [datum] [nazov eventu]\n**Príklady:**\n!pridat 23.10 Pisomka z matiky z mnozin\n!pridat 6.4.2018 Adlerka day\n!pridat 09.08 Ja nevim co'
            }
        });
        return;
    },

    invalidDateFormatReply: (msg)=> {
        msg.reply({
            "embed": {
                "title": "Nesprávny formát dátumu",
                "color": RED,
                "description": 'Použitie: !pridat [datum] [nazov eventu]\n**Príklady:**\n!pridat 23.10 Pisomka z matiky z mnozin\n!pridat 6.4.2018 Adlerka day\n!pridat 09.08 Ja nevim co'
            }
        });
        return;
    },

    successReply: (msg, dateObj, eventName)=>{
        msg.reply({
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

    if (isToday) {
        embedTitle = "Eventy na dnes"
        eventsFields = [
            {
                name: `***${todayDateString}***`,
                value: "Nič"
            }
        ];
    }else if (isTomorrow) {
        embedTitle = "Eventy na zajtra"
        eventsFields = [
            {
                name: `***${tomorrowDateString}***`,
                value: "Nič"
            }
        ];
    }else{
        eventsFields = [
            {
                name: `***Dnes (${todayDateString})***`,
                value: "Nič"
            },
            {
                name: `***Zajtra (${tomorrowDateString})***`,
                value: "Nič"
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

            if (eventsFields[0].value == "Nič") {
                eventsFields[0].value = "";
            }
            eventsFields[0].value += `• ${e.content}\n`;

        }else if (eventDateString == tomorrowDateString) {
            if (isToday) {return;}
            
            if (isTomorrow) {
                if (eventsFields[0].value == "Nič") {
                    eventsFields[0].value = "";
                }
                eventsFields[0].value += `• ${e.content}\n`;
            }else{
                if (eventsFields[1].value == "Nič") {
                    eventsFields[1].value = "";
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
                    value: "• " + e.content + "\n"
                })
            }
        }
    });
    
    msg.reply({
        "embed": {
            "title": embedTitle,
            "color": BLUE,
            "fields": eventsFields
        }
    });

    if (oldEventContentToDelete) {
        events = events.filter((obj)=>{
            return obj.content !== oldEventContentToDelete
        });
        saveData();
    }
}

// ED
discordClient.login(discordBotCongig.token);
console.log("[BOT] Started.");
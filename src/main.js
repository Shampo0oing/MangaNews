const {runBot} = require('./bot');
const axios = require('axios');
const {login} = require("./auth");

async function main () {

    try {
        await login();
        await runBot();

    }
    catch(err) {
        console.error(err);
    }

}

main();
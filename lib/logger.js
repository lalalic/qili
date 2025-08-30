const log4js =require("log4js")
const config =require("../conf")

log4js.configure({
    appenders:{
        log_file:{
            // type:"dateFile",
            // filename:`${config.log.dir}/qili`,
            // alwaysIncludePattern: true,
            // daysToKeep:10,
            // pattern: "yyyy-MM-dd.log",
            // encoding : 'utf-8',
            type:"multiFile",
            base:`${config.log.dir}/qili`,
            property:"appKey",
            extension:".log",
        },
        console:{
            type:"console",
        }
    },
    categories:{
        default:{
            appenders:["log_file","console"],
            level:"info"
        },
        debug: {
            appenders:["log_file","console"],
            level:"debug"
        },
    }
})

const logger=log4js.getLogger("qili")
logger.addContext("appKey","qili")

module.exports=logger
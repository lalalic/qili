const log4js =require("log4js")
const config =require("../conf")

log4js.configure({
    appenders:{
        log_file:{
            type:"dateFile",
            filename:`${config.log.dir}/qili`,
            alwaysIncludePattern: true,
            daysToKeep:10,
            pattern: "-yyyy-MM-dd-hh.log",
            encoding : 'utf-8',
        }
    },
    categories:{
        default:{
            appenders:["log_file"],
            level:"info"
        },
        debug: {
            appenders:["log_file"],
            level:"debug"
        },
    }
})

module.exports=log4js.getLogger(config.log.category)
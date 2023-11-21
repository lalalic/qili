
const { DataSource} = require('typeorm')
const {entities} =require("flowise/dist/database/entities")
const conf=require("../conf")

;(async()=>{
    const datasource=new DataSource({
        type: "mongodb",
        host: '127.0.0.1',
        port: conf.db.port,
        database: 'ai',
    
        synchronize: false,
        migrationsRun: false,
        entities: Object.values(entities),
    })
    
    await datasource.initialize()
    
    console.log(datasource.isInitialized)
    console.log('datasource created')
    process.exit()
})();

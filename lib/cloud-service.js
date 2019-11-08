const empty=a=>a
module.exports={
    merge:empty,
    ID:empty,
    buildComment:empty,
    buildFavorite:empty,
    buildStatistics:empty,
    buildPagination:empty,
    statistics:empty,
    addModule(module){
        return module.exports
    },
    logVariables:empty,
    reportThreshold:0,
}
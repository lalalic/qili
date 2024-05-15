const keyRunMetadata="$__RunMetadata__$"
/**
 * use chat history to pass metadata of a single ChatFlow run
 */
exports.injectRunMetadata = function (runConfig, metadata) {
    if (!runConfig.history) {
        runConfig.history = [];
    }
    runConfig.history[keyRunMetadata] = metadata;
    return runConfig;
};
exports.extractRunMetadata = function (runConfig) {
    return runConfig.chatHistory?.[keyRunMetadata];
};

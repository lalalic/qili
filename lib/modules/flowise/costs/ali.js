const bestMatch = require("./best-match");

const ali = bestMatch({
    "qwen-turbo": 0.008,
    "qwen-plus": 0.02,
    "qwen-max": 0.12,
    "qwen-max-longcontext": 0.12,
    "qwen-vl-plus": 0.008,
    "qwen-vl-max": 0.02
})

module.exports=ali;

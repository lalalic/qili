const prices={
    "LanguageModels": {
          "gpt-4": {
              "Input": 0.03,
              "Output": 0.06
          },
          "gpt-4-0314": {
              "Input": 0.03,
              "Output": 0.06
          },
          "gpt-4-0613": {
              "Input": 0.03,
              "Output": 0.06
          },
          "gpt-4-turbo":{
              "Input": 0.01,
              "Output": 0.03
          },
          "gpt-4-32k":{
              "Input": 0.06,
              "Output": 0.12
          },
          "gpt-4-vision-preview":{
              "Input": 0.01,
              "Output": 0.03
          },
          "gpt-3.5-turbo": {
              "Input": 0.001125,
              "Output": 0.002
          },
          "gpt-3.5-turbo-16k": {
              "Input": 0.003,
              "Output": 0.004
          },
          "gpt-3.5-turbo-16k-0613": {
              "Input": 0.003,
              "Output": 0.004
          },
          "gpt-3.5-turbo-0301": {
              "Input": 0.003,
              "Output": 0.004
          },
          "gpt-3.5-turbo-0613": {
              "Input": 0.003,
              "Output": 0.004
          },
          "text-ada-001": {
                  "Input": 0.0004,
                  "Output": 0.0004
          },
          "text-babbage-001": {
                  "Input": 0.0005,
                  "Output": 0.0005
          },
          "text-curie-001": {
                  "Input": 0.002,
                  "Output": 0.002
          },
          "text-davinci-001": {
                  "Input": 0.02,
                  "Output": 0.02
          },
          "text-davinci-002": {
                  "Input": 0.02,
                  "Output": 0.02
          },
          "text-davinci-003": {
                  "Input": 0.02,
                  "Output": 0.02
          }
    },
    "FineTuningModels": {
        "ada": {
            "Training": 0.0004,
            "Usage": 0.0016
        },
        "babbage": {
            "Training": 0.0006,
            "Usage": 0.0024
        },
        "curie": {
            "Training": 0.003,
            "Usage": 0.012
        },
        "davinci": {
            "Training": 0.03,
            "Usage": 0.12
        }
    },
    "EmbeddingModels": {
        "ada": {
            "Usage": 0.0001
        }
    },
    "ImageModels": {
      "dall-e-2":{
        "1024x1024": 0.02,
        "512x512": 0.018,
        "256x256": 0.016
      },
      "dall-e-3":{
          "standard":{
            "1024x1024": 0.04,
            "1024x1792": 0.08,
            "1792x1024": 0.08
          },
          "hd":{
            "1024x1024": 0.08,
            "1024x1792": 0.12,
            "1792x1024": 0.12
          }
        }
    },
    "AudioModels": {
        "whisper-1": {
            "Usage": 0.006
        }
    },
    "TTSModels": {
          "tts-1": {
              "Usage": 0.015
          },
          "tts-1-hd":{
              "Usage": 0.030
          }
      }
  }
const bestMatch=require("./best-match")
  Object.entries(prices).forEach(([key, values])=>{
    prices[key]=bestMatch(values, `[cost.openai.${key}]`)
})

module.exports=prices
  
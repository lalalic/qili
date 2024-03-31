const fetch = require('node-fetch');
const fs = require('fs');

const subscriptionKey = '396da6463e7b4c129e370e857c9c68dc'; // Replace with your subscription key
const region = 'eastus'; // Replace with your region

async function microsoftTTS(text, language) {
  const endpoint = `https://${region}.api.cognitive.microsoft.com/sts/v1.0/issuetoken`;
  const headers = {
    'Authorization': `Bearer ${subscriptionKey}`,
    'Content-Type': 'application/ssml+xml',
    'X-Microsoft-OutputFormat': 'audio-16khz-128kbitrate-mono-mp3',
  };

  const xmlBody = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${language}"><voice name="Microsoft Server Speech Text to Speech Voice (your language code)">${text}</voice></speak>`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: headers,
      body: xmlBody,
    });

    if (response.ok) {
      const audioBuffer = await response.buffer();
      fs.writeFileSync(`output_${language}.mp3`, audioBuffer);
      console.log(`Speech generated in ${language}.`);
    } else {
      console.error(`Failed to generate speech. Status code: ${response.statusText}`);
    }
  } catch (error) {
    console.error('Error generating speech:', error.message);
  }
}

// Example usage:
const textToSpeak = "Hello, how are you?";
const languages = ["en-US",/* "es-ES", "fr-FR"*/]; // Example languages: English (US), Spanish (Spain), French (France)

languages.forEach(lang => {
  microsoftTTS(textToSpeak, lang);
});

/**
 * Copyright 2015 IBM Corp. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

var express = require('express'); // app server
var bodyParser = require('body-parser'); // parser for post requests
var Conversation = require('watson-developer-cloud/conversation/v1'); // watson sdk
var TextToSpeechV1 = require('watson-developer-cloud/text-to-speech/v1');
var fs = require('fs');
var app = express();
var path = require('path');
var request = require('request');

var fileName = 'public/output.wav';

// Bootstrap application settings
app.use(express.static('public')) // load UI from public folder
app.use(bodyParser.json());

// Create the service wrapper
var conversation = new Conversation({
  version_date: Conversation.VERSION_DATE_2017_04_21
});

app.get('/api/token', function(req, res) {
  $.ajax({
    type: 'GET',
    url: 'https://stream.watsonplatform.net/authorization/api/v1/token?url=https://stream.watsonplatform.net/text-to-speech/api',
    dataType: 'json',
    contentType: 'application/json',
    async: false,
    headers: {
      "Authorization": "Basic " + btoa(process.env.TEXT_TO_SPEECH_USERNAME, + ":" + process.env.TEXT_TO_SPEECH_PASSWORD)
    },
    success:function(res){
      console.log("Success")
      console.log(res)
      res.json({'token': res})
    },
    error:function(res){
      console.log("Error")
      console.log(res)
    }
  });
})

app.post('/api/voice', function(req, res) {
  if (fs.existsSync(__dirname + '/' + fileName)) {
    fs.unlink(__dirname + '/' + fileName);
  }
  var text_to_speech = new TextToSpeechV1 ({
    username: process.env.TEXT_TO_SPEECH_USERNAME,
    password: process.env.TEXT_TO_SPEECH_PASSWORD
  });

  var params = {
    text: req.body.text,
    voice: 'en-US_AllisonVoice',
    accept: 'audio/wav'
  };

  // Pipe the synthesized text to a file.
  text_to_speech.synthesize(params).on('error', function(error) {
    console.log('Error:', error);
  }).pipe(fs.createWriteStream(fileName));
  res.end('200')
  // res.setHeader("content-type", "audio/wav");
  // fs.createReadStream(fileName).pipe(res);
});

// Endpoint to be call from the client side
app.post('/api/message', function(req, res) {
  var workspace = process.env.WORKSPACE_ID || '<workspace-id>';
  if (!workspace || workspace === '<workspace-id>') {
    return res.json({
      'output': {
        'text': 'The app has not been configured with a <b>WORKSPACE_ID</b> environment variable. Please refer to the ' + '<a href="https://github.com/watson-developer-cloud/conversation-simple">README</a> documentation on how to set this variable. <br>' + 'Once a workspace has been defined the intents may be imported from ' + '<a href="https://github.com/watson-developer-cloud/conversation-simple/blob/master/training/car_workspace.json">here</a> in order to get a working application.'
      }
    });
  }
  var payload = {
    workspace_id: workspace,
    context: req.body.context || {},
    input: req.body.input || {}
  };

  // Send the input to the conversation service
  conversation.message(payload, function(err, data) {
    if (err) {
      return res.status(err.code || 500).json(err);
    }
    return res.json(updateMessage(payload, data));
  });
});

/**
 * Updates the response text using the intent confidence
 * @param  {Object} input The request to the Conversation service
 * @param  {Object} response The response from the Conversation service
 * @return {Object}          The response with the updated message
 */
function updateMessage(input, response) {
  var responseText = null;
  if (!response.output) {
    response.output = {};
  } else {
    return response;
  }
  if (response.intents && response.intents[0]) {
    var intent = response.intents[0];
    // Depending on the confidence of the response the app can return different messages.
    // The confidence will vary depending on how well the system is trained. The service will always try to assign
    // a class/intent to the input. If the confidence is low, then it suggests the service is unsure of the
    // user's intent . In these cases it is usually best to return a disambiguation message
    // ('I did not understand your intent, please rephrase your question', etc..)
    if (intent.confidence >= 0.75) {
      responseText = 'I understood your intent was ' + intent.intent;
    } else if (intent.confidence >= 0.5) {
      responseText = 'I think your intent was ' + intent.intent;
    } else {
      responseText = 'I did not understand your intent';
    }
  }
  response.output.text = responseText;
  return response;
}

module.exports = app;

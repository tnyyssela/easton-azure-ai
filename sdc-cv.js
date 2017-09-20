var KafkaRest = require('kafka-rest');
var kafka = new KafkaRest({ 'url': 'http://10.0.0.176:8082' });
var fs = require('fs');
var request = require('request');
var util = require('util');
var cv = require('opencv');
var kfkObj = [];


//*****************************************************/
//Kafka Consumer
//*****************************************************/

//Subscribe and log from 'test' topic 
//TODO: GET THIS WORKING WITH REAL KAFKA STUFFS!
// var kfkCon = function () {
//         kafka.consumer("my-consumer").join({
//         "format": "binary",
//         "auto.offset.reset": "smallest"
//         }, function(err, consumer_instance) {
//         var stream = consumer_instance.subscribe('drone1_successfullAIResults'); //TODO: need to update to vid stream

//         stream.on('data', function(msgs) {
//             for(var i = 0; i < msgs.length; i++)
//                 console.log("Got a message: key=" + msgs[i].key + " value=" + msgs[i].value + " partition=" + msgs[i].partition);
            
//                 //Send to azure to describe img
//                 // az_describe(msgs[i].value); //TODO: update to whatever this msgs img data val actually is

//                 //Add location to kfkObj
//                 //kfkObj.push({"location": msgs[i].value.location}); //TODO: whatever this loc obj actually is

//         });
//     });
// };


//*****************************************************/
//Azure CV Analysis
//*****************************************************/

var az_describe = function (img){
    
    //Set the headers
    var headers = {
        'Content-Type': 'application/octet-stream',
        'Ocp-Apim-Subscription-Key': '0116ca2ab45f4660b129abcd050534dd'
    };

    // Configure the request
    var options = {
        url: "https://westus.api.cognitive.microsoft.com/vision/v1.0/describe",
        method: 'POST',
        headers: headers,
        body: img
    };

    // Start the request
    request(options, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            // Print out the response body
            console.log(body);

            //publish azure tags json to kafka
            kfkObj.push({'key': 'az_desc', 'value': body});

            //Send to OpenCV for bounding boxes
            cvDetect(img);

        } else {
            console.log("error from service : " + response.body);
        }
    });
};


// var az_tag = function (img){

//     //Set the headers
//     var headers = {
//         'Content-Type': 'application/octet-stream',
//         'Ocp-Apim-Subscription-Key': '0116ca2ab45f4660b129abcd050534dd'
//     };

//     // Configure the request
//     var options = {
//         url: "https://westus.api.cognitive.microsoft.com/vision/v1.0/tag",
//         method: 'POST',
//         headers: headers,
//         body: img
//     };

//     // Start the request
//     request(options, function (error, response, body) {
//         if (!error && response.statusCode == 200) {
//             // Print out the response body
//             console.log(body);

//             //publish azure tags json to kafka
//             kfkObj.push({"az_tags": body});
//         } else {
//             console.log("error from service : " + response.body);
//         }
//     });
// };

//*****************************************************/
//OpenCV Bounding Boxes
//*****************************************************/

var cvDetect = function(img) {

    cv.readImage(img, function(err, im){  
    if (err) throw err;
    if (im.width() < 1 || im.height() < 1) throw new Error('Image has no size');
  
        im.detectObject('./node_modules/opencv/data/haarcascade_fullbody.xml', {}, function(err, persons){
        if (err) throw err;
    
        for (var i = 0; i < persons.length; i++){
            var person = persons[i];
            im.ellipse(person.x + person.width / 2, person.y + person.height / 2, person.width / 2, person.height / 2, [255, 255, 0], 3);
        }

        //To visually verify bounding as necessary
        // im.save('test.jpg');
        // console.log('img saved');
        
        var buff = im.toBuffer();

        //Add image binary to kfkObj
        if(buff){
            kfkObj.push({'key': 'ocv_bounding', 'value': buff});            
        }
        
        //publish kfkObj to kafka
        kfkProd(kfkObj);

        });
    });
};


//*****************************************************/
//Kafka Producer
//*****************************************************/

var kfkProd = function(kfkObj){ 

    console.log(kfkObj);
    //Push to 'test' topic
    kafka.topic('drone1_successfullAIResults')
        .produce(kfkObj,
        function(err, response) {
            if(err){
                console.log(err);
            } else {
                console.log(response);
            }
        }
    );
};

//Test Image
var imgBinary = fs.readFileSync('30.jpg');

az_describe(imgBinary);
// cvDetect(imgBinary);
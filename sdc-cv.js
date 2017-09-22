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
var kfkCon = function () {
        kafka.consumer("azurecv-consumer").join({
        "format": "binary"
        }, function(err, consumer_instance) {
        var stream = consumer_instance.subscribe('videoFrames');

        stream.on('data', function(msgs) {
            for(var i = 0; i < msgs.length; i++) {
                var val = msgs[i].value;//.toString('utf8');
                var json = JSON.parse(val);

                //Add coordinates to kfkObj
                kfkObj.push({'key': 'coordinate', 'value' : json['coordinate']});
                            
                var frame = json['frame'];
                var buf = Buffer.from(frame, 'base64');
                
                //Send to azure to describe img
                // console.log(buf);
                az_describe(buf);
    
            }
        });
        stream.on('error', function(err) {
            console.log("Consumer instance reported an error: " + err);
            console.log("Attempting to shut down consumer instance...");
            consumer_instance.shutdown();
        });
    });
};


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
            // console.log(body);

            //If person publish azure tags json to kafka
            if(body.includes('person') || body.includes('man') ||
            body.includes('woman') || body.includes('child') || body.includes('people')) {

                kfkObj.push({'key': 'az_desc', 'value': body});
                
                //& send to OpenCV for bounding boxes
                cvDetect(img);
            }

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
        
            if(persons){
                for (var i = 0; i < persons.length; i++){
                    var person = persons[i];
                    im.ellipse(person.x + person.width / 2, person.y + person.height / 2, person.width / 2, person.height / 2, [255, 255, 0], 3);
                }

                // console.log(im.toBuffer());
                var ocv_bounds = im.toBuffer().toString('base64');

                // console.log(img);
                
                //Add image binary to kfkObj
                kfkObj.push({'key': 'ocv_bounding', 'value': ocv_bounds});   
                
                //To visually verify bounding as necessary
                // im.save(Date.now() +'.jpg');
                // console.log('img saved');
                
                //publish kfkObj to kafka
                kfkProd(kfkObj);
            }

        });
    });
};


//*****************************************************/
//Kafka Producer
//*****************************************************/

var kfkProd = function(kfkObj){ 
    if(!kfkObj){
        console.log('kfkObj is EMPTY!');
    } else {
        //Push to 'test' topic
        kafka.topic('successfulAIResults')
            .produce(kfkObj.toString('base64'),
            function(err, response) {
                if(err){
                    console.log(err);
                } else {
                    console.log(response);
                }
            }
        );
    }
};

//*****************************************************/
//Manual Tests
//*****************************************************/

//Test Image
// var imgBinary = fs.readFileSync('woods.jpg');

// az_describe(imgBinary);
// cvDetect(imgBinary);
kfkCon();
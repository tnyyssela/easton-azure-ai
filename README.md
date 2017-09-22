Description:
==========

  * consume img and loc data from kafka
  * pass img to azure for CV img desc
  * pass img to OpenCV for bounding box
    - if azure says there's a person 
  * publish location, azure desc, bounding box to kafka via producer
    - if openCV says there's a person

Dependencies:
==========

  * (Install Homebrew if not already installed: https://brew.sh/)
  * brew update
  * brew tap homebrew/science
  * brew install opencv

Installation:
==========
  
  * update KafkaRest endpoint at top of sdc-cv.js file
  * npm install
  * npm run sdc

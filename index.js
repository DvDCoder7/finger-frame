const video = document.querySelector('#video');
const canvas = document.querySelector('#cv');
const fps = 60;

let width = 1280;
let height = 720;
canvasInterval = null;

function drawImage() {
  canvas.getContext('2d', { alpha: false }).drawImage(video, 0, 0, width, height);
}

canvasInterval = window.setInterval(() => {
  drawImage(video);
}, 1000 / fps);

video.onpause = function() {
  clearInterval(canvasInterval);
};
video.onended = function() {
  clearInterval(canvasInterval);
};
video.onplay = function() {
  clearInterval(canvasInterval);
  canvasInterval = window.setInterval(() => {
    drawImage(video);
  }, 1000 / fps);
};

async function criarDetector() {
    const model = handPoseDetection.SupportedModels.MediaPipeHands;
    const detectorConfig = {
        runtime: 'mediapipe', // or 'tfjs'
        modelType: 'full',
        solutionPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/hands'
    };
    detector = await handPoseDetection.createDetector(model, detectorConfig);
    return detector;
}

async function detectar(detector) {
    const hands = await detector.estimateHands(video);
    
    return hands;
}

navigator.mediaDevices
.getUserMedia({
    video: true,
    audio: false,
})
.then((localMediaStream) => {
    const video = document.querySelector("video");
    video.srcObject = localMediaStream;

    video.onloadeddata = async() => {
        width = video.videoWidth;
        height = video.videoHeight;
        cv.width = width; cv.height = height;
        console.log(width, height);
        detector = await criarDetector();

        setInterval(async () => {
            let hands = await detectar(detector);
            if(hands.length >= 1) {
                console.log(hands[0].keypoints[4]);
            } else {
                console.log(hands.length);
            }
        }, 1000/fps); 
    };
})
.catch((error) => {
    console.log("Rejected!", error);
});

// var searchText = "We believe cats are real stars of Youtube.";
// var question = "Who are the real stars of Youtube?";

// qna.load().then(model => {
//     model.findAnswers(question, searchText).then(answers => {
//         console.log("Answers: ", answers);
//     })
// })
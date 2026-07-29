const video = document.querySelector('#video');
const canvas = document.querySelector('#cv');
const txt = document.querySelector('#texto');
const fps = 60;

let width = 1280;
let height = 720;
canvasInterval = null;

var videoPaused = false;

function pauseVideo() {
    videoPaused = !videoPaused;
    const tracks = video.srcObject.getTracks();
    for (var i = 0; i < tracks.length; i++) {
        var track = tracks[i];
        track.enabled = videoPaused;
    }
    // if(videoPaused) canvas.hidden = true;
    // else canvas.hidden = false;
    console.log("aaa");
} 

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

let pegar_coordenada = (hands) => {
    let r = [];
    if(hands.length >= 1) {
        r.push(hands[0].keypoints[4]);
        r.push(hands[0].keypoints[8]);
    }
    if(hands.length == 2) {
        r.push(hands[1].keypoints[4]);
        r.push(hands[1].keypoints[8]);
    }
    return r;
}

// Gambiarra que funciona p 4 coordenadas
let ordena = (coordenadas) => {
    if(!coordenadas) return [];
    if(coordenadas.length < 4) return coordenadas;
    coordenadas.sort((a, b) => {return (a.x - b.x)});
    if(coordenadas[0].y < coordenadas[1].y) [coordenadas[0], coordenadas[1]] = [coordenadas[1], coordenadas[0]];
    if(coordenadas[2].y > coordenadas[3].y) [coordenadas[2], coordenadas[3]] = [coordenadas[3], coordenadas[2]];
    return coordenadas;
}

function drawImage(video, coordenadas) {
    ctx = canvas.getContext('2d', { alpha: false });
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(video, 0, 0, width, height);    

    ctx.lineWidth = 12;
    ctx.strokeStyle = "orange";

    ctx.beginPath();
    coordenadas = ordena(coordenadas);

    if(coordenadas.length > 0) ctx.moveTo(coordenadas[0].x, coordenadas[0].y);

    let str = "";
    coordenadas.forEach((el) => {
        ctx.lineTo(el.x, el.y);
        str += `${el.x}, ${el.y}<br />`; 
    })
    texto.innerHTML = str;
    ctx.closePath();
    ctx.stroke();
}

async function updateVideo() {
    let hands = await detectar(detector);
    let coordenadas = pegar_coordenada(hands);
    drawImage(video, coordenadas);
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

        updateInterval = setInterval(async () => {
            updateVideo();
        }, 1000/fps);

        video.onpause = function() {
            clearInterval(updateInterval);
        };
        video.onended = function() {
            clearInterval(updateInterval);
        };
        video.onplay = function() {
            clearInterval(updateInterval);
            updateInterval = window.setInterval(() => {
                updateVideo();
            }, 1000 / fps);
        };

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
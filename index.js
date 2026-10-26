const video = document.querySelector('#video');
const canvas = document.querySelector('#cv');
const shaderCanvas = document.querySelector('#cv2');
const txt = document.querySelector('#texto');
const filterButtons = document.querySelectorAll('.filter-button');
const contrastThreshold = document.querySelector('#contrast-threshold');
const contrastValue = document.querySelector('#contrast-value');
const neighborThreshold = document.querySelector('#neighbor-threshold');
const neighborValue = document.querySelector('#neighbor-value');
const autoOrder = document.querySelector('#auto-order');
const fps = 60;
let shaderRenderer;
let selectedFilter = 'grayscale';

let width = 1280;
let height = 720;
canvasInterval = null;

var videoPaused = false;

filterButtons.forEach((button) => {
    button.addEventListener('click', () => {
        selectedFilter = button.dataset.filter;
        filterButtons.forEach((filterButton) => {
            filterButton.setAttribute('aria-pressed', filterButton === button);
        });
    });
});

contrastThreshold.addEventListener('input', () => {
    contrastValue.value = Number(contrastThreshold.value).toFixed(2);
});

neighborThreshold.addEventListener('input', () => {
    neighborValue.value = neighborThreshold.value;
});

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
    if(hands.length >= 1) console.log(hands[0]);
    return hands;
}

let pegar_coordenada = (hands) => {
    let r = [];
    if(hands.length >= 1) {
        r.push(hands[0].keypoints[4]);
        r.push(hands[0].keypoints[8]);
    }
    if(hands.length == 2) {
        r.push(hands[1].keypoints[8]);
        r.push(hands[1].keypoints[4]);
    }
    return r;
}

function orientacao(a, b, c) {
    return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function segmentosSeCruzam(a, b, c, d) {
    const abC = orientacao(a, b, c);
    const abD = orientacao(a, b, d);
    const cdA = orientacao(c, d, a);
    const cdB = orientacao(c, d, b);
    const epsilon = 1e-8;
    const estaNoSegmento = (p, q, r) =>
        q.x >= Math.min(p.x, r.x) - epsilon && q.x <= Math.max(p.x, r.x) + epsilon &&
        q.y >= Math.min(p.y, r.y) - epsilon && q.y <= Math.max(p.y, r.y) + epsilon;

    if (((abC > epsilon && abD < -epsilon) || (abC < -epsilon && abD > epsilon)) &&
        ((cdA > epsilon && cdB < -epsilon) || (cdA < -epsilon && cdB > epsilon))) {
        return true;
    }
    return (Math.abs(abC) <= epsilon && estaNoSegmento(a, c, b)) ||
        (Math.abs(abD) <= epsilon && estaNoSegmento(a, d, b)) ||
        (Math.abs(cdA) <= epsilon && estaNoSegmento(c, a, d)) ||
        (Math.abs(cdB) <= epsilon && estaNoSegmento(c, b, d));
}

function quadrilateroValido(pontos) {
    const area = pontos.reduce((soma, ponto, indice) => {
        const proximo = pontos[(indice + 1) % pontos.length];
        return soma + ponto.x * proximo.y - proximo.x * ponto.y;
    }, 0);
    return Math.abs(area) > 1e-6 &&
        !segmentosSeCruzam(pontos[0], pontos[1], pontos[2], pontos[3]) &&
        !segmentosSeCruzam(pontos[1], pontos[2], pontos[3], pontos[0]);
}

function permutar(pontos, prefixo = []) {
    if (pontos.length === 0) return [prefixo];
    return pontos.flatMap((ponto, indice) =>
        permutar(pontos.filter((_, i) => i !== indice), [...prefixo, ponto])
    );
}

function ordena(coordenadas) {
    if (coordenadas.length !== 4 ||
        coordenadas.some(({ x, y }) => !Number.isFinite(x) || !Number.isFinite(y))) {
        return [];
    }

    const unicos = coordenadas.filter((ponto, indice) =>
        coordenadas.findIndex(({ x, y }) => x === ponto.x && y === ponto.y) === indice
    );
    if (unicos.length !== 4) return [];

    const centro = coordenadas.reduce((soma, ponto) => ({
        x: soma.x + ponto.x / coordenadas.length,
        y: soma.y + ponto.y / coordenadas.length
    }), { x: 0, y: 0 });
    const porAngulo = [...coordenadas].sort((a, b) =>
        Math.atan2(a.y - centro.y, a.x - centro.x) -
        Math.atan2(b.y - centro.y, b.x - centro.x)
    );
    if (quadrilateroValido(porAngulo)) return porAngulo;

    const primeira = coordenadas[0];
    const restantes = coordenadas.slice(1);
    return permutar(restantes)
        .map((ordem) => [primeira, ...ordem])
        .find(quadrilateroValido) || [];
}

function drawImage(video, coordenadas) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, width, height);

    ctx.lineWidth = 12;
    ctx.strokeStyle = "orange";
    ctx.lineJoin = "round";

    txt.innerHTML = "";
    coordenadas.forEach((el) => {
        txt.innerHTML += `${el.x}, ${el.y}<br />`;
    });
    const quadrilatero = autoOrder.checked
        ? ordena(coordenadas)
        : coordenadas.length === 4 &&
            coordenadas.every(({ x, y }) => Number.isFinite(x) && Number.isFinite(y))
            ? coordenadas
            : [];
    shaderRenderer(
        video,
        quadrilatero,
        selectedFilter,
        Number(contrastThreshold.value),
        Number(neighborThreshold.value)
    );
    if (quadrilatero.length === 4) {
        ctx.beginPath();
        ctx.moveTo(quadrilatero[0].x, quadrilatero[0].y);
        quadrilatero.slice(1).forEach(({ x, y }) => ctx.lineTo(x, y));
        ctx.closePath();
        ctx.stroke();
    }
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
        canvas.width = width; canvas.height = height;
        shaderCanvas.width = width; shaderCanvas.height = height;
        shaderRenderer = window.initializeShaderRenderer(shaderCanvas);
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
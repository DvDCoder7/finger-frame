const vertexShaderSource = `
attribute vec2 a_position;
attribute vec2 a_texCoord;
varying vec2 v_texCoord;

void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    v_texCoord = a_texCoord;
}
`;

const fragmentShaderSource = `
precision mediump float;

uniform sampler2D u_video;
uniform vec2 u_points[4];
uniform bool u_hasQuadrilateral;
uniform vec2 u_texelSize;
uniform int u_filterMode;
uniform float u_contrastThreshold;
uniform float u_neighborThreshold;
varying vec2 v_texCoord;

bool crossesEdge(vec2 point, vec2 a, vec2 b) {
    bool crosses = (a.y > point.y) != (b.y > point.y);
    return crosses && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x;
}

bool insideQuadrilateral(vec2 point) {
    bool inside = false;
    inside = inside != crossesEdge(point, u_points[0], u_points[1]);
    inside = inside != crossesEdge(point, u_points[1], u_points[2]);
    inside = inside != crossesEdge(point, u_points[2], u_points[3]);
    inside = inside != crossesEdge(point, u_points[3], u_points[0]);
    return inside;
}

float luminance(vec3 color) {
    return dot(color, vec3(0.299, 0.587, 0.114));
}

float edgeContrast(vec2 texCoord) {
    float center = luminance(texture2D(u_video, texCoord).rgb);
    return max(
        max(abs(center - luminance(texture2D(u_video, texCoord + vec2(u_texelSize.x, 0.0)).rgb)),
            abs(center - luminance(texture2D(u_video, texCoord - vec2(u_texelSize.x, 0.0)).rgb))),
        max(abs(center - luminance(texture2D(u_video, texCoord + vec2(0.0, u_texelSize.y)).rgb)),
            abs(center - luminance(texture2D(u_video, texCoord - vec2(0.0, u_texelSize.y)).rgb)))
    );
}

bool isBorderPixel(vec2 texCoord) {
    vec2 point = vec2(texCoord.x, 1.0 - texCoord.y);
    return insideQuadrilateral(point) && edgeContrast(texCoord) > u_contrastThreshold;
}

void main() {
    vec4 color = texture2D(u_video, v_texCoord);
    vec2 point = vec2(v_texCoord.x, 1.0 - v_texCoord.y);

    if (u_hasQuadrilateral && insideQuadrilateral(point)) {
        if (u_filterMode == 0) {
            color.rgb = vec3(luminance(color.rgb));
        } else {
            float neighboringBorderCount = 0.0;
            if (isBorderPixel(v_texCoord + vec2(u_texelSize.x, 0.0))) neighboringBorderCount += 1.0;
            if (isBorderPixel(v_texCoord + vec2(-u_texelSize.x, 0.0))) neighboringBorderCount += 1.0;
            if (isBorderPixel(v_texCoord + vec2(0.0, u_texelSize.y))) neighboringBorderCount += 1.0;
            if (isBorderPixel(v_texCoord + vec2(0.0, -u_texelSize.y))) neighboringBorderCount += 1.0;
            if (isBorderPixel(v_texCoord + vec2(u_texelSize.x, u_texelSize.y))) neighboringBorderCount += 1.0;
            if (isBorderPixel(v_texCoord + vec2(-u_texelSize.x, u_texelSize.y))) neighboringBorderCount += 1.0;
            if (isBorderPixel(v_texCoord + vec2(u_texelSize.x, -u_texelSize.y))) neighboringBorderCount += 1.0;
            if (isBorderPixel(v_texCoord - u_texelSize)) neighboringBorderCount += 1.0;
            bool isBorder = edgeContrast(v_texCoord) > u_contrastThreshold;
            color.rgb = isBorder && neighboringBorderCount >= u_neighborThreshold
                ? vec3(0.0)
                : vec3(1.0);
        }
    }

    gl_FragColor = color;
}
`;

function compileShader(gl, type, source) {
    const shader = gl.createShader(type);
    if (!shader) throw new Error('Could not create WebGL shader.');
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const message = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error(`Could not compile WebGL shader: ${message}`);
    }
    return shader;
}

function createProgram(gl, vertexShader, fragmentShader) {
    const program = gl.createProgram();
    if (!program) throw new Error('Could not create WebGL program.');
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        const message = gl.getProgramInfoLog(program);
        gl.deleteProgram(program);
        throw new Error(`Could not link WebGL program: ${message}`);
    }
    return program;
}

window.initializeShaderRenderer = function initializeShaderRenderer(canvas) {
    const gl = canvas.getContext('webgl');
    if (!gl) throw new Error('WebGL is not available in this browser.');

    const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
    const program = createProgram(gl, vertexShader, fragmentShader);
    const positionLocation = gl.getAttribLocation(program, 'a_position');
    const texCoordLocation = gl.getAttribLocation(program, 'a_texCoord');
    const videoLocation = gl.getUniformLocation(program, 'u_video');
    const pointsLocation = gl.getUniformLocation(program, 'u_points[0]');
    const hasQuadrilateralLocation = gl.getUniformLocation(program, 'u_hasQuadrilateral');
    const texelSizeLocation = gl.getUniformLocation(program, 'u_texelSize');
    const filterModeLocation = gl.getUniformLocation(program, 'u_filterMode');
    const contrastThresholdLocation = gl.getUniformLocation(program, 'u_contrastThreshold');
    const neighborThresholdLocation = gl.getUniformLocation(program, 'u_neighborThreshold');
    const buffer = gl.createBuffer();
    const texture = gl.createTexture();
    if (!buffer || !texture) throw new Error('Could not allocate WebGL rendering resources.');

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        -1, -1, 0, 0,
         1, -1, 1, 0,
        -1,  1, 0, 1,
         1,  1, 1, 1
    ]), gl.STATIC_DRAW);
    gl.useProgram(program);
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(texCoordLocation);
    gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 16, 8);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.uniform1i(videoLocation, 0);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

    return function render(video, points, filterMode, contrastThreshold, neighborThreshold) {
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
        gl.uniform2f(texelSizeLocation, 1 / video.videoWidth, 1 / video.videoHeight);

        const hasQuadrilateral = points.length === 4;
        const normalizedPoints = new Float32Array(8);
        if (hasQuadrilateral) {
            points.forEach((point, index) => {
                normalizedPoints[index * 2] = point.x / video.videoWidth;
                normalizedPoints[index * 2 + 1] = point.y / video.videoHeight;
            });
        };
        gl.uniform2fv(pointsLocation, normalizedPoints);
        gl.uniform1i(hasQuadrilateralLocation, hasQuadrilateral ? 1 : 0);
        gl.uniform1i(filterModeLocation, filterMode === 'border' ? 1 : 0);
        gl.uniform1f(contrastThresholdLocation, contrastThreshold);
        gl.uniform1f(neighborThresholdLocation, neighborThreshold);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };
}

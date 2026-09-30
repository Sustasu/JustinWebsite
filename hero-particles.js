import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js";

const canvas = document.querySelector(".site-particle-canvas");

if (canvas) {
  try {
    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: "low-power",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.4));
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 50);
    camera.position.z = 7.2;

    const particleCount = window.innerWidth < 640 ? 4200 : 8200;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const startPositions = new Float32Array(particleCount * 3);
    const startColors = new Float32Array(particleCount * 3);
    const targetPositions = new Float32Array(particleCount * 3);
    const targetColors = new Float32Array(particleCount * 3);
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.019,
      vertexColors: true,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
      blending: THREE.NormalBlending,
      sizeAttenuation: true,
    });

    const particleField = new THREE.Points(geometry, material);
    scene.add(particleField);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const palette = {
      tesseract: [0x101010, 0x3a3a3a],
      flow: [0x202020, 0x555555],
      skills: [0x171717, 0x444444],
      network: [0x111111, 0x4a4a4a],
      release: [0x1a1a1a, 0x505050],
      grid: [0x161616, 0x484848],
      orbit: [0x202020, 0x555555],
    };
    const sectionScenes = [
      { element: document.querySelector(".hero"), name: "tesseract" },
      { element: document.querySelector(".metrics"), name: "flow" },
      { element: document.querySelector("#skills"), name: "skills" },
      { element: document.querySelector("#recommendations"), name: "network" },
      { element: document.querySelector("#experience"), name: "release" },
      { element: document.querySelector("#clients"), name: "grid" },
      { element: document.querySelector(".contact-strip"), name: "orbit" },
    ].filter(({ element }) => element);

    let activeScene = "";
    let sceneProgress = 0;
    let transitionStarted = performance.now();
    let scrollImpulse = 0;
    let scrollMotion = 0;
    let upwardScrollBoost = 0;
    let previousScrollY = window.scrollY;
    let pointerStillSince = 0;
    let lastPointerX = null;
    let lastPointerY = null;
    let attractionStrength = 0;
    const pointerTarget = new THREE.Vector2();
    const pointerOffset = new THREE.Vector2();
    const attractionPointer = new THREE.Vector3();

    const seeded = (value) => {
      const result = Math.sin(value * 127.1 + 311.7) * 43758.5453;
      return result - Math.floor(result);
    };

    const particlePhases = new Float32Array(particleCount);
    const particleSpeeds = new Float32Array(particleCount);
    const particleArcs = new Float32Array(particleCount);
    const eyeBlinkWeights = new Float32Array(particleCount);
    const mouthLipWeights = new Float32Array(particleCount);
    for (let index = 0; index < particleCount; index += 1) {
      particlePhases[index] = seeded(index + 4109) * Math.PI * 2;
      particleSpeeds[index] = 0.8 + seeded(index + 5209) * 1.4;
      particleArcs[index] = 0.08 + seeded(index + 6301) * 0.28;
    }

    const tesseractVertices = Array.from({ length: 16 }, (_, vertex) => [
      vertex & 1 ? 1 : -1,
      vertex & 2 ? 1 : -1,
      vertex & 4 ? 1 : -1,
      vertex & 8 ? 1 : -1,
    ]);
    const tesseractEdges = [];
    for (let vertex = 0; vertex < 16; vertex += 1) {
      for (let axis = 0; axis < 4; axis += 1) {
        if ((vertex & (1 << axis)) === 0) {
          tesseractEdges.push([vertex, vertex | (1 << axis)]);
        }
      }
    }

    const projectTesseractPoint = (point4D) => {
      const angleXW = 0.52;
      const angleYW = -0.38;
      const angleZW = 0.46;
      const rotatedX = point4D[0] * Math.cos(angleXW) - point4D[3] * Math.sin(angleXW);
      const rotatedW1 = point4D[0] * Math.sin(angleXW) + point4D[3] * Math.cos(angleXW);
      const rotatedY = point4D[1] * Math.cos(angleYW) - rotatedW1 * Math.sin(angleYW);
      const rotatedW2 = point4D[1] * Math.sin(angleYW) + rotatedW1 * Math.cos(angleYW);
      const rotatedZ = point4D[2] * Math.cos(angleZW) - rotatedW2 * Math.sin(angleZW);
      const rotatedW3 = point4D[2] * Math.sin(angleZW) + rotatedW2 * Math.cos(angleZW);
      const perspective = 3.4 / (3.4 - rotatedW3);
      return [rotatedX * perspective, rotatedY * perspective, rotatedZ * perspective];
    };

    const getHeroTextSourcePositions = () => {
      const hero = document.querySelector(".hero");
      const sourcePositions = new Float32Array(particleCount * 3);
      if (!hero) return sourcePositions;

      const lineGroups = new Map();
      const range = document.createRange();
      const walker = document.createTreeWalker(hero, NodeFilter.SHOW_TEXT);
      let textNode = walker.nextNode();
      let textNodeIndex = 0;

      while (textNode) {
        const textStyle = getComputedStyle(textNode.parentElement);
        for (let characterIndex = 0; characterIndex < textNode.length; characterIndex += 1) {
          range.setStart(textNode, characterIndex);
          range.setEnd(textNode, characterIndex + 1);
          const characterBounds = range.getBoundingClientRect();
          if (!characterBounds.height) continue;

          const lineKey = Math.round(characterBounds.top / 2) * 2;
          const groupKey = `${textNodeIndex}:${lineKey}:${textStyle.font}:${textStyle.textTransform}`;
          let line = lineGroups.get(groupKey);
          if (!line) {
            line = {
              text: "",
              style: textStyle,
              left: characterBounds.left,
              right: characterBounds.right,
              top: characterBounds.top,
              bottom: characterBounds.bottom,
            };
            lineGroups.set(groupKey, line);
          }
          line.text += textNode.textContent[characterIndex];
          line.left = Math.min(line.left, characterBounds.left);
          line.right = Math.max(line.right, characterBounds.right);
          line.top = Math.min(line.top, characterBounds.top);
          line.bottom = Math.max(line.bottom, characterBounds.bottom);
        }
        textNodeIndex += 1;
        textNode = walker.nextNode();
      }

      const glyphX = [];
      const glyphY = [];
      const maskScale = 2;

      Array.from(lineGroups.values()).sort((first, second) => first.top - second.top).forEach((line) => {
        const lineText = line.style.textTransform === "uppercase" ? line.text.toUpperCase() : line.text;
        const mask = document.createElement("canvas");
        const maskContext = mask.getContext("2d", { willReadFrequently: true });
        if (!maskContext) return;

        maskContext.font = line.style.font;
        if ("letterSpacing" in maskContext) maskContext.letterSpacing = line.style.letterSpacing;
        const measuredWidth = Math.max(maskContext.measureText(lineText).width, 1);
        const lineWidth = Math.max(line.right - line.left, measuredWidth);
        const lineHeight = Math.max(line.bottom - line.top, parseFloat(line.style.fontSize) * 1.2);
        mask.width = Math.ceil(lineWidth * maskScale);
        mask.height = Math.ceil(lineHeight * maskScale);

        maskContext.font = line.style.font;
        maskContext.textBaseline = "top";
        maskContext.fillStyle = "#ffffff";
        if ("letterSpacing" in maskContext) maskContext.letterSpacing = line.style.letterSpacing;
        maskContext.scale(maskScale, maskScale);
        maskContext.fillText(lineText, 0, 0);

        const pixels = maskContext.getImageData(0, 0, mask.width, mask.height).data;
        const textWidth = Math.max(maskContext.measureText(lineText).width, 1);
        for (let y = 0; y < mask.height; y += 2) {
          for (let x = 0; x < mask.width; x += 2) {
            const alpha = pixels[(y * mask.width + x) * 4 + 3];
            if (alpha < 72) continue;
            glyphX.push(line.left + (x / maskScale / textWidth) * (line.right - line.left));
            glyphY.push(line.top + y / maskScale);
          }
        }
      });

      if (!glyphX.length) {
        const bounds = hero.getBoundingClientRect();
        for (let index = 0; index < particleCount; index += 1) {
          const offset = index * 3;
          const screenX = bounds.left + seeded(index + 31) * bounds.width;
          const screenY = bounds.top + seeded(index + 73) * bounds.height;
          const viewHeight = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
          sourcePositions[offset] = (screenX / window.innerWidth - 0.5) * viewHeight * camera.aspect;
          sourcePositions[offset + 1] = (0.5 - screenY / window.innerHeight) * viewHeight;
          sourcePositions[offset + 2] = (seeded(index + 109) - 0.5) * 0.08;
        }
        return sourcePositions;
      }

      const viewHeight = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
      const viewWidth = viewHeight * camera.aspect;
      for (let index = 0; index < particleCount; index += 1) {
        const offset = index * 3;
        const sourceIndex = Math.floor(seeded(index + 997) * glyphX.length);
        sourcePositions[offset] = (glyphX[sourceIndex] / window.innerWidth - 0.5) * viewWidth;
        sourcePositions[offset + 1] = (0.5 - glyphY[sourceIndex] / window.innerHeight) * viewHeight;
        sourcePositions[offset + 2] = (seeded(index + 109) - 0.5) * 0.08;
      }

      return sourcePositions;
    };

    const getLayout = (name) => {
      const positionsForScene = new Float32Array(particleCount * 3);
      const colorsForScene = new Float32Array(particleCount * 3);
      if (name === "face") {
        eyeBlinkWeights.fill(0);
        mouthLipWeights.fill(0);
      }
      const [firstHex, secondHex] = palette[name] || palette.tesseract;
      const firstColor = new THREE.Color(firstHex);
      const secondColor = new THREE.Color(secondHex);
      const color = new THREE.Color();
      const faceHairColor = new THREE.Color(0x070707);
      const aspect = Math.max(window.innerWidth / Math.max(window.innerHeight, 1), 0.5);
      const viewHeight = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
      const viewWidth = viewHeight * aspect;
      let tesseractScale = 1;
      if (name === "tesseract") {
        let maxX = 0;
        let maxY = 0;
        tesseractVertices.forEach((vertex) => {
          const projected = projectTesseractPoint(vertex);
          maxX = Math.max(maxX, Math.abs(projected[0]));
          maxY = Math.max(maxY, Math.abs(projected[1]));
        });
        tesseractScale = Math.min(viewWidth * 0.28 / maxX, viewHeight * 0.36 / maxY);
      }
      const centers = [
        [-0.34, 0.2], [-0.04, -0.22], [0.3, 0.24], [0.4, -0.25], [-0.4, -0.2], [0.02, 0.34],
      ];
      const gaussian = (distanceX, distanceY, spreadX, spreadY) =>
        Math.exp(-((distanceX / spreadX) ** 2 + (distanceY / spreadY) ** 2));

      for (let index = 0; index < particleCount; index += 1) {
        const offset = index * 3;
        const randomA = seeded(index + 1);
        const randomB = seeded(index + 821);
        const randomC = seeded(index + 2381);
        let x = 0;
        let y = 0;
        let z = 0;

        if (name === "tesseract") {
          const edgeIndex = index % tesseractEdges.length;
          const sampleIndex = Math.floor(index / tesseractEdges.length);
          const samplesPerEdge = Math.ceil(particleCount / tesseractEdges.length);
          const [startVertexIndex, endVertexIndex] = tesseractEdges[edgeIndex];
          const startVertex = tesseractVertices[startVertexIndex];
          const endVertex = tesseractVertices[endVertexIndex];
          const amount = THREE.MathUtils.clamp(
            (sampleIndex + 0.5 + (randomA - 0.5) * 0.3) / samplesPerEdge,
            0,
            1,
          );
          const point4D = startVertex.map((value, axis) => THREE.MathUtils.lerp(value, endVertex[axis], amount));
          const projected = projectTesseractPoint(point4D);
          x = projected[0] * tesseractScale;
          y = projected[1] * tesseractScale;
          z = projected[2] * tesseractScale;
        } else if (name === "face") {
          const region = index / particleCount;

          if (region < 0.12) {
            const angle = randomA * Math.PI * 2;
            const vertical = Math.sin(angle);
            const jawWidth = vertical < 0 ? 0.74 + (vertical + 1) * 0.26 : 1;
            x = Math.cos(angle) * 1.08 * jawWidth;
            y = vertical * 1.5;
            z = 0.1 + Math.max(0, vertical) * 0.08;
          } else if (region < 0.72) {
            const faceIndex = index - Math.floor(particleCount * 0.12);
            const faceCount = Math.floor(particleCount * 0.6);
            const columns = 74;
            const rows = Math.ceil(faceCount / columns);
            const row = Math.floor(faceIndex / columns);
            const column = faceIndex % columns;
            const vertical = THREE.MathUtils.clamp(
              (row + (randomA - 0.5) * 0.2) / Math.max(rows - 1, 1) * 2 - 1,
              -1,
              1,
            );
            const horizontal = THREE.MathUtils.clamp(
              (column + (row % 2) * 0.5 + (randomB - 0.5) * 0.2) / (columns - 1) * 2 - 1,
              -1,
              1,
            );
            y = vertical * 1.48;
            const jawTaper = vertical < 0 ? 0.74 + (vertical + 1) * 0.26 : 1;
            const faceWidth = 1.08 * Math.sqrt(Math.max(0, 1 - vertical * vertical)) * jawTaper;
            x = horizontal * faceWidth;

            const normalizedX = x / 1.12;
            const normalizedY = y / 1.58;
            const surfaceDepth = Math.sqrt(Math.max(0, 1 - normalizedX * normalizedX - normalizedY * normalizedY));
            const eyeSockets = gaussian(Math.abs(x) - 0.38, y - 0.3, 0.2, 0.13);
            const eyeballs = gaussian(Math.abs(x) - 0.37, y - 0.29, 0.13, 0.075);
            const browRidge = gaussian(Math.abs(x) - 0.38, y - 0.55, 0.28, 0.085);
            const forehead = gaussian(x, y - 0.95, 0.56, 0.34);
            const noseBridge = gaussian(x, y + 0.02, 0.115, 0.4);
            const noseTip = gaussian(x, y + 0.37, 0.17, 0.14);
            const noseWings = gaussian(Math.abs(x) - 0.16, y + 0.39, 0.1, 0.085);
            const cheekbones = gaussian(Math.abs(x) - 0.61, y + 0.19, 0.23, 0.2);
            const nasolabial = gaussian(Math.abs(x) - 0.29, y + 0.52, 0.055, 0.2);
            const mouthIndent = gaussian(x, y + 0.69, 0.27, 0.09);
            const chin = gaussian(x, y + 1.0, 0.3, 0.18);
            z = 0.07 + surfaceDepth * 0.35
              - eyeSockets * 0.105
              + eyeballs * 0.055
              + browRidge * 0.09
              + forehead * 0.035
              + noseBridge * 0.23
              + noseTip * 0.3
              + noseWings * 0.085
              + cheekbones * 0.1
              - nasolabial * 0.025
              - mouthIndent * 0.085
              + chin * 0.08
              + Math.sin(row * 0.34 + column * 0.16) * 0.008;
          } else if (region < 0.77) {
            const side = randomA < 0.5 ? -1 : 1;
            const browT = randomB * 2 - 1;
            x = side * 0.38 + browT * 0.26;
            y = 0.57 + (1 - browT * browT) * 0.06 - side * browT * 0.045;
            z = 0.49;
          } else if (region < 0.87) {
            const side = randomA < 0.5 ? -1 : 1;
            const eyeT = randomB * 2 - 1;
            const upperLid = randomC < 0.65;
            eyeBlinkWeights[index] = upperLid ? 1 - Math.abs(eyeT) : 0;
            x = side * 0.38 + eyeT * 0.22;
            y = 0.3 + (upperLid ? 1 : -0.58) * (1 - eyeT * eyeT) * 0.1;
            z = 0.5;
          } else if (region < 0.92) {
            const side = randomA < 0.5 ? -1 : 1;
            const angle = randomB * Math.PI * 2;
            const radius = Math.sqrt(randomC) * (randomA < 0.3 ? 0.07 : 0.035);
            x = side * 0.38 + Math.cos(angle) * radius;
            y = 0.3 + Math.sin(angle) * radius;
            z = 0.53;
          } else if (region < 0.96) {
            if (randomA < 0.7) {
              const noseT = randomB;
              x = Math.sin((noseT - 0.5) * Math.PI) * 0.075 + (randomC - 0.5) * 0.018;
              y = 0.38 - noseT * 0.78;
              z = 0.45 + Math.sin(noseT * Math.PI) * 0.22;
            } else {
              const side = randomB < 0.5 ? -1 : 1;
              const wingT = randomC * 2 - 1;
              x = side * (0.12 + (wingT + 1) * 0.045);
              y = -0.37 - Math.sin((wingT + 1) * Math.PI / 2) * 0.055;
              z = 0.53 + (1 - Math.abs(wingT)) * 0.07;
            }
          } else if (region < 0.99) {
            const mouthT = randomA * 2 - 1;
            const upperLip = randomB < 0.52;
            mouthLipWeights[index] = (upperLip ? 1 : -1) * (1 - Math.abs(mouthT) * 0.28);
            const cupidBow = upperLip ? gaussian(Math.abs(mouthT), 0.24, 0.11, 1) * 0.018 : 0;
            x = mouthT * 0.35;
            y = -0.67 + (1 - mouthT * mouthT) * 0.05 + (upperLip ? 1 : -1) * (0.012 + cupidBow);
            z = 0.48;
          } else {
            const side = randomA < 0.5 ? -1 : 1;
            const earAngle = randomB * Math.PI * 2;
            x = side * (1.0 + Math.cos(earAngle) * 0.13);
            y = 0.02 + Math.sin(earAngle) * 0.24;
            z = 0.12 + Math.max(0, Math.cos(earAngle)) * 0.05;
          }
        } else if (name === "skills") {
          const lane = index % 11;
          x = (randomA - 0.5) * viewWidth * 0.94;
          y = (lane / 10 - 0.5) * viewHeight * 0.72 + Math.sin(x * 0.85 + lane * 1.6) * 0.17;
          z = (randomB - 0.5) * 1.1;
        } else if (name === "network") {
          const center = centers[index % centers.length];
          const angle = randomA * Math.PI * 2;
          const radius = Math.sqrt(randomB) * (0.12 + randomC * 0.52);
          x = (center[0] + Math.cos(angle) * radius) * viewWidth * 0.82;
          y = (center[1] + Math.sin(angle) * radius) * viewHeight * 0.82;
          z = (randomC - 0.5) * 1.2;
        } else if (name === "release") {
          const lane = index % 13;
          const xLane = (lane / 12 - 0.5) * viewWidth * 0.82;
          y = (randomA - 0.5) * viewHeight * 0.92;
          x = xLane + Math.sin(y * 1.2 + lane) * 0.12;
          z = (randomB - 0.5) * 0.9;
        } else if (name === "grid") {
          const columns = Math.ceil(Math.sqrt(particleCount * aspect));
          const rows = Math.ceil(particleCount / columns);
          const column = index % columns;
          const row = Math.floor(index / columns);
          x = (column / Math.max(columns - 1, 1) - 0.5) * viewWidth * 0.9;
          y = (row / Math.max(rows - 1, 1) - 0.5) * viewHeight * 0.8;
          x += Math.sin(row * 0.7) * 0.035;
          y += Math.cos(column * 0.55) * 0.035;
          z = (randomC - 0.5) * 0.7;
        } else if (name === "orbit") {
          const orbit = index % 7;
          const angle = randomA * Math.PI * 2;
          const radius = 0.28 + orbit * 0.14 + (randomB - 0.5) * 0.13;
          x = Math.cos(angle) * radius * viewHeight * 0.8;
          y = Math.sin(angle) * radius * viewHeight * 0.48;
          z = (randomC - 0.5) * 0.8 + Math.sin(angle * 2) * 0.16;
        } else {
          x = (randomA - 0.5) * viewWidth;
          y = (randomB - 0.5) * viewHeight;
          z = (randomC - 0.5) * 1.2;
        }

        positionsForScene[offset] = x;
        positionsForScene[offset + 1] = y;
        positionsForScene[offset + 2] = z;

        const tint = (Math.sin(index * 0.047 + randomB * 5) + 1) * 0.5;
        color.copy(firstColor).lerp(secondColor, tint * 0.62);
        if (name === "face") {
          const beard = Math.max(
            gaussian(x, y + 0.94, 0.52, 0.45),
            gaussian(Math.abs(x) - 0.74, y + 0.34, 0.2, 0.46) * 0.82,
            gaussian(x, y + 0.54, 0.32, 0.12) * 0.94,
          );
          const sweptHair = gaussian(x, y - 1.4, 0.72, 0.18) * 0.78;
          color.lerp(faceHairColor, Math.min(0.96, Math.max(beard, sweptHair)));
        }
        colorsForScene[offset] = color.r;
        colorsForScene[offset + 1] = color.g;
        colorsForScene[offset + 2] = color.b;
      }

      return { positions: positionsForScene, colors: colorsForScene };
    };

    const setScene = (name) => {
      if (name === activeScene && geometry.getAttribute("position").count > 0) return;
      const isInitialFace = activeScene === "" && name === "tesseract";
      activeScene = name;
      const layout = getLayout(name);
      startPositions.set(positions);
      if (isInitialFace) startPositions.set(getHeroTextSourcePositions());
      startColors.set(colors);
      targetPositions.set(layout.positions);
      targetColors.set(layout.colors);
      transitionStarted = performance.now();
      canvas.dataset.scene = name;
      if (reducedMotion.matches) {
        positions.set(targetPositions);
        colors.set(targetColors);
        geometry.getAttribute("position").needsUpdate = true;
        geometry.getAttribute("color").needsUpdate = true;
        renderer.render(scene, camera);
      }
    };

    const resize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.position.z = width < 640 ? 7.5 : 7.2;
      camera.updateProjectionMatrix();
      setScene(activeScene);
    };

    const updateScrollScene = () => {
      const scrollY = window.scrollY;
      const scrollDelta = scrollY - previousScrollY;
      previousScrollY = scrollY;
      scrollImpulse = THREE.MathUtils.clamp(scrollImpulse + scrollDelta * 0.0022, -0.85, 0.85);
      if (scrollDelta < -1) {
        upwardScrollBoost = Math.min(1, upwardScrollBoost + Math.max(0.18, Math.abs(scrollDelta) / 240));
      }

      const focusY = window.innerHeight * 0.52;
      let current = sectionScenes.find(({ element }) => {
        const rect = element.getBoundingClientRect();
        return rect.top <= focusY && rect.bottom > focusY;
      });
      if (!current) {
        current = sectionScenes.reduce((nearest, section) => {
          const distance = Math.abs(section.element.getBoundingClientRect().top - focusY);
          return distance < nearest.distance ? { ...section, distance } : nearest;
        }, { ...sectionScenes[0], distance: Infinity });
      }

      const rect = current.element.getBoundingClientRect();
      sceneProgress = THREE.MathUtils.clamp((focusY - rect.top) / Math.max(rect.height, 1), 0, 1);
      document.body.dataset.scrollScene = current.name;
      setScene(current.name);
    };

    resize();
    updateScrollScene();
    window.addEventListener("resize", resize);
    window.addEventListener("scroll", updateScrollScene, { passive: true });
    window.addEventListener("pointermove", (event) => {
      pointerTarget.x = (event.clientX / window.innerWidth - 0.5) * 0.14;
      pointerTarget.y = (event.clientY / window.innerHeight - 0.5) * 0.12;

      const now = performance.now();
      const moved = lastPointerX === null || Math.hypot(event.clientX - lastPointerX, event.clientY - lastPointerY) > 4;
      lastPointerX = event.clientX;
      lastPointerY = event.clientY;
      if (moved) {
        pointerStillSince = now;
        attractionStrength = 0;
      }
    }, { passive: true });
    document.documentElement.addEventListener("pointerleave", () => {
      lastPointerX = null;
      lastPointerY = null;
      pointerStillSince = 0;
      attractionStrength = 0;
    });
    document.body.classList.add("has-particle-field");

    if ("IntersectionObserver" in window) {
      document.body.classList.add("has-scroll-reveal");
      const revealObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in-view");
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.08, rootMargin: "0px 0px -8% 0px" });

      document.querySelectorAll(".section, .contact-strip").forEach((section) => {
        revealObserver.observe(section);
      });
    }

    const clock = new THREE.Clock();
    const animate = () => {
      if (!reducedMotion.matches && document.visibilityState === "visible") {
        const delta = Math.min(clock.getDelta(), 0.05);
        const elapsed = clock.elapsedTime;
        const pointerEase = 1 - Math.exp(-1.1 * delta);
        pointerOffset.lerp(pointerTarget, pointerEase);
        scrollMotion += (scrollImpulse - scrollMotion) * (1 - Math.exp(-2.2 * delta));
        scrollImpulse *= Math.exp(-1.8 * delta);
        upwardScrollBoost *= Math.exp(-1.25 * delta);
        const idleDuration = lastPointerX !== null ? performance.now() - pointerStillSince : 0;
        const targetAttraction = idleDuration > 5000
          ? Math.min((idleDuration - 5000) / 4200, 1) * 0.86
          : 0;
        attractionStrength += (targetAttraction - attractionStrength) * (1 - Math.exp(-0.45 * delta));
        const transition = THREE.MathUtils.clamp((performance.now() - transitionStarted) / 3000, 0, 1);
        const easedTransition = transition < 0.5
          ? 16 * transition ** 5
          : 1 - Math.pow(-2 * transition + 2, 5) / 2;
        const positionAttribute = geometry.getAttribute("position");
        const colorAttribute = geometry.getAttribute("color");
        const positionArray = positionAttribute.array;
        const colorArray = colorAttribute.array;

        for (let index = 0; index < positionArray.length; index += 1) {
          const particleIndex = Math.floor(index / 3);
          const axis = index % 3;
          const phase = particlePhases[particleIndex] + easedTransition * particleSpeeds[particleIndex];
          const arc = Math.sin(Math.PI * easedTransition) * particleArcs[particleIndex];
          const curl = axis === 0 ? Math.cos(phase) : axis === 1 ? Math.sin(phase) : Math.sin(phase * 1.6) * 0.45;
          positionArray[index] = THREE.MathUtils.lerp(startPositions[index], targetPositions[index], easedTransition) + curl * arc;
          colorArray[index] = THREE.MathUtils.lerp(startColors[index], targetColors[index], easedTransition);
        }

        positionAttribute.needsUpdate = true;
        colorAttribute.needsUpdate = true;
        const isHeroTesseract = activeScene === "tesseract";
        const baseSpin = 0.018 + scrollMotion * 0.12;
        const targetYaw = pointerOffset.x * 4.2 + Math.sin(elapsed * 0.18) * 0.08 + upwardScrollBoost * 0.18;
        particleField.rotation.y += isHeroTesseract
          ? (targetYaw - particleField.rotation.y) * (1 - Math.exp(-1.8 * delta))
          : delta * Math.max(0.008, baseSpin);
        const targetTilt = isHeroTesseract
          ? pointerOffset.y * 3.1 + Math.sin(elapsed * 0.14) * 0.025
          : Math.sin(elapsed * 0.16) * 0.025 + pointerOffset.y * 0.35;
        particleField.rotation.x += (targetTilt - particleField.rotation.x) * (1 - Math.exp(-0.85 * delta));
        const targetRoll = isHeroTesseract ? Math.sin(elapsed * 0.11) * 0.035 : 0;
        particleField.rotation.z += (targetRoll - particleField.rotation.z) * (1 - Math.exp(-0.8 * delta));
        const viewHeight = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
        const viewWidth = viewHeight * camera.aspect;
        const rightToCenter = viewWidth * 0.46 * (1 - sceneProgress);
        const targetX = pointerOffset.x + (isHeroTesseract ? rightToCenter : 0);
        const targetY = pointerOffset.y + (isHeroTesseract ? (0.5 - sceneProgress) * 0.2 : 0);
        const positionEase = 1 - Math.exp(-0.9 * delta);
        particleField.position.x += (targetX - particleField.position.x) * positionEase;
        particleField.position.y += (targetY - particleField.position.y) * positionEase;

        if (attractionStrength > 0.001) {
          particleField.updateMatrixWorld(true);
          const viewHeight = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
          const worldX = (lastPointerX / window.innerWidth - 0.5) * viewHeight * camera.aspect;
          const worldY = (0.5 - lastPointerY / window.innerHeight) * viewHeight;
          attractionPointer.set(worldX, worldY, 0);
          particleField.worldToLocal(attractionPointer);

          const radius = 1.25;
          for (let index = 0; index < positionArray.length; index += 3) {
            const deltaX = attractionPointer.x - positionArray[index];
            const deltaY = attractionPointer.y - positionArray[index + 1];
            const distance = Math.hypot(deltaX, deltaY);
            if (distance >= radius || distance === 0) continue;

            const influence = 1 - distance / radius;
            const pull = attractionStrength * influence * influence;
            const swirl = attractionStrength * influence * 0.18;
            positionArray[index] += deltaX * pull - deltaY * swirl;
            positionArray[index + 1] += deltaY * pull + deltaX * swirl;
          }
          positionAttribute.needsUpdate = true;
        }

        material.opacity += ((isHeroTesseract ? 0.9 : 0.48) - material.opacity) * (1 - Math.exp(-1.3 * delta));
        renderer.render(scene, camera);
      }
      window.requestAnimationFrame(animate);
    };

    if (!reducedMotion.matches) {
      animate();
    } else {
      renderer.render(scene, camera);
    }
  } catch (error) {
    console.warn("The particle hero could not be initialized.", error);
  }
}
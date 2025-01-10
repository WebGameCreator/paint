import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { ARButton } from "three/examples/jsm/webxr/ARButton.js";

import QRCode from "https://cdn.jsdelivr.net/npm/qrcode@1.5.3/+esm";

document.getElementById("qr-code").src = await QRCode.toDataURL(window.location.href, {
    margin: 2,
    color: {
        dark: "#fe007d",
        light: "#FFFFFF",
    },
});

let container;
let camera, scene, renderer;
let controller;

let pinching = false;
const shapeSelector = document.getElementById("shapeSelector");
let hitTestSource = null;
let hitTestSourceRequested = false;
let planeFound = false;
let flowersGltf;
let reticleVisible;
let reticleMatrix;

const drawingLines = [];
let drawingPoints = [];
let drawingMaterial;
let drawingGeometry;

// check for webxr session support
if ("xr" in navigator) {
    navigator.xr.isSessionSupported("immersive-ar").then((supported) => {
        if (supported) {
            //hide "ar-not-supported"
            document.getElementById("ar-not-supported").style.display = "none";
        }
    });
}

function sessionStart() {
    planeFound = false;
}


container = document.createElement("div");
document.body.appendChild(container);

scene = new THREE.Scene();

camera = new THREE.PerspectiveCamera(
    70,
    window.innerWidth / window.innerHeight,
    0.01,
    20
);

const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
light.position.set(0.5, 1, 0.25);
scene.add(light);



renderer = new THREE.WebGLRenderer({ alpha: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;
container.appendChild(renderer.domElement);



renderer.xr.addEventListener("sessionstart", sessionStart);

document.getElementById("controls").appendChild(
    ARButton.createButton(renderer, {
        requiredFeatures: ["local", "dom-overlay", "hand-tracking"],
        domOverlay: { root: document.querySelector("#overlay") },
    })
);

controller = renderer.xr.getController(0);
scene.add(controller);

//load flowers.glb
const loader = new GLTFLoader();

flowersGltf = await new Promise((resolve) => {
    loader.load("donut.glb", (gltf) => {
        resolve(gltf.scene);
    });
});

window.addEventListener("resize", onWindowResize);


const hand = renderer.xr.getHand(0);

scene.add(hand);

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);
}

let lastPosition = {x: 0, y: 0, z: 0};

renderer.setAnimationLoop((timeStamp, frame) => {
    if (hand.inputState.pinching == true) {
        if (shapeSelector.selectedIndex === 0) {
            if (pinching == false) {
                pinching = true;
                drawingPoints = [];
                drawingMaterial = new THREE.LineBasicMaterial({ color: 0x0000ff });
                drawingGeometry = new THREE.BufferGeometry().setFromPoints(drawingPoints);
                drawingLines.push(new THREE.Line(drawingGeometry, drawingMaterial));
                scene.add(drawingLines[drawingLines.length - 1]);
                if (shapeSelector.selectedIndex === 1) {
                    if (reticleVisible && flowersGltf) {
                        const flower =
                            flowersGltf.children[
                            Math.floor(Math.random() * flowersGltf.children.length)
                            ];
                        const mesh = flower.clone();

                        reticleMatrix.decompose(mesh.position, mesh.quaternion, mesh.scale);
                        scene.add(mesh);
                    }
                }
            }
            if (hand.joints?.["index-finger-tip"]?.position != null) {
                const x = hand.joints["index-finger-tip"].position.x;
                const y = hand.joints["index-finger-tip"].position.y;
                const z = hand.joints["index-finger-tip"].position.z;
                if (x != lastPosition.x || y != lastPosition.y || z != lastPosition.z) {
                    console.log(hand);
                    drawingPoints.push(new THREE.Vector3(x, y, z));
                    drawingGeometry.dispose();
                    drawingGeometry = new THREE.BufferGeometry().setFromPoints(drawingPoints);
                    drawingLines[drawingLines.length - 1].geometry = drawingGeometry;
                    lastPosition = { x, y, z };
                }
            }
        }
    }
    else {
        pinching = false;
    }
    renderer.render(scene, camera);
});
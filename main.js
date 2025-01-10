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

let reticle;

let hitTestSource = null;
let hitTestSourceRequested = false;
let planeFound = false;
let flowersGltf;

let drawingPoints = [];
let drawingMaterial;
let drawingGeometry;
let drawingLine;

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

drawingPoints = [];
drawingMaterial = new THREE.LineBasicMaterial({ color: 0x0000ff });
drawingGeometry = new THREE.BufferGeometry().setFromPoints(drawingPoints);
drawingLine = new THREE.Line(drawingGeometry, drawingMaterial);
scene.add(drawingLine);

renderer = new THREE.WebGLRenderer({ alpha: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;
container.appendChild(renderer.domElement);



renderer.xr.addEventListener("sessionstart", sessionStart);

document.body.appendChild(
    ARButton.createButton(renderer, {
        requiredFeatures: ["local", "hit-test", "dom-overlay", "hand-tracking"],
        domOverlay: { root: document.querySelector("#overlay") },
    })
);

function onSelect() {
    if (reticle.visible && flowersGltf) {
        //pick random child from flowersGltf
        const flower =
            flowersGltf.children[
            Math.floor(Math.random() * flowersGltf.children.length)
            ];
        const mesh = flower.clone();

        reticle.matrix.decompose(mesh.position, mesh.quaternion, mesh.scale);
        scene.add(mesh);
    }
}

controller = renderer.xr.getController(0);
controller.addEventListener("select", onSelect);
scene.add(controller);

reticle = new THREE.Mesh(
    new THREE.RingGeometry(0.15, 0.2, 32).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial()
);
reticle.matrixAutoUpdate = false;
reticle.visible = false;
scene.add(reticle);

//load flowers.glb
const loader = new GLTFLoader();

loader.load("donut.glb", (gltf) => {
    flowersGltf = gltf.scene;
});

window.addEventListener("resize", onWindowResize);


const hand = renderer.xr.getHand(0);

hand.addEventListener('selectstart', () => console.log("selectstart"));
hand.addEventListener('selectend', () => console.log("selectend"));
hand.addEventListener('squeezestart', () => console.log("squeezestart"));
hand.addEventListener('squeezeend', () => console.log("squeezeend"));
scene.add(hand);

const pivot = new THREE.Mesh(new THREE.IcosahedronGeometry(0.01, 3));
pivot.name = 'pivot';
pivot.position.z = - 0.05;

hand.add(pivot);


function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);
}

let lastPosition = {x: 0, y: 0, z: 0};

renderer.setAnimationLoop((timeStamp, frame) => {
    if (hand.joints?.["index-finger-tip"]?.position != null) {
        const x = hand.joints["index-finger-tip"].position.x;
        const y = hand.joints["index-finger-tip"].position.y;
        const z = hand.joints["index-finger-tip"].position.z;
        if (x != lastPosition.x || y != lastPosition.y || z != lastPosition.z) {
            console.log(hand);
            drawingPoints.push(new THREE.Vector3(x, y, z));
            drawingGeometry.dispose();
            drawingGeometry = new THREE.BufferGeometry().setFromPoints(drawingPoints);
            drawingLine.geometry = drawingGeometry;
            lastPosition = {x, y, z};
        }
    }

    if (frame) {
        const referenceSpace = renderer.xr.getReferenceSpace();
        const session = renderer.xr.getSession();

        if (hitTestSourceRequested === false) {
            session.requestReferenceSpace("viewer").then(function (referenceSpace) {
                session
                    .requestHitTestSource({ space: referenceSpace })
                    .then(function (source) {
                        hitTestSource = source;
                    });
            });

            session.addEventListener("end", function () {
                hitTestSourceRequested = false;
                hitTestSource = null;
            });

            hitTestSourceRequested = true;
        }

        if (hitTestSource) {
            const hitTestResults = frame.getHitTestResults(hitTestSource);

            if (hitTestResults.length) {
                if (!planeFound) {
                    planeFound = true;
                }
                const hit = hitTestResults[0];

                reticle.visible = true;
                reticle.matrix.fromArray(hit.getPose(referenceSpace).transform.matrix);
            } else {
                reticle.visible = false;
            }
        }
    }

    renderer.render(scene, camera);
});
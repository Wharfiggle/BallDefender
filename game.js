import * as THREE from "three";
import * as GameObject from "./GameObject.js";
import { meshes } from "./Shaders.js";

//set up three renderer
let w = window.innerWidth;
let h = window.innerHeight;
const renderer = new THREE.WebGLRenderer({
    canvas: document.getElementById("three"),
    antialias: true
});
renderer.setSize(w, h);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

//set up ui canvas
const canvas = document.getElementById("ui");
canvas.width = w;
canvas.height = h;
const ui = canvas.getContext("2d");

//extra ui canvas with ghosting effect instead of normal drawing
const ghostCanvas = document.getElementById("ghostui");
ghostCanvas.width = w;
ghostCanvas.height = h;
const ghostUi = ghostCanvas.getContext("2d");

//set up scene
const fov = 50;
const aspect = w / h;
const near = 0.1;
const far = 30;
const camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
camera.position.z = 20;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
camera.updateMatrixWorld();

//set up lighting
const hemiLight = new THREE.HemisphereLight(0x608060, 0x608060);
scene.add(hemiLight);
const dirLight = new THREE.DirectionalLight(0xcccccc, 2);
dirLight.position.set(-1, 1, 1);
//scene.add(dirLight);
const pointLight = new THREE.PointLight(0xffffff, 150, 40);
pointLight.position.z = 1.5;
pointLight.castShadow = true;
scene.add(pointLight);
const pointLightBack = new THREE.PointLight(0xffffff, 150, 40);
pointLightBack.position.z = -1;
pointLightBack.castShadow = true;
scene.add(pointLightBack);

//game objects
const handler = new GameObject.handler(scene, ui, ghostUi, document);
handler.addGameObject(new GameObject.paddle(camera));
handler.addGameObject(new GameObject.scoreKeeper(camera));


//mouse input
document.addEventListener("mousemove", event => {
    dispatchMouseEvent(event);
});

//touch input
document.addEventListener("touchmove", handleTouch, { passive: false });
document.addEventListener("touchstart", handleTouch, { passive: false });
function handleTouch(event)
{
    event.preventDefault();
    const touchEvent = event.touches[0];
    dispatchMouseEvent(touchEvent);
}

//custom mouseEvent
function dispatchMouseEvent(event)
{
    //convert to normalized device coordinates (NDC) (-1 to 1)
    const coordX = (event.clientX / w) * 2 - 1;
    const coordY = 1 - (event.clientY / h) * 2;
    document.dispatchEvent( new CustomEvent("mouseEvent", { 
        detail: {
            pos: new THREE.Vector2(event.clientX, event.clientY),
            coord: new THREE.Vector2(coordX, coordY)
        }}) );
}


//ball spawning variables
const ballSpawnTime = 0.5;
let ballSpawnTimer = ballSpawnTime;
const ballSpawnWeights = [
    { type: GameObject.ball, weight: 1 },
    { type: GameObject.bob, weight: 1 },
    { type: GameObject.orbiter, weight: 1 },
    { type: GameObject.bertha, weight: 1 }
];
const ballSpawnWeightSum = ballSpawnWeights.reduce((sum, e) => sum + e.weight, 0);

//always start with a bertha on screen
handler.addGameObject(new GameObject.bertha(camera));

//add background
handler.addGameObject(new GameObject.background(camera));

//tick
let lastTime = 0;
function tick(t = 0)
{
    requestAnimationFrame(tick);
    let dt = (t - lastTime) / 1000;
    lastTime = t;
    let timems = t / 1000;

    //dont process this frame if it's is after a large accumulation of skipped frames
    if(dt > 1.0)
        return;

    //once timer is up, spawn a new ball of a random type with weighted chances
    ballSpawnTimer -= dt;
    if(ballSpawnTimer <= 0)
    {
        ballSpawnTimer = ballSpawnTime;
        const rn = Math.random() * ballSpawnWeightSum;

        let weightTotal = 0;
        let type = GameObject.ball;
        for(const wt of ballSpawnWeights)
        {
            weightTotal += wt.weight;
            if(rn < weightTotal)
            {
                type = wt.type;
                break;
            }
        }

        handler.addGameObject(new type(camera));
    }

    //clear previously drawn ui frame
    ui.clearRect(0, 0, w, h);
    
    //only partially clear previously drawn ui frame for ghost ui
    ghostUi.save();
    ghostUi.globalCompositeOperation = "destination-out";
    ghostUi.fillStyle = "rgba(0, 0, 0, 0.25)";
    ghostUi.fillRect(0, 0, w, h);
    ghostUi.restore();
    ghostUi.globalCompositeOperation = "source-over";
    
    handler.tick(dt, timems);

    renderer.render(scene, camera);
}
tick();

//adapt to resized window
function handleWindowResize()
{
    w = window.innerWidth;
    h = window.innerHeight;
    renderer.setSize(w, h);
    canvas.width = w;
    canvas.height = h;
    ghostCanvas.width = w;
    ghostCanvas.height = h;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();

    document.dispatchEvent( new CustomEvent("windowResize"), { 
        detail: { 
            newSize: new THREE.Vector2(w, h),
            camera: camera
        } 
    });
}
window.addEventListener("resize", handleWindowResize, false);
import * as THREE from "three";
import * as GameObject from "./GameObject.js";

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

//set up scene
const fov = 50;
const aspect = w / h;
const near = 0.1;
const far = 30;
const camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
camera.position.z = 20;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

//set up lighting
const hemiLight = new THREE.HemisphereLight(0x808080, 0x404040);
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
const handler = new GameObject.handler(scene, ui, document);
handler.addGameObject(new GameObject.paddle());
handler.addGameObject(new GameObject.scoreKeeper());


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


//tick
const ballSpawnTime = 1;
let ballSpawnTimer = ballSpawnTime;

let lastTime = 0;
function tick(t = 0)
{
    requestAnimationFrame(tick);
    let dt = (t - lastTime) / 1000;
    lastTime = t;

    //once timer is up, spawn a new ball of a random type with weighted chances
    ballSpawnTimer -= dt;
    if(ballSpawnTimer <= 0)
    {
        ballSpawnTimer = ballSpawnTime;
        const weightedTypes = [
            { type: GameObject.ball, weight: 0.33 },
            { type: GameObject.bob, weight: 0.33 },
            { type: GameObject.bertha, weight: 0.33 }
        ]
        const rn = Math.random();

        let weightTotal = 0;
        let type = GameObject.ball;
        for(const wt of weightedTypes)
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
    
    handler.tick(dt);

    //adapt to resized window
    if(window.innerWidth != w || window.innerHeight != h)
    {
        w = window.innerWidth;
        h = window.innerHeight;
        renderer.setSize(w, h);
        canvas.width = w;
        canvas.height = h;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
    }

    renderer.render(scene, camera);
}
tick();
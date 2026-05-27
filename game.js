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
scene.add(pointLight);
const pointLightBack = new THREE.PointLight(0xffffff, 150, 40);
pointLightBack.position.z = -1;
scene.add(pointLightBack);

//game object handler
const handler = new GameObject.handler(scene, ui);

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

    ui.fillStyle = "white";
    ui.beginPath();
	ui.arc(w/2, h/2, 5, 0, Math.PI * 2);
	ui.fill();
    
    handler.tick(dt);

    //adapt to resized window
    if(window.innerWidth != w || window.innerHeight != h)
    {
        w = window.innerWidth;
        h = window.innerHeight;
        renderer.setSize(w, h);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
    }

    renderer.render(scene, camera);
}
tick();
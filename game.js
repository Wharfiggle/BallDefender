import * as THREE from "three";
import * as GameObject from "./GameObject.js";

//set up canvas
let w = window.innerWidth;
let h = window.innerHeight;
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(w, h);
document.body.appendChild(renderer.domElement);

//set up scene
const fov = 50;
const aspect = w / h;
const near = 0.1;
const far = 30;
const camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
camera.position.z = 20;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xffffff);

//set up lighting
const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444);
scene.add(hemiLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 2);
dirLight.position.set(-1, 1, 1);
scene.add(dirLight);
//const pointLight = new THREE.PointLight(0xffaaaa, 150, 40);
//pointLight.position.set(0, 0, 6);
//scene.add(pointLight);


//game objects
const handler = new GameObject.handler(scene);

//handler.addGameObject(new GameObject.ball(camera));


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
import * as THREE from "three";
import { getRandomPointOnRectangle } from "./RandomPointOnRectangle.js";

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
const far = 20;
const camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
camera.position.z = 20;
const scene = new THREE.Scene();

//set up meshes
const meshes = {
    ball: new THREE.Mesh(
        new THREE.IcosahedronGeometry(1.0, 2),
        new THREE.MeshStandardMaterial({ color: "purple", flatShading: true })
    ),
    bob: new THREE.Mesh(
        new THREE.IcosahedronGeometry(1.0, 2),
        new THREE.MeshStandardMaterial({ color: "green", flatShading: true })
    ),
    orbiter: new THREE.Mesh(
        new THREE.IcosahedronGeometry(1.0, 2),
        new THREE.MeshStandardMaterial({ color: "red", flatShading: true })
    ),
    bertha: new THREE.Mesh(
        new THREE.IcosahedronGeometry(3.0, 6),
        new THREE.MeshStandardMaterial({ color: "red", flatShading: true })
    ),
    paddle: new THREE.Mesh()
}

//add wireframe to meshes
/*for(const [key, mesh] of Object.entries(meshes))
{
    const wireMat = new THREE.MeshBasicMaterial({ color: "white", wireframe: true });
    const wireMesh = new THREE.Mesh(mesh.geometry, wireMat);
    wireMesh.scale.setScalar(1.001);
    mesh.add(wireMesh);
}*/

//set up lighting
const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444);
scene.add(hemiLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 10);
dirLight.position.set(-1, 1, 1);
scene.add(dirLight);

//get spawn point on edge of screen at the origin
let viewSize = new THREE.Vector2();
camera.getViewSize(camera.position.z, viewSize); //populates viewSize with width and height of camera's view z units away
const spawnPoint = getRandomPointOnRectangle(viewSize.width, viewSize.height);

meshes.ball.position.x = spawnPoint.x;
meshes.ball.position.y = spawnPoint.y;
scene.add(meshes.ball);


//tick
function animate()
{
    requestAnimationFrame(animate);
    
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
animate();
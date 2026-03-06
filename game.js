import * as THREE from "three";


//set up canvas
let w = window.innerWidth;
let h = window.innerHeight;
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(w, h);
document.body.appendChild(renderer.domElement);

//set up scene
const fov = 75;
const aspect = w / h;
const near = 0.1;
const far = 20;
const camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
camera.position.z = 10;
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
for(mesh of meshes)
{
    const wireMat = new THREE.MeshBasicMaterial({ color: "white", wireframe: true });
    const wireMesh = new THREE.Mesh(mesh.geometry, wireMat);
    wireMesh.scale.setScalar(1.001);
    mesh.add(wireMesh);
}

//set up lighting
const hemiLight = new THREE.HemisphereLight(0xffffff, 0x000000);
scene.add(hemiLight);


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
    controls.update();
}
animate();
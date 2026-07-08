import * as THREE from "three";

//set up meshes
const standardBallMesh = new THREE.IcosahedronGeometry(0.5, 2); 
export const meshes = {
    ball: new THREE.Mesh(
        standardBallMesh,
        new THREE.MeshStandardMaterial({ color: "purple"})
    ),
    bob: new THREE.Mesh(
        standardBallMesh,
        new THREE.MeshStandardMaterial({ color: "green"})
    ),
    orbiter: new THREE.Mesh(
        standardBallMesh,
        new THREE.MeshStandardMaterial({ color: "navy"})
    ),
    bertha: new THREE.Mesh(
        new THREE.IcosahedronGeometry(1.5, 6),
        new THREE.MeshStandardMaterial({ color: "red"})
    ),
    /*point: new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.1, 1),
        new THREE.MeshStandardMaterial({ color: "yellow", emissive: true, emissiveIntensity: 1 })
    ),*/
    paddle: new THREE.Mesh(
        new THREE.BoxGeometry(2.0, 0.2, 2.8),
        new THREE.MeshStandardMaterial({ color: "white" })
    )
}


//custom shader to allow for individual opacities per instanced mesh
const paddleTrailMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.02
});

export const shaders = {
    paddleTrailMat: paddleTrailMat
}
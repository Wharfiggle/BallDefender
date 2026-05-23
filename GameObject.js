import * as THREE from "three";
import { getRandomPointOnRectangle } from "./RandomPointOnRectangle.js";

//set up meshes
const meshes = {
    ball: new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.75, 2),
        new THREE.MeshStandardMaterial({ color: "purple", flatShading: true })
    ),
    bob: new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.75, 2),
        new THREE.MeshStandardMaterial({ color: "green", flatShading: true })
    ),
    orbiter: new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.75, 2),
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

export class handler
{
    gameObjects = [];
    removeGameObjects = [];
    constructor(scene)
    {
        this.scene = scene;
    }
    addGameObject(gameObj)
    {
        gameObj.handler = this;
        this.scene.add(gameObj.mesh);
        this.gameObjects.push(gameObj);
    }
    removeGameObject(gameObj) { this.removeGameObjects.push(gameObj); }
    removeMesh(mesh)
    {
        this.scene.remove(mesh);
        if(mesh.geometry)
            mesh.geometry.dispose();
        if(mesh.material)
        {
            if(Array.isArray(mesh.material))
                mesh.material.forEach(m => m.dispose());
            else
                mesh.material.dispose();
        }
    }
    tick(dt)
    {
        for(const go of this.gameObjects)
        {
            go.tick(dt);
        }

        for(const rgo of this.removeGameObjects)
        {
            this.removeMesh(rgo.mesh);
        }
        this.gameObjects = this.gameObjects.filter(e => !this.removeGameObjects.includes(e));
        this.removeGameObjects = [];
    }
}

export class gameObject
{
    handler = null;
    constructor(mesh, startPos = null)
    {
        if(!startPos)
            startPos = new THREE.Vector3();
        this.mesh = mesh.clone();
        this.mesh.position.x = startPos.x;
        this.mesh.position.y = startPos.y;
        this.mesh.position.z = startPos.z;
    }
    tick(dt){}
    setPos(vector3) { this.mesh.position.copy(vector3); }
    addPos(vector3) { this.mesh.position.add(vector3); }
}

export class ball extends gameObject
{
    speed = 5;
    camera = null;
    radius = 0.75;
    constructor(camera)
    {
        super(meshes.ball);
        this.camera = camera;

        //get spawn point on edge of screen at the origin
        let viewSize = new THREE.Vector2();
        camera.getViewSize(camera.position.z, viewSize); //populates viewSize with width and height of camera's view z units away
        let spawnPoint = getRandomPointOnRectangle(viewSize.width + this.radius * 2, viewSize.height + this.radius * 2);

        this.setPos(new THREE.Vector3(spawnPoint.x, spawnPoint.y, 0));
    }
    tick(dt)
    {
        //if would touch center, set position at edge of center and start shrinking
        if(this.mesh.position.length() < this.speed * dt + this.radius)
        {
            const currScale = this.mesh.scale.x;

            //slowly shrink until scale would be 0, then remove self
            if(currScale > dt)
                this.mesh.scale.setScalar(currScale - dt * this.speed);
            else
            {
                this.handler.removeGameObject(this);
                this.handler.addGameObject(new ball(this.camera));
            }

            //set pos touching edge of ball to origin with new scale
            this.setPos(this.mesh.position.clone().normalize().multiplyScalar(this.radius * this.mesh.scale.x));
        }
        else //move towards center
            this.addPos(this.mesh.position.clone().normalize().multiplyScalar(dt * -this.speed));
    }
}
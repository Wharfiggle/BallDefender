import * as THREE from "three";
import { getRandomPointOnRectangle } from "./RandomPointOnRectangle.js";

//set up meshes
const meshes = {
    ball: new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.65, 2),
        new THREE.MeshStandardMaterial({ color: "purple", flatShading: true })
    ),
    bob: new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.65, 2),
        new THREE.MeshStandardMaterial({ color: "green", flatShading: true })
    ),
    orbiter: new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.65, 2),
        new THREE.MeshStandardMaterial({ color: "red", flatShading: true })
    ),
    bertha: new THREE.Mesh(
        new THREE.IcosahedronGeometry(2.0, 6),
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

function lerp(vec1, vec2, t)
{
    const a = vec1.clone();
    const b = vec2.clone();
    return a.add( b.sub(a).multiplyScalar(t) );
}

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
    addedDepth = 0;
    constructor(mesh, startPos = null, addedDepth = 0)
    {
        console.assert(!!mesh);

        this.mesh = mesh.clone();

        this.addedDepth = addedDepth;

        if(!startPos)
            startPos = new THREE.Vector3();
        this.setPos(startPos);
    }
    tick(dt){}
    setPos(vector3)
    {
        this.mesh.position.copy(vector3);
        this.mesh.position.z += this.addedDepth;
    }
    addPos(vector3) { this.mesh.position.add(vector3); }
    getPos()
    {
        const vec = this.mesh.position.clone();
        vec.z -= this.addedDepth;
        return vec;
    }
}

export class ball extends gameObject
{
    speed = 5;
    camera = null;
    radius = null;
    closeToCenter = false;
    centerLerp = 0;
    centerSpeed = 5;
    constructor(camera, mesh = null, addedDepth = 0)
    {
        super(!mesh ? meshes.ball : mesh, null, addedDepth);

        this.radius = this.mesh.geometry.parameters.radius;
        if(addedDepth == 0)
            this.addedDepth = this.radius;
        this.camera = camera;

        console.assert(!!camera);
        console.assert(!!this.radius);

        //get spawn point on edge of screen at the origin
        let viewSize = new THREE.Vector2();
        camera.getViewSize(camera.position.z - this.addedDepth, viewSize); //populates viewSize with width and height of camera's view z units away
        const spawnOffset = this.radius * 3;
        const spawnPoint = getRandomPointOnRectangle(viewSize.width + spawnOffset, viewSize.height + spawnOffset);

        this.setPos(new THREE.Vector3(spawnPoint.x, spawnPoint.y, 0));
    }
    tick(dt)
    {
        const dist = this.getPos().length();

        //if ball is past paddle's hittable radius, start transition to slow linear movement towards center
        if(this.closeToCenter || dist < 3 + this.radius)
        {
            this.closeToCenter = true;

            //if ball would touch center, set position at edge of center and start shrinking
            if(dist < this.speed * dt + this.radius)
            {
                const currScale = this.mesh.scale.x;

                //slowly shrink until scale would be 0, then remove self
                if(currScale > dt)
                    this.mesh.scale.setScalar(currScale - dt * this.centerSpeed / this.radius / 2);
                else
                    this.handler.removeGameObject(this);

                //set pos touching edge of ball to origin with new scale
                this.setPos(this.getPos().normalize().multiplyScalar(this.radius * this.mesh.scale.x));
            }
            else //lerp into linear movement
            {
                if(this.centerLerp < 1)
                    this.centerLerp = Math.min(1, this.centerLerp + dt * 3);
                this.addPos( lerp(this.getMoveVector(dt, this.speed), this.getCenterMoveVector(dt, this.centerSpeed), this.centerLerp) );
            }
        }
        else
            this.addPos(this.getMoveVector(dt, this.speed));
    }
    getMoveVector(dt, speed) { return this.getCenterMoveVector(dt, speed); }
    getCenterMoveVector(dt, speed) { return this.getPos().normalize().multiplyScalar(dt * -speed); }
}

export class bob extends ball
{
    bobStartPos = null;
    bobTime = 0;
    bobSpeed = 6;
    bobStrength = 0.3;
    constructor(camera)
    {
        super(camera, meshes.bob);
        this.bobStartPos = this.getPos();
    }
    getMoveVector(dt, speed)
    {
        const result = this.getCenterMoveVector(dt, speed);
        
        const pos = this.getPos();
        const ang = Math.atan2(pos.y, pos.x);
        this.bobTime += dt;
        result.add(new THREE.Vector3(
            Math.sin(this.bobTime * this.bobSpeed) * this.bobStrength * Math.cos(ang + Math.PI / 2),
            Math.sin(this.bobTime * this.bobSpeed) * this.bobStrength * Math.sin(ang + Math.PI / 2), 0));

        return result;
    }
}

export class bertha extends ball
{
    speed = 1.5;
    centerSpeed = 1.5;
    damage = 5;
    constructor(camera)
    {
        super(camera, meshes.bertha, -2);
    }
}
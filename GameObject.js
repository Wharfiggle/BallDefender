import * as THREE from "three";
import { getRandomPointOnRectangle } from "./RandomPointOnRectangle.js";

//set up meshes
const meshes = {
    ball: new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.5, 2),
        new THREE.MeshStandardMaterial({ color: "purple", flatShading: false })
    ),
    bob: new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.5, 2),
        new THREE.MeshStandardMaterial({ color: "green", flatShading: false })
    ),
    orbiter: new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.5, 2),
        new THREE.MeshStandardMaterial({ color: "navy", flatShading: false })
    ),
    bertha: new THREE.Mesh(
        new THREE.IcosahedronGeometry(1.5, 6),
        new THREE.MeshStandardMaterial({ color: "red", flatShading: false })
    ),
    paddle: new THREE.Mesh(
        new THREE.BoxGeometry(2.0, 0.2, 2.8),
        new THREE.MeshStandardMaterial({ color: "white" })
    )
}

let paddleObj = null;
let scoreObj = null;

//add shadows to meshes except paddle
for(const [key, mesh] of Object.entries(meshes))
{
    if(key != "berthaasdasd")
        mesh.receiveShadow = true;
    if(key != "paddle")
        mesh.castShadow = true;
}

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
    constructor(scene, ui, document)
    {
        this.scene = scene;
        this.ui = ui;
        this.document = document;
    }
    addGameObject(gameObj)
    {
        gameObj.handler = this;
        gameObj.ui = this.ui;
        gameObj.document = this.document;
        gameObj.postInit(this, this.ui, this.document);
        if(gameObj.mesh)
            this.scene.add(gameObj.mesh);
        this.gameObjects.push(gameObj);
    }
    removeGameObject(gameObj) { this.removeGameObjects.push(gameObj); }
    removeMesh(mesh)
    {
        if(!mesh)
            return;
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
    pos = new THREE.Vector3();
    constructor(mesh = null, startPos = null, addedDepth = 0)
    {
        if(mesh)
            this.mesh = mesh.clone();

        this.addedDepth = addedDepth;

        if(!startPos)
            startPos = new THREE.Vector3();
        this.setPos(startPos);
    }
    postInit(handler, ui, document){}
    tick(dt){}
    setPos(vector3)
    {
        this.pos.copy(vector3);
        this.pos.z += this.addedDepth;
        if(!!this.mesh)
            this.mesh.position.copy(this.pos);
    }
    addPos(vector3)
    {
        this.pos.add(vector3);
        if(!!this.mesh)
            this.mesh.position.copy(this.pos);
    }
    getPos()
    {
        const vec = this.pos.clone();
        vec.z -= this.addedDepth;
        return vec;
    }
}

export class paddle extends gameObject
{
    radius = 2.5;
    width = null;
    pointLight = null;
    constructor()
    {
        super(meshes.paddle);
        this.setPos(new THREE.Vector3(0, this.radius, 0));
        this.width = this.mesh.geometry.parameters.height;
        paddleObj = this;
    }
    postInit(handler, ui, document)
    {
        this.pointLight = new THREE.PointLight(0xffffff, 5, 15);
        this.pointLight.castShadow = true;
        this.pointLight.position.copy(this.pos);
        handler.scene.add(this.pointLight);

        //respond to mouseEvent fired from game.js
        document.addEventListener("mouseEvent", event => {
            const e = event.detail;
            const ang = Math.atan2(e.coord.y, e.coord.x);
            const dir = new THREE.Vector3(Math.cos(ang), Math.sin(ang));
            this.setPos(dir.clone().multiplyScalar(this.radius));
            this.pointLight.position.copy(dir.clone().multiplyScalar(this.radius + this.width));
            this.mesh.rotation.z = ang + Math.PI / 2;
        });
    }
    /*setPos(vector3)
    {
        super.setPos(vector3);
        if(!!this.pointLight)
            this.pointLight.position.copy(this.pos);
    }*/
    tick(dt)
    {
        //draw white dot in center
        this.ui.fillStyle = "white";
        this.ui.beginPath();
	    this.ui.arc(this.ui.canvas.width / 2, this.ui.canvas.height / 2, 5, 0, Math.PI * 2);
	    this.ui.fill();
    }
}

export class scoreKeeper extends gameObject
{
    score = 0;
    constructor()
    {
        super();
        scoreObj = this;
    }
    addScore(num){
        this.score += num;
    }
    subtractScore(num){
        this.score = Math.max(0, this.score - num);
    }
    tick(dt)
    {
        this.ui.fillStyle = "white";
        this.ui.font = "48px serif";
        this.ui.fillText(this.score, 10, 50);
    }
}

export class ball extends gameObject
{
    damage = 1;
    speed = 5;
    camera = null;
    radius = null;
    closeToCenter = false;
    deflected = false;
    shrinking = false;
    deflectThreshold = 0.85;
    centerLerp = 0;
    centerSpeed = 5;
    cullDistance = null;
    constructor(camera, mesh = null, addedDepth = 0)
    {
        super(!mesh ? meshes.ball : mesh, new THREE.Vector3(), addedDepth);

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
        this.cullDistance = viewSize.length();

        this.setPos(new THREE.Vector3(spawnPoint.x, spawnPoint.y, 0));
    }
    tick(dt)
    {
        const dist = this.getPos().length();

        //if ball is within hitting distance and alligned with paddle's angle, deflect
        if(!this.shrinking)
        {
            const minDist = paddleObj?.radius + paddleObj?.width - this.radius;
            const maxDist = paddleObj?.radius + paddleObj?.width + this.radius;
            if(!this.deflected && dist >= minDist && dist <= maxDist)
            {
                this.closeToCenter = true;
                if(!!paddleObj && this.getPos().normalize().dot(paddleObj.getPos().normalize()) >= this.deflectThreshold)
                {
                    this.deflected = true;
                    this.speed = -this.speed;
                    scoreObj.addScore(1);
                }
            }
            else if(dist < Math.abs(minDist)) //ensure closeToCenter flag is toggled even if frames are skipped or paddleObj is missing
                this.closeToCenter = true;
        }

        //if ball wasn't deflected in time, transition to slow linear movement towards center
        if(this.closeToCenter && !this.deflected)
        {
            //if ball would touch center, set position at edge of center and start shrinking
            if(this.shrinking || dist < this.speed * dt + this.radius)
            {
                this.shrinking = true;

                const currScale = this.mesh.scale.x;

                //slowly shrink until scale would be 0, then remove self
                if(currScale > dt)
                    this.mesh.scale.setScalar(currScale - dt * this.centerSpeed / this.radius / 2);
                else{
                    this.handler.removeGameObject(this);
                    scoreObj.subtractScore(this.damage);
                }

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
        {
            this.addPos(this.getMoveVector(dt, this.speed));

            //cull once far enough away if deflected
            if(this.deflected && dist > this.cullDistance)
                this.handler.removeGameObject(this);
        }
    }
    getMoveVector(dt, speed) { return this.getCenterMoveVector(dt, speed); }
    getCenterMoveVector(dt, speed) { return this.getPos().normalize().multiplyScalar(dt * -speed); }
}

export class bob extends ball
{
    bobTime = 0;
    bobSpeed = 6;
    bobStrength = 0.3;
    constructor(camera)
    {
        super(camera, meshes.bob);
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

export class orbiter extends ball
{
    orbitSpeed = 25;
    constructor(camera)
    {
        super(camera, meshes.orbiter);
    }
    getMoveVector(dt, speed)
    {
        const pos = this.getPos();
        const dist = pos.clone().add(this.getCenterMoveVector(dt, speed)).length();
        const ang = Math.atan2(pos.y, pos.x) + this.orbitSpeed * dt / dist;
        
        const dir = new THREE.Vector3(Math.cos(ang), Math.sin(ang));
        return dir.multiplyScalar(dist).sub(pos);
    }
}

export class bertha extends ball
{
    speed = 1.5;
    centerSpeed = 1.5;
    damage = 5;
    deflectThreshold = 0.7;
    constructor(camera)
    {
        super(camera, meshes.bertha, -2);
    }
}
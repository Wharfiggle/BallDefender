import * as THREE from "three";
import { getRandomPointOnRectangle } from "./RandomPointOnRectangle.js";

//set up meshes
const standardBallMesh = new THREE.IcosahedronGeometry(0.5, 2); 
const meshes = {
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

let paddleObj = null;
let scoreObj = null;

//add shadows to meshes except paddle
for(const [key, mesh] of Object.entries(meshes))
{
    if(key == "bertha")
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

function worldToScreen(vector3, camera, screenWidth, screenHeight)
{
    const screenPos = vector3.clone().project(camera);
    return new THREE.Vector2((1 + screenPos.x) * screenWidth / 2, (1 - screenPos.y) * screenHeight / 2);
}

export class handler
{
    gameObjects = [];
    removeGameObjects = [];
    unshiftGameObjects = [];
    constructor(scene, ui, document)
    {
        this.scene = scene;
        this.ui = ui;
        this.document = document;

        //preload meshes and keep in memory to prevent lag spikes on spawns
        for(const [key, mesh] of Object.entries(meshes))
        {
            const copy = mesh.clone();
            copy.scale.setScalar(0);
            scene.add(copy);
        }        
    }
    addGameObject(gameObj, under = false)
    {
        gameObj.handler = this;
        gameObj.ui = this.ui;
        gameObj.document = this.document;
        gameObj.postInit(this, this.ui, this.document);
        if(gameObj.mesh)
            this.scene.add(gameObj.mesh);
        
        if(under)
            this.unshiftGameObjects.push(gameObj);
        else
            this.gameObjects.push(gameObj);
    }
    removeGameObject(gameObj) { this.removeGameObjects.push(gameObj); }
    removeMesh(mesh)
    {
        if(!mesh)
            return;
        this.scene.remove(mesh);
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

        for(const ugo of this.unshiftGameObjects)
        {
            this.gameObjects.unshift(ugo);
        }
        this.unshiftGameObjects = [];
    }
}

export class gameObject extends EventTarget
{
    handler = null;
    addedDepth = 0;
    pos = new THREE.Vector3();
    constructor(mesh = null, startPos = null, addedDepth = 0)
    {
        super();

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
    angle = 0;
    width = null;
    pointLight = null;
    camera = null;
    screenRadius = 0;
    trail = {
        lastAngle: 0,
        minSteps: 20,
        maxSteps: 20,
        maxLength: Math.PI,
        length: 0,
        lengthReduceSpeed: 1,
        trailWidth: 5
    }
    constructor(camera)
    {
        super(meshes.paddle);
        this.setPos(new THREE.Vector3(0, this.radius, 0));
        this.width = this.mesh.geometry.parameters.height;
        this.camera = camera;

        paddleObj = this;
    }
    postInit(handler, ui, document)
    {
        this.pointLight = new THREE.PointLight(0xffffff, 5, 15);
        this.pointLight.castShadow = true;
        this.pointLight.position.copy(this.pos);
        handler.scene.add(this.pointLight);

        const screenPos = worldToScreen(this.getPos(), this.camera, ui.canvas.width, ui.canvas.height);
        this.screenRadius = screenPos.sub(new THREE.Vector2(ui.canvas.width / 2, ui.canvas.height / 2)).length();

        //respond to mouseEvent fired from game.js
        document.addEventListener("mouseEvent", event => {
            const e = event.detail;
            this.angle = Math.atan2(e.coord.y, e.coord.x);
            const dir = new THREE.Vector3(Math.cos(this.angle), Math.sin(this.angle));
            this.setPos(dir.clone().multiplyScalar(this.radius));
            this.pointLight.position.copy(dir.clone().multiplyScalar(this.radius + this.width));
            this.mesh.rotation.z = this.angle + Math.PI / 2;
        });
    }
    tick(dt)
    {
        //draw white dot in center
        const scoreColor = scoreObj.colorFlash.color;
        this.ui.fillStyle = `rgb(${scoreColor.x}, ${scoreColor.y}, ${scoreColor.z})`;
        this.ui.beginPath();
	    this.ui.arc(this.ui.canvas.width / 2, this.ui.canvas.height / 2, 5, 0, Math.PI * 2);
	    this.ui.fill();

        //draw white trail following paddle
        const tr = this.trail;

        //shrink trail length over time
        tr.length += (tr.length > 0 ? -1 : 1) * tr.lengthReduceSpeed * Math.abs(tr.length) * dt;

        //calculate angle difference and apply to length
        const angDiff = (tr.lastAngle - this.angle) % (2 * Math.PI);
        const ccwDiff = angDiff < 0 ? angDiff + (2 * Math.PI) : angDiff;
        const cwDiff = (2 * Math.PI - ccwDiff) % (2 * Math.PI);
        const ccw = ccwDiff < cwDiff;
        tr.length += (ccw ? ccwDiff : -cwDiff);
        tr.length = Math.min(tr.maxLength, Math.max(-tr.maxLength, tr.length)); //clamp
        
        let steps = Math.abs(tr.length) / (tr.maxLength / tr.maxSteps);
        steps = Math.max(tr.minSteps, steps); //make sure steps is not below minSteps

        this.ui.strokeStyle = "white";
        for(let j = 0; j < tr.trailWidth; j++)
        {
            this.ui.save();
            for(let i = 0; i < steps; i++)
            {
                const start = this.angle + i * (tr.length / steps);
                const end = this.angle + (i + 1) * (tr.length / steps);
                this.ui.globalAlpha = 1.0 - ((i + 1) * (1.0 / steps));
                this.ui.beginPath();
                this.ui.arc(this.ui.canvas.width / 2, this.ui.canvas.height / 2, this.screenRadius + j, -start, -end, tr.length > 0);
                this.ui.stroke();
            }
            this.ui.restore();
        }

        tr.lastAngle = this.angle;
    }
}

export class scoreKeeper extends gameObject
{
    score = 0;
    camera = null;
    colorFlash = {
        defaultColor: new THREE.Vector3(255, 255, 255),
        color: null,
        startColor: null,
        targetColor: null,
        lerp: 1,
        defaultSpeed: 5,
        speed: null,
    }
    constructor(camera)
    {
        super();
        scoreObj = this;

        this.camera = camera;

        this.colorFlash.color = this.colorFlash.defaultColor.clone();
        this.colorFlash.startColor = this.colorFlash.defaultColor.clone();
        this.colorFlash.targetColor = this.colorFlash.defaultColor.clone();
        this.colorFlash.speed = this.colorFlash.defaultSpeed;

        //load score from local storage
        const storedScore = Number(localStorage.getItem("score"));
        this.score = !!storedScore ? storedScore : 0;
    }
    flashScoreColor(vec3, fadeIn = false, speed = null)
    {
        const cf = this.colorFlash;

        //cf.targetColor = vec3;
        //cf.startColor = this.colorFlash.color.clone();
        cf.targetColor = vec3;
        cf.startColor = fadeIn ? cf.color.clone() : vec3;

        cf.lerp = 0;
        cf.color = cf.startColor;
        cf.speed = !!speed ? speed : cf.defaultSpeed;
    }
    addScore(num, pos)
    {
        const particle = new scoreParticle(this.camera, pos, num);
        this.handler.addGameObject(particle, true);
        particle.addEventListener("particleDeath", () => { 
            this.score += num;
            this.flashScoreColor(new THREE.Vector3(255, 255, 0));
            localStorage.setItem("score", this.score); //save new score in local storage
        }, { once: true });
    }
    subtractScore(num, pos)
    {
        this.score = Math.max(0, this.score - num);
        this.flashScoreColor(new THREE.Vector3(20, 20, 20), false, 10);
        localStorage.setItem("score", this.score); //save new score in local storage
    }
    tick(dt)
    {
        const cf = this.colorFlash;
        if(cf.lerp < 1)
        {
            cf.lerp = Math.min(1, cf.lerp + dt * cf.speed);
            if(cf.startColor != cf.targetColor)
                cf.color = lerp(cf.startColor, cf.targetColor, cf.lerp, 1);

            //fade back to default color after reaching target color
            if(cf.lerp == 1 && cf.targetColor != cf.defaultColor)
                this.flashScoreColor(cf.defaultColor, true);
        }

        this.ui.fillStyle = `rgb(${cf.color.x}, ${cf.color.y}, ${cf.color.z})`;
        this.ui.font = "48px serif";
        this.ui.fillText(this.score, 10, 50);
    }
}

export class scoreParticle extends gameObject
{
    amount = 1;
    fallTime = 1.0;
    stayTime = 0;
    fadeTime = 0;
    maxOffset = 0.5;
    camera = null;
    timer = 0;
    vel = new THREE.Vector3();
    target = new THREE.Vector3();
    stopped = false;
    constructor(camera, startPos = new THREE.Vector3(), amount = null, fallTime = null, fadeTime = null)
    {
        super(null, startPos);
        if(!!amount) this.amount = amount;
        if(!!fallTime) this.fallTime = fallTime;
        if(!!fadeTime) this.fadeTime = fadeTime;

        this.camera = camera;

        //this.target = new THREE.Vector3(this.maxOffset * (Math.random() * 2 - 1), this.maxOffset * (Math.random() * 2 - 1));
        const pos = this.getPos();
        this.vel = new THREE.Vector3(
            (this.target.x - pos.x) / this.fallTime,
            (4.9 * this.fallTime) + ((this.target.y - pos.y) / this.fallTime)
        );
    }
    tick(dt)
    {
        this.timer += dt;
        if(this.timer >= this.fallTime)
        {
            if(!this.stopped)
            {
                this.setPos(this.target);
                this.stopped = true;
            }

            //finished, remove self and dispatch event
            if(this.timer >= this.fallTime + this.stayTime + this.fadeTime)
            {
                this.handler.removeGameObject(this);
                this.dispatchEvent(new CustomEvent("particleDeath"));
            }
            else
            {
                const opacity = Math.min(1, 1.0 - (this.timer - this.fallTime - this.stayTime) / this.fadeTime);
                this.setPos(this.target.clone().multiplyScalar(Math.pow(opacity, 2)));
            }
        }
        else //go towards target
        {
            this.vel.y -= 9.8 * dt; //gravity
            this.addPos(this.vel.clone().multiplyScalar(dt));
        }

        const screenPos = worldToScreen(this.getPos(), this.camera, this.ui.canvas.width, this.ui.canvas.height);
        this.ui.fillStyle = "yellow";
        this.ui.beginPath();
	    this.ui.arc(screenPos.x, screenPos.y, 2.5, 0, Math.PI * 2);
	    this.ui.fill();
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
    deflectShrinkSpeed = 10;
    shrinking = false;
    deflectThreshold = 0.85;
    centerLerp = 0;
    centerSpeed = 5;
    //cullDistance = null;
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
        //this.cullDistance = viewSize.length();

        this.setPos(new THREE.Vector3(spawnPoint.x, spawnPoint.y, 0));
    }
    tick(dt)
    {
        const pos = this.getPos();
        const dist = pos.length();

        //shrinking logic for deflected and when hit the center
        if(this.shrinking)
        {
            const shrinkSpeed = this.deflected ? this.deflectShrinkSpeed : (this.centerSpeed / this.radius / 2);
            const newScale = this.mesh.scale.x - dt * shrinkSpeed;

            //shrink to minimum size, then remove self
            if(newScale > (this.deflected ? 0.1 : 0))
                this.mesh.scale.setScalar(newScale);
            else
            {
                this.handler.removeGameObject(this);
                if(this.deflected)
                    scoreObj.addScore(1, pos);
                else
                    scoreObj.subtractScore(this.damage, pos);
            }

            //set pos touching edge of ball to origin with new scale
            if(!this.deflected)
                this.setPos(this.getPos().normalize().multiplyScalar(this.radius * this.mesh.scale.x));

            return;
        }

        //if ball is within hitting distance and alligned with paddle's angle, deflect
        const minDist = paddleObj?.radius + paddleObj?.width - this.radius;
        const maxDist = paddleObj?.radius + paddleObj?.width + this.radius;
        if(!this.deflected && dist >= minDist && dist <= maxDist)
        {
            this.closeToCenter = true;
            if(!!paddleObj && this.getPos().normalize().dot(paddleObj.getPos().normalize()) >= this.deflectThreshold)
            {
                this.deflected = true;
                this.shrinking = true;
                //this.speed = -this.speed;
                //scoreObj.addScore(1, this.getPos().normalize().multiplyScalar((pos.length() - this.radius)));
            }
        }
        else if(dist < Math.abs(minDist)) //ensure closeToCenter flag is toggled even if frames are skipped or paddleObj is missing
            this.closeToCenter = true;

        //if ball wasn't deflected in time, transition to slow linear movement towards center
        if(this.closeToCenter && !this.deflected)
        {
            //if ball would touch center, set position at edge of center and start shrinking
            if(dist < this.speed * dt + this.radius)
                this.shrinking = true;
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
            /*if(this.deflected && dist > this.cullDistance)
                this.handler.removeGameObject(this);*/
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
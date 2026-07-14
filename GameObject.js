import * as THREE from "three";
import { getRandomPointOnRectangle } from "./RandomPointOnRectangle.js";
import { shaders, meshes } from "./Shaders.js";

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
    return new THREE.Vector2((1.0 + screenPos.x) * screenWidth / 2, (1.0 - screenPos.y) * screenHeight / 2);
}

export class handler
{
    gameObjects = [];
    removeGameObjects = [];
    unshiftGameObjects = [];
    constructor(scene, ui, ghostUi, document)
    {
        this.scene = scene;
        this.ui = ui;
        this.ghostUi = ghostUi;
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
        gameObj.ghostUi = this.ghostUi;
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
    tick(dt, timems)
    {
        for(const go of this.gameObjects)
        {
            go.tick(dt, timems);
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
    tick(dt, timems)
    {
        //automatically set any uTime uniforms on materials of meshes

        if(!!this.mesh?.material?.userData?.shader?.uniforms?.uTime)
            this.mesh.material.userData.shader.uniforms.uTime.value = timems;
        else if(!!this.mesh?.material?.uniforms?.uTime)
            this.mesh.material.uniforms.uTime.value = timems;
    }
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
    getPos(includeAddedDepth = false)
    {
        const vec = this.pos.clone();
        if(!includeAddedDepth)
            vec.z -= this.addedDepth;
        return vec;
    }
}

export class paddle extends gameObject
{
    paddleMesh = meshes.paddle.clone();
    radius = 2.5;
    radiusStretch = {
        cursorDist: 0,
        screenCornerToCenter: 0,
        initRadius: 0,
        stretchAmount: 0.25,
    }
    targetAngle = Math.PI / 2;
    maxRotSpeed = Math.PI * 10; //radians per second
    angle = Math.PI / 2;
    width = null;
    pointLight = null;
    camera = null;
    dotSizeMod = 1;
    trail = {
        cwMeshes: null,
        ccwMeshes: null,
        lastAngle: 0,
        length: 0, //radians
        maxLength: Math.PI / 2,
        gap: Math.PI / 100, //radians
        lengthReduceSpeed: 8,
    };
    atomEffect = {
        atoms: [],
        numAtoms: 3,
        orbitSpeed: 2.0,
        spinSpeed: 2.0
    }
    constructor(camera)
    {
        super(new THREE.Object3D());

        //our mesh acts as the anchor point and the paddleMesh rotates with it but at radius
        this.paddleMesh.position.set(0, this.radius, 0);
        this.mesh.add(this.paddleMesh);

        this.width = this.paddleMesh.geometry.parameters.height;
        this.camera = camera;

        //subtle white light from paddle
        this.pointLight = new THREE.PointLight(0xffffff, 15, 15);
        this.pointLight.position.set(0, this.radius + this.width, 0);
        this.pointLight.castShadow = true;
        this.mesh.add(this.pointLight);

        //set up atoms for atom effect
        const ae = this.atomEffect;
        for(var i = 0; i < ae.numAtoms; i++)
        {
            const atom = new THREE.Object3D();

            const parent = new THREE.Object3D();
            parent.add(atom);

            const grandparent = new THREE.Object3D();
            grandparent.add(parent);

            const randRad = () => { return 2 * Math.PI * (Math.random() - 0.5) }

            const atomObj = {
                radius: 0.2,
                atom: atom,
                parent: parent,
                parentVel: new THREE.Vector3(randRad() * ae.orbitSpeed, randRad() * ae.orbitSpeed, randRad() * ae.orbitSpeed),
                grandparent: grandparent,
                grandparentVel: new THREE.Vector3(randRad() * ae.spinSpeed, randRad() * ae.spinSpeed, randRad() * ae.spinSpeed),
            };
            ae.atoms.push(atomObj);

            atom.position.set(0, ae.atoms[i].radius, 0);
        }

        paddleObj = this;
    }
    postInit(handler, ui, document)
    {
        // set up instanced meshes
        const tr = this.trail;
        
        const maxMeshes = Math.floor(this.trail.maxLength / this.trail.gap);
        console.log("Maximum instanced meshes per trail: " + maxMeshes);
        tr.ccwMeshes = new THREE.InstancedMesh(this.paddleMesh.geometry, shaders.paddleTrailMat, maxMeshes);
        tr.cwMeshes = tr.ccwMeshes.clone();

        //set instanced mesh transforms
        const dummy = new THREE.Object3D();
        dummy.scale.setScalar(0.8);
        const trailDir = tr.length < 0 ? -1 : 1;
        for(let trailDir = -1; trailDir <= 1; trailDir += 2)
        {
            for(let i = 0; i < maxMeshes; i++)
            {
                const a = tr.gap * (i + 1) * trailDir + Math.PI / 2;
                const scale = (maxMeshes - i) / maxMeshes;
                dummy.scale.setScalar(scale);
                dummy.position.set(Math.cos(a) * this.radius, Math.sin(a) * this.radius - this.paddleMesh.position.y, 0);
                dummy.rotation.z = a - Math.PI / 2;
                dummy.updateMatrix();
                const meshes = trailDir == 1 ? tr.ccwMeshes : tr.cwMeshes;
                meshes.setMatrixAt(i, dummy.matrix);
            }
        }
        this.paddleMesh.add(tr.ccwMeshes);
        this.paddleMesh.add(tr.cwMeshes);

        //initialize radiusStretch values
        const rs = this.radiusStretch;
        rs.screenCornerToCenter = new THREE.Vector2(ui.canvas.width, ui.canvas.height).length();
        rs.initRadius = this.radius;

        //respond to mouseEvent fired from game.js and rotate with mouse direction
        document.addEventListener("mouseEvent", event => {
            const e = event.detail;
            this.targetAngle = Math.atan2(e.coord.y, e.coord.x);
            this.radiusStretch.cursorDist = e.coord.length();
        });
    }
    tick(dt, timems)
    {
        super.tick(dt, timems);


        // dot in center

        //modify dot size based on score's color flash
        const cf = scoreObj.colorFlash;
        if(cf.lerp < 1)
        {
            if(cf.targetColor == cf.addScoreColor) //growing
                this.dotSizeMod = 1 + Math.sqrt(cf.lerp);
            else if(cf.targetColor == cf.subtractScoreColor) //shrinking
                this.dotSizeMod = 1 - cf.lerp * 0.5;
            else if(cf.targetColor == cf.defaultColor) //back to normal
            {
                if(this.dotSizeMod > 1) //back to normal after growing
                    this.dotSizeMod = 2 - Math.pow(cf.lerp, 2);
                else //back to normal after shrinking
                    this.dotSizeMod = cf.lerp * 0.5 + 0.5;
            }
        }
        else
            this.dotSizeMod = 1;

        //draw dot in center
        const scoreColor = scoreObj.colorFlash.color;
        this.ui.fillStyle = `rgb(${scoreColor.x}, ${scoreColor.y}, ${scoreColor.z})`;
        this.ui.beginPath();
	    this.ui.arc(this.ui.canvas.width / 2, this.ui.canvas.height / 2, 5 * this.dotSizeMod, 0, Math.PI * 2);
	    this.ui.fill();

        //draw ghosting atoms flying around dot in center
        const ae = this.atomEffect;
        for(var i = 0; i < ae.atoms.length; i++)
        {
            //rotate atoms
            const atom = ae.atoms[i];
            atom.parent.rotateX(atom.parentVel.x * dt);
            atom.parent.rotateY(atom.parentVel.y * dt);
            atom.parent.rotateZ(atom.parentVel.z * dt);
            atom.grandparent.rotateX(atom.grandparentVel.x * dt);
            atom.grandparent.rotateY(atom.grandparentVel.y * dt);
            atom.grandparent.rotateZ(atom.grandparentVel.z * dt);

            //draw 2d circle in ghost ui
            const worldPos = new THREE.Vector3();
            atom.atom.getWorldPosition(worldPos);
            const screenPos = worldToScreen(worldPos, this.camera, this.ui.canvas.width, this.ui.canvas.height);
            this.ghostUi.fillStyle = "white";
            this.ghostUi.beginPath();
            this.ghostUi.arc(screenPos.x, screenPos.y, 1.0, 0, Math.PI * 2);
            this.ghostUi.fill();
        }

        
        //stretch paddle radius based on where user's cursor is
        const rs = this.radiusStretch;
        this.radius = rs.initRadius - rs.stretchAmount + rs.cursorDist * rs.stretchAmount * 2;
        this.paddleMesh.position.y = this.radius;
        this.paddleMesh.scale.y = 1.0 - rs.cursorDist / 4;
        this.paddleMesh.scale.x = 1.0 + rs.cursorDist / 4;

        // draw trail of instanced meshes following paddle based on prior rotations
        
        const tr = this.trail;

        //shrink trail length over time
        tr.length -= (tr.length > 0 ? 1 : -1) * tr.lengthReduceSpeed * Math.abs(tr.length) * dt;

        //calculate angle difference from last frame and clamp to maxRotSpeed
        const angDiff = (tr.lastAngle - this.targetAngle) % (2 * Math.PI);
        const ccwDiff = angDiff < 0 ? angDiff + (2 * Math.PI) : angDiff; //counter clockwise difference
        const cwDiff = (2 * Math.PI - ccwDiff) % (2 * Math.PI); //clockwise difference
        const ccw = ccwDiff < cwDiff; //went counterclockwise if ccwDiff is shorter than cwDiff and vice versa
        let finalDiff = (ccw ? ccwDiff : cwDiff);
        if(finalDiff > this.maxRotSpeed * dt)
        {
            finalDiff = this.maxRotSpeed * dt;
            this.angle += (ccw ? -1 : 1) * finalDiff;
        }
        else
            this.angle = this.targetAngle;
        
        //apply to mesh
        this.mesh.rotation.z = this.angle - Math.PI / 2;
        
        //apply final angle difference to trail length
        tr.length += (ccw ? finalDiff : -finalDiff); //counterclockwise movement is positive, clockwise movement is negative
        tr.length = Math.min(tr.maxLength, Math.max(-tr.maxLength, tr.length)); //clamp length

        //derrive mesh count from trail length
        const meshCount = Math.floor(Math.abs(tr.length) / tr.gap);
        if(tr.length > 0)
        {
            tr.ccwMeshes.count = meshCount;
            tr.cwMeshes.count = 0;
        }
        else
        {
            tr.ccwMeshes.count = 0;
            tr.cwMeshes.count = meshCount;
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
        addScoreColor: new THREE.Vector3(255, 255, 0),
        subtractScoreColor: new THREE.Vector3(100, 100, 100),
        color: null,
        startColor: null,
        targetColor: null,
        lerp: 1,
        speed: 5,
    }
    constructor(camera)
    {
        super();
        scoreObj = this;

        this.camera = camera;

        this.colorFlash.color = this.colorFlash.defaultColor.clone();
        this.colorFlash.startColor = this.colorFlash.defaultColor.clone();
        this.colorFlash.targetColor = this.colorFlash.defaultColor.clone();

        //load score from local storage
        const storedScore = Number(localStorage.getItem("score"));
        this.score = !!storedScore ? storedScore : 0;
    }
    flashScoreColor(vec3, fadeIn = false, speed = 5)
    {
        const cf = this.colorFlash;

        //cf.targetColor = vec3;
        //cf.startColor = this.colorFlash.color.clone();
        cf.targetColor = vec3;
        cf.startColor = fadeIn ? cf.color.clone() : vec3;

        cf.lerp = 0;
        cf.color = cf.startColor;
        cf.speed = speed;
    }
    async addScore(num, pos)
    {
        if(num <= 0)
            return;
        
        //stagger multiple score particles for each point gained
        for(var i = 0; i < num; i++)
        {
            const particle = new scoreParticle(this.camera, pos, num);
            particle.stayTime += i * 0.1;
            this.handler.addGameObject(particle, true);
            particle.addEventListener("particleDeath", () => { 
                this.score += 1;
                this.flashScoreColor(this.colorFlash.addScoreColor, false, 5);
                localStorage.setItem("score", this.score); //save new score in local storage
            }, { once: true });
        }
    }
    subtractScore(num, pos)
    {
        this.score = Math.max(0, this.score - num);
        this.flashScoreColor(this.colorFlash.subtractScoreColor, false, 10 * Math.pow(0.6, num - 1));
        localStorage.setItem("score", this.score); //save new score in local storage
    }
    tick(dt, timems)
    {
        super.tick(dt, timems);

        const cf = this.colorFlash;
        if(cf.lerp < 1)
        {
            cf.lerp = Math.min(1, cf.lerp + dt * cf.speed);
            if(cf.startColor != cf.targetColor)
                cf.color = lerp(cf.startColor, cf.targetColor, cf.lerp);

            //fade back to default color after reaching target color
            if(cf.lerp == 1 && cf.targetColor != cf.defaultColor)
                this.flashScoreColor(cf.defaultColor, true, cf.speed);
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
    //maxOffset = 0.5;
    camera = null;
    timer = 0;
    vel = null;
    target = new THREE.Vector3();
    stopped = false;
    gravity = 0;
    constructor(camera, startPos = new THREE.Vector3(), amount = null, fallTime = null, fadeTime = null)
    {
        super(null, startPos);
        if(!!amount) this.amount = amount;
        if(!!fallTime) this.fallTime = fallTime;
        if(!!fadeTime) this.fadeTime = fadeTime;

        this.camera = camera;

        const rang = Math.random() * Math.PI * 2;
        this.gravity = new THREE.Vector3(Math.cos(rang) * 9.8, Math.sin(rang) * 9.8);

        //this.target = new THREE.Vector3(this.maxOffset * (Math.random() * 2 - 1), this.maxOffset * (Math.random() * 2 - 1));
    }
    tick(dt, timems)
    {
        super.tick(dt, timems);

        this.timer += dt;
        if(this.timer < this.stayTime) //staying
        {} //do nothing
        else if(this.timer < this.stayTime + this.fallTime) //falling
        {
            if(this.vel == null)
            {
                const pos = this.getPos();
                this.vel = new THREE.Vector3(
                    ((this.gravity.x / 2) * this.fallTime) + ((this.target.x - pos.x) / this.fallTime),
                    ((this.gravity.y / 2) * this.fallTime) + ((this.target.y - pos.y) / this.fallTime)
                );
            }

            //go towards target
            this.vel.sub(this.gravity.clone().multiplyScalar(dt)); //apply gravity to vel
            this.addPos(this.vel.clone().multiplyScalar(dt));
        }
        else if(this.timer >= this.fallTime + this.stayTime) //fading
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

        const screenPos = worldToScreen(this.getPos(true), this.camera, this.ui.canvas.width, this.ui.canvas.height);
        this.ghostUi.fillStyle = "yellow";
        this.ghostUi.beginPath();
	    this.ghostUi.arc(screenPos.x, screenPos.y, 2.5, 0, Math.PI * 2);
	    this.ghostUi.fill();
    }
}


// balls

export class ball extends gameObject
{
    damage = 1;
    speed = 5;
    camera = null;
    radius = null;
    closeToCenter = false;
    deflected = false;
    deflectShrinkSpeed = 18;
    shrinking = false;
    deflectThreshold = 0.85;
    centerLerp = 0;
    centerSpeed = 5;
    //pointLight = null;
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

        //this.pointLight = new THREE.PointLight(this.mesh.material.color, 15, this.radius + 5);
        //this.mesh.add(this.pointLight);

        //get spawn point on edge of screen at the origin
        let viewSize = new THREE.Vector2();
        camera.getViewSize(camera.position.z - this.addedDepth, viewSize); //populates viewSize with width and height of camera's view z units away
        const spawnOffset = this.radius * 3;
        const spawnPoint = getRandomPointOnRectangle(viewSize.width + spawnOffset, viewSize.height + spawnOffset);
        //this.cullDistance = viewSize.length();

        this.setPos(new THREE.Vector3(spawnPoint.x, spawnPoint.y, 0));
    }
    tick(dt, timems)
    {
        super.tick(dt, timems);

        const pos = this.getPos();
        const dist = pos.length();

        //shrinking logic for deflected and when hit the center
        if(this.shrinking)
        {
            const shrinkSpeed = this.deflected ? (this.deflectShrinkSpeed * Math.pow(this.mesh.scale.x, 1.5)) : (this.centerSpeed / this.radius / 2);
            const newScale = this.mesh.scale.x - dt * shrinkSpeed;

            //shrink to minimum size, then remove self
            if(newScale * this.radius > (this.deflected ? 0.05 : 0))
                this.mesh.scale.setScalar(newScale);
            else
            {
                this.handler.removeGameObject(this);
                if(this.deflected)
                    scoreObj.addScore(this.damage, this.getPos(true));
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
            const paddleDir = new THREE.Vector3(Math.cos(paddleObj.angle), Math.sin(paddleObj.angle));
            if(!!paddleObj && this.getPos().normalize().dot(paddleDir) >= this.deflectThreshold)
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
    damage = 2;
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
    damage = 2;
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
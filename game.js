import * as THREE from "three";
import * as GameObject from "./GameObject.js";
import { getMeshes } from "./Shaders.js";

window.addEventListener("load", () => {
    if("requestIdleCallback" in window)
        requestIdleCallback(loadGame);
    else
    {
        console.log("requestIdleCallback does not exist.");
        setTimeout(loadGame, 500);
    }
});

function loadGame()
{
    let dpr = window.devicePixelRatio || 1;

    //set up meshes with params from url
    const urlParams = Object.fromEntries(new URLSearchParams(window.location.search));
    const meshes = getMeshes(urlParams);

    //set up three renderer
    let w = window.innerWidth;
    let h = window.innerHeight;
    const renderer = new THREE.WebGLRenderer({
        canvas: document.getElementById("three"),
        antialias: true
    });
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    //set up ui canvas
    const canvas = document.getElementById("ui");
    const ui = canvas.getContext("2d");

    //extra ui canvas with ghosting effect instead of normal drawing
    const ghostCanvas = document.getElementById("ghostui");
    const ghostUi = ghostCanvas.getContext("2d");

    //set up scene
    const fov = 50;
    const aspect = w / h;
    const near = 0.1;
    const far = 40;
    const camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
    camera.position.z = 20;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("black");
    camera.updateMatrixWorld();

    handleWindowResize();

    //set up lighting
    const hemiLight = new THREE.AmbientLight(urlParams.ambient ? urlParams.ambient : 0x608060);
    scene.add(hemiLight);
    const pointLight = new THREE.PointLight(urlParams.centerLight ? urlParams.centerLight : "white", 150, 40);
    pointLight.position.z = 1.5;
    pointLight.castShadow = true;
    scene.add(pointLight);
    const pointLightBack = new THREE.PointLight(urlParams.centerLight ? urlParams.centerLight : "white", 150, 40);
    pointLightBack.position.z = -1;
    pointLightBack.castShadow = true;
    scene.add(pointLightBack);

    //game objects
    const handler = new GameObject.handler(scene, camera, ui, ghostUi, meshes);
    handler.newGameObject(GameObject.paddle, { paddleColor: urlParams.paddle });
    handler.newGameObject(GameObject.scoreKeeper, { 
        defaultScore: urlParams.defaultScore, 
        addScore: urlParams.addScore, 
        highScore: urlParams.highScore, 
        subtractScore: urlParams.subtractScore,
        showScore: urlParams.showScore,
        scoreParticle: urlParams.scoreParticle
    });


    //mouse input
    document.addEventListener("mousemove", event => {
        dispatchMouseEvent(event);
    });

    //touch input
    document.addEventListener("touchmove", handleTouch, { passive: false });
    document.addEventListener("touchstart", handleTouch, { passive: false });
    function handleTouch(event)
    {
        event.preventDefault();
        const touchEvent = event.touches[0];
        dispatchMouseEvent(touchEvent);
    }

    //custom mouseEvent
    function dispatchMouseEvent(event)
    {
        //convert to normalized device coordinates (NDC) (-1 to 1)
        const coordX = (event.clientX / w) * 2 - 1;
        const coordY = (event.clientY / h) * 2 - 1;
        document.dispatchEvent( new CustomEvent("mouseEvent", { 
            detail: {
                pos: new THREE.Vector2(event.clientX * dpr, event.clientY * dpr),
                coord: new THREE.Vector2(coordX, coordY)
            }}) );
    }


    //ball spawning variables
    const ballSpawnTime = 0.5;
    let ballSpawnTimer = ballSpawnTime;
    const ballSpawnWeights = [
        { type: GameObject.ball, weight: 1 },
        { type: GameObject.bob, weight: 1 },
        { type: GameObject.orbiter, weight: 1 },
        { type: GameObject.bertha, weight: 1 }
    ];
    const ballSpawnWeightSum = ballSpawnWeights.reduce((sum, e) => sum + e.weight, 0);

    //always start with a bertha on screen
    handler.newGameObject(GameObject.bertha);

    //add background
    handler.newGameObject(GameObject.background);

    //tick
    let lastTime = 0;
    function tick(t = 0)
    {
        requestAnimationFrame(tick);
        let dt = (t - lastTime) / 1000;
        lastTime = t;
        let time = t / 1000;

        //camera.position.set(0, Math.sin(time) * 7.5, 20);
        //camera.lookAt(0, 0, 0);

        //dont process this frame if it's is after a large accumulation of skipped frames
        if(dt > 1.0)
            return;

        if(dpr != window.devicePixelRatio)
            handleWindowResize();

        //once timer is up, spawn a new ball of a random type with weighted chances
        ballSpawnTimer -= dt;
        if(ballSpawnTimer <= 0)
        {
            ballSpawnTimer = ballSpawnTime;
            const rn = Math.random() * ballSpawnWeightSum;

            let weightTotal = 0;
            let type = GameObject.ball;
            for(const wt of ballSpawnWeights)
            {
                weightTotal += wt.weight;
                if(rn < weightTotal)
                {
                    type = wt.type;
                    break;
                }
            }

            handler.newGameObject(type);
        }

        //clear previously drawn ui frame
        ui.clearRect(0, 0, w * dpr, h * dpr);
        
        //only partially clear previously drawn ui frame for ghost ui
        ghostUi.save();
        ghostUi.globalCompositeOperation = "destination-out";
        ghostUi.fillStyle = "rgba(0, 0, 0, 0.25)";
        ghostUi.fillRect(0, 0, w * dpr, h * dpr);
        ghostUi.restore();
        ghostUi.globalCompositeOperation = "source-over";
        
        handler.tick(dt, time);

        renderer.render(scene, camera);
    }
    tick();

    //adapt to resized window
    function handleWindowResize()
    {
        dpr = window.devicePixelRatio;
        renderer.setPixelRatio(dpr);
        w = window.innerWidth;
        h = window.innerHeight;
        renderer.setSize(w, h);
        canvas.style.width = w + "px";
        canvas.style.height = h + "px";
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        ui.setTransform(dpr, 0, 0, dpr, 0, 0);
        ui.width = w;
        ui.height = h;
        ghostCanvas.style.width = w + "px";
        ghostCanvas.style.height = h + "px";
        ghostCanvas.width = w * dpr;
        ghostCanvas.height = h * dpr;
        ghostUi.setTransform(dpr, 0, 0, dpr, 0, 0);
        ghostUi.width = w;
        ghostUi.height = h;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();

        document.dispatchEvent( new CustomEvent("windowResize"), { 
            detail: { 
                newSize: new THREE.Vector2(w, h),
                camera: camera
            } 
        });
    }
    window.addEventListener("resize", handleWindowResize, false);
}
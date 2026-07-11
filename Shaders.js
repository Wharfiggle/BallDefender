import * as THREE from "three";

//called by first modular onBeforeCompile shader modifier
function establishOnBeforeCompileChain(material)
{
    material.userData.onBeforeCompileList = [];

    //replace cache key so compiler doesnt assume shaders with different modifications are the same
    material.userData.cacheKey = "";
    material.customProgramCacheKey = () => { return material.userData.cacheKey; }
    
    material.onBeforeCompile = (shader) => {
        const onbcl = material.userData.onBeforeCompileList;
        for(var i = 0; i < onbcl.length; i++)
        {
            onbcl[i](shader);
        }

        //store for later access
        material.userData.shader = shader;
    };

    return material;
}

//wobble vertices in a sin pattern
export function applyVerticeWobble(args, material)
{
    const wobbleAmount = args.wobbleAmount ? args.wobbleAmount : 5.0;

    if(!material.userData.onBeforeCompileList)
        material = establishOnBeforeCompileChain(material);

    material.userData.onBeforeCompileList.push((shader) => {
        shader.uniforms.uTime = { value: 0 };

        //pass uniforms
        shader.vertexShader = `uniform float uTime;
            ` + shader.vertexShader;

        //begin_vertex is where transformed is calculated from vertex position
        shader.vertexShader = shader.vertexShader.replace(
            "#include <begin_vertex>", `#include <begin_vertex>
            transformed.y += sin(transformed.x * ${wobbleAmount} + uTime * 10.0) * 0.1;`);
    });
    
    material.userData.cacheKey += "verticeWobble: " + wobbleAmount;
    return material;
}

//cut out forward facing normals
export function applyMarbleFresnel(material)
{
    if(!material.userData.onBeforeCompileList)
        material = establishOnBeforeCompileChain(material);

    material.userData.onBeforeCompileList.push((shader) => {
        shader.fragmentShader = shader.fragmentShader.replace(
            "#include <opaque_fragment>",
            `float facing = abs(dot(geometryNormal, geometryViewDir));
            diffuseColor.a = 0.3 + (1.0 - facing);
            #include <opaque_fragment>`
        );
    });

    material.userData.cacheKey += "marbleFresnel"
    return material;
}

//slightly transparent white material
const paddleTrailMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.05
});

export const shaders = {
    paddleTrailMat: paddleTrailMat,
}


//set up meshes
const standardBallMesh = new THREE.IcosahedronGeometry(0.5, 2); 
export const meshes = {
    ball: new THREE.Mesh(
        standardBallMesh,
        applyMarbleFresnel(
            applyVerticeWobble({wobbleAmount: "6.0"},
                new THREE.MeshStandardMaterial({ color: "purple", transparent: true })))
    ),
    bob: new THREE.Mesh(
        standardBallMesh,
        applyMarbleFresnel(
            applyVerticeWobble({wobbleAmount: "6.0"},
                new THREE.MeshStandardMaterial({ color: "green", transparent: true})))
    ),
    orbiter: new THREE.Mesh(
        standardBallMesh,
        applyMarbleFresnel(
            applyVerticeWobble({wobbleAmount: "6.0"},
                new THREE.MeshStandardMaterial({ color: "navy", transparent: true })))
    ),
    bertha: new THREE.Mesh(
        new THREE.IcosahedronGeometry(1.5, 6),
        applyMarbleFresnel(
            applyVerticeWobble({wobbleAmount: "2.0"},
                new THREE.MeshStandardMaterial({ color: "red", transparent: true })))
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
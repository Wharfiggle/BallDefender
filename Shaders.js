import * as THREE from "three";

const shaderFunctions = {
    fit: `float fit(float unscaled, float originalMin, float originalMax, float minAllowed, float maxAllowed)
        { return (maxAllowed - minAllowed) * (unscaled - originalMin) / (originalMax - originalMin) + minAllowed; }`,
    smoothMod: `float smoothMod(float axis, float amp, float rad)
        {
            float top = cos(PI * (axis / amp)) * sin(PI * (axis / amp));
            float bottom = pow(sin(PI * (axis / amp)), 2.0) + pow(rad, 2.0);
            float at = atan(top / bottom);
            return amp * (0.5) - (1.0 / PI) * at;
        }`,
    perlin3dNoise: `vec4 permute(vec4 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
        vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
        vec3 fade(vec3 t) { return t*t*t*(t*(t*6.0-15.0)+10.0); }
        float noise(vec3 P) {
            vec3 Pi0 = floor(P); // Integer part for indexing
            vec3 Pi1 = Pi0 + vec3(1.0); // Integer part + 1
            Pi0 = mod(Pi0, 289.0);
            Pi1 = mod(Pi1, 289.0);
            vec3 Pf0 = fract(P); // Fractional part for interpolation
            vec3 Pf1 = Pf0 - vec3(1.0); // Fractional part - 1.0
            vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);
            vec4 iy = vec4(Pi0.yy, Pi1.yy);
            vec4 iz0 = Pi0.zzzz;
            vec4 iz1 = Pi1.zzzz;

            vec4 ixy = permute(permute(ix) + iy);
            vec4 ixy0 = permute(ixy + iz0);
            vec4 ixy1 = permute(ixy + iz1);

            vec4 gx0 = ixy0 / 7.0;
            vec4 gy0 = fract(floor(gx0) / 7.0) - 0.5;
            gx0 = fract(gx0);
            vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0);
            vec4 sz0 = step(gz0, vec4(0.0));
            gx0 -= sz0 * (step(0.0, gx0) - 0.5);
            gy0 -= sz0 * (step(0.0, gy0) - 0.5);

            vec4 gx1 = ixy1 / 7.0;
            vec4 gy1 = fract(floor(gx1) / 7.0) - 0.5;
            gx1 = fract(gx1);
            vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1);
            vec4 sz1 = step(gz1, vec4(0.0));
            gx1 -= sz1 * (step(0.0, gx1) - 0.5);
            gy1 -= sz1 * (step(0.0, gy1) - 0.5);

            vec3 g000 = vec3(gx0.x,gy0.x,gz0.x);
            vec3 g100 = vec3(gx0.y,gy0.y,gz0.y);
            vec3 g010 = vec3(gx0.z,gy0.z,gz0.z);
            vec3 g110 = vec3(gx0.w,gy0.w,gz0.w);
            vec3 g001 = vec3(gx1.x,gy1.x,gz1.x);
            vec3 g101 = vec3(gx1.y,gy1.y,gz1.y);
            vec3 g011 = vec3(gx1.z,gy1.z,gz1.z);
            vec3 g111 = vec3(gx1.w,gy1.w,gz1.w);

            vec4 norm0 = taylorInvSqrt(vec4(dot(g000, g000), dot(g010, g010), dot(g100, g100), dot(g110, g110)));
            g000 *= norm0.x;
            g010 *= norm0.y;
            g100 *= norm0.z;
            g110 *= norm0.w;
            vec4 norm1 = taylorInvSqrt(vec4(dot(g001, g001), dot(g011, g011), dot(g101, g101), dot(g111, g111)));
            g001 *= norm1.x;
            g011 *= norm1.y;
            g101 *= norm1.z;
            g111 *= norm1.w;

            float n000 = dot(g000, Pf0);
            float n100 = dot(g100, vec3(Pf1.x, Pf0.yz));
            float n010 = dot(g010, vec3(Pf0.x, Pf1.y, Pf0.z));
            float n110 = dot(g110, vec3(Pf1.xy, Pf0.z));
            float n001 = dot(g001, vec3(Pf0.xy, Pf1.z));
            float n101 = dot(g101, vec3(Pf1.x, Pf0.y, Pf1.z));
            float n011 = dot(g011, vec3(Pf0.x, Pf1.yz));
            float n111 = dot(g111, Pf1);

            vec3 fade_xyz = fade(Pf0);
            vec4 n_z = mix(vec4(n000, n100, n010, n110), vec4(n001, n101, n011, n111), fade_xyz.z);
            vec2 n_yz = mix(n_z.xy, n_z.zw, fade_xyz.y);
            float n_xyz = mix(n_yz.x, n_yz.y, fade_xyz.x); 
            return 2.2 * n_xyz;
        }`
}

//called by first modular onBeforeCompile shader modifier
function establishOnBeforeCompileChain(material, features) //features: array of strings
{
    material.userData.onBeforeCompileList = [];

    //replace cache key so compiler doesnt assume shaders with different modifications are the same
    material.userData.cacheKey = "";
    material.customProgramCacheKey = () => { return material.userData.cacheKey; }
    
    material.onBeforeCompile = (shader) => {
        if(features.includes("uTime"))
        {
            shader.uniforms.uTime = { value: 0 };
            shader.vertexShader = `uniform float uTime;
                ` + shader.vertexShader;
            shader.fragmentShader = `uniform float uTime;
                ` + shader.fragmentShader;
        }

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

export function applyGermyPattern(material)
{
    if(!material.userData.onBeforeCompileList)
        material = establishOnBeforeCompileChain(material, ["uTime"]);

    material.userData.onBeforeCompileList.push((shader) => {
        shader.vertexShader = shader.vertexShader.replace( //varyings
            "#include <common>", `#include <common>
            varying vec2 vUv;
            varying vec3 vWorldPosition;`
        ).replace( //pass uv
            "#include <uv_vertex>", `#include <uv_vertex>
            vUv = uv;`
        ).replace( //pass worldPosition
            '#include <begin_vertex>', `#include <begin_vertex>
            vWorldPosition = vec3(modelMatrix * vec4(transformed, 1.0));`
        );

        shader.fragmentShader = shader.fragmentShader.replace(
            "#include <common>", `#include <common>
            varying vec2 vUv;
            varying vec3 vWorldPosition;`
        ).replace( //functions
            "void main() {",
            shaderFunctions.smoothMod + `
            ` + shaderFunctions.perlin3dNoise + `
            float wave(vec3 position)
            { return smoothMod(length(position) / 5.0, 0.09, 2.0); }
            void main() {`
        ).replace( //main pattern calculation
            "#include <opaque_fragment>", `#include <opaque_fragment>
            vec3 coords = vWorldPosition * 0.1;
            coords.z += uTime / 10.0;
            float pattern = wave(coords + noise(coords));
            float alpha = 1.0 - pow(length(vWorldPosition), 2.0) / 1000.0;
            pattern += length(vWorldPosition) / 1000.0;
            gl_FragColor = vec4(pattern * 0.75, pattern, pattern * 0.75, alpha);
            return;`
        );
    });

    material.userData.cacheKey += "background";
    return material;
}

//make lumpy animated organelle looking thing
export function applyOrganelle(args, material)
{
    const density = args.density ? args.density : "3.0";
    const colorIntensity = args.colorIntensity ? args.colorIntensity : "0.5";

    if(!material.userData.onBeforeCompileList)
        material = establishOnBeforeCompileChain(material, ["uTime"]);

    material.userData.onBeforeCompileList.push((shader) => {
        shader.vertexShader = shader.vertexShader.replace( //varyings
            "#include <common>", `#include <common>
            varying float vDisplacement;`
        ).replace( //functions
            "void main() {",
            shaderFunctions.smoothMod + `
            ` + shaderFunctions.fit + `
            ` + shaderFunctions.perlin3dNoise + `
            float wave(vec3 position)
            { return fit(smoothMod(position.y * ${density}, 1.0, 1.5), 0.1, 0.6, 0.0, 1.0); }
            void main() {`
        ).replace( //main calculations
            "#include <begin_vertex>", `#include <begin_vertex>
            vec3 coords = vNormal;
            coords.y += (uTime + length(modelMatrix[3].xyz)) / 2.0;
            vDisplacement = wave(vec3(noise(coords)));
            transformed *= vDisplacement;`
        );

        shader.fragmentShader = shader.fragmentShader.replace( //varyings
            '#include <common>', `#include <common>
            varying vec3 vMyPosition;
            varying float vDisplacement;`
        ).replace( //make valleys darker
            "#include <opaque_fragment>", `#include <opaque_fragment>
            gl_FragColor.rgb *= pow(vDisplacement, ${colorIntensity});`
        );
    });

    material.userData.cacheKey += "organelle: " + density + ", " + colorIntensity;
    return material;
}

//wobble vertices in a sin pattern
export function applyVerticeWobble(args, material)
{
    const intensity = args.intensity ? args.intensity : "5.0";
    const speed = args.speed ? args.speed : "10.0";

    if(!material.userData.onBeforeCompileList)
        material = establishOnBeforeCompileChain(material, ["uTime"]);

    material.userData.onBeforeCompileList.push((shader) => {
        //begin_vertex is where transformed is calculated from vertex position
        shader.vertexShader = shader.vertexShader.replace(
            "#include <begin_vertex>", `#include <begin_vertex>
            transformed.y += sin(transformed.x * ${intensity} + uTime * ${speed}) * 0.1;
            transformed.x += sin(transformed.y * ${intensity} + uTime * ${speed}) * 0.1;`);
    });
    
    material.userData.cacheKey += "verticeWobble: " + intensity + ", " + speed;
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
export const paddleTrailMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.05,
    depthTest: false
});

//set up meshes
const standardBallMesh = new THREE.IcosahedronGeometry(0.65, 3); 
export const meshes = {
    background: new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        applyGermyPattern(
            new THREE.MeshStandardMaterial( { color: "blue" }))
    ),
    organelleBertha: new THREE.Mesh(
        new THREE.IcosahedronGeometry(1.0, 20),
        applyVerticeWobble({intensity: "2.0", speed: "5.0"},
            applyOrganelle({density: "3.0", colorIntensity: "3.0"},
                new THREE.MeshStandardMaterial({ color: "yellow" })))
    ),
    bertha: new THREE.Mesh(
        new THREE.IcosahedronGeometry(1.5, 6),
        applyMarbleFresnel(
            applyVerticeWobble({intensity: "2.0", speed: "5.0"},
                new THREE.MeshStandardMaterial({ color: "red" })))
    ),
    organelle: new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.5, 5),
        applyVerticeWobble({intensity: "2.0"},
            applyOrganelle({density: "1.5", colorIntensity: "5.0"},
                new THREE.MeshStandardMaterial({ color: "yellow" })))
    ),
    ball: new THREE.Mesh(
        standardBallMesh,
        applyMarbleFresnel(
            applyVerticeWobble({intensity: "2.0"},
                new THREE.MeshStandardMaterial({ color: "purple" })))
    ),
    bob: new THREE.Mesh(
        standardBallMesh,
        applyMarbleFresnel(
            applyVerticeWobble({intensity: "2.0"},
                new THREE.MeshStandardMaterial({ color: "green" })))
    ),
    orbiter: new THREE.Mesh(
        standardBallMesh,
        applyMarbleFresnel(
            applyVerticeWobble({intensity: "2.0"},
                new THREE.MeshStandardMaterial({ color: "navy" })))
    ),
    paddle: new THREE.Mesh(
        new THREE.BoxGeometry(2.0, 0.2, 2.8),
        new THREE.MeshStandardMaterial({ color: "white" })
    )
}

for(const [index, [key, mesh]] of Object.entries(meshes).entries())
{
    meshes[key].material.transparent = true;
    if(!key.includes("organelle"))
        meshes[key].material.depthTest = false;
    meshes[key].renderOrder = index;
}

meshes.bertha.add(meshes.organelleBertha.clone());
meshes.ball.add(meshes.organelle.clone());
meshes.bob.add(meshes.organelle.clone());
meshes.orbiter.add(meshes.organelle.clone());
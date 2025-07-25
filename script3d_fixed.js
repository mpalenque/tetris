// UI elements
const scoreText = document.getElementById("scoreNumber")
const linesText = document.getElementById("linesNumber")
const fullText = document.getElementById("fullNumber")

// Three.js setup
let scene, camera, renderer, nextScene, nextCamera, nextRenderer
let composer, bloomPass
let blockSize = 75
const boardWidth = 12
const boardHeight = 20
const boardSize = boardWidth * boardHeight

// GLB model variables
let serverModel = null
let serverGeometry = null
let serverMaterial = null
let isModelLoaded = false

// Load GLB model function
function loadServerModel() {
    const loader = new THREE.GLTFLoader()
    
    // Show loading message
    const gameContainer = document.getElementById('gameContainer')
    const loadingDiv = document.createElement('div')
    loadingDiv.id = 'loading'
    loadingDiv.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        color: white;
        font-family: Arial, sans-serif;
        font-size: 16px;
        text-align: center;
        z-index: 1000;
    `
    loadingDiv.innerHTML = 'Loading server model...<br><div style="margin-top: 10px;">0%</div>'
    gameContainer.appendChild(loadingDiv)
    
    return new Promise((resolve, reject) => {
        loader.load(
            'server.glb',
            function(gltf) {
                console.log('Server model loaded successfully')
                serverModel = gltf.scene
                
                // Extract geometry and materials from GLB
                let meshFound = false
                serverModel.traverse((child) => {
                    if (child.isMesh && !meshFound) {
                        console.log('Found mesh in GLB, extracting geometry and material')
                        meshFound = true
                        serverGeometry = child.geometry.clone()
                        
                        // Properly handle different material types from GLB
                        let originalMaterial = child.material
                        console.log('Original material type:', originalMaterial.type)
                        console.log('Original material properties:', originalMaterial)
                        
                        if (Array.isArray(originalMaterial)) {
                            // Handle multi-material mesh - use first material
                            originalMaterial = originalMaterial[0]
                        }
                        
                        // Convert to PBR-compatible material while preserving all properties
                        if (originalMaterial.isMeshStandardMaterial || originalMaterial.isMeshPhysicalMaterial) {
                            // Already PBR compatible, just clone
                            serverMaterial = originalMaterial.clone()
                        } else {
                            // Convert other material types to MeshStandardMaterial
                            serverMaterial = new THREE.MeshStandardMaterial()
                            
                            // Copy all relevant properties
                            if (originalMaterial.color) serverMaterial.color.copy(originalMaterial.color)
                            if (originalMaterial.emissive) {
                                serverMaterial.emissive.copy(originalMaterial.emissive)
                                console.log('Copied emissive color:', originalMaterial.emissive)
                            }
                            if (originalMaterial.emissiveIntensity !== undefined) {
                                serverMaterial.emissiveIntensity = originalMaterial.emissiveIntensity
                                console.log('Copied emissive intensity:', originalMaterial.emissiveIntensity)
                            }
                            if (originalMaterial.map) serverMaterial.map = originalMaterial.map
                            if (originalMaterial.emissiveMap) serverMaterial.emissiveMap = originalMaterial.emissiveMap
                            if (originalMaterial.normalMap) serverMaterial.normalMap = originalMaterial.normalMap
                            if (originalMaterial.roughnessMap) serverMaterial.roughnessMap = originalMaterial.roughnessMap
                            if (originalMaterial.metalnessMap) serverMaterial.metalnessMap = originalMaterial.metalnessMap
                            if (originalMaterial.transparent !== undefined) serverMaterial.transparent = originalMaterial.transparent
                            if (originalMaterial.opacity !== undefined) serverMaterial.opacity = originalMaterial.opacity
                            
                            // Set reasonable PBR defaults
                            serverMaterial.metalness = originalMaterial.metalness || 0.3
                            serverMaterial.roughness = originalMaterial.roughness || 0.4
                        }
                        
                        // Ensure material works with lighting
                        serverMaterial.needsUpdate = true
                        
                        console.log('Final server material:', serverMaterial)
                        console.log('Emissive properties - color:', serverMaterial.emissive, 'intensity:', serverMaterial.emissiveIntensity)
                        
                        // Scale the geometry to fit our block size
                        const box = new THREE.Box3().setFromObject(child)
                        const size = box.getSize(new THREE.Vector3())
                        const maxDimension = Math.max(size.x, size.y, size.z)
                        const scale = (blockSize * 0.8) / maxDimension
                        
                        serverGeometry.scale(scale, scale, scale)
                        console.log(`Scaled model by factor: ${scale}`)
                        
                        // Center the geometry
                        const boundingBox = new THREE.Box3().setFromBufferAttribute(serverGeometry.attributes.position)
                        const center = boundingBox.getCenter(new THREE.Vector3())
                        serverGeometry.translate(-center.x, -center.y, -center.z)
                    }
                })
                
                if (!serverGeometry) {
                    console.error('No mesh found in GLB file')
                    reject(new Error('No mesh found in GLB file'))
                    return
                }
                
                isModelLoaded = true
                // Remove loading message
                if (loadingDiv.parentNode) {
                    loadingDiv.parentNode.removeChild(loadingDiv)
                }
                resolve(serverGeometry)
            },
            function(progress) {
                const percent = Math.round(progress.loaded / progress.total * 100)
                console.log('Loading progress:', percent + '%')
                if (loadingDiv) {
                    loadingDiv.innerHTML = `Loading server model...<br><div style="margin-top: 10px;">${percent}%</div>`
                }
            },
            function(error) {
                console.error('Error loading GLB model:', error)
                // Remove loading message
                if (loadingDiv.parentNode) {
                    loadingDiv.parentNode.removeChild(loadingDiv)
                }
                reject(error)
            }
        )
    })
}

// Initialize Three.js
function initThreeJS() {
    // Main game scene
    scene = new THREE.Scene()
    camera = new THREE.OrthographicCamera(
        -boardWidth * blockSize / 2, boardWidth * blockSize / 2,
        boardHeight * blockSize / 2, -boardHeight * blockSize / 2,
        1, 1000
    )
    
    // Position camera with more rotation to clearly see 3D cubes
    const angleX = 8 * Math.PI / 180;  // 8 degrees X rotation for better depth
    const angleY = 12 * Math.PI / 180; // 12 degrees Y rotation for clear 3D view
    camera.position.set(
        Math.sin(angleY) * 20, 
        Math.sin(angleX) * 12, 
        Math.cos(angleY) * Math.cos(angleX) * 20
    )
    camera.lookAt(0, 0, 0)
    
    renderer = new THREE.WebGLRenderer({ 
        antialias: true,
        powerPreference: "high-performance"
    })
    renderer.setSize(900, 1500)
    renderer.setClearColor(0x1a1a1a)
    
    // Enhanced settings for GLB materials and emissive support
    renderer.physicallyCorrectLights = true
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.outputEncoding = THREE.sRGBEncoding
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.2  // Increased for better visibility
    renderer.gammaFactor = 2.2
    
    // Enable better material rendering
    renderer.capabilities.logarithmicDepthBuffer = true
    
    document.getElementById('gameContainer').appendChild(renderer.domElement)

    // Next piece scene with same increased rotation
    nextScene = new THREE.Scene()
    nextCamera = new THREE.OrthographicCamera(-150, 150, 112, -112, 1, 1000)
    const nextAngleX = 8 * Math.PI / 180;
    const nextAngleY = 12 * Math.PI / 180;
    nextCamera.position.set(
        Math.sin(nextAngleY) * 10, 
        Math.sin(nextAngleX) * 6, 
        Math.cos(nextAngleY) * Math.cos(nextAngleX) * 10
    )
    nextCamera.lookAt(0, 0, 0)
    
    nextRenderer = new THREE.WebGLRenderer({ 
        antialias: true,
        powerPreference: "high-performance"
    })
    nextRenderer.setSize(400, 300)
    nextRenderer.setClearColor(0x2a2a2a)
    
    // Same enhanced settings for next renderer
    nextRenderer.physicallyCorrectLights = true
    nextRenderer.shadowMap.enabled = true
    nextRenderer.shadowMap.type = THREE.PCFSoftShadowMap
    nextRenderer.outputEncoding = THREE.sRGBEncoding
    nextRenderer.toneMapping = THREE.ACESFilmicToneMapping
    nextRenderer.toneMappingExposure = 1.2  // Increased for better visibility
    nextRenderer.gammaFactor = 2.2
    
    document.getElementById('nextCanvas').appendChild(nextRenderer.domElement)
    
    // Setup post-processing
    setupPostProcessing()
    
    // Professional PBR lighting setup
    setupPBRLighting()
    
    // Add floor with reflective surface
    createReflectiveFloor()
    
    // Setup lighting for next scene too
    setupNextSceneLighting()
    
    // Load the server model and then start the game
    loadServerModel().then(() => {
        console.log('Model loaded successfully, starting game...')
        console.log('Server material loaded:', serverMaterial)
        if (serverMaterial) {
            console.log('Material color:', serverMaterial.color)
            console.log('Material emissive:', serverMaterial.emissive)
            console.log('Material emissiveIntensity:', serverMaterial.emissiveIntensity)
            console.log('Material metalness:', serverMaterial.metalness)
            console.log('Material roughness:', serverMaterial.roughness)
        }
        createBackgroundPlanes()
        createBackgroundParticles()
        resetGame()
        setInterval(gameLoop, 20)
    }).catch((error) => {
        console.error('Failed to load model, falling back to enhanced box geometry')
        console.error('Error details:', error)
        // Enhanced fallback geometry and material
        serverGeometry = new THREE.BoxGeometry(blockSize * 0.8, blockSize * 0.8, blockSize * 0.8)
        serverMaterial = new THREE.MeshStandardMaterial({
            color: 0x666666,
            metalness: 0.3,
            roughness: 0.4,
            emissive: 0x333333,
            emissiveIntensity: 0.3
        })
        isModelLoaded = true
        createBackgroundPlanes()
        createBackgroundParticles()
        resetGame()
        setInterval(gameLoop, 20)
    })
}

function setupPBRLighting() {
    // Remove any existing lights
    scene.children = scene.children.filter(child => !(child.isLight))
    
    // Main directional light - stronger and better positioned
    const keyLight = new THREE.DirectionalLight(0xffffff, 3.0)
    keyLight.position.set(15, 25, 15)
    keyLight.castShadow = true
    keyLight.shadow.mapSize.width = 4096
    keyLight.shadow.mapSize.height = 4096
    keyLight.shadow.camera.near = 0.1
    keyLight.shadow.camera.far = 100
    keyLight.shadow.camera.left = -50
    keyLight.shadow.camera.right = 50
    keyLight.shadow.camera.top = 50
    keyLight.shadow.camera.bottom = -50
    keyLight.shadow.radius = 10
    keyLight.shadow.blurSamples = 25
    scene.add(keyLight)

    // Fill light from opposite side - stronger
    const fillLight = new THREE.DirectionalLight(0xffffff, 2.0)
    fillLight.position.set(-20, 15, -10)
    scene.add(fillLight)

    // Rim light for edge definition - stronger
    const rimLight = new THREE.DirectionalLight(0xffffff, 1.5)
    rimLight.position.set(0, 8, -25)
    scene.add(rimLight)

    // Strong ambient light for base illumination
    const ambientLight = new THREE.AmbientLight(0x404040, 1.2)
    scene.add(ambientLight)

    // Hemisphere light for natural sky/ground lighting
    const hemisphereLight = new THREE.HemisphereLight(0x87CEEB, 0x8B4513, 0.8)
    scene.add(hemisphereLight)
    
    // Additional point lights for better GLB material visibility
    const pointLight1 = new THREE.PointLight(0xffffff, 2.0, 200)
    pointLight1.position.set(20, 20, 20)
    scene.add(pointLight1)
    
    const pointLight2 = new THREE.PointLight(0xffffff, 1.5, 200)
    pointLight2.position.set(-20, 20, 20)
    scene.add(pointLight2)
    
    // Extra light specifically for emissive materials
    const emissiveLight = new THREE.DirectionalLight(0xffffff, 1.0)
    emissiveLight.position.set(0, 30, 0)
    scene.add(emissiveLight)
    
    console.log('Enhanced PBR lighting setup complete with support for GLB materials')
}

function setupNextSceneLighting() {
    // Remove any existing lights from next scene
    nextScene.children = nextScene.children.filter(child => !(child.isLight))
    
    // Strong key light for next piece preview
    const nextKeyLight = new THREE.DirectionalLight(0xffffff, 3.0)
    nextKeyLight.position.set(8, 15, 8)
    nextScene.add(nextKeyLight)

    // Fill light for next scene
    const nextFillLight = new THREE.DirectionalLight(0xffffff, 1.5)
    nextFillLight.position.set(-8, 10, -5)
    nextScene.add(nextFillLight)

    // Strong ambient light for next scene
    const nextAmbientLight = new THREE.AmbientLight(0x404040, 1.0)
    nextScene.add(nextAmbientLight)
    
    // Point light for better GLB visibility in next preview
    const nextPointLight = new THREE.PointLight(0xffffff, 2.0, 100)
    nextPointLight.position.set(0, 10, 10)
    nextScene.add(nextPointLight)
    
    console.log('Enhanced next scene lighting setup complete')
}

function setupPostProcessing() {
    // Simplified post-processing without outline
    composer = new THREE.EffectComposer(renderer)
    
    // Render pass
    const renderPass = new THREE.RenderPass(scene, camera)
    composer.addPass(renderPass)
    
    // Subtle bloom pass for nice glow
    bloomPass = new THREE.UnrealBloomPass(
        new THREE.Vector2(900, 1500),
        0.5,  // Moderate strength
        0.4,  // Good radius
        0.85  // Threshold
    )
    composer.addPass(bloomPass)
    
    // Enhanced anti-aliasing pass for better definition
    const fxaaPass = new THREE.ShaderPass(THREE.FXAAShader)
    fxaaPass.material.uniforms['resolution'].value.x = 1 / (900 * renderer.getPixelRatio())
    fxaaPass.material.uniforms['resolution'].value.y = 1 / (1500 * renderer.getPixelRatio())
    fxaaPass.renderToScreen = true
    composer.addPass(fxaaPass)
}

// Create reflective floor with proper depth sorting
function createReflectiveFloor() {
    const floorGeometry = new THREE.PlaneGeometry(boardWidth * blockSize * 1.4, boardHeight * blockSize * 1.4)
    const floorMaterial = new THREE.MeshStandardMaterial({
        color: 0x2a2a2a,
        metalness: 0.7,
        roughness: 0.3,
        transparent: false
    })
    
    const floor = new THREE.Mesh(floorGeometry, floorMaterial)
    floor.rotation.x = -Math.PI / 2
    floor.position.y = -(boardHeight * blockSize) / 2 - blockSize * 2
    floor.receiveShadow = true  // Floor receives shadows
    floor.renderOrder = -10
    scene.add(floor)
    
    // Add subtle grid pattern with better visibility
    const gridHelper = new THREE.GridHelper(
        boardWidth * blockSize * 1.4, 
        28, 
        0x444444, 
        0x2a2a2a
    )
    gridHelper.position.y = -(boardHeight * blockSize) / 2 - blockSize * 2 + 0.05
    gridHelper.renderOrder = -9
    scene.add(gridHelper)
}

// Color constants
const blockColors = [0x000000, 0xff0000, 0x0000ff, 0x00ff00, 0x808080]
const backgroundColors = [0x000000, 0x800000, 0x000080, 0x006400, 0x404040]
const RED_COLOR = 1
const BLUE_COLOR = 2  
const GREEN_COLOR = 3
const GRAY_COLOR = 4
const gameColors = [RED_COLOR, BLUE_COLOR, GREEN_COLOR]

// Game board - stored as cube references
let board = Array.from({length: boardHeight}, () => Array(boardWidth).fill(null))
let nextBoard = Array.from({length: 3}, () => Array(4).fill(null))

// Game variables
let score = 0
let lines = 0
let goodPieces = 0
let badPieces = 0

// Color zone functions
function getZoneColor(x) {
    if (x >= 0 && x <= 3) return RED_COLOR
    if (x >= 4 && x <= 7) return BLUE_COLOR
    if (x >= 8 && x <= 11) return GREEN_COLOR
    return GRAY_COLOR
}

function isInCorrectZone(x, pieceColor) {
    return getZoneColor(x) === pieceColor
}

// Function to get the current geometry (GLB model or fallback)
function getCurrentGeometry() {
    if (isModelLoaded && serverGeometry) {
        return serverGeometry
    } else {
        // Fallback box geometry
        return new THREE.BoxGeometry(blockSize * 0.8, blockSize * 0.8, blockSize * 0.8)
    }
}

// PBR materials for realistic lighting and great visual quality
const cubeMaterials = [
    // Black (empty)
    new THREE.MeshStandardMaterial({ 
        color: 0x000000,
        transparent: true,
        opacity: 0
    }),
    // Red - PBR material with nice properties
    new THREE.MeshStandardMaterial({ 
        color: 0xff3333,
        metalness: 0.2,
        roughness: 0.3,
        emissive: 0x220000,
        emissiveIntensity: 0.1
    }),
    // Blue - PBR material with nice properties
    new THREE.MeshStandardMaterial({ 
        color: 0x3333ff,
        metalness: 0.2,
        roughness: 0.3,
        emissive: 0x000022,
        emissiveIntensity: 0.1
    }),
    // Green - PBR material with nice properties
    new THREE.MeshStandardMaterial({ 
        color: 0x33ff33,
        metalness: 0.1,
        roughness: 0.4,
        emissive: 0x002200,
        emissiveIntensity: 0.1
    }),
    // Gray - Metallic material for wrong placement
    new THREE.MeshStandardMaterial({ 
        color: 0x999999,
        metalness: 0.8,
        roughness: 0.2,
        emissive: 0x111111,
        emissiveIntensity: 0.05
    })
]

// Background planes for zones with proper depth
function createBackgroundParticles() {
    const particleCount = 100  // Reduced particle count
    const geometry = new THREE.BufferGeometry()
    const positions = new Float32Array(particleCount * 3)
    const colors = new Float32Array(particleCount * 3)

    for (let i = 0; i < particleCount; i++) {
        positions[i * 3] = (Math.random() - 0.5) * 60      // Smaller spread
        positions[i * 3 + 1] = (Math.random() - 0.5) * 50
        positions[i * 3 + 2] = (Math.random() - 0.5) * 30

        // Subtler color variations
        const colorChoice = Math.floor(Math.random() * 3)
        if (colorChoice === 0) {
            colors[i * 3] = 0.5 + Math.random() * 0.3       // Dimmer red
            colors[i * 3 + 1] = 0.1
            colors[i * 3 + 2] = 0.1
        } else if (colorChoice === 1) {
            colors[i * 3] = 0.1
            colors[i * 3 + 1] = 0.1
            colors[i * 3 + 2] = 0.5 + Math.random() * 0.3   // Dimmer blue
        } else {
            colors[i * 3] = 0.1
            colors[i * 3 + 1] = 0.5 + Math.random() * 0.3   // Dimmer green
            colors[i * 3 + 2] = 0.1
        }
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))

    const material = new THREE.PointsMaterial({
        size: 0.5,                    // Smaller particles
        transparent: true,
        opacity: 0.2,                 // Much lower opacity
        vertexColors: true,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true
    })

    const particles = new THREE.Points(geometry, material)
    particles.renderOrder = -10  // Behind everything
    scene.add(particles)

    // Slower animation
    function animateParticles() {
        const positions = particles.geometry.attributes.position.array
        for (let i = 0; i < positions.length; i += 3) {
            positions[i + 1] += Math.sin(Date.now() * 0.0005 + positions[i]) * 0.005  // Slower movement
        }
        particles.geometry.attributes.position.needsUpdate = true
        requestAnimationFrame(animateParticles)
    }
    animateParticles()
}

let backgroundPlanes = []

function createBackgroundPlanes() {
    const planeGeometry = new THREE.PlaneGeometry(4 * blockSize, boardHeight * blockSize)
    
    // Red background - PBR material
    const redMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x440000,
        metalness: 0.3,
        roughness: 0.8,
        transparent: true, 
        opacity: 0.4,
        depthWrite: false,
        side: THREE.DoubleSide
    })
    const redPlane = new THREE.Mesh(planeGeometry, redMaterial)
    redPlane.position.set(-4 * blockSize, 0, -blockSize * 0.6)
    redPlane.renderOrder = -5
    scene.add(redPlane)
    backgroundPlanes.push(redPlane)
    
    // Blue background - PBR material
    const blueMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x000044,
        metalness: 0.3,
        roughness: 0.8,
        transparent: true, 
        opacity: 0.4,
        depthWrite: false,
        side: THREE.DoubleSide
    })
    const bluePlane = new THREE.Mesh(planeGeometry, blueMaterial)
    bluePlane.position.set(0, 0, -blockSize * 0.6)
    bluePlane.renderOrder = -5
    scene.add(bluePlane)
    backgroundPlanes.push(bluePlane)
    
    // Green background - PBR material
    const greenMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x004400,
        metalness: 0.3,
        roughness: 0.8,
        transparent: true, 
        opacity: 0.4,
        depthWrite: false,
        side: THREE.DoubleSide
    })
    const greenPlane = new THREE.Mesh(planeGeometry, greenMaterial)
    greenPlane.position.set(4 * blockSize, 0, -blockSize * 0.6)
    greenPlane.renderOrder = -5
    scene.add(greenPlane)
    backgroundPlanes.push(greenPlane)
    
    // Simple borders between zones
    const borderMaterial = new THREE.MeshBasicMaterial({
        color: 0x666666,
        transparent: true,
        opacity: 0.2
    })
    
    const borderGeometry = new THREE.PlaneGeometry(2, boardHeight * blockSize)
    
    // Border between red and blue
    const border1 = new THREE.Mesh(borderGeometry, borderMaterial)
    border1.position.set(-2 * blockSize, 0, -blockSize * 0.55)
    border1.renderOrder = -4
    scene.add(border1)
    
    // Border between blue and green
    const border2 = new THREE.Mesh(borderGeometry, borderMaterial)
    border2.position.set(2 * blockSize, 0, -blockSize * 0.55)
    border2.renderOrder = -4
    scene.add(border2)
}

// Block pieces definitions
const block_red = {
    rotations: [
        [{x: 0, y: 0}, {x: 1, y: 0}, {x: 2, y: 0}, {x: 3, y: 0}],
        [{x: 0, y: 0}, {x: 0, y: -1}, {x: 0, y: -2}, {x: 0, y: -3}]
    ]
}

const block_orange = {
    rotations: [
        [{x: 0, y: 0}, {x: 1, y: 0}, {x: 2, y: 0}, {x: 2, y: -1}],
        [{x: 0, y: -2}, {x: 1, y: -2}, {x: 1, y: -1}, {x: 1, y: 0}],
        [{x: 0, y: 0}, {x: 0, y: -1}, {x: 1, y: -1}, {x: 2, y: -1}],
        [{x: 0, y: -2}, {x: 0, y: -1}, {x: 0, y: 0}, {x: 1, y: 0}]
    ]
}

const block_yellow = {
    rotations: [
        [{x: 0, y: 0}, {x: 0, y: -1}, {x: 1, y: 0}, {x: 1, y: -1}]
    ]
}

const block_green = {
    rotations: [
        [{x: 0, y: -1}, {x: 1, y: -1}, {x: 1, y: 0}, {x: 2, y: 0}],
        [{x: 0, y: 0}, {x: 0, y: -1}, {x: 1, y: -1}, {x: 1, y: -2}]
    ]
}

const block_cyan = {
    rotations: [
        [{x: 0, y: -1}, {x: 1, y: -1}, {x: 2, y: -1}, {x: 1, y: 0}],
        [{x: 0, y: 0}, {x: 0, y: -1}, {x: 0, y: -2}, {x: 1, y: -1}],
        [{x: 0, y: 0}, {x: 1, y: 0}, {x: 2, y: 0}, {x: 1, y: -1}],
        [{x: 1, y: 0}, {x: 1, y: -1}, {x: 1, y: -2}, {x: 0, y: -1}]
    ]
}

const block_blue = {
    rotations: [
        [{x: 0, y: 0}, {x: 0, y: -1}, {x: 1, y: 0}, {x: 2, y: 0}],
        [{x: 1, y: -2}, {x: 0, y: -2}, {x: 0, y: -1}, {x: 0, y: 0}],
        [{x: 2, y: 0}, {x: 2, y: -1}, {x: 1, y: -1}, {x: 0, y: -1}],
        [{x: 1, y: -2}, {x: 1, y: -1}, {x: 1, y: 0}, {x: 0, y: 0}]
    ]
}

const block_purple = {
    rotations: [
        [{x: 2, y: -1}, {x: 1, y: -1}, {x: 1, y: 0}, {x: 0, y: 0}],
        [{x: 1, y: 0}, {x: 1, y: -1}, {x: 0, y: -1}, {x: 0, y: -2}]
    ]
}

const candidate_pieces = [block_red, block_orange, block_yellow, block_green, block_cyan, block_blue, block_purple]

let current_color = gameColors[getRandomValue(gameColors.length)]
let next_piece = candidate_pieces[current_color-1]

let current_piece = {
    rotations: next_piece.rotations,
    rotation_state: 0
}

const tick_level0_cycle = 30
let piece_x = 0
let piece_y = 0 
let ticks = 0
let tick_cycle = tick_level0_cycle

// Current piece cubes
let currentPieceCubes = []

// Functions
function createCube(x, y, color) {
    const geometry = getCurrentGeometry()
    
    let material
    if (isModelLoaded && serverMaterial) {
        // Always use original GLB material if available
        material = serverMaterial.clone()
        
        // Ensure the material has proper lighting response
        if (material.color && material.color.r === 0 && material.color.g === 0 && material.color.b === 0) {
            // If material is completely black, brighten it slightly
            material.color = new THREE.Color(0x333333)
        }
        
        // Ensure emissive materials work properly
        if (material.emissive && material.emissiveIntensity === undefined) {
            material.emissiveIntensity = 1.0
        }
    } else {
        // Enhanced fallback material with better visibility
        material = new THREE.MeshStandardMaterial({
            color: 0x888888,
            metalness: 0.3,
            roughness: 0.4,
            emissive: 0x222222,
            emissiveIntensity: 0.2
        })
    }
    
    const cube = new THREE.Mesh(geometry, material)
    cube.position.set(
        x * blockSize - (boardWidth * blockSize) / 2 + blockSize / 2,
        (boardHeight * blockSize) / 2 - y * blockSize - blockSize / 2,
        0
    )
    
    // Enable shadows for PBR lighting
    cube.castShadow = true
    cube.receiveShadow = true
    cube.renderOrder = 1
    
    // Ensure material updates properly
    cube.material.needsUpdate = true
    
    return cube
}

function drawBoard(){
    // Clear existing cubes from scene
    board.forEach((row, y) => {
        row.forEach((cube, x) => {
            if (cube) {
                scene.remove(cube)
            }
        })
    })
    
    // Redraw all cubes
    board.forEach((row, y) => {
        row.forEach((cube, x) => {
            if (cube) {
                scene.add(cube)
            }
        })
    })
}

function drawNextBoard(){
    // Clear existing cubes from next scene
    nextBoard.forEach((row, y) => {
        row.forEach((cube, x) => {
            if (cube) {
                nextScene.remove(cube)
            }
        })
    })
    
    // Redraw next board cubes
    nextBoard.forEach((row, y) => {
        row.forEach((cube, x) => {
            if (cube) {
                const nextCube = cube.clone()
                nextCube.position.set(
                    x * blockSize - 150,
                    112 - y * blockSize,
                    0
                )
                nextScene.add(nextCube)
            }
        })
    })
}

function drawCurrentBlock(){
    // Remove previous current piece cubes
    currentPieceCubes.forEach(cube => scene.remove(cube))
    currentPieceCubes = []
    
    // Create new current piece cubes
    getCurrentPieceCoords().forEach(coords => {
        const x = piece_x + coords.x
        const y = piece_y + coords.y
        if (y >= 0) {
            const cube = createCube(x, y, current_color)
            currentPieceCubes.push(cube)
            scene.add(cube)
        }
    })
    
    // No outline effects needed - PBR lighting will make them look great
}

function movePiece(){
    if (canMovePieceTo(piece_x, piece_y+1)){
        piece_y++
    } else {
        safePaintPiece(piece_x, piece_y)        // lock block

        if (isBoardValid()){
            let linesAdded = 0
            const heightToCheck = getPieceHeight(getCurrentPieceCoords())

            while (checkLine(piece_y, heightToCheck)) linesAdded++
            if (linesAdded) addScore(100*linesAdded)
            else addScore(Math.round(piece_y / 4))  
            
            current_piece = {
                rotations: next_piece.rotations,
                rotation_state: 0
            }

            piece_x = Math.floor(boardWidth / 2)
            current_color = getNextColor()
            
            choseNextBlock()
            drawNextBoard()
        } else {
            loseGame()
        }

        piece_y = -1 
    }
}

function addScore(diff){
    score += diff
    scoreText.innerText = score.toString()

    if (diff >= 100) goodPieces += diff / 10
    else if (diff == 5) goodPieces += 1
    else {
        badPieces += Math.pow((5-diff), 2)

        if (badPieces > 100){
            badPieces /= 4
            goodPieces /= 4
        }
    }

    efficiency = badPieces ? (goodPieces) / (goodPieces + badPieces) : 1
    fullText.innerText = `${Math.floor(efficiency * 100)}%`
}

function choseNextBlock(){
    let color = gameColors[getRandomValue(gameColors.length)]
    next_piece = candidate_pieces[color-1]

    // clear next board
    nextBoard.forEach((row, y) => {
        row.forEach((cube, x) => {
            if (cube) {
                nextScene.remove(cube)
            }
            nextBoard[y][x] = null
        })
    })

    next_piece.rotations[0].forEach(coords => {
        const geometry = getCurrentGeometry()
        // Use original GLB material if available, otherwise fallback to colored materials
        const material = isModelLoaded && serverMaterial ? serverMaterial.clone() : cubeMaterials[color]
        const cube = new THREE.Mesh(geometry, material)
        
        // Store color information in userData for the next piece too
        cube.userData.originalColor = color
        
        nextBoard[2+coords.y][0+coords.x] = cube
    })
}

function getNextColor(){
    const cube = nextBoard[2+next_piece.rotations[0][0].y][0+next_piece.rotations[0][0].x]
    if (cube && cube.userData && cube.userData.originalColor) {
        return cube.userData.originalColor
    }
    return RED_COLOR // fallback
}

function checkLine(sinceRow, iterations){
    let sectionsCleared = 0

    // Check each row for completed color sections
    for(i=0; i<iterations; i++){
        let currentRow = sinceRow - i
        if (currentRow < 0) continue
        
        // Check each 4-column section
        let sectionsInThisRow = checkColorSections(currentRow)
        if (sectionsInThisRow > 0) {
            sectionsCleared += sectionsInThisRow
            clearCompletedSections(currentRow)
            
            // Move everything down
            for(y=currentRow-1; y>-1; y--){
                for(x=0; x<boardWidth; x++){
                    board[y+1][x] = board[y][x]
                    if (board[y+1][x]) {
                        board[y+1][x].position.y = (boardHeight * blockSize) / 2 - (y+1) * blockSize - blockSize / 2
                    }
                }
            }
            
            // Clear top row
            for(x=0; x<boardWidth; x++){
                board[0][x] = null
            }
            
            lines++
            linesText.innerText = lines.toString()
        }
    }

    if (sectionsCleared > 0) {
        // update gravity
        if (lines < 100){
            tick_cycle = tick_level0_cycle - Math.floor(lines / 5)
        } else {
            tick_cycle = Math.max(1, tick_level0_cycle - 20 - Math.floor((lines-100) / 10)) 
        }
        return true
    }

    return false
}

function checkColorSections(row) {
    let sectionsCleared = 0
    
    // Check red section (columns 0-3)
    if (isSectionComplete(row, 0, 3, RED_COLOR)) {
        sectionsCleared++
    }
    
    // Check blue section (columns 4-7)  
    if (isSectionComplete(row, 4, 7, BLUE_COLOR)) {
        sectionsCleared++
    }
    
    // Check green section (columns 8-11)
    if (isSectionComplete(row, 8, 11, GREEN_COLOR)) {
        sectionsCleared++
    }
    
    return sectionsCleared
}

function isSectionComplete(row, startCol, endCol, expectedColor) {
    for (let x = startCol; x <= endCol; x++) {
        const cube = board[row][x]
        if (!cube || !cube.userData || cube.userData.originalColor !== expectedColor || !cube.userData.isInCorrectZone) {
            return false
        }
    }
    return true
}

function clearCompletedSections(row) {
    // Clear red section if complete
    if (isSectionComplete(row, 0, 3, RED_COLOR)) {
        for (let x = 0; x <= 3; x++) {
            if (board[row][x]) {
                scene.remove(board[row][x])
                board[row][x] = null
            }
        }
    }
    
    // Clear blue section if complete
    if (isSectionComplete(row, 4, 7, BLUE_COLOR)) {
        for (let x = 4; x <= 7; x++) {
            if (board[row][x]) {
                scene.remove(board[row][x])
                board[row][x] = null
            }
        }
    }
    
    // Clear green section if complete
    if (isSectionComplete(row, 8, 11, GREEN_COLOR)) {
        for (let x = 8; x <= 11; x++) {
            if (board[row][x]) {
                scene.remove(board[row][x])
                board[row][x] = null
            }
        }
    }
}

function loseGame(){
    board.forEach((row, y) => {
        row.forEach((cube, x) => {
            if (cube) {
                // Instead of changing material, add a dark overlay effect
                cube.material.emissive = new THREE.Color(0x220000)
                cube.material.emissiveIntensity = 0.3
                cube.material.transparent = true
                cube.material.opacity = 0.7
            }
        })
    })
}

function resetGame(){
    // Clear all cubes from scene
    board.forEach((row, y) => {
        row.forEach((cube, x) => {
            if (cube) {
                scene.remove(cube)
            }
        })
    })
    
    // Reset board
    board = Array.from({length: boardHeight}, () => Array(boardWidth).fill(null))
    nextBoard = Array.from({length: 3}, () => Array(4).fill(null))
    
    score = 0
    lines = 0
    goodPieces = 0
    badPieces = 0
    tick_cycle = tick_level0_cycle

    choseNextBlock()
    drawBoard()
    drawNextBoard()

    linesText.innerText = "0"
    scoreText.innerText = "0"
    fullText.innerText = "100%"

    piece_x = Math.floor(boardWidth / 2)
    piece_y = -1
}

function gameLoop(){
    if (++ticks == tick_cycle){
        movePiece()
        ticks = 0
    }

    drawBoard()
    drawCurrentBlock()
    
    // Render with post-processing
    composer.render()
    nextRenderer.render(nextScene, nextCamera)
}

// Event listeners
document.addEventListener('keydown', e => {
    if (e.key == "Enter"){
        resetGame()
    } else if (e.key == "ArrowRight"){
        if (canMovePieceTo(piece_x+1, piece_y)) {
            piece_x++
        }
    } else if (e.key == "ArrowLeft"){
        if (canMovePieceTo(piece_x-1, piece_y)) {
            piece_x--
        }
    } else if (e.key == "ArrowDown"){
        if (canMovePieceTo(piece_x, piece_y+1)) {
            piece_y++
        }
    } else if (e.key == " "){
        if (canPieceRotate()){
            current_piece.rotation_state = (current_piece.rotation_state + 1) % current_piece.rotations.length
        }
    }
})

// Utility functions
function safePaint(x,y) {
    if (isValidPlace(x,y)) {
        // Always use GLB material if available, store zone info as custom property
        const cube = createCube(x, y, current_color)
        
        // Store zone information as custom properties for game logic
        cube.userData.originalColor = current_color
        cube.userData.isInCorrectZone = isInCorrectZone(x, current_color)
        
        // If not in correct zone, add a slight red tint to the material for visual feedback
        if (!cube.userData.isInCorrectZone && isModelLoaded && serverMaterial) {
            cube.material.emissive = new THREE.Color(0x440000)
            cube.material.emissiveIntensity = 0.2
        }
        
        board[y][x] = cube
    }
}

function safePaintPiece(x0, y0){
    getCurrentPieceCoords().forEach(coords => {
        safePaint(x0 + coords.x, y0 + coords.y)
    })
}

function canMoveTo(x,y){
    return isValidPlace(x,y) && board[y][x] == null
}

function canMovePieceTo(x0,y0){
    let ok = true

    getCurrentPieceCoords().forEach(coords => {
        const x = x0 + coords.x
        const y = y0 + coords.y

        if (y < 0){
            // arriba del tablero
            if (x < 0 || x >= boardWidth){
                ok = false
                return
            }
        } else {
            // dentro del tablero
            if (!canMoveTo(x,y)){
                ok = false
                return
            }
        }
    })

    return ok
}

function canPieceRotate(){
    let test_rotation_state = (current_piece.rotation_state + 1) % current_piece.rotations.length
    return isPieceInside(piece_x, piece_y, current_piece.rotations[test_rotation_state])
}

function isValidPlace(x,y){
    return (y >= 0 && y < boardHeight && x >= 0 && x < boardWidth)
}

function isCellOutside(x,y){
    return (y >= boardHeight || x < 0 || x >= boardWidth)
}

function isCellOccupied(x,y){
    return board[y][x] != null
}

function isPieceInside(x0, y0, relative_coords){
    let inside = true

    relative_coords.forEach(coords => {
        const x = x0 + coords.x
        const y = y0 + coords.y

        if (y >= 0 && (isCellOutside(x,y) || isCellOccupied(x,y))){
            inside = false
            return
        }
    })

    return inside
}

function isBoardValid(){
    let result = true

    board[0].forEach(cube => {
        if (cube){
            result = false
            return
        }
    })

    return result
}

function getCurrentPieceCoords(){
    return current_piece.rotations[current_piece.rotation_state]
}

function getPieceWidth(relative_coords){
    let max_x = 0
    
    relative_coords.forEach(coords => {
        if (coords.x > max_x) max_x = coords.x 
    })

    return (max_x + 1)
}

function getPieceHeight(relative_coords){
    let min_y = 0
    
    relative_coords.forEach(coords => {
        if (coords.y < min_y) min_y = coords.y
    })

    return (1 - min_y)
}

function getRandomValue(max){
    return Math.floor(Math.random() * max);
}

// Initialize and start game
initThreeJS()

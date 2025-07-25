// UI elements
const scoreText = document.getElementById("scoreNumber")
const linesText = document.getElementById("linesNumber")
const fullText = document.getElementById("fullNumber")

// Three.js setup
let scene, camera, renderer, nextScene, nextCamera, nextRenderer
let composer, outlinePass, bloomPass
let blockSize = 30
const boardWidth = 12
const boardHeight = 20
const boardSize = boardWidth * boardHeight

// Initialize Three.js
function initThreeJS() {
    // Main game scene
    scene = new THREE.Scene()
    camera = new THREE.OrthographicCamera(
        -boardWidth * blockSize / 2, boardWidth * blockSize / 2,
        boardHeight * blockSize / 2, -boardHeight * blockSize / 2,
        1, 1000
    )
    
    // Position camera for subtle 3-degree rotation
    const angle = 3 * Math.PI / 180; // 3 degrees in radians
    camera.position.set(Math.sin(angle) * 10, 5, Math.cos(angle) * 10)
    camera.lookAt(0, 0, 0)
    
    renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(360, 600)
    renderer.setClearColor(0x1a1a1a)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.outputEncoding = THREE.sRGBEncoding
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.0
    document.getElementById('gameContainer').appendChild(renderer.domElement)

    // Next piece scene (smaller)
    nextScene = new THREE.Scene()
    nextCamera = new THREE.OrthographicCamera(-60, 60, 45, -45, 1, 1000)
    const nextAngle = 3 * Math.PI / 180;
    nextCamera.position.set(Math.sin(nextAngle) * 5, 3, Math.cos(nextAngle) * 5)
    nextCamera.lookAt(0, 0, 0)
    
    nextRenderer = new THREE.WebGLRenderer({ antialias: true })
    nextRenderer.setSize(120, 90)
    nextRenderer.setClearColor(0x2a2a2a)
    nextRenderer.shadowMap.enabled = true
    nextRenderer.shadowMap.type = THREE.PCFSoftShadowMap
    document.getElementById('nextCanvas').appendChild(nextRenderer.domElement)
    
    // Setup post-processing
    setupPostProcessing()
    
    // Add realistic lighting with shadows
    const ambientLight = new THREE.AmbientLight(0x404040, 0.4)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2)
    directionalLight.position.set(10, 20, 5)
    directionalLight.castShadow = true
    directionalLight.shadow.mapSize.width = 2048
    directionalLight.shadow.mapSize.height = 2048
    directionalLight.shadow.camera.near = 0.5
    directionalLight.shadow.camera.far = 50
    scene.add(ambientLight)
    scene.add(directionalLight)
    
    // Add floor with reflective surface
    createReflectiveFloor()
    
    const nextAmbientLight = new THREE.AmbientLight(0x404040, 0.6)
    const nextDirectionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
    nextDirectionalLight.position.set(1, 1, 1)
    nextScene.add(nextAmbientLight)
    nextScene.add(nextDirectionalLight)
}

function setupPostProcessing() {
    // Create composer
    composer = new THREE.EffectComposer(renderer)
    
    // Render pass
    const renderPass = new THREE.RenderPass(scene, camera)
    composer.addPass(renderPass)
    
    // Outline pass
    outlinePass = new THREE.OutlinePass(new THREE.Vector2(360, 600), scene, camera)
    outlinePass.edgeStrength = 3.0
    outlinePass.edgeGlow = 0.5
    outlinePass.edgeThickness = 1.0
    outlinePass.pulsePeriod = 0
    outlinePass.visibleEdgeColor.set('#ffffff')
    outlinePass.hiddenEdgeColor.set('#190a05')
    composer.addPass(outlinePass)
    
    // Bloom pass
    bloomPass = new THREE.UnrealBloomPass(
        new THREE.Vector2(360, 600),
        1.5, // strength
        0.4, // radius
        0.85 // threshold
    )
    composer.addPass(bloomPass)
    
    // Anti-aliasing pass
    const fxaaPass = new THREE.ShaderPass(THREE.FXAAShader)
    fxaaPass.material.uniforms['resolution'].value.x = 1 / 360
    fxaaPass.material.uniforms['resolution'].value.y = 1 / 600
    composer.addPass(fxaaPass)
}
}

// Create reflective floor with proper depth sorting
function createReflectiveFloor() {
    const floorGeometry = new THREE.PlaneGeometry(boardWidth * blockSize * 1.2, boardHeight * blockSize * 1.2)
    const floorMaterial = new THREE.MeshStandardMaterial({
        color: 0x2a2a2a,
        metalness: 0.9,
        roughness: 0.1,
        transparent: false,
        envMapIntensity: 1.0
    })
    
    const floor = new THREE.Mesh(floorGeometry, floorMaterial)
    floor.rotation.x = -Math.PI / 2
    floor.position.y = -(boardHeight * blockSize) / 2 - blockSize * 1.5 // Move further down to avoid overlapping
    floor.receiveShadow = true
    floor.renderOrder = -1 // Render first
    scene.add(floor)
    
    // Add subtle grid pattern
    const gridHelper = new THREE.GridHelper(
        boardWidth * blockSize * 1.2, 
        24, 
        0x444444, 
        0x222222
    )
    gridHelper.position.y = -(boardHeight * blockSize) / 2 - blockSize * 1.5 + 0.1
    gridHelper.renderOrder = 0
    scene.add(gridHelper)
}

// Prepare colors with advanced PBR materials
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

// Create cube geometry and advanced PBR materials
const cubeGeometry = new THREE.BoxGeometry(blockSize * 0.9, blockSize * 0.9, blockSize * 0.9)

// Create advanced PBR materials without wireframe
const cubeMaterials = [
    // Black (empty)
    new THREE.MeshStandardMaterial({ 
        color: 0x000000,
        transparent: true,
        opacity: 0
    }),
    // Red
    new THREE.MeshStandardMaterial({ 
        color: 0xff2222,
        metalness: 0.2,
        roughness: 0.3,
        emissive: 0x110000,
        emissiveIntensity: 0.1,
        transparent: true,
        opacity: 0.9
    }),
    // Blue
    new THREE.MeshStandardMaterial({ 
        color: 0x2222ff,
        metalness: 0.3,
        roughness: 0.25,
        emissive: 0x000011,
        emissiveIntensity: 0.1,
        transparent: true,
        opacity: 0.9
    }),
    // Green
    new THREE.MeshStandardMaterial({ 
        color: 0x22ff22,
        metalness: 0.15,
        roughness: 0.35,
        emissive: 0x001100,
        emissiveIntensity: 0.1,
        transparent: true,
        opacity: 0.9
    }),
    // Gray
    new THREE.MeshStandardMaterial({ 
        color: 0x666666,
        metalness: 0.8,
        roughness: 0.2,
        emissive: 0x111111,
        emissiveIntensity: 0.05,
        transparent: true,
        opacity: 0.8
    })
]

// Background planes for zones with proper depth
let backgroundPlanes = []

function createBackgroundPlanes() {
    const planeGeometry = new THREE.PlaneGeometry(4 * blockSize, boardHeight * blockSize)
    
    // Red background (columns 0-3)
    const redMaterial = new THREE.MeshBasicMaterial({ 
        color: backgroundColors[RED_COLOR], 
        transparent: true, 
        opacity: 0.15,
        depthWrite: false,
        side: THREE.DoubleSide
    })
    const redPlane = new THREE.Mesh(planeGeometry, redMaterial)
    redPlane.position.set(-4 * blockSize, 0, -blockSize/3)
    redPlane.renderOrder = -2
    scene.add(redPlane)
    backgroundPlanes.push(redPlane)
    
    // Blue background (columns 4-7)
    const blueMaterial = new THREE.MeshBasicMaterial({ 
        color: backgroundColors[BLUE_COLOR], 
        transparent: true, 
        opacity: 0.15,
        depthWrite: false,
        side: THREE.DoubleSide
    })
    const bluePlane = new THREE.Mesh(planeGeometry, blueMaterial)
    bluePlane.position.set(0, 0, -blockSize/3)
    bluePlane.renderOrder = -2
    scene.add(bluePlane)
    backgroundPlanes.push(bluePlane)
    
    // Green background (columns 8-11)
    const greenMaterial = new THREE.MeshBasicMaterial({ 
        color: backgroundColors[GREEN_COLOR], 
        transparent: true, 
        opacity: 0.15,
        depthWrite: false,
        side: THREE.DoubleSide
    })
    const greenPlane = new THREE.Mesh(planeGeometry, greenMaterial)
    greenPlane.position.set(4 * blockSize, 0, -blockSize/3)
    greenPlane.renderOrder = -2
    scene.add(greenPlane)
    backgroundPlanes.push(greenPlane)
}

// Prepare colors with PBR materials
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

// Create cube geometry and materials with wireframe and PBR
const cubeGeometry = new THREE.BoxGeometry(blockSize * 0.9, blockSize * 0.9, blockSize * 0.9)

// Create PBR materials with wireframe
const cubeMaterials = blockColors.map((color, index) => {
    const material = new THREE.MeshStandardMaterial({ 
        color: color,
        metalness: 0.3,
        roughness: 0.4,
        transparent: index === 0, // Make black (empty) transparent
        opacity: index === 0 ? 0 : 0.8
    })
    return material
})

// Create wireframe materials
const wireframeMaterials = blockColors.map(color => {
    return new THREE.MeshBasicMaterial({
        color: color,
        wireframe: true,
        transparent: true,
        opacity: 0.8
    })
})

// Background planes for zones
let backgroundPlanes = []

function createBackgroundPlanes() {
    const planeGeometry = new THREE.PlaneGeometry(4 * blockSize, boardHeight * blockSize)
    
    // Red background (columns 0-3)
    const redMaterial = new THREE.MeshBasicMaterial({ color: backgroundColors[RED_COLOR], transparent: true, opacity: 0.3 })
    const redPlane = new THREE.Mesh(planeGeometry, redMaterial)
    redPlane.position.set(-4 * blockSize, 0, -blockSize/2)
    scene.add(redPlane)
    backgroundPlanes.push(redPlane)
    
    // Blue background (columns 4-7)
    const blueMaterial = new THREE.MeshBasicMaterial({ color: backgroundColors[BLUE_COLOR], transparent: true, opacity: 0.3 })
    const bluePlane = new THREE.Mesh(planeGeometry, blueMaterial)
    bluePlane.position.set(0, 0, -blockSize/2)
    scene.add(bluePlane)
    backgroundPlanes.push(bluePlane)
    
    // Green background (columns 8-11)
    const greenMaterial = new THREE.MeshBasicMaterial({ color: backgroundColors[GREEN_COLOR], transparent: true, opacity: 0.3 })
    const greenPlane = new THREE.Mesh(planeGeometry, greenMaterial)
    greenPlane.position.set(4 * blockSize, 0, -blockSize/2)
    scene.add(greenPlane)
    backgroundPlanes.push(greenPlane)
}

// Block pieces definitions (same as original)
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
    // Create main cube with PBR material
    const cube = new THREE.Mesh(cubeGeometry, cubeMaterials[color])
    cube.position.set(
        x * blockSize - (boardWidth * blockSize) / 2 + blockSize / 2,
        (boardHeight * blockSize) / 2 - y * blockSize - blockSize / 2,
        0
    )
    cube.castShadow = true
    cube.receiveShadow = true
    
    // Create wireframe outline
    const wireframe = new THREE.Mesh(cubeGeometry, wireframeMaterials[color])
    wireframe.position.copy(cube.position)
    wireframe.scale.setScalar(1.01) // Slightly larger to avoid z-fighting
    
    // Group both together
    const cubeGroup = new THREE.Group()
    cubeGroup.add(cube)
    cubeGroup.add(wireframe)
    
    return cubeGroup
}

function drawBoard(){
    // Clear existing cubes from scene
    board.forEach((row, y) => {
        row.forEach((cubeGroup, x) => {
            if (cubeGroup) {
                scene.remove(cubeGroup)
            }
        })
    })
    
    // Redraw all cubes
    board.forEach((row, y) => {
        row.forEach((cubeGroup, x) => {
            if (cubeGroup) {
                scene.add(cubeGroup)
            }
        })
    })
}

function drawNextBoard(){
    // Clear existing cubes from next scene
    nextBoard.forEach((row, y) => {
        row.forEach((cubeGroup, x) => {
            if (cubeGroup) {
                nextScene.remove(cubeGroup)
            }
        })
    })
    
    // Redraw next board cubes
    nextBoard.forEach((row, y) => {
        row.forEach((cubeGroup, x) => {
            if (cubeGroup) {
                const nextCubeGroup = cubeGroup.clone()
                nextCubeGroup.position.set(
                    x * blockSize - 60,
                    45 - y * blockSize,
                    0
                )
                nextScene.add(nextCubeGroup)
            }
        })
    })
}

function drawCurrentBlock(){
    // Remove previous current piece cubes
    currentPieceCubes.forEach(cubeGroup => scene.remove(cubeGroup))
    currentPieceCubes = []
    
    // Create new current piece cubes
    getCurrentPieceCoords().forEach(coords => {
        const x = piece_x + coords.x
        const y = piece_y + coords.y
        if (y >= 0) {
            const cubeGroup = createCube(x, y, current_color)
            currentPieceCubes.push(cubeGroup)
            scene.add(cubeGroup)
        }
    })
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
        row.forEach((cubeGroup, x) => {
            if (cubeGroup) {
                nextScene.remove(cubeGroup)
            }
            nextBoard[y][x] = null
        })
    })

    next_piece.rotations[0].forEach(coords => {
        const cubeGroup = new THREE.Group()
        const cube = new THREE.Mesh(cubeGeometry, cubeMaterials[color])
        const wireframe = new THREE.Mesh(cubeGeometry, wireframeMaterials[color])
        wireframe.scale.setScalar(1.01)
        cubeGroup.add(cube)
        cubeGroup.add(wireframe)
        nextBoard[2+coords.y][0+coords.x] = cubeGroup
    })
}

function getNextColor(){
    const cubeGroup = nextBoard[2+next_piece.rotations[0][0].y][0+next_piece.rotations[0][0].x]
    if (cubeGroup && cubeGroup.children[0]) {
        // Find color index from material
        for (let i = 0; i < cubeMaterials.length; i++) {
            if (cubeGroup.children[0].material === cubeMaterials[i]) {
                return i
            }
        }
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
        const cubeGroup = board[row][x]
        if (!cubeGroup || !cubeGroup.children[0] || cubeGroup.children[0].material !== cubeMaterials[expectedColor]) {
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
        row.forEach((cubeGroup, x) => {
            if (cubeGroup && cubeGroup.children[0]) {
                cubeGroup.children[0].material = cubeMaterials[GRAY_COLOR]
                cubeGroup.children[1].material = wireframeMaterials[GRAY_COLOR]
            }
        })
    })
}

function resetGame(){
    // Clear all cubes from scene
    board.forEach((row, y) => {
        row.forEach((cubeGroup, x) => {
            if (cubeGroup) {
                scene.remove(cubeGroup)
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
    
    // Render both scenes
    renderer.render(scene, camera)
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
        let color = current_color
        // Check if piece is in correct zone
        if (!isInCorrectZone(x, current_color)) {
            color = GRAY_COLOR  // Wrong zone = gray color
        }
        
        const cubeGroup = createCube(x, y, color)
        board[y][x] = cubeGroup
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
createBackgroundPlanes()
resetGame()
setInterval(gameLoop, 20)

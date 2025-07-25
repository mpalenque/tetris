// UI elements
const canvas = document.getElementById("myCanvas")
const nextCanvas = document.getElementById("nextCanvas")
const scoreText = document.getElementById("scoreNumber")
const linesText = document.getElementById("linesNumber")
const fullText = document.getElementById("fullNumber")

// Prepare board
const context = canvas.getContext("2d")
const blockSize = 30
const boardWidth = 12
const boardHeight = 20
const boardSize = boardWidth * boardHeight

// Prepare colors
const blockColors = ['black', 'red', 'blue', 'green', 'gray']
const RED_COLOR = 1
const BLUE_COLOR = 2  
const GREEN_COLOR = 3
const GRAY_COLOR = 4
const gameColors = [RED_COLOR, BLUE_COLOR, GREEN_COLOR]

// construimos el tablero de 20 filas por 10 columnas
let board = Array.from({length: boardHeight}, () => Array(boardWidth).fill(0))

// prepare next block
const nextContext = nextCanvas.getContext("2d")
const nextBoardWidth = 4
const nextBoardHeight = 3
let nextBoard = Array.from({length: nextBoardHeight}, () => Array(nextBoardWidth).fill(0))

// game variables
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

// bloques disponibles
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
let next_piece_index = getRandomValue(candidate_pieces.length)
let next_piece = candidate_pieces[next_piece_index]

let current_piece = {
    rotations: next_piece.rotations,
    rotation_state: 0
}

const tick_level0_cycle = 30
let piece_x = 0
let piece_y = 0 
let ticks = 0
let tick_cycle = tick_level0_cycle

// ---- FUNCIONES ----------------------------------------------

function drawBlock(x, y, color, ctx){
    ctx.fillStyle = blockColors[color]
    ctx.fillRect(x * blockSize, y * blockSize, blockSize, blockSize)

    // borde
    ctx.strokeStyle = "#555"
    ctx.strokeRect(x * blockSize, y * blockSize, blockSize, blockSize)
}

function drawBoard(){
    // Draw background colors first (darker versions)
    context.fillStyle = '#800000'  // Dark red
    context.fillRect(0, 0, 4 * blockSize, boardHeight * blockSize)
    
    context.fillStyle = '#000080'  // Dark blue
    context.fillRect(4 * blockSize, 0, 4 * blockSize, boardHeight * blockSize)
    
    context.fillStyle = '#006400'  // Dark green
    context.fillRect(8 * blockSize, 0, 4 * blockSize, boardHeight * blockSize)
    
    // Draw blocks on top of background
    board.forEach((row, y) => {
        row.forEach((color, x) => {
            if (color !== 0) {
                drawBlock(x,y,color,context)
            }
        })
    })
}

function drawNextBoard(){
    nextBoard.forEach((row, y) => {
        row.forEach((color, x) => {
            drawBlock(x,y,color,nextContext)
        })
    })
}

function drawCurrentBlock(){
    getCurrentPieceCoords().forEach(coords => {
        drawBlock(piece_x + coords.x, piece_y + coords.y,current_color, context)
    })
}

function movePiece(){
    safeClearPiece(piece_x, piece_y)

    if (canMovePieceTo(piece_x, piece_y+1)){
        //safePaintPiece(piece_x, piece_y+1)
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

            piece_x = boardWidth / 2
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
    next_piece_index = getRandomValue(candidate_pieces.length)
    next_piece = candidate_pieces[next_piece_index]

    // clear next board
    nextBoard.forEach((row, y) => {
        row.forEach((color, x) => {
            nextBoard[y][x] = 0
        })
    })

    next_piece.rotations[0].forEach(coords => {
        nextBoard[2+coords.y][0+coords.x] = color
    })
}

function getNextColor(){
    return nextBoard[2+next_piece.rotations[0][0].y][0+next_piece.rotations[0][0].x]
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
                }
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
        if (board[row][x] !== expectedColor) {
            return false
        }
    }
    return true
}

function clearCompletedSections(row) {
    // Clear red section if complete
    if (isSectionComplete(row, 0, 3, RED_COLOR)) {
        for (let x = 0; x <= 3; x++) {
            board[row][x] = 0
        }
    }
    
    // Clear blue section if complete
    if (isSectionComplete(row, 4, 7, BLUE_COLOR)) {
        for (let x = 4; x <= 7; x++) {
            board[row][x] = 0
        }
    }
    
    // Clear green section if complete
    if (isSectionComplete(row, 8, 11, GREEN_COLOR)) {
        for (let x = 8; x <= 11; x++) {
            board[row][x] = 0
        }
    }
}

function loseGame(){
    board.forEach((row, y) => {
        row.forEach((color, x) => {
            if (color) board[y][x] = GRAY_COLOR
        })
    })
}

function resetGame(){
    board = board.map(row => row.map(color => 0))
    nextBoard = nextBoard.map(row => row.map(color => 0))
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

    piece_x = boardWidth / 2
    piece_y = -1
}

function gameLoop(){
    if (++ticks == tick_cycle){
        movePiece()
        ticks = 0
    }

    drawBoard()
    drawCurrentBlock()
}

// ---- LISTENERS -----------------

document.addEventListener('keydown', e => {
    console.log(e)

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

// ---- UTILS ---------------------

function safePaint(x,y) {
    if (isValidPlace(x,y)) {
        // Check if piece is in correct zone
        if (isInCorrectZone(x, current_color)) {
            board[y][x] = current_color
        } else {
            board[y][x] = GRAY_COLOR  // Wrong zone = gray color
        }
    }
}

function safePaintPiece(x0, y0){
    getCurrentPieceCoords().forEach(coords => {
        safePaint(x0 + coords.x, y0 + coords.y)
    })
}

function safeClear(x,y){
    if (isValidPlace(x,y)) board[y][x] = 0
}

function safeClearPiece(x0, y0){
    getCurrentPieceCoords().forEach(coords => {
        safeClear(x0 + coords.x, y0 + coords.y)
    })
}

function canMoveTo(x,y){
    return isValidPlace(x,y) && board[y][x] == 0
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
    return board[y][x] != 0
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

    board[0].forEach(color => {
        if (color){
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

function getRandomColor(count){
    return Math.floor(Math.random() * count) + 1
}

function testBoard(){
    for (x=0; x<boardWidth; x++){
        for (y=0; y<boardHeight; y++){
            board[y][x] = getRandomValue(3)
        }
    }
}

// ---- MAIN PROGRAM --------------

resetGame()
setInterval(gameLoop, 20)
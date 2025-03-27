// Get canvas and context
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game state variables
let lastTime = 0;
const FPS = 60;
const frameTime = 1000 / FPS;

// Game objects
const paddle = {
    width: 100,
    height: 20,
    x: 350,
    y: 550,
    speed: 8,
    dx: 0
};

const ballTemplate = {
    radius: 8,
    speed: 4,
    moving: false
};

let balls = []; // Will store all active balls

// Add these constants at the top with other game constants
const CONTAINER = {
    MARGIN_X: 40,      // Margin from canvas edges
    MARGIN_TOP: 80,    // Margin from top for score
    MARGIN_BOTTOM: 100 // Margin from bottom for paddle area
};

// Calculate container dimensions
CONTAINER.width = canvas.width - (CONTAINER.MARGIN_X * 2);
CONTAINER.height = Math.floor((canvas.height - CONTAINER.MARGIN_TOP - CONTAINER.MARGIN_BOTTOM) * 0.75);
CONTAINER.x = CONTAINER.MARGIN_X;
CONTAINER.y = CONTAINER.MARGIN_TOP;

// First, let's add a function to calculate brick dimensions based on level layout
function calculateBrickDimensions(rows, cols) {
    const MIN_PADDING = 4; // Minimum padding between bricks
    
    // Available space within container
    const availableWidth = CONTAINER.width - (MIN_PADDING * (cols - 1));
    const availableHeight = CONTAINER.height - (MIN_PADDING * (rows - 1));
    
    // Calculate maximum possible brick size
    const maxBrickWidth = availableWidth / cols;
    const maxBrickHeight = availableHeight / rows;
    
    // Maintain aspect ratio (width:height = 2.5:1)
    const aspectRatio = 2.5;
    let brickWidth, brickHeight, padding;
    
    if (maxBrickWidth / maxBrickHeight > aspectRatio) {
        // Height is the limiting factor
        brickHeight = maxBrickHeight;
        brickWidth = brickHeight * aspectRatio;
        padding = (CONTAINER.width - (cols * brickWidth)) / (cols + 1);
    } else {
        // Width is the limiting factor
        brickWidth = maxBrickWidth;
        brickHeight = brickWidth / aspectRatio;
        padding = (CONTAINER.height - (rows * brickHeight)) / (rows + 1);
    }
    
    // Calculate offsets to center the grid within the container
    const totalGridWidth = (cols * brickWidth) + ((cols - 1) * padding);
    const totalGridHeight = (rows * brickHeight) + ((rows - 1) * padding);
    
    const offsetX = CONTAINER.x + (CONTAINER.width - totalGridWidth) / 2;
    const offsetY = CONTAINER.y + (CONTAINER.height - totalGridHeight) / 2;
    
    debugLog.log(`Container: ${CONTAINER.width}x${CONTAINER.height}`);
    debugLog.log(`Grid: ${totalGridWidth.toFixed(1)}x${totalGridHeight.toFixed(1)}`);
    debugLog.log(`Brick: ${brickWidth.toFixed(1)}x${brickHeight.toFixed(1)}, padding: ${padding.toFixed(1)}`);
    
    return {
        width: brickWidth,
        height: brickHeight,
        padding: padding,
        offsetX: offsetX,
        offsetY: offsetY
    };
}

// First, let's modify the brick object to include level-specific properties
const brick = {
    width: 56,
    height: 20,
    padding: 10,
    offsetX: 40,
    offsetY: 60,
    rows: 5,
    cols: 11,
    totalCount: 0,    // Track total bricks for the level
    activeCount: 0    // Track remaining bricks
};

const bricks = [];
let score = 0;

// Add after other const declarations
const hitSound = document.getElementById('hitSound');

// Add color constants at the top with other constants
const colors = {
    background: '#0a192f',  // Darker background for better star visibility
    paddle: '#4a90e2',      // Soft blue for paddle
    ball: '#5ab9ea',        // Light blue for ball
    bricks: [               // Different colors for brick rows - now 7 colors for max rows
        '#ffb6b9',         // Soft pink
        '#fae3d9',         // Light peach
        '#bbded6',         // Mint green
        '#8ac6d1',         // Light cyan
        '#b8a9c9',         // Soft purple
        '#c6e2ff',         // Light blue
        '#ffd1dc'          // Light pink
    ],
    text: '#ffffff'         // White text for better contrast
};

// Add to game state variables at the top
const combo = {
    count: 0,
    multiplier: 1,
    resetTimeout: null,
    maxMultiplier: 8,
    lastHitTime: 0,
    comboWindow: 1000, // ms to maintain combo
};

// Add at the top with other constants
const debugLog = {
    element: document.getElementById('debugLog'),
    maxLines: 50,
    lines: [],
    log(message) {
        const timestamp = new Date().toLocaleTimeString();
        this.lines.unshift(`[${timestamp}] ${message}`);
        if (this.lines.length > this.maxLines) {
            this.lines.pop();
        }
        this.element.innerHTML = this.lines.join('<br>');
    }
};

// Add after other game state variables
let currentLevel = 1;
const maxLevel = 6;

// Update the levels definition with a more structured approach
const levels = {
    1: {
        rows: 8,
        cols: 10,
        pattern: null // Full grid
    },
    2: {
        rows: 8,
        cols: 10,
        pattern: (i, j, rows, cols) => {
            // Ensure we're within bounds
            if (i >= rows || j >= cols) return false;
            // Alternating pattern
            return j % 2 === (i % 2);
        }
    },
    3: {
        rows: 8,
        cols: 11,
        pattern: (i, j, rows, cols) => {
            // Ensure we're within bounds
            if (i >= rows || j >= cols) return false;
            // Diamond pattern
            const centerCol = Math.floor(cols / 2);
            const centerRow = Math.floor(rows / 2);
            const distance = Math.abs(j - centerCol) + Math.abs(i - centerRow);
            return distance < 5;
        }
    },
    4: {
        rows: 8,
        cols: 12,
        pattern: (i, j, rows, cols) => {
            // Ensure we're within bounds
            if (i >= rows || j >= cols) return false;
            // Pyramid pattern
            const centerCol = Math.floor(cols / 2);
            const maxWidth = Math.min(i + 1, rows - i) * 2;
            return Math.abs(j - centerCol) < maxWidth / 2;
        }
    },
    5: {
        rows: 8,
        cols: 13,
        pattern: (i, j, rows, cols) => {
            // Ensure we're within bounds
            if (i >= rows || j >= cols || j === 0 ) return false;
            // Spiral pattern
            const centerCol = Math.floor(cols / 2);
            const centerRow = Math.floor(rows / 2);
            const dx = j - centerCol;
            const dy = i - centerRow;
            const angle = Math.atan2(dy, dx);
            const distance = Math.sqrt(dx * dx + dy * dy);
            return distance < 4 + (angle + Math.PI) / (2 * Math.PI) * 3;
        }
    },
    6: {
        rows: 8,
        cols: 14,
        pattern: (i, j, rows, cols) => {
            // Ensure we're within bounds and not first/last column
            if (i >= rows || j >= cols || j === 0 ) return false;
            // Checkerboard with increasing difficulty
            const basePattern = (i + j) % 2 === 0;
            const difficulty = Math.floor(i / 2); // More bricks in lower rows
            return basePattern && (i >= rows - difficulty * 2);
        }
    }
};

// Add debug mode toggle
let debugMode = true; // Set to true to enable multiple balls

// Add at the top with other game state variables
const gameState = {
    current: 'menu', // 'menu', 'levelSelect', 'playing', or 'paused'
    menuOptions: [
        {
            text: 'Start Game',
            action: () => {
                gameState.current = 'playing';
                init(1); // Start from level 1
            }
        },
        {
            text: 'Select Level',
            action: () => {
                gameState.current = 'levelSelect';
                gameState.selectedOption = 0; // Reset selection when entering level select
            }
        }
    ],
    selectedOption: 0,
    levelSelect: {
        selectedLevel: 1,
        options: Object.keys(levels).map(levelNum => ({
            text: `Level ${levelNum}`,
            action: () => {
                gameState.current = 'playing';
                init(parseInt(levelNum));
            }
        }))
    },
    pauseMenu: {
        options: [
            {
                text: 'Resume',
                action: () => {
                    gameState.current = 'playing';
                }
            },
            {
                text: 'Back to Menu',
                action: () => {
                    gameState.current = 'menu';
                    gameState.selectedOption = 0;
                }
            }
        ]
    }
};

// Input handling
document.addEventListener('keydown', keyDown);
document.addEventListener('keyup', keyUp);

function keyDown(e) {
    // Add debug logging for key presses
    debugLog.log(`Key pressed: ${e.key}, Current state: ${gameState.current}`);

    // Handle ESC key first, regardless of state
    if (e.key === 'Escape') {
        debugLog.log('ESC key pressed, handling state transition');
        if (gameState.current === 'levelSelect') {
            gameState.current = 'menu';
            gameState.selectedOption = 0;
            debugLog.log('Transitioned from levelSelect to menu');
        } else if (gameState.current === 'playing') {
            debugLog.log('Transitioning from playing to paused');
            gameState.current = 'paused';
            gameState.selectedOption = 0;
            debugLog.log('Game state is now paused');
        } else if (gameState.current === 'paused') {
            debugLog.log('Transitioning from paused to playing');
            gameState.current = 'playing';
            debugLog.log('Game state is now playing');
        }
        return;
    }

    // Handle menu, level select, and pause states
    if (gameState.current === 'menu' || gameState.current === 'levelSelect' || gameState.current === 'paused') {
        switch (e.key) {
            case 'Enter':
                if (gameState.current === 'levelSelect') {
                    gameState.levelSelect.options[gameState.selectedOption].action();
                } else if (gameState.current === 'paused') {
                    gameState.pauseMenu.options[gameState.selectedOption].action();
                } else {
                    gameState.menuOptions[gameState.selectedOption].action();
                }
                break;
            case 'ArrowUp':
                if (gameState.current === 'levelSelect') {
                    gameState.selectedOption = (gameState.selectedOption - 1 + gameState.levelSelect.options.length) % gameState.levelSelect.options.length;
                } else if (gameState.current === 'paused') {
                    gameState.selectedOption = (gameState.selectedOption - 1 + gameState.pauseMenu.options.length) % gameState.pauseMenu.options.length;
                } else {
                    gameState.selectedOption = (gameState.selectedOption - 1 + gameState.menuOptions.length) % gameState.menuOptions.length;
                }
                break;
            case 'ArrowDown':
                if (gameState.current === 'levelSelect') {
                    gameState.selectedOption = (gameState.selectedOption + 1) % gameState.levelSelect.options.length;
                } else if (gameState.current === 'paused') {
                    gameState.selectedOption = (gameState.selectedOption + 1) % gameState.pauseMenu.options.length;
                } else {
                    gameState.selectedOption = (gameState.selectedOption + 1) % gameState.menuOptions.length;
                }
                break;
        }
        return;
    }

    // Handle game input only when playing
    if (gameState.current === 'playing') {
        if (e.key === 'ArrowRight') {
            paddle.dx = paddle.speed;
        } else if (e.key === 'ArrowLeft') {
            paddle.dx = -paddle.speed;
        } else if (e.key === ' ') {
            if (debugMode) {
                addNewBall();
                const lastBall = balls[balls.length - 1];
                launchBall(lastBall);
                debugLog.log('New ball added. Total balls: ' + balls.length);
            } else if (balls.length > 0 && !balls[0].moving) {
                launchBall(balls[0]);
            }
        }
    }
}

function keyUp(e) {
    if (e.key === 'ArrowRight' && paddle.dx > 0) {
        paddle.dx = 0;
    } else if (e.key === 'ArrowLeft' && paddle.dx < 0) {
        paddle.dx = 0;
    }
}

// Add parallax background objects
const background = {
    stars: [],
    numStars: 100,
    speeds: [0.1, 0.2, 0.3], // Different speeds for different layers
    init() {
        // Create stars with random positions and layers
        for (let i = 0; i < this.numStars; i++) {
            this.stars.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                radius: Math.random() * 2 + 1,
                layer: Math.floor(Math.random() * 3), // 0, 1, or 2
                opacity: Math.random() * 0.5 + 0.2
            });
        }
    },
    update() {
        // Update star positions
        this.stars.forEach(star => {
            star.y += this.speeds[star.layer];
            
            // Reset star position when it goes off screen
            if (star.y > canvas.height) {
                star.y = 0;
                star.x = Math.random() * canvas.width;
            }
        });
    },
    render() {
        this.stars.forEach(star => {
            ctx.beginPath();
            ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, ${star.opacity})`;
            ctx.fill();
            ctx.closePath();
        });
    }
};

// Add after other game objects
const effects = {
    shake: {
        intensity: 0,
        duration: 0
    },
    particles: [],
    createParticles(x, y, color) {
        for (let i = 0; i < 8; i++) {
            this.particles.push({
                x,
                y,
                color,
                dx: (Math.random() - 0.5) * 4,
                dy: (Math.random() - 0.5) * 4,
                life: 1.0 // Will decrease until 0
            });
        }
    },
    update() {
        // Update screen shake
        if (this.shake.duration > 0) {
            this.shake.duration--;
        }

        // Update particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.dx;
            p.y += p.dy;
            p.life -= 0.02;
            
            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }
    },
    render(ctx) {
        // Apply screen shake
        if (this.shake.duration > 0) {
            const dx = Math.random() * this.shake.intensity * 2 - this.shake.intensity;
            const dy = Math.random() * this.shake.intensity * 2 - this.shake.intensity;
            ctx.save();
            ctx.translate(dx, dy);
        }

        // Render particles
        this.particles.forEach(p => {
            ctx.beginPath();
            ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${p.color}, ${p.life})`;
            ctx.fill();
            ctx.closePath();
        });

        // Render text particles (for combo)
        this.particles.forEach(p => {
            if (p.isText) {
                const alpha = p.life;
                const size = p.size * (1 + (1 - p.life) * 0.5); // Text grows as it fades
                ctx.font = `bold ${size}px Arial`;
                ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
                ctx.textAlign = 'center';
                ctx.fillText(p.text, p.x, p.y);
            }
        });
    },
    screenShake(intensity = 5, duration = 10) {
        this.shake.intensity = intensity;
        this.shake.duration = duration;
    },
    createComboText(x, y, text, size) {
        this.particles.push({
            x,
            y,
            text,
            size,
            dy: -2,
            life: 1.0,
            isText: true
        });
    }
};

// Game initialization
function init(levelNum = 1) {
    // Initialize background if it hasn't been
    if (background.stars.length === 0) {
        background.init();
    }
    
    if (levelNum === 1) {
        score = 0;
        combo.count = 0;
        combo.multiplier = 1;
    }
    
    currentLevel = levelNum;
    const level = levels[currentLevel];
    
    // Reset brick counts
    brick.totalCount = 0;
    brick.activeCount = 0;
    
    // Update brick dimensions based on level layout
    const dimensions = calculateBrickDimensions(level.rows, level.cols);
    brick.width = dimensions.width;
    brick.height = dimensions.height;
    brick.padding = dimensions.padding;
    brick.offsetX = dimensions.offsetX;
    brick.offsetY = dimensions.offsetY;
    brick.rows = level.rows;
    brick.cols = level.cols;
    
    debugLog.log(`Level ${currentLevel} initialized with ${brick.rows}x${brick.cols} grid`);
    
    // Create bricks for current level with proper counting
    bricks.length = 0;
    for (let i = 0; i < level.rows; i++) {
        bricks[i] = [];
        for (let j = 0; j < level.cols; j++) {
            const shouldCreate = level.pattern ? 
                level.pattern(i, j, level.rows, level.cols) : 
                true;
            
            if (shouldCreate) {
                brick.totalCount++;
                brick.activeCount++;
            }
            
            bricks[i][j] = {
                x: j * (brick.width + brick.padding) + brick.offsetX,
                y: i * (brick.height + brick.padding) + brick.offsetY,
                visible: shouldCreate
            };
        }
    }
    
    debugLog.log(`Created level with ${brick.totalCount} total bricks`);
    
    // Reset balls
    balls = [];
    addNewBall();

    // Reset paddle
    paddle.x = canvas.width / 2 - paddle.width / 2;
}

// Game update logic
function update(deltaTime) {
    if (transition.active) {
        transition.update();
        return;
    }

    // Update effects
    effects.update();

    // Update background
    background.update();

    // Move paddle
    paddle.x += paddle.dx;

    // Keep paddle within boundaries
    if (paddle.x < 0) {
        paddle.x = 0;
    } else if (paddle.x + paddle.width > canvas.width) {
        paddle.x = canvas.width - paddle.width;
    }

    // Update all balls
    for (let ballIndex = balls.length - 1; ballIndex >= 0; ballIndex--) {
        const ball = balls[ballIndex];
        
        if (ball.moving) {
            // Move ball
            ball.x += ball.dx;
            ball.y += ball.dy;

            // Wall collision with boundary enforcement
            if (ball.x + ball.radius > canvas.width) {
                ball.x = canvas.width - ball.radius; // Force ball position to valid range
                ball.dx *= -1;
                playBallCollisionSound('wall');
            } else if (ball.x - ball.radius < 0) {
                ball.x = ball.radius; // Force ball position to valid range
                ball.dx *= -1;
                playBallCollisionSound('wall');
            }

            if (ball.y - ball.radius < 0) {
                ball.y = ball.radius; // Force ball position to valid range
                ball.dy *= -1;
                playBallCollisionSound('wall');
            }

            // Paddle collision with angle reflection
            if (ball.y + ball.radius > paddle.y && 
                ball.x > paddle.x && 
                ball.x < paddle.x + paddle.width) {
                
                // Calculate where on the paddle the ball hit (0 to 1)
                const hitPosition = (ball.x - paddle.x) / paddle.width;
                
                // Angle range from -60 to 60 degrees
                const maxAngle = Math.PI / 3; // 60 degrees
                const angle = (hitPosition * 2 - 1) * maxAngle;
                
                // Calculate new velocity based on angle while maintaining speed
                const speed = Math.sqrt(ball.dx * ball.dx + ball.dy * ball.dy);
                ball.dx = Math.sin(angle) * speed;
                ball.dy = -Math.cos(angle) * speed;
                
                // Ensure minimum vertical velocity to prevent horizontal bouncing
                const minVerticalSpeed = speed * 0.3;
                if (Math.abs(ball.dy) < minVerticalSpeed) {
                    const sign = ball.dy < 0 ? -1 : 1;
                    ball.dy = sign * minVerticalSpeed;
                    // Recalculate horizontal speed to maintain total speed
                    ball.dx = sign * Math.sqrt(speed * speed - minVerticalSpeed * minVerticalSpeed);
                }

                debugLog.log(`Ball hit paddle at position ${hitPosition.toFixed(2)}, angle: ${(angle * 180 / Math.PI).toFixed(1)}°`);
                combo.count = 0;
                combo.multiplier = 1;
                clearTimeout(combo.resetTimeout);
                
                // Add sound for paddle hit
                playBallCollisionSound('paddle');
            }

            // Remove ball if it goes below paddle
            if (ball.y + ball.radius > canvas.height) {
                balls.splice(ballIndex, 1);
                debugLog.log('Ball removed. Remaining balls: ' + balls.length);
                if (balls.length === 0) {
                    addNewBall(); // Add new ball when all balls are lost
                }
                continue;
            }

            // Brick collision - updated for better accuracy
            for (let i = 0; i < brick.rows; i++) {
                for (let j = 0; j < brick.cols; j++) {
                    const b = bricks[i][j];
                    if (b.visible) {
                        // Calculate the closest point on the brick to the ball's center
                        const closestX = Math.max(b.x, Math.min(ball.x, b.x + brick.width));
                        const closestY = Math.max(b.y, Math.min(ball.y, b.y + brick.height));

                        // Calculate the distance between the ball's center and this closest point
                        const distanceX = ball.x - closestX;
                        const distanceY = ball.y - closestY;
                        const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);

                        // If the distance is less than the ball's radius, we have a collision
                        if (distance <= ball.radius) {
                            debugLog.log(`Collision detected with brick at row ${i}, col ${j}`);
                            // Calculate new velocity
                            const newVelocity = calculateBrickBounce(ball, b);
                            ball.dx = newVelocity.dx;
                            ball.dy = newVelocity.dy;
                            
                            // Ensure minimum vertical velocity to prevent horizontal bouncing
                            const speed = Math.sqrt(ball.dx * ball.dx + ball.dy * ball.dy);
                            const minVerticalSpeed = speed * 0.3;
                            if (Math.abs(ball.dy) < minVerticalSpeed) {
                                const sign = ball.dy < 0 ? -1 : 1;
                                ball.dy = sign * minVerticalSpeed;
                                // Recalculate horizontal speed to maintain total speed
                                ball.dx = sign * Math.sqrt(speed * speed - minVerticalSpeed * minVerticalSpeed);
                            }

                            b.visible = false;
                            brick.activeCount--;
                            debugLog.log(`Brick destroyed. Remaining: ${brick.activeCount}/${brick.totalCount}`);
                            
                            // Update combo
                            const now = Date.now();
                            if (now - combo.lastHitTime < combo.comboWindow) {
                                combo.count++;
                                debugLog.log(`Combo increased to ${combo.count}, multiplier: ${combo.multiplier}`);
                                combo.multiplier = Math.min(Math.floor(combo.count / 3) + 1, combo.maxMultiplier);
                                
                                // Only shake screen at 5x intervals and increase intensity
                                if (combo.count >= 5 && combo.count % 5 === 0) {
                                    const shakeLevel = Math.floor(combo.count / 5); // 1 at 5x, 2 at 10x, etc.
                                    const shakeIntensity = Math.min(3 + shakeLevel * 2, 12); // Increases by 2 each time, max 12
                                    const shakeDuration = Math.min(5 + shakeLevel * 2, 15); // Increases duration too, max 15
                                    effects.screenShake(shakeIntensity, shakeDuration);
                                    debugLog.log(`Screen shake: intensity=${shakeIntensity}, duration=${shakeDuration}`);
                                }
                                
                                // Comment out particle creation
                                // const brickColor = colors.bricks[i % colors.bricks.length];
                                // const rgb = hexToRgb(brickColor);
                                // for (let p = 0; p < particleCount; p++) {
                                //     effects.createParticles(b.x + brick.width/2, b.y + brick.height/2, `${rgb.r},${rgb.g},${rgb.b}`);
                                // }

                                // Increase score based on multiplier
                                score += 10 * combo.multiplier;
                                
                                // Play brick hit sound with combo
                                playBallCollisionSound('brick');
                            } else {
                                debugLog.log('Combo reset - too much time passed');
                                combo.count = 1;
                                combo.multiplier = 1;
                                // Remove screen shake for non-combo hits
                                // effects.screenShake(3, 5);
                                score += 10;
                                
                                // Play normal brick hit sound
                                playBallCollisionSound('brick');
                            }

                            combo.lastHitTime = now;

                            // Reset combo if ball hits paddle
                            clearTimeout(combo.resetTimeout);
                            combo.resetTimeout = setTimeout(() => {
                                combo.count = 0;
                                combo.multiplier = 1;
                            }, combo.comboWindow);

                            break; // Exit after first collision
                        }
                    }
                }
            }
        } else {
            // Ball follows paddle before launch
            ball.x = paddle.x + paddle.width / 2;
        }
    }

    // Check for level completion after brick collision handling
    if (isLevelComplete()) {
        debugLog.log(`Level ${currentLevel} complete! Max level: ${maxLevel}`);
        if (currentLevel < maxLevel) {
            transition.start();
        } else {
            debugLog.log('Game complete!');
            gameState.current = 'menu';
        }
    }
}

function resetBall() {
    debugLog.log('Resetting balls');
    balls = [];
    addNewBall();
}

// Game render logic
function render() {
    // Clear the canvas with background color
    ctx.fillStyle = colors.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw background
    background.render();

    // Start effects (for screen shake)
    effects.render(ctx);

    // Draw paddle
    ctx.fillStyle = colors.paddle;
    ctx.fillRect(paddle.x, paddle.y, paddle.width, paddle.height);

    // Draw all balls
    balls.forEach(ball => {
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
        ctx.fillStyle = colors.ball;
        ctx.fill();
        ctx.closePath();
    });

    // Draw bricks
    for (let i = 0; i < brick.rows; i++) {
        for (let j = 0; j < brick.cols; j++) {
            if (bricks[i][j].visible) {
                ctx.fillStyle = colors.bricks[i];
                ctx.fillRect(
                    bricks[i][j].x,
                    bricks[i][j].y,
                    brick.width,
                    brick.height
                );
            }
        }
    }

    // Draw score and combo
    ctx.font = '20px Arial';
    ctx.fillStyle = colors.text;
    ctx.textAlign = 'left';
    ctx.fillText(`Score: ${score}`, 8, 30);
    
    // New combo display at top center
    if (combo.count > 1) {
        // Draw glow effect for combo text
        ctx.save();
        ctx.textAlign = 'center';
        ctx.shadowBlur = 15;
        ctx.shadowColor = 'rgba(255, 255, 255, 0.5)';
        
        // Draw combo multiplier
        const comboSize = Math.min(32 + combo.multiplier * 2, 48);
        ctx.font = `bold ${comboSize}px Arial`;
        const gradient = ctx.createLinearGradient(
            canvas.width/2 - 50, 
            0, 
            canvas.width/2 + 50, 
            0
        );
        gradient.addColorStop(0, '#ff6b6b');
        gradient.addColorStop(0.5, '#ffd93d');
        gradient.addColorStop(1, '#ff6b6b');
        ctx.fillStyle = gradient;
        ctx.fillText(`${combo.count}×`, canvas.width/2, 45);
        
        // Draw "COMBO" text below
        ctx.font = '16px Arial';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.fillText('COMBO', canvas.width/2, 65);
        
        ctx.restore();
    }

    // Draw level indicator
    ctx.font = '20px Arial';
    ctx.fillStyle = colors.text;
    ctx.textAlign = 'right';
    ctx.fillText(`Level: ${currentLevel}`, canvas.width - 8, 30);

    // Draw transition effect
    transition.render(ctx);

    // If we had screen shake, restore the context
    if (effects.shake.duration > 0) {
        ctx.restore();
    }

    // Draw debug info if enabled
    if (debugMode) {
        ctx.font = '16px Arial';
        ctx.fillStyle = '#ff0';
        ctx.textAlign = 'left';
        ctx.fillText(`Debug Mode: ON (Balls: ${balls.length})`, 8, canvas.height - 10);
    }
}

// Main game loop
function gameLoop(currentTime) {
    try {
        const deltaTime = currentTime - lastTime;

        if (deltaTime >= frameTime) {
            // Always update background
            background.update();

            // Update game state based on current state
            if (gameState.current === 'playing') {
                update(deltaTime);
                render();
            } else if (gameState.current === 'paused') {
                debugLog.log('Game is paused - rendering paused state');
                // When paused, render the game state first, then the pause menu
                render();
                renderMenu();
            } else if (gameState.current === 'menu' || gameState.current === 'levelSelect') {
                renderMenu();
            }
            
            lastTime = currentTime;
        }

        requestAnimationFrame(gameLoop);
    } catch (error) {
        debugLog.log(`ERROR: ${error.message}`);
        debugLog.log(error.stack);
    }
}

// Start the game
init();
requestAnimationFrame(gameLoop);

// Add utility function for color conversion
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

// Update the isLevelComplete function with debug logging
function isLevelComplete() {
    const complete = brick.activeCount === 0;
    if (complete) {
        debugLog.log(`Level ${currentLevel} complete! All ${brick.totalCount} bricks destroyed.`);
    }
    return complete;
}

// Add level transition effect
const transition = {
    active: false,
    alpha: 0,
    fadeIn: false,
    duration: 300, // Increased from 180 to 300 frames (5 seconds at 60 FPS)
    current: 0,
    particles: [],
    scoreDisplay: {
        current: 0,
        target: 0,
        start: 0,
        animationStarted: false,
        animationComplete: false
    },
    messages: {
        levelComplete: { opacity: 0, y: 0 },
        score: { opacity: 0, y: 0 },
        nextLevel: { opacity: 0, y: 0 }
    },
    
    start() {
        this.active = true;
        this.fadeIn = true;
        this.current = 0;
        this.alpha = 0;
        this.particles = [];
        this.scoreDisplay = {
            start: score,
            current: score,
            target: score,
            animationStarted: false,
            animationComplete: false
        };
        
        // Reset message states
        this.messages = {
            levelComplete: { opacity: 0, y: canvas.height/2 - 40 },
            score: { opacity: 0, y: canvas.height/2 },
            nextLevel: { opacity: 0, y: canvas.height/2 + 40 }
        };
        
        // Create celebration particles
        for (let i = 0; i < 100; i++) { // Increased particle count
            this.particles.push({
                x: canvas.width / 2,
                y: canvas.height / 2,
                dx: (Math.random() - 0.5) * 12,
                dy: (Math.random() - 0.5) * 12,
                size: Math.random() * 6 + 2,
                color: colors.bricks[Math.floor(Math.random() * colors.bricks.length)],
                alpha: 1,
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 0.2
            });
        }
    },
    
    easeInOutCubic(t) {
        return t < 0.5 
            ? 4 * t * t * t 
            : 1 - Math.pow(-2 * t + 2, 3) / 2;
    },
    
    update() {
        if (!this.active) return;
        
        this.current++;
        const progress = this.current / this.duration;
        
        if (this.fadeIn) {
            this.alpha = this.easeInOutCubic(progress * 2);
            
            // Adjusted timing for messages to appear earlier and stay longer
            if (progress > 0.1) { // Level complete message appears earlier (was 0.15)
                this.messages.levelComplete.opacity = Math.min(1, (progress - 0.1) * 3);
            }
            if (progress > 0.2) { // Score message appears earlier (was 0.25)
                this.messages.score.opacity = Math.min(1, (progress - 0.2) * 3);
                if (!this.scoreDisplay.animationStarted) {
                    this.scoreDisplay.animationStarted = true;
                }
            }
            if (progress > 0.3) { // Next level message appears earlier (was 0.35)
                this.messages.nextLevel.opacity = Math.min(1, (progress - 0.3) * 3);
            }
            
            // Wait longer before transitioning to next level
            if (this.current >= this.duration * 0.7) { // Changed from duration/2 to duration * 0.7
                this.fadeIn = false;
                init(currentLevel + 1);
            }
        } else {
            // Slower fade out
            this.alpha = this.easeInOutCubic(2 - progress * 2);
            if (this.current >= this.duration) {
                this.active = false;
            }
        }
        
        // Update particles with more dynamic behavior
        this.particles.forEach(p => {
            p.x += p.dx;
            p.y += p.dy;
            p.dy += 0.15; // Increased gravity
            p.alpha = Math.max(0, p.alpha - 0.01); // Slower fade
            p.rotation += p.rotationSpeed;
            
            // Bounce particles off screen edges
            if (p.x < 0 || p.x > canvas.width) p.dx *= -0.8;
            if (p.y < 0 || p.y > canvas.height) p.dy *= -0.8;
        });
        
        // Animate score counter with easing
        if (this.scoreDisplay.animationStarted && !this.scoreDisplay.animationComplete) {
            const scoreProgress = (progress - 0.25) * 2;
            if (scoreProgress <= 1) {
                this.scoreDisplay.current = Math.floor(this.scoreDisplay.start + 
                    (this.scoreDisplay.target - this.scoreDisplay.start) * this.easeInOutCubic(scoreProgress));
            } else {
                this.scoreDisplay.animationComplete = true;
            }
        }
    },
    
    render(ctx) {
        if (!this.active) return;
        
        // Draw particles with glow effect
        this.particles.forEach(p => {
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rotation);
            
            // Add glow effect
            ctx.shadowBlur = 15;
            ctx.shadowColor = p.color;
            
            ctx.fillStyle = `${p.color}${Math.floor(p.alpha * 255).toString(16).padStart(2, '0')}`;
            ctx.fillRect(-p.size/2, -p.size/2, p.size, p.size);
            ctx.restore();
        });
        
        // Draw fade overlay
        ctx.fillStyle = `rgba(0, 0, 0, ${this.alpha})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        if (this.fadeIn) {
            ctx.textAlign = 'center';
            
            // Draw messages with individual fade-ins and slight animations
            if (this.messages.levelComplete.opacity > 0) {
                ctx.fillStyle = `rgba(255, 255, 255, ${this.messages.levelComplete.opacity})`;
                ctx.font = 'bold 48px Arial';
                ctx.fillText(`Level ${currentLevel} Complete!`, 
                    canvas.width/2, 
                    this.messages.levelComplete.y);
            }
            
            if (this.messages.score.opacity > 0) {
                ctx.fillStyle = `rgba(255, 255, 255, ${this.messages.score.opacity})`;
                ctx.font = '32px Arial';
                ctx.fillText(`Score: ${this.scoreDisplay.current}`, 
                    canvas.width/2, 
                    this.messages.score.y);
            }
            
            if (this.messages.nextLevel.opacity > 0) {
                ctx.fillStyle = `rgba(255, 255, 255, ${this.messages.nextLevel.opacity})`;
                ctx.font = '24px Arial';
                ctx.fillText('Get Ready for Level ' + (currentLevel + 1), 
                    canvas.width/2, 
                    this.messages.nextLevel.y);
            }
        }
    }
};

// Add function to create new balls
function addNewBall() {
    balls.push({
        ...ballTemplate,
        x: paddle.x + paddle.width / 2,
        y: 530,
        dx: 0,  // Initial velocity will be set by launchBall
        dy: 0,  // Initial velocity will be set by launchBall
        moving: false
    });
}

// First, let's add a function to handle ball collision sounds
function playBallCollisionSound(type, speed = 1) {
    // Reset sound to prevent overlapping
    hitSound.currentTime = 0;
    
    // Adjust pitch based on collision type and speed
    switch(type) {
        case 'paddle':
            hitSound.playbackRate = 0.8; // Lower pitch for paddle
            break;
        case 'brick':
            // Higher pitch for bricks, modified by combo
            hitSound.playbackRate = Math.min(1 + combo.multiplier * 0.1, 2.0);
            break;
        case 'wall':
            hitSound.playbackRate = 1.2; // Slightly higher pitch for walls
            break;
    }
    
    hitSound.play();
}

// Add this function to calculate more realistic bounces
function calculateBrickBounce(ball, brick) {
    // Calculate collision normal
    const ballCenterX = ball.x;
    const ballCenterY = ball.y;
    
    // Find the closest point on the brick to the ball's center
    const closestX = Math.max(brick.x, Math.min(ballCenterX, brick.x + brick.width));
    const closestY = Math.max(brick.y, Math.min(ballCenterY, brick.y + brick.height));
    
    // Calculate normal vector
    let normalX = ballCenterX - closestX;
    let normalY = ballCenterY - closestY;
    
    // If the ball is exactly at the corner or edge, determine normal based on approach direction
    if (Math.abs(normalX) < 0.0001 && Math.abs(normalY) < 0.0001) {
        // Ball is exactly at corner/edge, use ball's velocity to determine reflection
        if (Math.abs(ball.dx) > Math.abs(ball.dy)) {
            // Horizontal approach
            normalX = ball.dx > 0 ? 1 : -1;
            normalY = 0;
        } else {
            // Vertical approach
            normalX = 0;
            normalY = ball.dy > 0 ? 1 : -1;
        }
    }
    
    // Normalize the normal vector
    const length = Math.sqrt(normalX * normalX + normalY * normalY);
    if (length > 0) {
        normalX /= length;
        normalY /= length;
    } else {
        // Fallback to vertical normal if we somehow still have a zero-length vector
        normalX = 0;
        normalY = ball.dy > 0 ? -1 : 1;
    }
    
    // Calculate reflection using the normalized normal vector
    const dotProduct = 2 * (ball.dx * normalX + ball.dy * normalY);
    const reflectionX = ball.dx - dotProduct * normalX;
    const reflectionY = ball.dy - dotProduct * normalY;
    
    // Maintain ball speed
    const currentSpeed = Math.sqrt(ball.dx * ball.dx + ball.dy * ball.dy);
    const reflectionLength = Math.sqrt(reflectionX * reflectionX + reflectionY * reflectionY);
    
    // Safety check for zero reflection length
    if (reflectionLength < 0.0001) {
        debugLog.log('Warning: Zero reflection length detected, using simple bounce');
        return {
            dx: -ball.dx,
            dy: -ball.dy
        };
    }
    
    const newVelocity = {
        dx: (reflectionX / reflectionLength) * currentSpeed,
        dy: (reflectionY / reflectionLength) * currentSpeed
    };
    
    // Verify the new velocity
    if (isNaN(newVelocity.dx) || isNaN(newVelocity.dy)) {
        debugLog.log('Error: Invalid velocity calculated, using simple bounce');
        debugLog.log(`Normal: (${normalX}, ${normalY}), Length: ${length}`);
        debugLog.log(`Reflection: (${reflectionX}, ${reflectionY}), Length: ${reflectionLength}`);
        return {
            dx: -ball.dx,
            dy: -ball.dy
        };
    }
    
    // Add debug logging for successful calculations
    debugLog.log(`Normal vector: (${normalX.toFixed(2)}, ${normalY.toFixed(2)})`);
    debugLog.log(`Ball velocity before: dx=${ball.dx.toFixed(2)}, dy=${ball.dy.toFixed(2)}`);
    debugLog.log(`New velocity: dx=${newVelocity.dx.toFixed(2)}, dy=${newVelocity.dy.toFixed(2)}`);
    
    return newVelocity;
}

// Add new function to handle ball launching
function launchBall(ball) {
    ball.moving = true;
    
    // Set initial velocity based on paddle movement
    if (paddle.dx > 0) {
        // Moving right - 45° right
        ball.dx = ballTemplate.speed;
        ball.dy = -ballTemplate.speed;
    } else if (paddle.dx < 0) {
        // Moving left - 45° left
        ball.dx = -ballTemplate.speed;
        ball.dy = -ballTemplate.speed;
    } else {
        // Stationary - straight up
        ball.dx = 0;
        ball.dy = -ballTemplate.speed * Math.SQRT2; // Maintain same speed as diagonal launches
    }
}

// Add an additional safety check after all ball movement
// Add this after all ball position updates but before collision checks
const safetyCheck = () => {
    // Enforce horizontal boundaries
    if (ball.x < ball.radius) {
        ball.x = ball.radius;
        ball.dx = Math.abs(ball.dx); // Force movement to the right
    } else if (ball.x > canvas.width - ball.radius) {
        ball.x = canvas.width - ball.radius;
        ball.dx = -Math.abs(ball.dx); // Force movement to the left
    }
    
    // Enforce vertical boundaries
    if (ball.y < ball.radius) {
        ball.y = ball.radius;
        ball.dy = Math.abs(ball.dy); // Force movement downward
    }
    
    // Ensure the ball is moving at minimum speed
    const currentSpeed = Math.sqrt(ball.dx * ball.dx + ball.dy * ball.dy);
    if (currentSpeed < ballTemplate.speed * 0.5) {
        // If ball is moving too slow, reset to minimum speed
        const factor = ballTemplate.speed / currentSpeed;
        ball.dx *= factor;
        ball.dy *= factor;
        debugLog.log('Ball speed corrected - was moving too slow');
    } else if (currentSpeed > ballTemplate.speed * 1.5) {
        // If ball is moving too fast, cap the speed
        const factor = ballTemplate.speed / currentSpeed;
        ball.dx *= factor;
        ball.dy *= factor;
        debugLog.log('Ball speed corrected - was moving too fast');
    }
};

// Add menu rendering function
function renderMenu() {
    // Only clear and draw background for main menu and level select
    if (gameState.current !== 'paused') {
        // Clear the canvas with background color
        ctx.fillStyle = colors.background;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw background
        background.render();
    }

    // Draw title
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = colors.text;
    ctx.shadowBlur = 20;
    ctx.shadowColor = 'rgba(255, 255, 255, 0.5)';

    // Main title (only for main menu)
    if (gameState.current === 'menu') {
        ctx.font = 'bold 64px Arial';
        const gradient = ctx.createLinearGradient(
            canvas.width/2 - 150,
            canvas.height/3 - 30,
            canvas.width/2 + 150,
            canvas.height/3 + 30
        );
        gradient.addColorStop(0, '#ff6b6b');
        gradient.addColorStop(0.5, '#ffd93d');
        gradient.addColorStop(1, '#ff6b6b');
        ctx.fillStyle = gradient;
        ctx.fillText('BREAKOUT', canvas.width/2, canvas.height/3);
    }

    // Menu options, level selection, or pause menu
    if (gameState.current === 'levelSelect') {
        // Draw level selection title
        ctx.font = '32px Arial';
        ctx.fillStyle = colors.text;
        ctx.fillText('Select Level', canvas.width/2, canvas.height/2 - 60);

        // Draw level options
        ctx.font = '28px Arial';
        gameState.levelSelect.options.forEach((option, index) => {
            const y = canvas.height/2 + index * 40;
            
            // Draw selection indicator
            if (index === gameState.selectedOption) {
                ctx.fillStyle = '#ffd93d';
                ctx.fillText('> ' + option.text + ' <', canvas.width/2, y);
            } else {
                ctx.fillStyle = colors.text;
                ctx.fillText(option.text, canvas.width/2, y);
            }
        });

        // Draw instructions
        ctx.font = '20px Arial';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.fillText('Use arrow keys to select level', canvas.width/2, canvas.height * 0.8);
        ctx.fillText('Press ENTER to start level', canvas.width/2, canvas.height * 0.8 + 30);
        ctx.fillText('Press ESC to return to main menu', canvas.width/2, canvas.height * 0.8 + 60);
    } else if (gameState.current === 'paused') {
        // Draw semi-transparent overlay for pause menu
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw pause menu title
        ctx.font = '32px Arial';
        ctx.fillStyle = colors.text;
        ctx.fillText('PAUSED', canvas.width/2, canvas.height/2 - 60);

        // Draw pause menu options
        ctx.font = '28px Arial';
        gameState.pauseMenu.options.forEach((option, index) => {
            const y = canvas.height/2 + index * 40;
            
            // Draw selection indicator
            if (index === gameState.selectedOption) {
                ctx.fillStyle = '#ffd93d';
                ctx.fillText('> ' + option.text + ' <', canvas.width/2, y);
            } else {
                ctx.fillStyle = colors.text;
                ctx.fillText(option.text, canvas.width/2, y);
            }
        });

        // Draw instructions
        ctx.font = '20px Arial';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.fillText('Use arrow keys to navigate', canvas.width/2, canvas.height * 0.8);
        ctx.fillText('Press ENTER to select', canvas.width/2, canvas.height * 0.8 + 30);
        ctx.fillText('Press ESC to resume game', canvas.width/2, canvas.height * 0.8 + 60);
    } else {
        // Draw main menu options
        ctx.font = '32px Arial';
        gameState.menuOptions.forEach((option, index) => {
            const y = canvas.height/2 + index * 50;
            
            // Draw selection indicator
            if (index === gameState.selectedOption) {
                ctx.fillStyle = '#ffd93d';
                ctx.fillText('> ' + option.text + ' <', canvas.width/2, y);
            } else {
                ctx.fillStyle = colors.text;
                ctx.fillText(option.text, canvas.width/2, y);
            }
        });

        // Draw instructions
        ctx.font = '20px Arial';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.fillText('Use arrow keys to navigate', canvas.width/2, canvas.height * 0.7);
        ctx.fillText('Press ENTER to select', canvas.width/2, canvas.height * 0.7 + 30);
    }

    ctx.restore();
}

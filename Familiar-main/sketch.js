// ============================================================
//  YOUR CREATURE  —  sketch.js
//  MDDN242 Project 2  |  Two Liquid Familiars / Maze Walker
// ============================================================

new p5(function(p) {

    // ============================================================
    //  MAZE CONFIG
    // ============================================================
    let CELL = 40;
    let COLS, ROWS;
    let maze = [];

    // ============================================================
    //  DERIVED SIZES
    // ============================================================
    let BLOB_DIST;
    const NUM_BLOBS     = 22;
    const SPRING_K      = 0.22;
    const DAMPING       = 0.70;
    const NUM_TENTACLES = 6;

    function deriveSizes() {
        BLOB_DIST = CELL * 0.28;
    }

    // ============================================================
    //  DOORS  (shared pool, 4 total)
    // ============================================================
    let doors = [];
    const TOTAL_DOORS     = 80;
    const DOOR_ANIM_SPEED = 0.045;
    const REROUTE_FRAMES  = 90;  // frames blocked before rerouting

    // ============================================================
    //  TWO CREATURES
    // ============================================================
    let creatures = [];   // two entries

    // Creature colour palettes
    const PALETTES = [
        { body: [8, 8, 18],  glow: [10, 200, 80],  shimmer: [80, 120, 255],  trail: [10, 30, 15],  trailGlow: [20, 200, 80]  },
        { body: [18, 5, 18], glow: [200, 40, 200],  shimmer: [255, 80, 200],  trail: [30, 8, 25],   trailGlow: [200, 40, 200] },
    ];

    // ============================================================
    //  SETUP
    // ============================================================
    function isMobile() { return window.innerWidth <= 768; }
    function canvasSize() {
        if (isMobile()) return { w: window.innerWidth, h: window.innerHeight };
        return { w: p.windowWidth - 40, h: p.windowHeight - 40 };
    }

    p.setup = function() {
        let sz  = canvasSize();
        let cnv = p.createCanvas(sz.w, sz.h);
        cnv.parent('canvas-container');
        deriveSizes();
        init();
    };

    // ============================================================
    //  FULL INIT
    // ============================================================
    function init() {
        buildMaze();
        creatures = [];

        // Creature 0: left → right  (green)
        let startRow0 = p.floor(ROWS * 0.35);
        let paths0    = findMultiplePaths(0, startRow0, COLS - 1, startRow0, 3);
        creatures.push(createCreature(
            path0StartX(paths0), path0StartY(paths0, startRow0),
            paths0, 0, true, PALETTES[0]
        ));

        // Creature 1: right → left  (purple)
        let startRow1 = p.floor(ROWS * 0.65);
        let paths1    = findMultiplePaths(COLS - 1, startRow1, 0, startRow1, 3);
        creatures.push(createCreature(
            (COLS - 1) * CELL + CELL / 2, startRow1 * CELL + CELL / 2,
            paths1, 0, false, PALETTES[1]
        ));

        // Place doors — 2 per creature, on different paths where possible
        doors = [];
        placeDoors(creatures[0], 5);
        placeDoors(creatures[1], 8);
    }

    function path0StartX(paths) { return paths[0][0].col * CELL + CELL / 2; }
    function path0StartY(paths, row) { return paths[0][0].row * CELL + CELL / 2; }

    // ============================================================
    //  MAZE GENERATION  (iterative DFS)
    // ============================================================
    function buildMaze() {
        COLS = p.max(p.floor(p.width  / CELL), 7);
        ROWS = p.max(p.floor(p.height / CELL), 7);

        maze = [];
        for (let r = 0; r < ROWS; r++) {
            maze[r] = [];
            for (let c = 0; c < COLS; c++) {
                maze[r][c] = { col: c, row: r, visited: false, walls: { N:true, S:true, E:true, W:true } };
            }
        }
        carveIterative(0, 0);
    }

    function carveIterative(sc, sr) {
        let stack = [{ c: sc, r: sr }];
        maze[sr][sc].visited = true;
        while (stack.length > 0) {
            let { c, r } = stack[stack.length - 1];
            let dirs = p.shuffle(['N','S','E','W']);
            let moved = false;
            for (let d of dirs) {
                let nc = c, nr = r;
                if (d==='N') nr--; if (d==='S') nr++;
                if (d==='E') nc++; if (d==='W') nc--;
                if (nr>=0 && nr<ROWS && nc>=0 && nc<COLS && !maze[nr][nc].visited) {
                    maze[r][c].walls[d] = false;
                    maze[nr][nc].walls[opposite(d)] = false;
                    maze[nr][nc].visited = true;
                    stack.push({ c:nc, r:nr });
                    moved = true; break;
                }
            }
            if (!moved) stack.pop();
        }
    }

    function opposite(d) { return { N:'S', S:'N', E:'W', W:'E' }[d]; }

    // ============================================================
    //  PATHFINDING — find up to maxPaths distinct paths via BFS
    //  Returns array of paths (each path = array of {col,row})
    // ============================================================
    function findMultiplePaths(sc, sr, ec, er, maxPaths) {
        let results = [];
        // First path: normal BFS
        let p1 = bfs(sc, sr, ec, er, new Set());
        if (!p1) return [[{col:sc,row:sr}]];
        results.push(p1);

        // Subsequent paths: block one node from each previous path and re-BFS
        for (let attempt = 0; attempt < 20 && results.length < maxPaths; attempt++) {
            // Pick a middle node to block from a random previous path
            let src  = results[p.floor(p.random(results.length))];
            let midI = p.floor(src.length * (0.3 + p.random(0.4)));
            let mid  = src[midI];
            let blocked = new Set([`${mid.col},${mid.row}`]);
            let np = bfs(sc, sr, ec, er, blocked);
            if (!np) continue;
            // Check this path is different enough from existing ones
            let isDupe = results.some(r => pathSimilarity(r, np) > 0.7);
            if (!isDupe) results.push(np);
        }

        if (results.length === 0) results.push([{col:sc,row:sr}]);
        return results;
    }

    function bfs(sc, sr, ec, er, blocked) {
        let queue   = [{ c:sc, r:sr, path:[{col:sc,row:sr}] }];
        let visited = new Set([`${sc},${sr}`]);
        while (queue.length > 0) {
            let { c, r, path } = queue.shift();
            if (c===ec && r===er) return path;
            let cell = maze[r][c];
            for (let m of [
                {d:'N',nc:c,  nr:r-1},{d:'S',nc:c,  nr:r+1},
                {d:'E',nc:c+1,nr:r  },{d:'W',nc:c-1,nr:r  },
            ]) {
                let key = `${m.nc},${m.nr}`;
                if (!cell.walls[m.d] && !visited.has(key) && !blocked.has(key)) {
                    visited.add(key);
                    queue.push({ c:m.nc, r:m.nr, path:[...path,{col:m.nc,row:m.nr}] });
                }
            }
        }
        return null;
    }

    function pathSimilarity(a, b) {
        let setA = new Set(a.map(n=>`${n.col},${n.row}`));
        let shared = b.filter(n => setA.has(`${n.col},${n.row}`)).length;
        return shared / Math.max(a.length, b.length);
    }

    // ============================================================
    //  DOOR PLACEMENT
    // ============================================================
    function placeDoors(creature, count) {
        // Try to place doors on different paths of this creature
        let placed = 0;
        let pathsUsed = new Set();

        for (let attempt = 0; attempt < 60 && placed < count; attempt++) {
            let pIdx = p.floor(p.random(creature.paths.length));
            let path = creature.paths[pIdx];
            if (path.length < 9) continue;

            let iMin = 2, iMax = path.length - 3;
            if (iMin >= iMax) continue;
            let i    = p.floor(p.random(iMin, iMax));
            let a    = path[i - 1], b = path[i];
            let dc   = b.col - a.col, dr = b.row - a.row;
            let dir  = dc===1?'E':dc===-1?'W':dr===1?'S':'N';

            // Avoid duplicates
            let key = `${a.col},${a.row},${dir}`;
            if (pathsUsed.has(key)) continue;

            // Prefer placing on different paths so both paths have a door
            pathsUsed.add(key);
            doors.push({
                col: a.col, row: a.row, dir,
                open: false, openAmt: 0,
                ownerId: creature.id,  // which creature this door primarily affects
                pathIdx: pIdx,         // which of creature's paths this is on
            });
            placed++;
        }
    }

    // ============================================================
    //  DOOR HELPERS
    // ============================================================
    function doorMidpoint(door) {
        let dc = door.dir==='E'?1:door.dir==='W'?-1:0;
        let dr = door.dir==='S'?1:door.dir==='N'?-1:0;
        return {
            x: door.col*CELL+CELL/2 + dc*CELL/2,
            y: door.row*CELL+CELL/2 + dr*CELL/2,
        };
    }

    function doorBlocksStep(path, fromIdx) {
        // Does any closed door block moving from path[fromIdx-1] to path[fromIdx]?
        if (fromIdx <= 0 || fromIdx >= path.length) return null;
        let a = path[fromIdx-1], b = path[fromIdx];
        let dc = b.col-a.col, dr = b.row-a.row;
        let dir = dc===1?'E':dc===-1?'W':dr===1?'S':'N';
        let opp = opposite(dir);
        for (let d of doors) {
            if (d.open) continue;
            if (d.col===a.col && d.row===a.row && d.dir===dir)   return d;
            if (d.col===b.col && d.row===b.row && d.dir===opp)   return d;
        }
        return null;
    }

    // ============================================================
    //  MOUSE — open doors
    // ============================================================
    p.mousePressed = function() {
        let mx = p.mouseX, my = p.mouseY;
        for (let door of doors) {
            let mp = doorMidpoint(door);
            let dx = mx-mp.x, dy = my-mp.y;
            if (dx*dx+dy*dy < (CELL*0.85)*(CELL*0.85)) door.open = true;
        }
    };

    // ============================================================
    //  CREATURE FACTORY
    // ============================================================
    let _creatureId = 0;

    function createCreature(x, y, paths, pathSetIdx, goingForward, palette) {
        let blobs = [];
        for (let i = 0; i < NUM_BLOBS; i++) {
            let angle = (i/NUM_BLOBS)*p.TWO_PI;
            blobs.push({ x:x+Math.cos(angle)*BLOB_DIST, y:y+Math.sin(angle)*BLOB_DIST, vx:0, vy:0 });
        }

        let id = _creatureId++;
        let tens = [];
        for (let i = 0; i < NUM_TENTACLES; i++) tens.push(createTentacle(x, y, i));

        return {
            id, x, y, vx:0, vy:0,
            paths,          // array of possible paths
            pathSetIdx,     // which path currently following (index into paths[])
            pathIndex: 0,   // step along current path
            goingForward,   // true = forward through path, false = reverse
            blobs,
            tentacles: tens,
            trail: [],
            eyeOpen: 1,
            blinkTimer: p.random(60,200),
            speed: CELL*0.12,
            squishX:1, squishY:1,
            blocked: false,
            blockedFrames: 0,
            corridorX1:0, corridorY1:0, corridorX2:p.width, corridorY2:p.height,
            palette,
        };
    }

    function createTentacle(x, y, idx) {
        let angle = (idx/NUM_TENTACLES)*p.TWO_PI + p.random(-0.2,0.2);
        let segs  = 7, segments = [];
        for (let s=0; s<segs; s++) {
            let frac = s/segs;
            segments.push({
                x: x+Math.cos(angle)*(BLOB_DIST+frac*CELL*0.28),
                y: y+Math.sin(angle)*(BLOB_DIST+frac*CELL*0.28),
                vx:0, vy:0,
            });
        }
        return {
            baseAngle: angle, segments,
            phase: p.random(p.TWO_PI),
            amplitude: p.random(0.15,0.4),
            freq: p.random(0.012,0.028),
            length: p.random(CELL*0.35,CELL*0.72),
        };
    }

    // ============================================================
    //  CORRIDOR BOUNDS
    // ============================================================
    function getCorridorBounds(cx, cy) {
        let col = p.constrain(p.floor(cx/CELL), 0, COLS-1);
        let row = p.constrain(p.floor(cy/CELL), 0, ROWS-1);
        let cell = maze[row][col];
        let mg = 1;
        let x1=(col)*CELL+mg,   y1=(row)*CELL+mg;
        let x2=(col+1)*CELL-mg, y2=(row+1)*CELL-mg;
        if (!cell.walls.E && col+1<COLS) x2=(col+2)*CELL-mg;
        if (!cell.walls.W && col-1>=0)   x1=(col-1)*CELL+mg;
        if (!cell.walls.S && row+1<ROWS) y2=(row+2)*CELL-mg;
        if (!cell.walls.N && row-1>=0)   y1=(row-1)*CELL+mg;
        return { x1, y1, x2, y2 };
    }

    // ============================================================
    //  DRAW LOOP
    // ============================================================
    p.draw = function() {
        p.background(6, 6, 12);

        for (let door of doors) {
            if (door.open && door.openAmt < 1) door.openAmt = Math.min(1, door.openAmt+DOOR_ANIM_SPEED);
        }

        drawMaze();
        drawDoors();

        for (let c of creatures) {
            moveCreature(c);
            recordTrail(c);
            updateCreature(c);
        }
        for (let c of creatures) drawTrail(c);
        for (let c of creatures) drawCreature(c);
    };

    // ============================================================
    //  MOVEMENT
    // ============================================================
    function moveCreature(c) {
        let path = c.paths[c.pathSetIdx];
        let idx  = c.goingForward ? c.pathIndex : (path.length-1-c.pathIndex);
        idx = p.constrain(idx, 0, path.length-1);

        // Check for blocking door
        let blocker = doorBlocksStep(path, c.goingForward ? c.pathIndex : (path.length-1-c.pathIndex));
        if (blocker && !blocker.open) {
            c.blocked = true;
            c.blockedFrames++;
            c.vx = 0; c.vy = 0;

            // After REROUTE_FRAMES, try a different path
            if (c.blockedFrames >= REROUTE_FRAMES) {
                let newPathIdx = findUnblockedPath(c);
                if (newPathIdx !== null && newPathIdx !== c.pathSetIdx) {
                    c.pathSetIdx   = newPathIdx;
                    c.pathIndex    = 0;
                    // Snap pathIndex to closest point on new path
                    c.pathIndex = closestPathStep(c.paths[newPathIdx], c.x, c.y, c.goingForward);
                }
                c.blockedFrames = 0;
            }
            return;
        }

        c.blocked      = false;
        c.blockedFrames = 0;

        let target = path[idx];
        let tx = target.col*CELL+CELL/2;
        let ty = target.row*CELL+CELL/2;
        let dx = tx-c.x, dy = ty-c.y;
        let dist = Math.sqrt(dx*dx+dy*dy);

        if (dist < c.speed+2) {
            c.pathIndex++;
            if (c.pathIndex >= path.length) {
                // Reached end — flip direction, rebuild maze
                c.goingForward = !c.goingForward;
                rebuildForCreature(c);
            }
        } else {
            let spd = p.min(c.speed+dist*0.04, CELL*0.22);
            c.vx = (dx/dist)*spd;
            c.vy = (dy/dist)*spd;
            c.x += c.vx;
            c.y += c.vy;
            let angle   = Math.atan2(dy,dx);
            let stretch = p.map(dist,0,CELL,1,1.28,true);
            c.squishX = 1+(stretch-1)*Math.abs(Math.cos(angle));
            c.squishY = 1+(stretch-1)*Math.abs(Math.sin(angle));
        }

        let bounds = getCorridorBounds(c.x, c.y);
        c.corridorX1=bounds.x1; c.corridorY1=bounds.y1;
        c.corridorX2=bounds.x2; c.corridorY2=bounds.y2;
    }

    function findUnblockedPath(c) {
        for (let pi = 0; pi < c.paths.length; pi++) {
            if (pi === c.pathSetIdx) continue;
            let path = c.paths[pi];
            // Check this path doesn't have a closed door blocking it at current step
            let hasBlock = false;
            for (let i = 1; i < path.length; i++) {
                if (doorBlocksStep(path, i)) { hasBlock = true; break; }
            }
            if (!hasBlock) return pi;
        }
        return null;
    }

    function closestPathStep(path, x, y, goingForward) {
        let best = 0, bestDist = Infinity;
        for (let i = 0; i < path.length; i++) {
            let idx = goingForward ? i : path.length-1-i;
            let pt  = path[idx];
            let dx  = pt.col*CELL+CELL/2-x;
            let dy  = pt.row*CELL+CELL/2-y;
            let d   = dx*dx+dy*dy;
            if (d < bestDist) { bestDist=d; best=i; }
        }
        return best;
    }

    function rebuildForCreature(c) {
        // Keep shared maze, just find new paths for this creature
        let startRow = c.goingForward
            ? c.paths[0][0].row
            : c.paths[0][c.paths[0].length-1].row;
        let sc = c.goingForward ? 0 : COLS-1;
        let ec = c.goingForward ? COLS-1 : 0;

        // Recalculate start row from current position
        let curRow = p.constrain(p.floor(c.y/CELL), 0, ROWS-1);
        let newPaths = findMultiplePaths(sc, curRow, ec, curRow, 3);
        c.paths     = newPaths;
        c.pathSetIdx = 0;
        c.pathIndex  = 0;

        // Reset trail
        c.trail = [];

        // Clear old doors for this creature and re-place
        doors = doors.filter(d => d.ownerId !== c.id);
        placeDoors(c, 2);
    }

    // ============================================================
    //  TRAIL
    // ============================================================
    const TRAIL_MAX  = 600;
    const TRAIL_LIFE = 420;

    function recordTrail(c) {
        if (p.frameCount % 2 === 0) {
            c.trail.push({ x:c.x, y:c.y, age:0 });
            if (c.trail.length > TRAIL_MAX) c.trail.shift();
        }
        for (let pt of c.trail) pt.age++;
    }

    function drawTrail(c) {
        let trail = c.trail;
        if (trail.length < 2) return;
        let pal = c.palette;
        p.push(); p.noFill();
        for (let i=1; i<trail.length; i++) {
            let pt=trail[i], prev=trail[i-1];
            let progress = i/trail.length;
            let ageFade  = 1-p.constrain(pt.age/TRAIL_LIFE,0,1);
            let alpha    = ageFade*progress*255;
            if (alpha<2) continue;
            let w = progress*ageFade*BLOB_DIST*1.1;
            p.stroke(pal.trail[0],pal.trail[1],pal.trail[2], alpha*0.85);
            p.strokeWeight(w);
            p.line(prev.x,prev.y,pt.x,pt.y);
            p.stroke(pal.trailGlow[0],pal.trailGlow[1],pal.trailGlow[2], alpha*0.32);
            p.strokeWeight(w*0.4);
            p.line(prev.x,prev.y,pt.x,pt.y);
        }
        p.noStroke();
        for (let i=0; i<trail.length; i+=8) {
            let pt=trail[i], progress=i/trail.length;
            let ageFade=1-p.constrain(pt.age/TRAIL_LIFE,0,1);
            let alpha=ageFade*progress*160;
            if (alpha<5) continue;
            let sz=progress*ageFade*BLOB_DIST*0.7;
            p.fill(pal.trail[0],pal.trail[1],pal.trail[2], alpha*0.8);
            p.ellipse(pt.x,pt.y,sz);
            p.fill(pal.trailGlow[0],pal.trailGlow[1],pal.trailGlow[2], alpha*0.2);
            p.ellipse(pt.x,pt.y,sz*0.5);
        }
        p.pop();
    }

    // ============================================================
    //  MAZE DRAWING
    // ============================================================
    function drawMaze() {
        p.push();

        // Draw all paths for all creatures faintly
        for (let c of creatures) {
            for (let pi=0; pi<c.paths.length; pi++) {
                let path = c.paths[pi];
                let isCurrent = (pi === c.pathSetIdx);
                p.noFill();
                p.strokeWeight(isCurrent ? CELL*0.5 : CELL*0.2);
                let pal = c.palette;
                p.stroke(pal.glow[0],pal.glow[1],pal.glow[2], isCurrent ? 32 : 10);
                p.beginShape();
                for (let pt of path) p.vertex(pt.col*CELL+CELL/2, pt.row*CELL+CELL/2);
                p.endShape();
            }
        }

        // Walls
        p.stroke(30,180,80,95);
        p.strokeWeight(1.5);
        for (let r=0; r<ROWS; r++) {
            for (let c=0; c<COLS; c++) {
                let cell=maze[r][c], x=c*CELL, y=r*CELL;
                if (cell.walls.N) p.line(x,y,x+CELL,y);
                if (cell.walls.S) p.line(x,y+CELL,x+CELL,y+CELL);
                if (cell.walls.W) p.line(x,y,x,y+CELL);
                if (cell.walls.E) p.line(x+CELL,y,x+CELL,y+CELL);
            }
        }

        // Corner dots
        p.fill(30,180,80,50); p.noStroke();
        for (let r=0;r<=ROWS;r++) for (let c=0;c<=COLS;c++) p.ellipse(c*CELL,r*CELL,2.5);

        // Goal markers per creature
        for (let c of creatures) {
            let path = c.paths[c.pathSetIdx];
            let goal = c.goingForward ? path[path.length-1] : path[0];
            let gx=goal.col*CELL+CELL/2, gy=goal.row*CELL+CELL/2;
            let pulse=0.5+0.5*p.sin(p.frameCount*0.05);
            let pal=c.palette;
            p.noFill();
            p.stroke(pal.glow[0],pal.glow[1],pal.glow[2], 180*pulse);
            p.strokeWeight(2);
            p.ellipse(gx,gy,CELL*0.7+pulse*8);
        }
        p.pop();
    }

    // ============================================================
    //  DOOR DRAWING
    // ============================================================
    function drawDoors() {
        for (let door of doors) {
            let mp    = doorMidpoint(door);
            let horiz = (door.dir==='E'||door.dir==='W');
            let t     = door.openAmt;

            // Find owning creature for colour
            let owner = creatures.find(c=>c.id===door.ownerId);
            let pal   = owner ? owner.palette : PALETTES[0];

            p.push();
            p.translate(mp.x, mp.y);

            // Halo glow
            if (!door.open) {
                let halo = 0.5+0.5*Math.sin(p.frameCount*0.06);
                p.noStroke();
                p.fill(255,200,0, 25*halo);
                p.ellipse(0,0,CELL*1.2,CELL*1.2);
            }

            p.rotate(horiz ? 0 : p.HALF_PI);
            p.rotate(t*p.HALF_PI);

            let dw=CELL*0.07, dh=CELL*0.9;
            p.noStroke();
            // Door body — yellow
            p.fill(255,200,0, p.lerp(235,50,t));
            p.rect(-dw/2,-dh/2,dw,dh,3);
            // Highlight strip
            p.fill(255,240,80, p.lerp(190,20,t));
            p.rect(-dw/2,-dh/2,dw*0.28,dh,3);
            // Knob
            if (t<0.5) {
                p.fill(255,150,0);
                p.ellipse(dw*0.7,0,dw*1.2);
            }

            p.pop();

            // Path indicator lines — show which paths the door blocks, coloured per creature
            if (!door.open) {
                for (let c of creatures) {
                    for (let pi=0; pi<c.paths.length; pi++) {
                        let path=c.paths[pi];
                        // Does this door sit on this path?
                        let onPath=false;
                        for (let i=1; i<path.length; i++) {
                            if (doorBlocksStep(path,i)===door) { onPath=true; break; }
                        }
                        if (!onPath) continue;
                        let isCurrent=(pi===c.pathSetIdx);
                        let pal2=c.palette;
                        p.push();
                        p.noFill();
                        p.stroke(pal2.glow[0],pal2.glow[1],pal2.glow[2], isCurrent?160:60);
                        p.strokeWeight(isCurrent?2:1);
                        // Small indicator tick
                        p.ellipse(mp.x,mp.y, CELL*0.55+(isCurrent?4:0));
                        p.pop();
                    }
                }

                // Click hint
                let hint=0.5+0.5*Math.sin(p.frameCount*0.09);
                p.push();
                p.textAlign(p.CENTER,p.CENTER);
                p.textSize(CELL*0.2);
                p.noStroke();
                p.fill(255,220,0,150*hint);
                p.text('click',mp.x,mp.y-CELL*0.68);
                p.pop();
            }
        }
    }

    // ============================================================
    //  UPDATE CREATURE PHYSICS
    // ============================================================
    function updateCreature(c) {
        let t = p.frameCount;
        let shakeAmt = c.blocked ? CELL*0.16 : 0;

        let sx = c.blocked ? (Math.random()-0.5)*shakeAmt*2 : 0;
        let sy = c.blocked ? (Math.random()-0.5)*shakeAmt*2 : 0;

        for (let i=0; i<NUM_BLOBS; i++) {
            let b     = c.blobs[i];
            let angle = (i/NUM_BLOBS)*p.TWO_PI;
            let tx    = c.x+sx+Math.cos(angle)*BLOB_DIST*c.squishX;
            let ty    = c.y+sy+Math.sin(angle)*BLOB_DIST*c.squishY;
            let nv    = p.noise(b.x*0.005+t*0.007, b.y*0.005);
            let na    = nv*p.TWO_PI*2;
            tx += Math.cos(na)*BLOB_DIST*0.14;
            ty += Math.sin(na)*BLOB_DIST*0.14;
            b.vx += (tx-b.x)*SPRING_K; b.vy += (ty-b.y)*SPRING_K;
            b.vx *= DAMPING; b.vy *= DAMPING;
            b.x  += b.vx;   b.y  += b.vy;
        }

        let clampMg = CELL*0.07;
        let cx1=c.corridorX1+clampMg, cy1=c.corridorY1+clampMg;
        let cx2=c.corridorX2-clampMg, cy2=c.corridorY2-clampMg;

        for (let ten of c.tentacles) {
            ten.phase += ten.freq;
            let travelAngle = Math.atan2(c.vy, c.vx+0.0001);
            let rawAngle    = ten.baseAngle+Math.sin(ten.phase)*ten.amplitude;
            let backAngle   = travelAngle+Math.PI;
            let bAngle      = rawAngle+0.32*Math.sin(backAngle-rawAngle);

            let bIdx = p.floor((ten.baseAngle/p.TWO_PI+1)*NUM_BLOBS)%NUM_BLOBS;
            let root = c.blobs[bIdx];
            ten.segments[0].x=root.x; ten.segments[0].y=root.y;

            let segLen=ten.length/ten.segments.length;
            for (let s=1; s<ten.segments.length; s++) {
                let seg=ten.segments[s], prev=ten.segments[s-1];
                let wa=bAngle+Math.sin(ten.phase+s*0.45)*0.38;
                let tx=prev.x+Math.cos(wa)*segLen;
                let ty=prev.y+Math.sin(wa)*segLen;
                seg.vx+=(tx-seg.x)*0.18; seg.vy+=(ty-seg.y)*0.18;
                seg.vx*=0.62; seg.vy*=0.62;
                seg.x+=seg.vx; seg.y+=seg.vy;
                // Wall clamp
                if (seg.x<cx1){seg.x=cx1;seg.vx=Math.abs(seg.vx)*0.25;}
                if (seg.x>cx2){seg.x=cx2;seg.vx=-Math.abs(seg.vx)*0.25;}
                if (seg.y<cy1){seg.y=cy1;seg.vy=Math.abs(seg.vy)*0.25;}
                if (seg.y>cy2){seg.y=cy2;seg.vy=-Math.abs(seg.vy)*0.25;}
            }
        }

        c.blinkTimer--;
        if (c.blinkTimer<=0) {
            c.eyeOpen=0;
            if (c.blinkTimer<-8) { c.eyeOpen=1; c.blinkTimer=p.random(80,300); }
        }
        c.squishX=p.lerp(c.squishX,1,0.09);
        c.squishY=p.lerp(c.squishY,1,0.09);
    }

    // ============================================================
    //  DRAW CREATURE
    // ============================================================
    function drawCreature(c) {
        let pal = c.palette;
        p.push();
        for (let ten of c.tentacles) drawTentacle(ten, pal, c.blocked);

        let gr = c.blocked ? 200 : pal.glow[0];
        let gg = c.blocked ? 60  : pal.glow[1];
        let gb = c.blocked ? 10  : pal.glow[2];

        for (let g=4; g>=1; g--) {
            p.noStroke();
            p.fill(gr,gg,gb, p.map(g,1,4,55,6));
            drawBlobShape(c, g*BLOB_DIST*0.12);
        }

        // Shadow
        p.noStroke(); p.fill(0,0,0,60);
        p.push(); p.translate(BLOB_DIST*0.18,BLOB_DIST*0.22);
        drawBlobShape(c,0); p.pop();

        // Body
        p.fill(pal.body[0],pal.body[1],pal.body[2]);
        drawBlobShape(c,0);

        // Specular
        p.fill(60,255,140,24);
        p.push(); p.translate(-BLOB_DIST*0.28,-BLOB_DIST*0.3);
        drawBlobShape(c,-BLOB_DIST*0.25); p.pop();

        // Shimmer
        let shimR=c.blocked?255:pal.shimmer[0];
        let shimG=c.blocked?60:pal.shimmer[1];
        p.fill(shimR,shimG,pal.shimmer[2], 13+9*p.sin(p.frameCount*0.04));
        drawBlobShape(c,-BLOB_DIST*0.32);

        drawEyes(c);
        p.pop();
    }

    function drawBlobShape(c, ro) {
        let pts=c.blobs;
        p.beginShape();
        for (let i=0;i<pts.length;i++) {
            let curr=pts[i], angle=(i/pts.length)*p.TWO_PI;
            p.curveVertex(curr.x+Math.cos(angle)*ro, curr.y+Math.sin(angle)*ro);
        }
        for (let i=0;i<3;i++) {
            let curr=pts[i], angle=(i/pts.length)*p.TWO_PI;
            p.curveVertex(curr.x+Math.cos(angle)*ro, curr.y+Math.sin(angle)*ro);
        }
        p.endShape(p.CLOSE);
    }

    function drawTentacle(ten, pal, blocked) {
        let segs=ten.segments;
        if (segs.length<2) return;
        p.push(); p.noFill();
        let gr=blocked?200:pal.glow[0], gg=blocked?60:pal.glow[1], gb=blocked?10:pal.glow[2];
        p.stroke(gr,gg,gb,18); p.strokeWeight(BLOB_DIST*0.5);
        p.beginShape();
        for (let s of segs) p.curveVertex(s.x,s.y);
        p.endShape();
        for (let s=0;s<segs.length-1;s++) {
            let t=s/(segs.length-1);
            p.stroke(12,14,22,p.lerp(220,0,t));
            p.strokeWeight(p.lerp(BLOB_DIST*0.6,0.8,t));
            p.line(segs[s].x,segs[s].y,segs[s+1].x,segs[s+1].y);
        }
        p.stroke(pal.shimmer[0],pal.shimmer[1],pal.shimmer[2],12);
        p.strokeWeight(1.2);
        p.beginShape();
        for (let s of segs) p.curveVertex(s.x,s.y);
        p.endShape();
        p.pop();
    }

    function drawEyes(c) {
        let r=BLOB_DIST*0.32;
        let offsets=[
            {x:-BLOB_DIST*0.36,y:-BLOB_DIST*0.26},
            {x: BLOB_DIST*0.36,y:-BLOB_DIST*0.30},
        ];
        let tAngle=Math.atan2(c.vy,c.vx+0.001);
        let lookX=Math.cos(tAngle)*1.5, lookY=Math.sin(tAngle)*1.5;
        let er=c.blocked?255:220, eg=c.blocked?80:240, eb=c.blocked?80:220;
        for (let eo of offsets) {
            let ex=c.x+eo.x+lookX, ey=c.y+eo.y+lookY;
            p.noStroke();
            p.fill(er,eg,eb);
            p.ellipse(ex,ey,r*2,r*2*c.eyeOpen);
            if (c.eyeOpen>0.2) {
                p.fill(5,5,10);
                p.ellipse(ex+lookX*0.5,ey+lookY*0.5,r*1.1,r*1.1*c.eyeOpen);
                p.fill(255,255,255,200);
                p.ellipse(ex-r*0.3+lookX*0.3,ey-r*0.3,r*0.4,r*0.4);
            }
        }
    }

    // ============================================================
    //  RESIZE
    // ============================================================
    p.windowResized = function() {
        let sz=canvasSize();
        p.resizeCanvas(sz.w,sz.h);
        deriveSizes();
        init();
    };

}, document.body);
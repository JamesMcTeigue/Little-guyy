// ============================================================
//  YOUR CREATURE  —  sketch.js
//  MDDN242 Project 2  |  Two Liquid Familiars / Split Maze
// ============================================================

new p5(function(p) {

    // ============================================================
    //  CONFIG
    // ============================================================
    let CELL = 40;
    let BLOB_DIST;
    const NUM_BLOBS  = 28;   // more points = smoother liquid silhouette
    const SPRING_K   = 0.18;
    const DAMPING    = 0.68;
    function deriveSizes() { BLOB_DIST = CELL * 0.30; }

    // Object count caps — performance
    const MAX_GHOSTS   = 6;   // total across both mazes
    const MAX_GEMS     = 10;  // total across both mazes
    const MAX_SPIKES   = 8;   // total across both mazes
    const MAX_DOORS    = 12;  // total across both mazes
    const MAX_TRAIL    = 120; // points per trail (was 300)

    const DOOR_ANIM_SPEED     = 0.045;
    const REROUTE_FRAMES      = 180;
    const PATH_SWITCH_INTERVAL = 1800; // 30 seconds at 60fps — auto switch path  // wait longer before rerouting
    const TRAIL_MAX       = MAX_TRAIL;
    const TRAIL_LIFE      = 80;   // fades in ~1.3 seconds

    let resetTimer    = -1;
    const RESET_DELAY  = 180;
    const DEATH_LIMIT  = 5;    // deaths before maze changes
    // Persistent across maze resets (survive init())
    let deathCounts  = [0, 0]; // deaths per creature index
    let gemCounts    = [0, 0]; // gems collected per creature index
    let mazeGeneration = 0;    // how many times maze has regenerated
    const KILL_GHOST_COST  = 5;   // gems to kill nearest ghost
    const MUTATE_MAZE_COST = 10;  // gems to mutate a section of maze

    const PALETTES = [
        { body:[6,10,16],   glow:[10,220,90],  shimmer:[60,140,255], trail:[8,28,14],  trailGlow:[15,200,80]  },
        { body:[16,4,20],   glow:[210,40,220], shimmer:[255,70,200], trail:[28,8,24],  trailGlow:[200,40,200] },
    ];

    // ============================================================
    //  TWO INDEPENDENT MAZES (left half / right half)
    // ============================================================
    // Each maze is a self-contained object: {cols, rows, cells, offsetX}
    let mazeL = null;  // left  — creature 0
    let mazeR = null;  // right — creature 1

    let doors       = [];
    let teleporters = [];
    let creatures   = [];
    let ghosts      = [];
    let gems        = [];   // collectables — creature picks these up for points
    let spikes      = [];   // traps — send creature back on touch, click to deactivate
    let _creatureId = 0;

    // ============================================================
    //  SETUP
    // ============================================================
    function isMobile() { return window.innerWidth <= 768; }
    function canvasSize() {
        if (isMobile()) return { w:window.innerWidth, h:window.innerHeight };
        return { w:p.windowWidth-40, h:p.windowHeight-40 };
    }

    p.setup = function() {
        let sz = canvasSize();
        p.createCanvas(sz.w, sz.h).parent('canvas-container');
        deriveSizes();
        init();
    };

    // ============================================================
    //  INIT
    // ============================================================
    function init() {
        creatures   = [];
        doors       = [];
        teleporters = [];
        resetTimer  = -1;

        let halfW = p.floor(p.width / 2);
        let gap   = 2; // px gap between the two mazes

        // Build left maze — occupies pixels 0..halfW-gap
        mazeL = buildMaze(halfW - gap, p.height, 0);
        // Build right maze — occupies pixels halfW+gap..width
        mazeR = buildMaze(p.width - halfW - gap, p.height, halfW + gap);

        // Creature 0: left maze, left→right
        let r0     = p.floor(mazeL.rows * 0.5);
        let paths0 = findMultiplePaths(mazeL, 0, r0, mazeL.cols-1, r0, 8);
        let c0 = createCreature(mazeL,
            paths0[0][0].col * CELL + CELL/2 + mazeL.offsetX,
            paths0[0][0].row * CELL + CELL/2,
            paths0, PALETTES[0]
        );
        creatures.push(c0);

        // Creature 1: right maze, right→left
        let r1     = p.floor(mazeR.rows * 0.5);
        let paths1 = findMultiplePaths(mazeR, mazeR.cols-1, r1, 0, r1, 8);
        let c1 = createCreature(mazeR,
            paths1[0][0].col * CELL + CELL/2 + mazeR.offsetX,
            paths1[0][0].row * CELL + CELL/2,
            paths1, PALETTES[1]
        );
        creatures.push(c1);

        placeDoors(c0, 8);
        placeDoors(c1, 8);
        placeTeleporters(c0, 5);
        placeTeleporters(c1, 5);

        // 4 ghosts per maze, spread across quadrants
        ghosts = [];
        gems   = [];
        spikes = [];
        spawnGhosts(mazeL, 4);
        spawnGhosts(mazeR, 4);
        placeGems(mazeL, c0, 8);
        placeGems(mazeR, c1, 8);
        placeSpikes(mazeL, c0, 5);
        placeSpikes(mazeR, c1, 5);
    }

    // ============================================================
    //  MAZE GENERATION
    // ============================================================
    function buildMaze(pixelW, pixelH, offsetX) {
        let cols = p.max(p.floor(pixelW / CELL), 5);
        let rows = p.max(p.floor(pixelH / CELL), 5);
        let cells = [];
        for (let r = 0; r < rows; r++) {
            cells[r] = [];
            for (let c = 0; c < cols; c++)
                cells[r][c] = { col:c, row:r, visited:false, walls:{N:true,S:true,E:true,W:true} };
        }
        // Iterative DFS carve
        let stack = [{c:0, r:0}];
        cells[0][0].visited = true;
        while (stack.length > 0) {
            let {c, r} = stack[stack.length-1];
            let dirs = p.shuffle(['N','S','E','W']);
            let moved = false;
            for (let d of dirs) {
                let nc=c, nr=r;
                if (d==='N') nr--; if (d==='S') nr++;
                if (d==='E') nc++; if (d==='W') nc--;
                if (nr>=0 && nr<rows && nc>=0 && nc<cols && !cells[nr][nc].visited) {
                    cells[r][c].walls[d]              = false;
                    cells[nr][nc].walls[opposite(d)]  = false;
                    cells[nr][nc].visited = true;
                    stack.push({c:nc, r:nr});
                    moved = true; break;
                }
            }
            if (!moved) stack.pop();
        }
        return { cols, rows, cells, offsetX };
    }

    function opposite(d) { return {N:'S',S:'N',E:'W',W:'E'}[d]; }

    // ============================================================
    //  PATHFINDING (per-maze)
    // ============================================================
    function findMultiplePaths(mz, sc, sr, ec, er, maxPaths) {
        let results = [];
        let first = bfs(mz, sc, sr, ec, er, new Set());
        if (!first) return [[{col:sc,row:sr},{col:ec,row:er}]];
        results.push(first);
        for (let attempt = 0; attempt < 40 && results.length < maxPaths; attempt++) {
            let blocked = new Set();
            for (let ex of results) {
                let s = p.floor(ex.length*0.2), e = p.floor(ex.length*0.8);
                for (let i = s; i <= e; i++) blocked.add(`${ex[i].col},${ex[i].row}`);
            }
            let np = bfs(mz, sc, sr, ec, er, blocked);
            if (!np) continue;
            if (!results.some(r => pathSimilarity(r, np) > 0.5)) results.push(np);
        }
        return results;
    }

    function bfs(mz, sc, sr, ec, er, blocked) {
        let queue   = [{c:sc, r:sr, path:[{col:sc,row:sr}]}];
        let visited = new Set([`${sc},${sr}`]);
        while (queue.length > 0) {
            let {c, r, path} = queue.shift();
            if (c===ec && r===er) return path;
            let cell = mz.cells[r][c];
            for (let m of [
                {d:'N',nc:c,  nr:r-1},{d:'S',nc:c,  nr:r+1},
                {d:'E',nc:c+1,nr:r  },{d:'W',nc:c-1,nr:r  },
            ]) {
                let key = `${m.nc},${m.nr}`;
                if (m.nr<0||m.nr>=mz.rows||m.nc<0||m.nc>=mz.cols) continue;
                if (!cell.walls[m.d] && !visited.has(key) && !blocked.has(key)) {
                    visited.add(key);
                    queue.push({c:m.nc, r:m.nr, path:[...path,{col:m.nc,row:m.nr}]});
                }
            }
        }
        return null;
    }

    function pathSimilarity(a, b) {
        let sa = new Set(a.map(n=>`${n.col},${n.row}`));
        return b.filter(n=>sa.has(`${n.col},${n.row}`)).length / Math.max(a.length,b.length);
    }

    // ============================================================
    //  DOORS
    // ============================================================
    function placeDoors(creature, count) {
        count = Math.min(count, Math.max(0, MAX_DOORS - doors.length));
        let placed=0, used=new Set();
        for (let attempt=0; attempt<80 && placed<count; attempt++) {
            let pIdx = p.floor(p.random(creature.paths.length));
            let path = creature.paths[pIdx];
            if (path.length < 7) continue;
            let iMin=2, iMax=path.length-3;
            if (iMin>=iMax) continue;
            let i = p.floor(p.random(iMin,iMax));
            let a=path[i-1], b=path[i];
            let dc=b.col-a.col, dr=b.row-a.row;
            if (Math.abs(dc)+Math.abs(dr)!==1) continue;
            let dir=dc===1?'E':dc===-1?'W':dr===1?'S':'N';
            let key=`${a.col},${a.row},${dir}`;
            if (used.has(key)) continue;
            used.add(key);
            doors.push({col:a.col, row:a.row, dir, open:false, openAmt:0,
                        ownerId:creature.id, mz:creature.mz, pathIdx:pIdx});
            placed++;
        }
    }

    function doorMidpoint(door) {
        let dc=door.dir==='E'?1:door.dir==='W'?-1:0;
        let dr=door.dir==='S'?1:door.dir==='N'?-1:0;
        return {
            x: door.col*CELL+CELL/2 + dc*CELL/2 + door.mz.offsetX,
            y: door.row*CELL+CELL/2 + dr*CELL/2
        };
    }

    // Only check doors that belong to THIS creature — prevents cross-creature blocking
    function doorBlocksStep(path, fromIdx, creatureId) {
        if (fromIdx<=0||fromIdx>=path.length) return null;
        let a=path[fromIdx-1], b=path[fromIdx];
        let dc=b.col-a.col, dr=b.row-a.row;
        if (Math.abs(dc)+Math.abs(dr)!==1) return null;
        let dir=dc===1?'E':dc===-1?'W':dr===1?'S':'N';
        let opp=opposite(dir);
        for (let d of doors) {
            if (d.open) continue;
            if (d.ownerId !== creatureId) continue;  // ← KEY FIX
            if (d.col===a.col&&d.row===a.row&&d.dir===dir) return d;
            if (d.col===b.col&&d.row===b.row&&d.dir===opp) return d;
        }
        return null;
    }

    p.mousePressed = function() {
        let mx=p.mouseX, my=p.mouseY;
        // Left click — open doors OR activate inactive teleporter
        if (p.mouseButton === p.LEFT) {
            for (let door of doors) {
                let mp=doorMidpoint(door);
                let dx=mx-mp.x, dy=my-mp.y;
                if (dx*dx+dy*dy < (CELL*1.2)*(CELL*1.2)) door.open=true;
            }
            tryActivateTeleporter(mx, my);
            // HUD buttons — kill ghost (5 gems) and mutate maze (10 gems)
            for (let i = 0; i < creatures.length; i++) {
                let c      = creatures[i];
                let isLeft = (i === 0);
                let panelX = isLeft ? 10 : p.floor(p.width/2) + 10;
                let panelW = p.floor(p.width/2) - 20;
                let panelY = 10;
                // Kill ghost button — right side of panel
                let btn1X = panelX + panelW - 90, btn1Y = panelY + 4, btn1W = 80, btn1H = 16;
                if (mx > btn1X && mx < btn1X+btn1W && my > btn1Y && my < btn1Y+btn1H)
                    killNearestGhost(c);
                // Mutate maze button
                let btn2X = panelX + panelW - 90, btn2Y = panelY + 23, btn2W = 80, btn2H = 16;
                if (mx > btn2X && mx < btn2X+btn2W && my > btn2Y && my < btn2Y+btn2H)
                    mutateMaze(c);
            }
            // Click to disarm spikes
            for (let sp of spikes) {
                if (!sp.armed) continue;
                let dx=mx-sp.x, dy=my-sp.y;
                if (dx*dx+dy*dy < (CELL*0.7)*(CELL*0.7)) { sp.armed=false; sp.resetTimer=0; }
            }
        }
        // Right click — send creature back to start
        if (p.mouseButton === p.RIGHT) {
            for (let c of creatures) {
                let dx=mx-c.x, dy=my-c.y;
                if (dx*dx+dy*dy < (BLOB_DIST*2.5)*(BLOB_DIST*2.5)) {
                    sendToStart(c);
                }
            }
        }
    };

    // Prevent context menu on right-click
    document.addEventListener("contextmenu", e => e.preventDefault());

    // ── Kill nearest ghost (costs 5 gems) ──
    function killNearestGhost(creature) {
        if (creature.gemsCollected < KILL_GHOST_COST) return;
        // Find closest ghost in same maze
        let best = null, bestD = Infinity;
        for (let g of ghosts) {
            if (g.mz !== creature.mz) continue;
            let dx = g.x - creature.x, dy = g.y - creature.y;
            let d  = dx*dx + dy*dy;
            if (d < bestD) { bestD = d; best = g; }
        }
        if (!best) return;
        creature.gemsCollected -= KILL_GHOST_COST;
        let cIdx = creatures.indexOf(creature);
        if (cIdx >= 0) gemCounts[cIdx] = creature.gemsCollected;
        // Remove ghost and spawn explosion particles
        let gi = ghosts.indexOf(best);
        if (gi >= 0) ghosts.splice(gi, 1);
        creature.killFlash = 25;
    }

    // ── Mutate a section of the maze (costs 10 gems) ──
    // Picks a random 3×3 region and re-carves it, opening new passages
    function mutateMaze(creature) {
        if (creature.gemsCollected < MUTATE_MAZE_COST) return;
        creature.gemsCollected -= MUTATE_MAZE_COST;
        let cIdx = creatures.indexOf(creature);
        if (cIdx >= 0) gemCounts[cIdx] = creature.gemsCollected;

        let mz  = creature.mz;
        // Pick a random 3×3 anchor (away from edges)
        let ac  = p.floor(p.random(1, mz.cols - 3));
        let ar  = p.floor(p.random(1, mz.rows - 3));
        let w   = 3, h = 3;

        // Reset visited state for the region
        for (let r = ar; r < ar+h; r++)
            for (let c = ac; c < ac+w; c++)
                mz.cells[r][c].visited = false;

        // Re-carve using DFS within the region
        let stack = [{c:ac, r:ar}];
        mz.cells[ar][ac].visited = true;
        while (stack.length > 0) {
            let {c, r} = stack[stack.length-1];
            let dirs = p.shuffle(['N','S','E','W']);
            let moved = false;
            for (let d of dirs) {
                let nc=c, nr=r;
                if (d==='N') nr--; if (d==='S') nr++;
                if (d==='E') nc++; if (d==='W') nc--;
                // Stay within the mutation region
                if (nr < ar || nr >= ar+h || nc < ac || nc >= ac+w) continue;
                if (mz.cells[nr][nc].visited) continue;
                mz.cells[r][c].walls[d]            = false;
                mz.cells[nr][nc].walls[opposite(d)] = false;
                mz.cells[nr][nc].visited = true;
                stack.push({c:nc, r:nr});
                moved = true; break;
            }
            if (!moved) stack.pop();
        }

        // Flash to show which region changed
        creature.mutateFlash  = 30;
        creature.mutateRegion = {x: ac*CELL+mz.offsetX, y: ar*CELL, w: w*CELL, h: h*CELL};
    }

    function sendToStart(c) {
        let path = c.paths[c.pathSetIdx];
        let start = path[0];
        c.x = start.col*CELL+CELL/2+c.mz.offsetX;
        c.y = start.row*CELL+CELL/2;
        for (let b of c.blobs) { b.x=c.x; b.y=c.y; b.vx=0; b.vy=0; }
        c.pathIndex     = 1;
        c.pathSetIdx    = 0;
        c.finished      = false;
        c.finishTimer   = 0;
        c.blocked       = false;
        c.blockedFrames = 0;
        c.teleporting   = false;
        c.vx=0; c.vy=0;
        c.trail=[];
        resetTimer = -1;

        // Track death and sync to persistent array
        c.deathCount++;
        let cIdx = creatures.indexOf(c);
        if (cIdx >= 0) deathCounts[cIdx] = c.deathCount;

        // Flash the screen for this creature's side
        c.deathFlash = 20; // frames of flash

        // If this creature has died enough times, regenerate its maze
        if (c.deathCount >= DEATH_LIMIT) {
            c.deathCount = 0;
            if (cIdx >= 0) deathCounts[cIdx] = 0;
            scheduleMapChange(cIdx);
        }
    }

    // Regenerate just one side of the maze after a short delay
    let mapChangeTimer = -1;
    let mapChangeSide  = -1;

    function scheduleMapChange(sideIdx) {
        mapChangeTimer = 90; // ~1.5 second warning flash before change
        mapChangeSide  = sideIdx;
    }

    function tickMapChange() {
        if (mapChangeTimer < 0) return;
        mapChangeTimer--;
        if (mapChangeTimer === 0) {
            mazeGeneration++;
            regenerateSide(mapChangeSide);
            mapChangeTimer = -1;
            mapChangeSide  = -1;
        }
    }

    function regenerateSide(sideIdx) {
        let halfW = p.floor(p.width / 2);
        let gap   = 2;

        if (sideIdx === 0) {
            // Regenerate left maze + creature 0
            mazeL = buildMaze(halfW - gap, p.height, 0);
            doors       = doors.filter(d => d.mz !== mazeL);
            teleporters = teleporters.filter(t => t.mz !== mazeL);
            gems        = gems.filter(g => g.mz !== mazeL);
            spikes      = spikes.filter(s => s.mz !== mazeL);
            ghosts      = ghosts.filter(g => g.mz !== mazeL);
            let r0    = p.floor(mazeL.rows * 0.5);
            let p0    = findMultiplePaths(mazeL, 0, r0, mazeL.cols-1, r0, 8);
            let prevGems = creatures[0] ? creatures[0].gemsCollected : 0;
            let prevDeaths = creatures[0] ? creatures[0].deathCount : 0;
            let c0 = createCreature(mazeL,
                p0[0][0].col*CELL+CELL/2+mazeL.offsetX,
                p0[0][0].row*CELL+CELL/2, p0, PALETTES[0]);
            c0.gemsCollected = prevGems;
            c0.deathCount    = prevDeaths;
            creatures[0] = c0;
            placeDoors(c0, 8);
            placeTeleporters(c0, 5);
            spawnGhosts(mazeL, 4);
            placeGems(mazeL, c0, 8);
            placeSpikes(mazeL, c0, 5);
        } else {
            // Regenerate right maze + creature 1
            mazeR = buildMaze(p.width - halfW - gap, p.height, halfW + gap);
            doors       = doors.filter(d => d.mz !== mazeR);
            teleporters = teleporters.filter(t => t.mz !== mazeR);
            gems        = gems.filter(g => g.mz !== mazeR);
            spikes      = spikes.filter(s => s.mz !== mazeR);
            ghosts      = ghosts.filter(g => g.mz !== mazeR);
            let r1    = p.floor(mazeR.rows * 0.5);
            let p1    = findMultiplePaths(mazeR, mazeR.cols-1, r1, 0, r1, 8);
            let prevGems = creatures[1] ? creatures[1].gemsCollected : 0;
            let prevDeaths = creatures[1] ? creatures[1].deathCount : 0;
            let c1 = createCreature(mazeR,
                p1[0][0].col*CELL+CELL/2+mazeR.offsetX,
                p1[0][0].row*CELL+CELL/2, p1, PALETTES[1]);
            c1.gemsCollected = prevGems;
            c1.deathCount    = prevDeaths;
            creatures[1] = c1;
            placeDoors(c1, 8);
            placeTeleporters(c1, 5);
            spawnGhosts(mazeR, 4);
            placeGems(mazeR, c1, 8);
            placeSpikes(mazeR, c1, 5);
        }
    }

    // ============================================================
    //  GHOSTS  (Pac-Man style chasers, wall-aware, bounce off edges)
    // ============================================================
    const GHOST_SPEED       = CELL * 0.09;   // slightly slower than creature
    const GHOST_CATCH_DIST  = CELL * 0.85;   // distance to catch a creature
    const GHOST_CHASE_PROB  = 0.75;          // probability of moving toward creature vs random

    // Spread ghosts across quadrants so they cover the maze evenly
    function spawnGhosts(mz, count) {
        // Global ghost cap
        count = Math.min(count, Math.max(0, MAX_GHOSTS - ghosts.length));
        if (count <= 0) return;
        let qCols = p.floor(mz.cols / 2);
        let qRows = p.floor(mz.rows / 2);
        let quadrants = [
            {c0:1,       r0:1,       c1:qCols,       r1:qRows      },
            {c0:qCols+1, r0:1,       c1:mz.cols-2,   r1:qRows      },
            {c0:1,       r0:qRows+1, c1:qCols,       r1:mz.rows-2  },
            {c0:qCols+1, r0:qRows+1, c1:mz.cols-2,   r1:mz.rows-2  },
        ];
        for (let i = 0; i < count; i++) {
            let q   = quadrants[i % quadrants.length];
            let col = p.floor(p.random(q.c0, q.c1+1));
            let row = p.floor(p.random(q.r0, q.r1+1));
            col = p.constrain(col, 0, mz.cols-1);
            row = p.constrain(row, 0, mz.rows-1);
            // Each ghost has a slightly different speed and chase probability
            ghosts.push({
                mz,
                x: col*CELL + CELL/2 + mz.offsetX,
                y: row*CELL + CELL/2,
                col, row,
                dir: null,
                targetCol: col, targetRow: row,
                moving: false,
                phase: p.random(p.TWO_PI),
                speed:      CELL * p.random(0.07, 0.11),
                chaseProb:  p.random(0.55, 0.88),
                hue:        p.floor(p.random(4)),  // 0=red 1=orange 2=pink 3=blue
            });
        }
    }

    // Pick a valid direction for the ghost to move from (col,row)
    // Prefers moving toward the nearest creature in the same maze
    // Avoids reversing (lastDir = opposite) unless it's the only option
    function pickGhostDir(mz, col, row, lastDir, targetCreature, ghost) {
        let cell = mz.cells[row][col];
        let dirs = ['N','S','E','W'];
        let open = dirs.filter(d => !cell.walls[d]);
        if (open.length === 0) return null;

        // Avoid reversing unless stuck
        let noReverse = open.filter(d => d !== opposite(lastDir));
        let candidates = noReverse.length > 0 ? noReverse : open;

        // If chasing, bias toward the direction that closes distance to creature
        let chaseP = (ghost && ghost.chaseProb) ? ghost.chaseProb : GHOST_CHASE_PROB;
        if (targetCreature && p.random() < chaseP) {
            let cx = targetCreature.x - mz.offsetX;
            let cy = targetCreature.y;
            let gcx = col*CELL + CELL/2;
            let gcy = row*CELL + CELL/2;

            // Score each direction by how much it closes distance
            let scored = candidates.map(d => {
                let nc=col, nr=row;
                if (d==='N') nr--; if (d==='S') nr++;
                if (d==='E') nc++; if (d==='W') nc--;
                let nx=nc*CELL+CELL/2, ny=nr*CELL+CELL/2;
                let distBefore = Math.sqrt((gcx-cx)**2+(gcy-cy)**2);
                let distAfter  = Math.sqrt((nx -cx)**2+(ny -cy)**2);
                return { d, score: distBefore - distAfter };
            });
            scored.sort((a,b) => b.score - a.score);
            // Mostly pick best, occasionally random (so it doesn't perfectly corner)
            let topP = (ghost && ghost.chaseProb) ? ghost.chaseProb : 0.82;
            return p.random() < topP ? scored[0].d : candidates[p.floor(p.random(candidates.length))];
        }

        return candidates[p.floor(p.random(candidates.length))];
    }

    function updateGhosts() {
        for (let g of ghosts) {
            g.phase += 0.06;

            // Find the creature in this maze
            let target = creatures.find(c => c.mz === g.mz && !c.finished);

            if (!g.moving) {
                // Pick next cell to walk into
                let d = pickGhostDir(g.mz, g.col, g.row, g.dir, target, g);
                if (!d) continue;
                g.dir = d;
                g.moving = true;
                let nc=g.col, nr=g.row;
                if (d==='N') nr--; if (d==='S') nr++;
                if (d==='E') nc++; if (d==='W') nc--;
                // Clamp to maze bounds
                nc = p.constrain(nc, 0, g.mz.cols-1);
                nr = p.constrain(nr, 0, g.mz.rows-1);
                g.targetCol = nc; g.targetRow = nr;
            }

            // Move toward target cell
            let tx = g.targetCol*CELL+CELL/2+g.mz.offsetX;
            let ty = g.targetRow*CELL+CELL/2;
            let dx = tx - g.x, dy = ty - g.y;
            let dist = Math.sqrt(dx*dx+dy*dy);

            if (dist < (g.speed||GHOST_SPEED) + 1) {
                g.x = tx; g.y = ty;
                g.col = g.targetCol; g.row = g.targetRow;
                g.moving = false;
            } else {
                g.x += (dx/dist)*(g.speed||GHOST_SPEED);
                g.y += (dy/dist)*(g.speed||GHOST_SPEED);
            }

            // Check catch — send creature back to start
            if (target && !target.teleporting) {
                let cdx = g.x - target.x, cdy = g.y - target.y;
                if (cdx*cdx+cdy*cdy < GHOST_CATCH_DIST*GHOST_CATCH_DIST) {
                    sendToStart(target);
                    // Ghost bounces back to a random spot after catching
                    g.col = p.floor(p.random(1, g.mz.cols-1));
                    g.row = p.floor(p.random(1, g.mz.rows-1));
                    g.x   = g.col*CELL+CELL/2+g.mz.offsetX;
                    g.y   = g.row*CELL+CELL/2;
                    g.moving = false;
                }
            }
        }
    }

    function drawGhosts() {
        for (let g of ghosts) {
            let x=g.x, y=g.y;
            let pulse = 0.5+0.5*Math.sin(g.phase);
            let sz = CELL*0.52 + pulse*CELL*0.06;

            // Define gc FIRST before any use
            let ghostColors = [[220,30,30],[240,120,20],[220,60,160],[30,180,220]];
            let gc = ghostColors[g.hue||0];

            p.push();
            p.translate(x, y);

            // Eerie glow
            for (let ring=3; ring>=1; ring--) {
                p.noStroke();
                p.fill(gc[0], gc[1]*0.5+ring*10, gc[2]*0.3, p.map(ring,1,3,30,6));
                p.ellipse(0, 0, sz*2 + ring*8);
            }

            // Ghost body — classic pac-man shape: dome top, wavy skirt
            p.noStroke();
            p.fill(gc[0], gc[1], gc[2], 200);
            p.beginShape();
            let steps = 24;
            // Dome top (semicircle)
            for (let i=0; i<=steps; i++) {
                let a = p.PI + (i/steps)*p.PI;  // 180° to 360°
                p.curveVertex(Math.cos(a)*sz*0.5, Math.sin(a)*sz*0.5);
            }
            // Wavy skirt bottom — 3 bumps
            let bumps = 3;
            for (let i=0; i<=bumps*2; i++) {
                let f  = i/(bumps*2);
                let bx = p.lerp(-sz*0.5, sz*0.5, f);
                let by = (i%2===0) ? sz*0.45 : sz*0.22 + Math.sin(g.phase*2)*sz*0.06;
                p.curveVertex(bx, by);
            }
            p.endShape(p.CLOSE);

            // Inner highlight
            p.fill(Math.min(255,gc[0]+40), Math.min(255,gc[1]+50), Math.min(255,gc[2]+50), 80);
            p.ellipse(-sz*0.1, -sz*0.15, sz*0.55, sz*0.4);

            // Eyes — white with dark pupils
            let eyeOffsets = [{x:-sz*0.18, y:-sz*0.05},{x:sz*0.18, y:-sz*0.05}];
            // Pupils track toward creature direction
            let target = creatures.find(c => c.mz === g.mz);
            let lookX=0, lookY=0;
            if (target) {
                let ang = Math.atan2(target.y-y, target.x-x);
                lookX = Math.cos(ang)*3; lookY = Math.sin(ang)*3;
            }
            for (let eo of eyeOffsets) {
                p.fill(255,255,255); p.ellipse(eo.x, eo.y, sz*0.22, sz*0.26);
                p.fill(20,20,120);  p.ellipse(eo.x+lookX*0.5, eo.y+lookY*0.5, sz*0.12, sz*0.14);
            }

            p.pop();
        }
    }

    // ============================================================
    //  GEMS  (collectables — creature auto-picks up when nearby)
    // ============================================================
    function placeGems(mz, creature, count) {
        count = Math.min(count, Math.max(0, MAX_GEMS - gems.length));
        if (count <= 0) return;
        let placed = 0, used = new Set();
        // Collect interior nodes only (skip first 2 and last 2 of each path)
        let allNodes = [];
        for (let path of creature.paths) {
            for (let i = 3; i < path.length - 3; i++) allNodes.push(path[i]);
        }
        // Shuffle so gems spread across different paths
        allNodes = p.shuffle(allNodes);
        // Space them out — pick every Nth node to avoid clustering
        let step = Math.max(1, Math.floor(allNodes.length / count));
        for (let i = 0; i < allNodes.length && placed < count; i += step) {
            let n = allNodes[i];
            let key = `${n.col},${n.row}`;
            if (used.has(key)) continue;
            used.add(key);
            gems.push({
                mz, ownerId: creature.id,
                col: n.col, row: n.row,
                x: n.col*CELL+CELL/2+mz.offsetX,
                y: n.row*CELL+CELL/2,
                collected: false,
                phase: p.random(p.TWO_PI),
                type: p.floor(p.random(3)),
            });
            placed++;
        }
    }

    function updateGems() {
        for (let gem of gems) {
            if (gem.collected) continue;
            gem.phase += 0.05;
            // Check if creature picks it up
            let c = creatures.find(cr => cr.id === gem.ownerId);
            if (!c || c.finished) continue;
            let dx = c.x - gem.x, dy = c.y - gem.y;
            if (dx*dx+dy*dy < (CELL*0.55)*(CELL*0.55)) {
                gem.collected = true;
                c.gemsCollected++;
                let cIdx = creatures.indexOf(c);
                if (cIdx >= 0) gemCounts[cIdx] = c.gemsCollected;
                c.speed = Math.min(c.speed * 1.04, CELL * 0.22);
                c.gemFlash = 15; // frames of sparkle flash
            }
        }
    }

    function drawGems() {
        for (let gem of gems) {
            if (gem.collected) continue;
            let pulse = 0.5+0.5*Math.sin(gem.phase);
            let sz    = CELL*0.22 + pulse*CELL*0.06;
            p.push();
            p.translate(gem.x, gem.y);

            // Glow
            p.noStroke();
            if      (gem.type===0) p.fill(80,220,255,  30*pulse);
            else if (gem.type===1) p.fill(255,200,80,  30*pulse);
            else                   p.fill(180,80,255,  30*pulse);
            p.ellipse(0,0,sz*3,sz*3);

            // Gem body
            if (gem.type===0) {
                // Diamond
                p.fill(80,220,255, 200);
                p.beginShape();
                p.vertex(0,-sz); p.vertex(sz*0.6,0); p.vertex(0,sz*0.7); p.vertex(-sz*0.6,0);
                p.endShape(p.CLOSE);
                p.fill(200,240,255,120);
                p.beginShape(); p.vertex(0,-sz); p.vertex(sz*0.6,0); p.vertex(0,-sz*0.1); p.endShape(p.CLOSE);
            } else if (gem.type===1) {
                // Circle gem
                p.fill(255,200,80, 200);
                p.ellipse(0,0,sz*2,sz*2);
                p.fill(255,240,160,120);
                p.ellipse(-sz*0.25,-sz*0.25,sz*0.8,sz*0.6);
            } else {
                // Star
                p.fill(180,80,255, 200);
                p.beginShape();
                for (let i=0;i<5;i++) {
                    let a1=(i/5)*p.TWO_PI-p.HALF_PI;
                    let a2=((i+0.5)/5)*p.TWO_PI-p.HALF_PI;
                    p.vertex(Math.cos(a1)*sz,Math.sin(a1)*sz);
                    p.vertex(Math.cos(a2)*sz*0.45,Math.sin(a2)*sz*0.45);
                }
                p.endShape(p.CLOSE);
            }
            p.pop();
        }
    }

    // ============================================================
    //  SPIKES  (traps — click to deactivate, auto-reset after a while)
    // ============================================================
    const SPIKE_RESET_FRAMES = 360;  // frames until spike rearms

    function placeSpikes(mz, creature, count) {
        count = Math.min(count, Math.max(0, MAX_SPIKES - spikes.length));
        if (count <= 0) return;
        let gemKeys = new Set(gems.filter(g=>g.mz===mz).map(g=>`${g.col},${g.row}`));
        // Start/end cells of ALL paths — never put a spike here
        let safeKeys = new Set();
        for (let path of creature.paths) {
            // Protect the first 35% of every path — where creature spawns and early walk
            let safeLen = p.floor(path.length * 0.35);
            for (let i = 0; i < safeLen; i++) safeKeys.add(`${path[i].col},${path[i].row}`);
            // Also protect the very last 2 nodes (finish area)
            for (let i = path.length-3; i < path.length; i++)
                safeKeys.add(`${path[i].col},${path[i].row}`);
        }

        // Collect eligible nodes: only from the middle 35%-90% of each path
        let candidates = [];
        for (let path of creature.paths) {
            let lo = p.floor(path.length * 0.35);
            let hi = p.floor(path.length * 0.90);
            for (let i = lo; i < hi; i++) {
                let n = path[i];
                let key = `${n.col},${n.row}`;
                if (!safeKeys.has(key) && !gemKeys.has(key))
                    candidates.push(n);
            }
        }

        // Shuffle and use a stride to spread them evenly
        candidates = p.shuffle(candidates);
        let stride  = Math.max(1, Math.floor(candidates.length / count));
        let used    = new Set();
        let placed  = 0;

        for (let i = 0; i < candidates.length && placed < count; i += stride) {
            let n   = candidates[i];
            let key = `${n.col},${n.row}`;
            if (used.has(key)) continue;
            used.add(key);
            spikes.push({
                mz, ownerId: creature.id,
                col: n.col, row: n.row,
                x: n.col*CELL+CELL/2+mz.offsetX,
                y: n.row*CELL+CELL/2,
                armed: true,
                resetTimer: 0,
                hitCooldown: 0,
                phase: p.random(p.TWO_PI),
            });
            placed++;
        }
    }

    function updateSpikes() {
        for (let sp of spikes) {
            sp.phase += 0.04;
            // Tick post-death invincibility so creature isn't killed again immediately
            if (sp.hitCooldown > 0) { sp.hitCooldown--; continue; }
            if (!sp.armed) {
                sp.resetTimer++;
                if (sp.resetTimer >= SPIKE_RESET_FRAMES) {
                    sp.armed = true;
                    sp.resetTimer = 0;
                }
                continue;
            }
            // Check if creature walks into spike
            let c = creatures.find(cr => cr.id === sp.ownerId);
            if (!c || c.finished || c.teleporting) continue;
            let dx = c.x - sp.x, dy = c.y - sp.y;
            if (dx*dx+dy*dy < (CELL*0.30)*(CELL*0.30)) {
                sendToStart(c);
                sp.hitCooldown = 120; // 2 second grace before this spike can kill again
            }
        }
    }

    function drawSpikes() {
        for (let sp of spikes) {
            p.push();
            p.translate(sp.x, sp.y);
            let pulse = 0.5+0.5*Math.sin(sp.phase);

            if (sp.armed) {
                // Red pulsing X of spikes
                p.noStroke();
                p.fill(200, 30, 30, 30+20*pulse);
                p.ellipse(0,0,CELL*0.8,CELL*0.8);
                // 4 spike triangles
                let sc2 = CELL*0.26;
                p.fill(220, 40, 40, 210);
                for (let i=0;i<4;i++) {
                    p.push(); p.rotate(i*p.HALF_PI);
                    p.beginShape();
                    p.vertex(0, -sc2*1.1);
                    p.vertex(-sc2*0.35, -sc2*0.3);
                    p.vertex( sc2*0.35, -sc2*0.3);
                    p.endShape(p.CLOSE);
                    p.pop();
                }
                // Diagonal spikes
                p.fill(200, 60, 60, 160);
                for (let i=0;i<4;i++) {
                    p.push(); p.rotate(p.PI/4 + i*p.HALF_PI);
                    p.beginShape();
                    p.vertex(0, -sc2*0.8);
                    p.vertex(-sc2*0.25, -sc2*0.15);
                    p.vertex( sc2*0.25, -sc2*0.15);
                    p.endShape(p.CLOSE);
                    p.pop();
                }
                // Click hint
                let hint = 0.4+0.4*Math.sin(p.frameCount*0.08);
                p.noStroke(); p.fill(255,100,100,110*hint);
                p.textAlign(p.CENTER,p.CENTER); p.textSize(CELL*0.13);
                p.text('click',0,CELL*0.44);
            } else {
                // Disarmed — dim grey, shows rearm progress arc
                p.noStroke(); p.fill(80,80,80,60);
                p.ellipse(0,0,CELL*0.6,CELL*0.6);
                p.fill(100,100,100,80);
                for (let i=0;i<4;i++) {
                    p.push(); p.rotate(i*p.HALF_PI);
                    p.triangle(0,-CELL*0.18,-CELL*0.07,-CELL*0.06,CELL*0.07,-CELL*0.06);
                    p.pop();
                }
                // Rearm arc
                let frac = sp.resetTimer/SPIKE_RESET_FRAMES;
                p.noFill(); p.stroke(200,60,60,80);
                p.strokeWeight(2);
                p.arc(0,0,CELL*0.7,CELL*0.7,-p.HALF_PI,-p.HALF_PI+frac*p.TWO_PI);
            }
            p.pop();
        }
    }

    // ============================================================
    //  TELEPORTERS  — Hub model
    //  Each creature has ONE entry hub + 3 secondary exits that
    //  rotate which is active. Stepping on the hub warps to whichever
    //  secondary is currently hot. Click an inactive secondary to
    //  force-activate it. Exits land mid-path on DIFFERENT paths so
    //  they naturally pull the creature onto new routes.
    // ============================================================
    const TP_EXIT_CYCLE = 420;   // frames each exit stays active before rotating

    // teleporters array stores HUB objects:
    //   { entry:{col,row}, exits:[{col,row,pathIdx},...], activeExitIdx, timer,
    //     ownerId, mz, phase }

    function placeTeleporters(creature, numExits) {
        let mz   = creature.mz;
        let paths = creature.paths;

        // Pick entry from partway along path 0 (fixed hub position)
        let mainPath = paths[0];
        if (mainPath.length < 8) return;
        let entryI = p.floor(mainPath.length * 0.25);
        let entry  = mainPath[entryI];

        // One exit per path (different path = different route through maze)
        let exits = [];
        let usedCells = new Set([`${entry.col},${entry.row}`]);

        for (let pi = 0; pi < paths.length && exits.length < numExits; pi++) {
            let path = paths[pi];
            // Pick an exit from the SECOND half of this path so it's further along
            let lo = p.floor(path.length * 0.50);
            let hi = p.floor(path.length * 0.80);
            if (lo >= hi) continue;
            let xi  = p.floor(p.random(lo, hi));
            let node = path[xi];
            let key  = `${node.col},${node.row}`;
            if (usedCells.has(key)) continue;
            usedCells.add(key);
            exits.push({ col:node.col, row:node.row, pathIdx:pi });
        }

        if (exits.length === 0) return;

        // Stagger starting active exit so the two creatures aren't in sync
        let startIdx = p.floor(p.random(exits.length));
        teleporters.push({
            entry,
            exits,
            activeExitIdx: startIdx,
            timer:   TP_EXIT_CYCLE,
            ownerId: creature.id,
            mz,
            phase:   p.random(p.TWO_PI),
        });
    }

    function updateTeleporters() {
        for (let hub of teleporters) {
            hub.phase += 0.04;
            hub.timer--;
            if (hub.timer <= 0) {
                // Rotate to next exit
                hub.activeExitIdx = (hub.activeExitIdx + 1) % hub.exits.length;
                hub.timer = TP_EXIT_CYCLE;
            }
        }
    }

    function checkTeleport(c) {
        if (c.teleporting || c.finished) return;
        let col = p.constrain(p.floor((c.x - c.mz.offsetX) / CELL), 0, c.mz.cols-1);
        let row = p.constrain(p.floor(c.y / CELL), 0, c.mz.rows-1);

        for (let hub of teleporters) {
            if (hub.ownerId !== c.id) continue;
            if (col !== hub.entry.col || row !== hub.entry.row) continue;

            // Warp to whichever exit is currently active
            let exit    = hub.exits[hub.activeExitIdx];
            let destX   = exit.col * CELL + CELL/2 + c.mz.offsetX;
            let destY   = exit.row * CELL + CELL/2;

            c.teleporting      = true;
            c.teleportProgress = 0;
            c.teleportFrom     = { x: hub.entry.col*CELL+CELL/2+c.mz.offsetX,
                                   y: hub.entry.row*CELL+CELL/2 };
            c.teleportTo       = { x: destX, y: destY };

            // Switch creature to the path that this exit belongs to
            let targetPathIdx = exit.pathIdx;
            c.pathSetIdx  = targetPathIdx;
            c.pathIndex   = closestPathStep(c.paths[targetPathIdx], destX, destY, c.mz.offsetX);
            c.trail = [];
            return;
        }
    }

    // Left-click an exit portal to force-rotate to it immediately
    function tryActivateTeleporter(mx, my) {
        for (let hub of teleporters) {
            // Check entry portal
            let ex = hub.entry.col*CELL+CELL/2+hub.mz.offsetX;
            let ey = hub.entry.row*CELL+CELL/2;
            // Check each exit portal
            for (let ei = 0; ei < hub.exits.length; ei++) {
                let exit = hub.exits[ei];
                let px = exit.col*CELL+CELL/2+hub.mz.offsetX;
                let py = exit.row*CELL+CELL/2;
                let hitR = (CELL*0.75)*(CELL*0.75);
                if ((mx-px)**2+(my-py)**2 < hitR) {
                    // Jump active exit to this one
                    hub.activeExitIdx = ei;
                    hub.timer = TP_EXIT_CYCLE;
                    return;
                }
            }
        }
    }

    // ============================================================
    //  CREATURE FACTORY
    // ============================================================
    function createCreature(mz, x, y, paths, palette) {
        let blobs=[];
        for (let i=0;i<NUM_BLOBS;i++) {
            let a=(i/NUM_BLOBS)*p.TWO_PI;
            blobs.push({x:x+Math.cos(a)*BLOB_DIST, y:y+Math.sin(a)*BLOB_DIST, vx:0, vy:0});
        }
        let destPt=paths[0][paths[0].length-1];
        return {
            id:_creatureId++, mz, x, y, vx:0, vy:0,
            paths, pathSetIdx:0, pathIndex:1,
            blobs, trail:[],
            eyeOpen:1, blinkTimer:p.random(60,200),
            speed:CELL*0.13,
            squishX:1, squishY:1,
            blocked:false, blockedFrames:0,
            corridorX1:0, corridorY1:0, corridorX2:p.width, corridorY2:p.height,
            palette,
            finished:false, finishTimer:0,
            finishX:destPt.col*CELL+CELL/2+mz.offsetX,
            finishY:destPt.row*CELL+CELL/2,
            teleporting:false, teleportProgress:0, teleportFrom:null, teleportTo:null,
            pathSwitchTimer: PATH_SWITCH_INTERVAL + p.floor(p.random(300)),
            gemsCollected: 0,
            deathCount: 0,
            deathFlash: 0,
            gemFlash:   0,
            killFlash:  0,
            mutateFlash: 0,
            mutateRegion: null,
            // Liquid drip params — random per-creature for organic variety
            dripAngles:  Array.from({length:5}, ()=>p.random(p.TWO_PI)),
            dripPhases:  Array.from({length:5}, ()=>p.random(p.TWO_PI)),
            dripSpeeds:  Array.from({length:5}, ()=>p.random(0.018,0.04)),
            noiseOffset: p.random(1000),
        };
    }

    // ============================================================
    //  CORRIDOR BOUNDS (per-maze)
    // ============================================================
    function getCorridorBounds(c) {
        let mz  = c.mz;
        let col = p.constrain(p.floor((c.x-mz.offsetX)/CELL), 0, mz.cols-1);
        let row = p.constrain(p.floor(c.y/CELL), 0, mz.rows-1);
        let cell=mz.cells[row][col]; let mg=1;
        let x1=col*CELL+mg+mz.offsetX, y1=row*CELL+mg;
        let x2=(col+1)*CELL-mg+mz.offsetX, y2=(row+1)*CELL-mg;
        if (!cell.walls.E&&col+1<mz.cols) x2=(col+2)*CELL-mg+mz.offsetX;
        if (!cell.walls.W&&col-1>=0)       x1=(col-1)*CELL+mg+mz.offsetX;
        if (!cell.walls.S&&row+1<mz.rows) y2=(row+2)*CELL-mg;
        if (!cell.walls.N&&row-1>=0)       y1=(row-1)*CELL+mg;
        return {x1,y1,x2,y2};
    }

    // ============================================================
    //  DRAW LOOP
    // ============================================================
    p.draw = function() {
        p.background(6,6,12);

        for (let door of doors)
            if (door.open&&door.openAmt<1) door.openAmt=Math.min(1,door.openAmt+DOOR_ANIM_SPEED);
        updateTeleporters();

        // Draw divider line
        p.stroke(30,80,50,60); p.strokeWeight(1);
        p.line(p.width/2, 0, p.width/2, p.height);

        drawMaze(mazeL);
        drawMaze(mazeR);
        updateGems();
        updateSpikes();
        drawTeleporters();
        drawDoors();
        drawSpikes();
        drawGems();

        for (let c of creatures) {
            moveCreature(c);
            recordTrail(c);
            updateCreature(c);
        }
        for (let c of creatures) drawTrail(c);
        for (let c of creatures) drawCreature(c);
        updateGhosts();
        drawGhosts();
        drawFinishOverlay();
        drawHUD();
        drawMapChangeWarning();
        tickReset();
        tickMapChange();
    };

    // ============================================================
    //  MOVEMENT
    // ============================================================
    function moveCreature(c) {
        if (c.finished) {
            c.finishTimer++;
            let bob=Math.sin(c.finishTimer*0.055)*BLOB_DIST*0.1;
            c.x+=(c.finishX-c.x)*0.06;
            c.y+=(c.finishY+bob-c.y)*0.06;
            c.vx=0; c.vy=0;
            let b=getCorridorBounds(c);
            c.corridorX1=b.x1;c.corridorY1=b.y1;c.corridorX2=b.x2;c.corridorY2=b.y2;
            return;
        }

        if (c.teleporting) {
            c.teleportProgress+=0.07;
            if (c.teleportProgress>=1) {
                c.x=c.teleportTo.x; c.y=c.teleportTo.y;
                for (let b of c.blobs){b.x=c.x;b.y=c.y;b.vx=0;b.vy=0;}
                c.teleporting=false; c.teleportProgress=0;
            } else {
                let t=c.teleportProgress;
                if (t<0.5){c.x+=(c.teleportFrom.x-c.x)*0.2;c.y+=(c.teleportFrom.y-c.y)*0.2;}
                else       {c.x+=(c.teleportTo.x  -c.x)*0.3;c.y+=(c.teleportTo.y  -c.y)*0.3;}
            }
            c.vx=0;c.vy=0;
            return;
        }

        // ── Timed path switch every 30 seconds ──
        c.pathSwitchTimer--;
        if (c.pathSwitchTimer <= 0) {
            // Pick a different path (cycle through them)
            let nextPath = (c.pathSetIdx + 1) % c.paths.length;
            c.pathSetIdx = nextPath;
            // Snap pathIndex to closest node on new path from current position
            c.pathIndex  = closestPathStep(c.paths[nextPath], c.x, c.y, c.mz.offsetX);
            c.pathSwitchTimer = PATH_SWITCH_INTERVAL;
            c.trail = []; // clear trail on repath so player can see the new route
        }

        let path=c.paths[c.pathSetIdx];
        let idx=p.constrain(c.pathIndex,0,path.length-1);

        let blocker=doorBlocksStep(path,idx,c.id);
        if (blocker&&!blocker.open) {
            c.blocked=true; c.blockedFrames++;
            c.vx=0; c.vy=0;
            if (c.blockedFrames>=REROUTE_FRAMES) {
                let np=findUnblockedPath(c);
                if (np!==null&&np!==c.pathSetIdx){
                    c.pathSetIdx=np;
                    c.pathIndex=closestPathStep(c.paths[np],c.x,c.y,c.mz.offsetX);
                }
                c.blockedFrames=0;
            }
            return;
        }
        c.blocked=false; c.blockedFrames=0;

        checkTeleport(c);
        if (c.teleporting) return;

        let target=path[idx];
        let tx=target.col*CELL+CELL/2+c.mz.offsetX, ty=target.row*CELL+CELL/2;
        let dx=tx-c.x, dy=ty-c.y;
        let dist=Math.sqrt(dx*dx+dy*dy);

        if (dist<c.speed+2) {
            c.pathIndex++;
            if (c.pathIndex>=path.length) {
                let end=path[path.length-1];
                c.finishX=end.col*CELL+CELL/2+c.mz.offsetX;
                c.finishY=end.row*CELL+CELL/2;
                c.pathIndex=path.length-1;
                c.finished=true; c.finishTimer=0;
                c.vx=0; c.vy=0;
                checkAllFinished();
            }
        } else {
            let spd=p.min(c.speed+dist*0.04,CELL*0.24);
            c.vx=(dx/dist)*spd; c.vy=(dy/dist)*spd;
            c.x+=c.vx; c.y+=c.vy;
            let angle=Math.atan2(dy,dx);
            let stretch=p.map(dist,0,CELL,1,1.25,true);
            c.squishX=1+(stretch-1)*Math.abs(Math.cos(angle));
            c.squishY=1+(stretch-1)*Math.abs(Math.sin(angle));
        }

        let b=getCorridorBounds(c);
        c.corridorX1=b.x1;c.corridorY1=b.y1;c.corridorX2=b.x2;c.corridorY2=b.y2;
    }

    function findUnblockedPath(c) {
        for (let pi=0;pi<c.paths.length;pi++) {
            if (pi===c.pathSetIdx) continue;
            let path=c.paths[pi];
            let hasBlock=false;
            for (let i=1;i<path.length;i++) {
                if (doorBlocksStep(path,i,c.id)){hasBlock=true;break;}
            }
            if (!hasBlock) return pi;
        }
        return null;
    }

    function closestPathStep(path,x,y,offsetX) {
        let best=0, bestD=Infinity;
        for (let i=0;i<path.length;i++) {
            let pt=path[i];
            let d=(pt.col*CELL+CELL/2+offsetX-x)**2+(pt.row*CELL+CELL/2-y)**2;
            if (d<bestD){bestD=d;best=i;}
        }
        return best;
    }

    function checkAllFinished() {
        if (creatures.every(c=>c.finished)) resetTimer=RESET_DELAY;
    }
    function tickReset() {
        if (resetTimer<0) return;
        resetTimer--;
        if (resetTimer===0){resetTimer=-1;init();}
    }

    // ============================================================
    //  TRAIL  (short, quick fade, clears on teleport)
    // ============================================================
    function recordTrail(c) {
        if (c.teleporting) return; // no trail while teleporting
        if (p.frameCount%2===0) {
            c.trail.push({x:c.x,y:c.y,age:0});
            if (c.trail.length>TRAIL_MAX) c.trail.shift();
        }
        for (let pt of c.trail) pt.age++;
    }

    function drawTrail(c) {
        let trail=c.trail; if (trail.length<2) return;
        let pal=c.palette;
        p.push(); p.noFill();
        for (let i=1;i<trail.length;i++) {
            let pt=trail[i],prev=trail[i-1];
            let progress=i/trail.length;
            let ageFade=1-p.constrain(pt.age/TRAIL_LIFE,0,1);
            let alpha=ageFade*progress*200; if (alpha<3) continue;
            let w=progress*ageFade*BLOB_DIST*0.9;
            p.stroke(pal.trail[0],pal.trail[1],pal.trail[2],alpha*0.9);
            p.strokeWeight(w);
            p.line(prev.x,prev.y,pt.x,pt.y);
            p.stroke(pal.trailGlow[0],pal.trailGlow[1],pal.trailGlow[2],alpha*0.4);
            p.strokeWeight(w*0.35);
            p.line(prev.x,prev.y,pt.x,pt.y);
        }
        p.pop();
    }

    // ============================================================
    //  UPDATE CREATURE PHYSICS  (blob ring only, no tentacles)
    // ============================================================
    function updateCreature(c) {
        let t=p.frameCount;
        let scaleFactor=1;
        if (c.teleporting) {
            let tp=c.teleportProgress;
            scaleFactor=tp<0.5?p.map(tp,0,0.5,1,0):p.map(tp,0.5,1,0,1);
            scaleFactor=p.max(scaleFactor,0.01);
        }
        let shakeAmt=c.blocked?CELL*0.14:0;
        let sx=c.blocked?(Math.random()-0.5)*shakeAmt*2:0;
        let sy=c.blocked?(Math.random()-0.5)*shakeAmt*2:0;

        for (let i=0;i<NUM_BLOBS;i++) {
            let b=c.blobs[i];
            let angle=(i/NUM_BLOBS)*p.TWO_PI;
            // Heavy noise deformation — very organic, mercury-like morphing
            // Two layers of noise at different scales and speeds for complex shapes
            let n1=p.noise(c.noiseOffset+Math.cos(angle)*1.2+t*0.004,
                           Math.sin(angle)*1.2+t*0.003);
            let n2=p.noise(c.noiseOffset*2.7+Math.cos(angle)*2.4+t*0.009,
                           Math.sin(angle)*2.4+t*0.008);
            // n1 gives big slow waves, n2 gives small fast ripples
            let noiseR = n1*0.7 + n2*0.3;
            let r=BLOB_DIST*(0.55 + noiseR*1.0)*scaleFactor;  // wide range: 0.55x to 1.55x
            let tx=c.x+sx+Math.cos(angle)*r*c.squishX;
            let ty=c.y+sy+Math.sin(angle)*r*c.squishY;
            b.vx+=(tx-b.x)*SPRING_K; b.vy+=(ty-b.y)*SPRING_K;
            b.vx*=DAMPING; b.vy*=DAMPING;
            b.x+=b.vx; b.y+=b.vy;
        }

        // Update drip phases
        for (let i=0;i<c.dripPhases.length;i++) c.dripPhases[i]+=c.dripSpeeds[i];

        c.blinkTimer--;
        if (c.blinkTimer<=0) {
            c.eyeOpen=0;
            if (c.blinkTimer<-8){c.eyeOpen=1;c.blinkTimer=p.random(80,300);}
        }
        c.squishX=p.lerp(c.squishX,1,0.09);
        c.squishY=p.lerp(c.squishY,1,0.09);
        if (c.deathFlash   > 0) c.deathFlash--;
        if (c.gemFlash     > 0) c.gemFlash--;
        if (c.killFlash    > 0) c.killFlash--;
        if (c.mutateFlash  > 0) c.mutateFlash--;
    }

    // ============================================================
    //  DRAW CREATURE  (liquid blob — no tentacles)
    // ============================================================
    function drawCreature(c) {
        let pal=c.palette;
        p.push();

        let gr=c.blocked?200:pal.glow[0];
        let gg=c.blocked?60:pal.glow[1];
        let gb=c.blocked?10:pal.glow[2];

        // ── Outer ambient glow ──
        for (let g=5;g>=1;g--) {
            p.noStroke();
            p.fill(gr,gg,gb, p.map(g,1,5,40,4));
            drawBlobShape(c, g*BLOB_DIST*0.16);
        }

        // ── Liquid drips / protrusions ──
        // These are small teardrop shapes that pulse out from the surface
        drawDrips(c, pal);

        // ── Drop shadow ──
        p.noStroke(); p.fill(0,0,0,55);
        p.push(); p.translate(BLOB_DIST*0.15,BLOB_DIST*0.2);
        drawBlobShape(c,0); p.pop();

        // ── Main body ──
        p.fill(pal.body[0],pal.body[1],pal.body[2]);
        drawBlobShape(c,0);

        // ── Subsurface scatter / depth ──
        p.fill(gr,gg,gb,18);
        drawBlobShape(c,-BLOB_DIST*0.15);

        // ── Specular highlight — top-left bright spot ──
        let hx=c.x-BLOB_DIST*0.28, hy=c.y-BLOB_DIST*0.3;
        p.noStroke();
        p.fill(255,255,255,50);
        p.ellipse(hx, hy, BLOB_DIST*0.55, BLOB_DIST*0.38);
        p.fill(255,255,255,28);
        p.ellipse(hx+BLOB_DIST*0.08, hy+BLOB_DIST*0.06, BLOB_DIST*0.22, BLOB_DIST*0.15);

        // ── Finished sparkle halo ──
        if (c.finished) {
            let pulse=0.5+0.5*Math.sin(c.finishTimer*0.08);
            p.noFill();
            for (let ring=3;ring>=1;ring--) {
                p.stroke(pal.glow[0],pal.glow[1],pal.glow[2],50*pulse/ring);
                p.strokeWeight(ring*1.6);
                p.ellipse(c.x,c.y,CELL*(0.9+ring*0.28+pulse*0.14));
            }
        }

        drawEyes(c);
        p.pop();
    }

    // Liquid drip protrusions — slow mercury surface-tension blobs
    function drawDrips(c, pal) {
        for (let i=0;i<c.dripAngles.length;i++) {
            let baseAngle = c.dripAngles[i];
            let phase     = c.dripPhases[i];
            let ext       = 0.5+0.5*Math.sin(phase); // 0..1

            // Drip extends well past the body — mercury drop stretching
            let dripR = BLOB_DIST*(1.0 + ext*0.9);
            let tipX  = c.x+Math.cos(baseAngle)*dripR;
            let tipY  = c.y+Math.sin(baseAngle)*dripR;

            // Root sits on body surface
            let rootX = c.x+Math.cos(baseAngle)*BLOB_DIST*0.6;
            let rootY = c.y+Math.sin(baseAngle)*BLOB_DIST*0.6;

            // Width tapers: fat at root, narrow at tip — teardrop
            let wRoot = BLOB_DIST*(0.35+ext*0.18);
            let wTip  = BLOB_DIST*(0.08+ext*0.06);
            let len   = Math.sqrt((tipX-rootX)**2+(tipY-rootY)**2);
            let mid   = 0.35; // bias the fattest point toward root

            p.noStroke();
            // Draw 8 cross-sections to approximate a tapered teardrop
            let steps = 8;
            for (let s=0;s<steps;s++) {
                let f    = s/(steps-1);
                let cx   = rootX+(tipX-rootX)*f;
                let cy   = rootY+(tipY-rootY)*f;
                // Width profile: wide near root, pinches to tip
                let wf   = f<mid ? p.lerp(wRoot,wRoot*1.1,f/mid)
                                 : p.lerp(wRoot*1.1,wTip,(f-mid)/(1-mid));
                let alpha= p.lerp(220, 0, f*f);
                p.fill(pal.body[0],pal.body[1],pal.body[2],alpha);
                p.ellipse(cx, cy, wf, wf);
            }

            // Pendant drop at tip — spherical blob that pinches off
            if (ext > 0.3) {
                let dropR=BLOB_DIST*(0.12+ext*0.14);
                // Slight droop from gravity
                let dropX=tipX + Math.cos(baseAngle)*dropR*0.3;
                let dropY=tipY + Math.sin(baseAngle)*dropR*0.3 + ext*BLOB_DIST*0.08;
                p.fill(pal.body[0],pal.body[1],pal.body[2],180*ext);
                p.ellipse(dropX, dropY, dropR*2, dropR*2.2);
                // Tiny specular on pendant
                p.fill(255,255,255, 60*ext);
                p.ellipse(dropX-dropR*0.3, dropY-dropR*0.3, dropR*0.5, dropR*0.4);
            }
        }
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

    function drawEyes(c) {
        let r=BLOB_DIST*0.28;
        // Eyes shift slightly in travel direction
        let tAngle=Math.atan2(c.vy,c.vx+0.001);
        let lookX=Math.cos(tAngle)*1.8, lookY=Math.sin(tAngle)*1.8;
        // Single large central eye when blocked (alarm), two small eyes normally
        if (c.blocked) {
            // One wide panicked eye
            p.noStroke(); p.fill(255,80,80);
            p.ellipse(c.x+lookX, c.y+lookY, r*2.2, r*1.4*c.eyeOpen);
            if (c.eyeOpen>0.2) {
                p.fill(5,5,10); p.ellipse(c.x+lookX,c.y+lookY, r*1.1, r*1.1*c.eyeOpen);
            }
        } else {
            let offsets=[{x:-BLOB_DIST*0.28,y:-BLOB_DIST*0.18},{x:BLOB_DIST*0.28,y:-BLOB_DIST*0.22}];
            for (let eo of offsets) {
                let ex=c.x+eo.x+lookX, ey=c.y+eo.y+lookY;
                p.noStroke(); p.fill(230,245,230);
                p.ellipse(ex,ey,r*2,r*2*c.eyeOpen);
                if (c.eyeOpen>0.2) {
                    p.fill(5,5,10);
                    p.ellipse(ex+lookX*0.4,ey+lookY*0.4,r*1.05,r*1.05*c.eyeOpen);
                    p.fill(255,255,255,220);
                    p.ellipse(ex-r*0.28,ey-r*0.28,r*0.38,r*0.38);
                }
            }
        }
    }

    // ============================================================
    //  MAZE DRAWING
    // ============================================================
    function drawMaze(mz) {
        p.push();
        let ox=mz.offsetX;

        // Faint path highlights
        for (let c of creatures) {
            if (c.mz!==mz) continue;
            for (let pi=0;pi<c.paths.length;pi++) {
                let path=c.paths[pi], isCurrent=(pi===c.pathSetIdx);
                p.noFill();
                p.strokeWeight(isCurrent?CELL*0.48:CELL*0.18);
                p.stroke(c.palette.glow[0],c.palette.glow[1],c.palette.glow[2],isCurrent?28:8);
                p.beginShape();
                for (let pt of path) p.vertex(pt.col*CELL+CELL/2+ox, pt.row*CELL+CELL/2);
                p.endShape();
            }
        }

        // Walls
        p.stroke(30,180,80,90); p.strokeWeight(1.5);
        for (let r=0;r<mz.rows;r++) {
            for (let c=0;c<mz.cols;c++) {
                let cell=mz.cells[r][c], x=c*CELL+ox, y=r*CELL;
                if (cell.walls.N) p.line(x,y,x+CELL,y);
                if (cell.walls.S) p.line(x,y+CELL,x+CELL,y+CELL);
                if (cell.walls.W) p.line(x,y,x,y+CELL);
                if (cell.walls.E) p.line(x+CELL,y,x+CELL,y+CELL);
            }
        }

        // Corner dots
        p.fill(30,180,80,45); p.noStroke();
        for (let r=0;r<=mz.rows;r++) for (let c=0;c<=mz.cols;c++) p.ellipse(c*CELL+ox,r*CELL,2.5);

        // Goal markers
        for (let c of creatures) {
            if (c.mz!==mz) continue;
            let path=c.paths[c.pathSetIdx];
            let goal=path[path.length-1]; if (!goal) continue;
            let gx=goal.col*CELL+CELL/2+ox, gy=goal.row*CELL+CELL/2;
            let pulse=0.5+0.5*p.sin(p.frameCount*0.05);
            p.noFill();
            p.stroke(c.palette.glow[0],c.palette.glow[1],c.palette.glow[2],180*pulse);
            p.strokeWeight(2.5); p.ellipse(gx,gy,CELL*0.7+pulse*8);
            p.fill(c.palette.glow[0],c.palette.glow[1],c.palette.glow[2],60*pulse);
            p.noStroke(); p.ellipse(gx,gy,CELL*0.35);
        }
        p.pop();
    }

    // ============================================================
    //  DOOR DRAWING
    // ============================================================
    function drawDoors() {
        for (let door of doors) {
            let mp=doorMidpoint(door);
            let horiz=(door.dir==='E'||door.dir==='W');
            let t=door.openAmt;
            p.push(); p.translate(mp.x,mp.y);
            if (!door.open) {
                let halo=0.5+0.5*Math.sin(p.frameCount*0.06);
                p.noStroke(); p.fill(255,200,0,22*halo);
                p.ellipse(0,0,CELL*1.15,CELL*1.15);
            }
            p.rotate(horiz?0:p.HALF_PI);
            p.rotate(t*p.HALF_PI);
            let dw=CELL*0.07,dh=CELL*0.9;
            p.noStroke();
            p.fill(255,200,0,p.lerp(235,45,t)); p.rect(-dw/2,-dh/2,dw,dh,3);
            p.fill(255,240,80,p.lerp(190,18,t)); p.rect(-dw/2,-dh/2,dw*0.28,dh,3);
            if (t<0.5){p.fill(255,150,0);p.ellipse(dw*0.7,0,dw*1.2);}
            p.pop();
            if (!door.open) {
                let hint=0.5+0.5*Math.sin(p.frameCount*0.09);
                p.push(); p.textAlign(p.CENTER,p.CENTER); p.textSize(CELL*0.19);
                p.noStroke(); p.fill(255,220,0,140*hint);
                p.text('click',mp.x,mp.y-CELL*0.65); p.pop();
            }
        }
    }

    // ============================================================
    //  TELEPORTER DRAWING  — Hub + rotating exits
    // ============================================================
    function drawTeleporters() {
        for (let hub of teleporters) {
            let ox  = hub.mz.offsetX;
            let hx  = hub.entry.col*CELL+CELL/2+ox;
            let hy  = hub.entry.row*CELL+CELL/2;
            let timeFrac = 1 - hub.timer / TP_EXIT_CYCLE;  // 0→1 countdown to next rotation

            // Draw entry hub — always active/bright
            drawHubPortal(hx, hy, hub, true);

            // Draw each exit
            for (let ei = 0; ei < hub.exits.length; ei++) {
                let exit    = hub.exits[ei];
                let ex      = exit.col*CELL+CELL/2+ox;
                let ey      = exit.row*CELL+CELL/2;
                let isHot   = (ei === hub.activeExitIdx);

                // Dashed link from hub to active exit
                if (isHot) {
                    p.push();
                    p.stroke(180,100,255, 20+12*Math.sin(hub.phase));
                    p.strokeWeight(1);
                    p.drawingContext.setLineDash([4,8]);
                    p.line(hx, hy, ex, ey);
                    p.drawingContext.setLineDash([]);
                    p.pop();
                }

                drawExitPortal(ex, ey, hub, ei, isHot, timeFrac);
            }
        }
    }

    // Hub entry — large bright spinning portal, always open
    function drawHubPortal(x, y, hub, isEntry) {
        p.push(); p.translate(x, y);
        let pulse  = 0.5+0.5*Math.sin(hub.phase);
        let radius = CELL*0.38 + pulse*CELL*0.07;
        p.noFill();
        for (let ring=4;ring>=1;ring--) {
            p.stroke(160, 60+ring*15, 255, 35*pulse/ring);
            p.strokeWeight(ring*2.0);
            p.ellipse(0,0,radius*2+ring*5);
        }
        for (let i=0;i<8;i++) {
            let angle=hub.phase*1.3+(i/8)*p.TWO_PI;
            p.stroke(200,100,255,100*pulse); p.strokeWeight(1.5);
            p.line(Math.cos(angle)*radius*0.25,Math.sin(angle)*radius*0.25,
                   Math.cos(angle)*radius*0.9, Math.sin(angle)*radius*0.9);
        }
        p.noStroke();
        p.fill(100,20,180, 80+40*pulse); p.ellipse(0,0,radius);
        p.fill(220,160,255,60+40*pulse); p.ellipse(0,0,radius*0.45);
        p.fill(220,190,255,180);
        p.textAlign(p.CENTER,p.CENTER); p.textSize(CELL*0.15); p.noStroke();
        p.text('IN',0,0);
        p.pop();
    }

    // Exit portals — hot exit glows, others are dim with rotation arc
    function drawExitPortal(x, y, hub, exitIdx, isHot, timeFrac) {
        p.push(); p.translate(x, y);
        let radius = CELL*0.30;

        if (isHot) {
            let pulse = 0.5+0.5*Math.sin(-hub.phase);
            // Bright hot exit — green tint to distinguish from entry
            p.noFill();
            for (let ring=3;ring>=1;ring--) {
                p.stroke(80, 200+ring*10, 180, 30*pulse/ring);
                p.strokeWeight(ring*2.0);
                p.ellipse(0,0,radius*2+ring*4);
            }
            for (let i=0;i<6;i++) {
                let angle=-hub.phase*1.4+(i/6)*p.TWO_PI;
                p.stroke(100,220,200,90*pulse); p.strokeWeight(1.3);
                p.line(Math.cos(angle)*radius*0.28,Math.sin(angle)*radius*0.28,
                       Math.cos(angle)*radius*0.88,Math.sin(angle)*radius*0.88);
            }
            p.noStroke();
            p.fill(20,140,120, 70+35*pulse); p.ellipse(0,0,radius*1.0);
            p.fill(150,255,230, 50+35*pulse); p.ellipse(0,0,radius*0.42);
            p.fill(180,255,240,180);
            p.textAlign(p.CENTER,p.CENTER); p.textSize(CELL*0.14); p.noStroke();
            p.text('OUT',0,0);
            // Rotation countdown arc — shows when this exit deactivates
            p.noFill(); p.stroke(100,255,200,80);
            p.strokeWeight(2.5);
            p.arc(0,0,radius*2.4,radius*2.4,-p.HALF_PI,-p.HALF_PI+(1-timeFrac)*p.TWO_PI);
        } else {
            // Dim inactive exit — shows which path it leads to
            let pathNum = hub.exits[exitIdx].pathIdx;
            // Slightly different grey tones per path
            let brightness = 60 + pathNum*15;
            p.noFill();
            p.stroke(brightness,brightness,brightness+30,50);
            p.strokeWeight(1.5);
            p.ellipse(0,0,radius*2);
            p.noStroke(); p.fill(brightness,brightness,brightness+40,60);
            p.ellipse(0,0,radius*0.7);
            // Show which path number this exit leads to
            p.fill(160,160,200,100);
            p.textAlign(p.CENTER,p.CENTER); p.textSize(CELL*0.14); p.noStroke();
            p.text('P'+(pathNum+1),0,0);
            // Click hint
            let hint=0.3+0.3*Math.sin(p.frameCount*0.06+exitIdx);
            p.fill(140,200,140,90*hint);
            p.textSize(CELL*0.12);
            p.text('click',0,radius+CELL*0.2);
        }
        p.pop();
    }

    // ============================================================
    //  HUD  — gem counters, death counters, buttons, effects
    // ============================================================
    function drawHUD() {
        p.push();
        p.textFont('monospace');

        for (let i = 0; i < creatures.length; i++) {
            let c      = creatures[i];
            let pal    = c.palette;
            let isLeft = (i === 0);
            let panelX = isLeft ? 10 : p.floor(p.width/2) + 10;
            let panelW = p.floor(p.width/2) - 20;
            let panelY = 10;
            let halfX  = isLeft ? 0 : p.floor(p.width/2);

            // ── Full-screen flash effects ──
            if (c.deathFlash > 0) {
                p.noStroke();
                p.fill(200, 30, 30, p.map(c.deathFlash, 0, 20, 0, 100));
                p.rect(halfX, 0, p.floor(p.width/2), p.height);
            }
            if (c.gemFlash > 0) {
                p.noStroke();
                p.fill(80, 220, 255, p.map(c.gemFlash, 0, 15, 0, 55));
                p.rect(halfX, 0, p.floor(p.width/2), p.height);
            }
            if (c.killFlash > 0) {
                p.noStroke();
                p.fill(255, 180, 0, p.map(c.killFlash, 0, 25, 0, 70));
                p.rect(halfX, 0, p.floor(p.width/2), p.height);
            }

            // ── Mutate flash — highlight the changed region ──
            if (c.mutateFlash > 0 && c.mutateRegion) {
                let mr = c.mutateRegion;
                let a  = p.map(c.mutateFlash, 0, 30, 0, 160);
                p.noStroke(); p.fill(100, 200, 255, a*0.3);
                p.rect(mr.x, mr.y, mr.w, mr.h);
                p.noFill(); p.stroke(100, 200, 255, a);
                p.strokeWeight(2); p.rect(mr.x, mr.y, mr.w, mr.h);
            }

            // ── HUD panel background ──
            p.noStroke();
            p.fill(6, 6, 12, 175);
            p.rect(panelX, panelY, panelW, 46, 4);
            // Colour stripe
            p.fill(pal.glow[0], pal.glow[1], pal.glow[2], 80);
            p.rect(panelX, panelY, 4, 46, 4, 0, 0, 4);

            // ── Gem count ──
            p.fill(80, 220, 255, 220);
            p.textSize(11); p.textAlign(p.LEFT, p.CENTER);
            p.text('◆ ' + c.gemsCollected, panelX + 12, panelY + 12);

            // ── Death count ──
            p.fill(220, 100, 100, 200);
            p.textSize(10);
            p.text('deaths: ' + c.deathCount + '/' + DEATH_LIMIT, panelX + 12, panelY + 32);

            // ── Kill Ghost button (5 gems) ──
            let btn1X = panelX + panelW - 92;
            let btn1Y = panelY + 4;
            let btn1W = 82, btn1H = 17;
            let canKill = c.gemsCollected >= KILL_GHOST_COST;
            p.noStroke();
            p.fill(canKill ? [180,40,40] : [60,30,30], canKill ? 220 : 100);
            // Draw button bg
            if (canKill) p.fill(160, 35, 35, 220); else p.fill(50, 25, 25, 120);
            p.rect(btn1X, btn1Y, btn1W, btn1H, 3);
            // Button border
            p.noFill();
            p.stroke(canKill ? 220 : 80, canKill ? 60 : 30, canKill ? 60 : 30, canKill ? 200 : 80);
            p.strokeWeight(1); p.rect(btn1X, btn1Y, btn1W, btn1H, 3);
            // Button text
            p.noStroke();
            p.fill(canKill ? [255,120,120] : [100,60,60], canKill ? 230 : 100);
            if (canKill) p.fill(255, 120, 120, 230); else p.fill(100, 60, 60, 100);
            p.textSize(9); p.textAlign(p.CENTER, p.CENTER);
            p.text('☠ Kill Ghost (' + KILL_GHOST_COST + '◆)', btn1X + btn1W/2, btn1Y + btn1H/2);

            // ── Mutate Maze button (10 gems) ──
            let btn2X = panelX + panelW - 92;
            let btn2Y = panelY + 25;
            let btn2W = 82, btn2H = 17;
            let canMutate = c.gemsCollected >= MUTATE_MAZE_COST;
            p.noStroke();
            if (canMutate) p.fill(20, 100, 160, 220); else p.fill(15, 35, 55, 120);
            p.rect(btn2X, btn2Y, btn2W, btn2H, 3);
            p.noFill();
            p.stroke(canMutate ? 60 : 30, canMutate ? 160 : 60, canMutate ? 220 : 80, canMutate ? 200 : 80);
            p.strokeWeight(1); p.rect(btn2X, btn2Y, btn2W, btn2H, 3);
            p.noStroke();
            if (canMutate) p.fill(80, 200, 255, 230); else p.fill(40, 80, 110, 100);
            p.textSize(9); p.textAlign(p.CENTER, p.CENTER);
            p.text('⚡ Mutate (' + MUTATE_MAZE_COST + '◆)', btn2X + btn2W/2, btn2Y + btn2H/2);
        }

        // Maze generation — top centre
        p.noStroke(); p.fill(60, 120, 80, 140);
        p.textSize(10); p.textAlign(p.CENTER, p.TOP);
        p.text('MAZE #' + (mazeGeneration + 1), p.width/2, 14);

        p.pop();
    }

    // ============================================================
    //  MAP CHANGE WARNING
    // ============================================================
    function drawMapChangeWarning() {
        if (mapChangeTimer < 0) return;
        let frac   = mapChangeTimer / 90;
        let flash  = Math.sin(p.frameCount * 0.4) > 0;
        let isLeft = (mapChangeSide === 0);
        let hx     = isLeft ? 0 : p.floor(p.width/2);
        let hw     = p.floor(p.width/2);

        p.push();
        // Pulsing red border
        if (flash) {
            p.noFill();
            p.stroke(255, 60, 60, 180 * frac);
            p.strokeWeight(4);
            p.rect(hx + 2, 2, hw - 4, p.height - 4, 4);
        }
        // Warning text
        p.noStroke();
        p.fill(255, 80, 80, 200 * frac * (flash ? 1 : 0.5));
        p.textAlign(p.CENTER, p.CENTER);
        p.textSize(CELL * 0.7);
        p.text('NEW MAZE', hx + hw/2, p.height/2 - CELL);
        p.textSize(CELL * 0.28);
        p.fill(255, 140, 140, 180 * frac * (flash ? 1 : 0.5));
        p.text('too many deaths!', hx + hw/2, p.height/2 + CELL * 0.2);
        p.pop();
    }

    // ============================================================
    //  FINISH OVERLAY
    // ============================================================
    function drawFinishOverlay() {
        if (resetTimer<=0) return;
        let fade=p.map(resetTimer,RESET_DELAY,0,0,210);
        p.push();
        p.noStroke(); p.fill(6,6,12,fade*0.55);
        p.rect(0,0,p.width,p.height);
        let tf=0.5+0.5*Math.sin(p.frameCount*0.15);
        p.textAlign(p.CENTER,p.CENTER);
        p.textSize(CELL*0.88); p.fill(30,255,120,200*tf);
        p.text('NEW MAZE',p.width/2,p.height/2);
        p.textSize(CELL*0.33); p.fill(30,200,80,140*tf);
        p.text('both familiars arrived',p.width/2,p.height/2+CELL*1.05);
        p.pop();
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
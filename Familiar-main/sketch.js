// ============================================================
//  YOUR CREATURE  —  sketch.js
//  MDDN242 Project 2
// ============================================================

new p5(function(p) {

    // ============================================================
    //  SETTINGS
    // ============================================================

    // ============================================================
    //  STATE
    // ============================================================

    let creature;
    // let micAnalyser = null;
    // let micActive   = false;
    // let micData     = null;


    // ============================================================
    //  CREATURE FACTORY
    // ============================================================

    function createCreature(x, y) {
        return {
            x, y,
            originX: x,
            originY: y,
            need: 50, 
        };
    }


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
        //cnv.mousePressed(onCanvasClick);

        creature = createCreature(p.width / 2, p.height / 2);
      //  loadState(creature);

        // window.addEventListener('focus', () => { creature.isWatched = true; });
        // window.addEventListener('blur',  () => { creature.isWatched = false; });

        // setInterval(() => {
        //     saveState(creature);
        //     creature.hour = new Date().getHours();
        // }, 30000);

        // window.addEventListener('beforeunload', () => saveState(creature));
    };


    // ============================================================
    //  DRAW LOOP
    // ============================================================

    p.draw = function() {
        p.background(255);

        let c = creature;



        // Draw creature
        drawCreature(c);
    };


    // ============================================================
    //  DRAW CREATURE  —  replace this with your design!
    // ============================================================

    function drawCreature(c) {

        p.push();
        p.translate(c.x, c.y);

        // Body
        p.noStroke();
        p.fill(0);
        p.ellipse(0, 0, 200);

        p.pop();
    }


    // ============================================================
    //  INPUT: MOUSE CLICK  —  feed the creature
    // ============================================================

    // function onCanvasClick() {
    //     if (!micActive) startMic();

     
    //     saveState(creature);
    // }


    // ============================================================
    //  INPUT: MICROPHONE
    // ============================================================

    // async function startMic() {
    //     try {
    //         let stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    //         let ctx    = new (window.AudioContext || window.webkitAudioContext)();
    //         let source = ctx.createMediaStreamSource(stream);
    //         micAnalyser = ctx.createAnalyser();
    //         micAnalyser.fftSize = 256;
    //         source.connect(micAnalyser);
    //         micData   = new Uint8Array(micAnalyser.frequencyBinCount);
    //         micActive = true;
    //     } catch(e) {
    //         console.log('Mic unavailable:', e);
    //     }
    // }

    // function getMicLevel() {
    //     if (!micAnalyser) return 0;
    //     micAnalyser.getByteFrequencyData(micData);
    //     let sum = 0;
    //     for (let i = 0; i < micData.length; i++) sum += micData[i];
    //     return sum / (micData.length * 255);
    // }

    // function updateMic(c) {
    //     if (!micActive) return;
    //     c.micLevel = getMicLevel();
    //     if (c.micLevel > MIC_THRESHOLD) c.exciteTimer = EXCITED_FRAMES;
    // }


    // ============================================================
    //  PERSISTENCE
    // ============================================================

    function saveState(c) {
        
    }

    function loadState(c) {

    }


    // ============================================================
    //  RESIZE
    // ============================================================

    p.windowResized = function() {
        let sz = canvasSize();
        p.resizeCanvas(sz.w, sz.h);
        creature.originX = p.width / 2;
        creature.originY = p.height / 2;
        creature.x = creature.originX;
        creature.y = creature.originY;
    };

}, document.body);

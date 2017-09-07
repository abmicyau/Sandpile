(function() {
    "use strict"

    const WIDTH = 320;
    const HEIGHT = 320;
    const SCALE_FACTOR = 2;
    let FRAME_SKIP_DEFAULT = 1;
    let FRAME_SKIP = FRAME_SKIP_DEFAULT;

    const GRAINS = 10000000;

    function Stack(size) {
        this._contents = new Array(size);
        this._top = 0;

        this.clear = function() {
            this._top = 0;
        }

        this.push = function(item) {
            if (this._top < size) {
                this._contents[this._top] = item;
                this._top++;
            }
        }

        this.forEach = function(fn) {
            for (let i = 0; i < this._top; i++) {
                fn(this._contents[i]);
            }
        }
    }

    const sandpileSimulator = {

        start: function() {
            this.setUp();

            const loop = () => {
                while (true) {
                    this.next();
                    if (this._iterations % FRAME_SKIP === 0) {
                        break;
                    }
                }

                if (this._continue) {
                    setTimeout(loop, 0);
                }
            };

            loop();
        },

        next: function() {
            let shouldContinue = false;
            this._aGrainsToCheckNow.clear();

            this._aGrainsToCheckNext.forEach((grain) => {
                this._aGrainsToCheckNow.push(grain);

                if (grain.next !== grain.cur) {
                    if (grain.next <= 4) { // should re-examine this
                        if (!grain.diff) {
                            grain.diff = true;
                            this._aGrainsToRender.push(grain);
                        }
                    }
                    shouldContinue = true;
                }
                grain.cur = grain.next;
                grain.check = false;
            })

            if (!shouldContinue) {
                this._continue = false;
            }

            this._aGrainsToCheckNext.clear();

            this._aGrainsToCheckNow.forEach((grain) => {
                if (grain.cur >= 4) {
                    this.topple(grain);
                }
            });

            if (this._iterations % FRAME_SKIP === 0) {
                this._aGrainsToRender.forEach((grain) => {
                    this.rerender(grain.x, grain.y);
                    grain.diff = false;
                });
                this._aGrainsToRender.clear();

                const now = Date.now();
                const duration = now - this._cycleStart;
                this._cycleStart = now;

                const total = now - this._startTime;

                $("#clock").text(this.msToTime(total));
                $("#iterations").text(this._iterations + " iterations");
                $("#time").text("Average iteration duration: " + (duration / FRAME_SKIP).toFixed(1) + " ms");
                $("#grains").text("Grains in the middle: " + this._startingGrain.next);
            }

            this._iterations++;
        },

        setUp: function() {
            $("body").append(
                "<canvas id='canvas' width=" +
                SCALE_FACTOR * WIDTH +
                " height=" +
                SCALE_FACTOR * HEIGHT +
                " style='border: 1px solid #000'></canvas>");
            $("body").append(
                "<div id='clock'></div>");
            $("body").append(
                "<div id='iterations'></div>");
            $("body").append(
                "<div id='time'></div>");
            $("body").append(
                "<div id='grains'></div>");

            this._oCanvas = $("#canvas")[0];
            this._oContext = this._oCanvas.getContext("2d");

            this._middle_x = Math.floor(WIDTH / 2);
            this._middle_y = Math.floor(HEIGHT / 2);
            this._iterations = 0;
            this._fastSpeed = true;
            this._cycleStart = Date.now();
            this._startTime = this._cycleStart;

            this._continue = true;

            this._aSandMap = new Array(WIDTH);
            for (let i = 0; i < WIDTH; i++) {
                this._aSandMap[i] = new Array(HEIGHT);
                for (let j = 0; j < HEIGHT; j++) {
                    if (i <= this._middle_x && j <= this._middle_y - (this._middle_x - i)) {
                        this._aSandMap[i][j] = {
                            x:          i,
                            y:          j,
                            cur:        0,
                            next:       0,
                            diff:       false,
                            check:      false,
                            regular:    i < this._middle_x && j < this._middle_y - (this._middle_x - i),
                            edge:       (i === this._middle_x && j !== this._middle_y) ||
                                        (i !== this._middle_x && j === this._middle_y - (this._middle_x - i))
                        };
                    } else {
                        this._aSandMap[i][j] = false;
                    }
                }
            }

            this._startingGrain = this._aSandMap[this._middle_x][[this._middle_y]];
            this._startingGrain.next = GRAINS;
            this.rerender(this._middle_x, this._middle_y);

            const iBufferSize = Math.floor((WIDTH * HEIGHT) / 8);

            this._aGrainsToCheckNow = new Stack(iBufferSize);
            this._aGrainsToCheckNext = new Stack(iBufferSize);
            this._aGrainsToRender = new Stack(iBufferSize);

            this._aGrainsToCheckNext.push(this._startingGrain);
        },

        topple: function(grain) {
            grain.next -= 4;

            const x = grain.x;
            const y = grain.y;

            this.pile(x - 1, y, x, y);
            this.pile(x + 1, y, x, y);
            this.pile(x, y - 1, x, y);
            this.pile(x, y + 1, x, y);

            if (grain.next >= 4) {
                this.addGrainToNext(grain);
            }
        },

        pile: function(x, y, xs, ys) {
            const grain = this._aSandMap[x][y];

            if (grain) {
                if (grain.regular) {
                    grain.next += 1;
                    this.addGrainToNext(grain);
                } else if (grain.edge) {
                    if (x === this._middle_x) {
                        if (x === xs) {
                            grain.next += 1;
                        } else {
                            grain.next += 2;
                        }
                    } else {
                        if ((x === xs + 1 && y === ys + 1) || (x === xs - 1 && y === ys - 1)) {
                            grain.next += 1;
                        } else {
                            grain.next += 2;
                        }
                    }
                    this.addGrainToNext(grain);
                } else { // middle
                    grain.next += 4;
                    this.addGrainToNext(grain);
                }
            }
        },

        addGrainToNext: function(grain) {
            if (!grain.check) {
                this._aGrainsToCheckNext.push(grain);
                grain.check = true;
            }
        },

        rerender: function(x, y) {
            const grain = this._aSandMap[x][y];
            const x_dist = this._middle_x - x;
            const y_dist = this._middle_y - y;

            const duplicate = (r, g, b) => {
                if (grain.regular) {
                    this.draw(this._middle_x - y_dist, this._middle_y - x_dist, r, g, b, 255);
                    this.draw(this._middle_x + y_dist, this._middle_y - x_dist, r, g, b, 255);
                    this.draw(this._middle_x + x_dist, y, r, g, b, 255);
                    this.draw(this._middle_x - y_dist, this._middle_y + x_dist,  r, g, b, 255);
                    this.draw(x, this._middle_y + y_dist,  r, g, b, 255);
                    this.draw(this._middle_x + y_dist, this._middle_y + x_dist,  r, g, b, 255);
                    this.draw(this._middle_x + x_dist, this._middle_y + y_dist,  r, g, b, 255);

                } else if (grain.edge) {
                    if (x === this._middle_x) {
                        this.draw(x, this._middle_y + y_dist, r, g, b, 255);
                        this.draw(this._middle_x - y_dist, this._middle_y, r, g, b, 255);
                        this.draw(this._middle_x + y_dist, this._middle_y, r, g, b, 255);
                    } else {
                        this.draw(this._middle_x + x_dist, y, r, g, b, 255);
                        this.draw(this._middle_x + x_dist, this._middle_y + y_dist, r, g, b, 255);
                        this.draw(x, this._middle_y + y_dist, r, g, b, 255);
                    }
                }
            };

            let c;
            switch (grain.next) {
                case 0:
                    c = { r: 255, g: 255, b: 255 };
                    break;
                case 1:
                    c = { r: 69, g: 178, b: 157 };
                    break;
                case 2:
                    c = { r: 239, g: 201, b: 76 };
                    break;
                case 3:
                    c = { r: 226, g: 122, b: 63 };
                    break;
                default:
                    c = { r: 223, g: 90, b: 73 };
                    break;
            }
            this.draw(x, y, c.r, c.g, c.b, 255);
            duplicate(grain, c.r, c.g, c.b);
        },

        draw: function(x, y, r, g, b, a) {
            this._oContext.fillStyle = "rgba("+r+","+g+","+b+","+(a/255)+")";
            this._oContext.fillRect(x * SCALE_FACTOR, y * SCALE_FACTOR, 1 * SCALE_FACTOR, 1 * SCALE_FACTOR);
        },

        toggleSpeed: function() {
            if (this._fastSpeed) {
                this._fastSpeed = false;
                FRAME_SKIP = 1;
            } else {
                this._fastSpeed = true;
                FRAME_SKIP = FRAME_SKIP_DEFAULT;
            }
        },

        msToTime: function(s) {
          function pad(n) {
            return ('00' + n).slice(-2);
          }

          var ms = s % 1000;
          s = (s - ms) / 1000;
          var secs = s % 60;
          s = (s - secs) / 60;
          var mins = s % 60;
          var hrs = (s - mins) / 60;

          return pad(hrs) + ':' + pad(mins) + ':' + pad(secs);
        }
    };

    sandpileSimulator.start();
})();
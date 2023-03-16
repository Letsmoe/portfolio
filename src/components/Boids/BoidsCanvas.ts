import { Boid } from "./Boid";
import { Vector } from "./Vector";

class BoidsCanvas {
	canvasDiv: HTMLCanvasElement;
	visibleRadius: number;
	maxForce: number;
	separationDist: number;
	boidRadius: number;
	boids: Boid[];
	ctx: CanvasRenderingContext2D;
	size: { width: number; height: number };
	mousePos: Vector;

	constructor(public canvas: HTMLCanvasElement, public options: any) {
		this.size = {
			width: window.innerWidth,
			height: window.innerHeight - 80,
		};

		// Set customisable boids parameters
		options = options !== undefined ? options : {};
		this.options = {
			background:
				options.background !== undefined
					? options.background
					: "#1a252f",
			density: options.density,
			speed: options.speed,
			interactive:
				options.interactive !== undefined ? options.interactive : true,
			mixedSizes:
				options.mixedSizes !== undefined ? options.mixedSizes : true,
			boidColours:
				options.boidColours !== undefined &&
				options.boidColours.length !== 0
					? options.boidColours
					: ["#ff3333"],
		};

		// Internal boids parameters
		this.visibleRadius = 150;
		this.maxForce = 0.04;
		this.separationDist = 80;
		this.boidRadius = 5; //size of the smallest boid

		this.init();
	}

	public init() {
		// Create canvas & context
		this.ctx = this.canvas.getContext("2d");
		this.canvas.width = this.size.width;
		this.canvas.height = this.size.height;

		// Add resize listener to canvas
		window.addEventListener("resize", () => {
			// Scale canvas
			this.canvas.width = window.innerWidth;
			this.canvas.height = window.innerHeight - 80;

			this.initialiseBoids();
		});

		this.initialiseBoids();

		// Mouse event listeners
		document.body.addEventListener("mousemove", (e) => {
			this.mousePos = new Vector(
				e.clientX - this.canvas.offsetLeft,
				e.clientY - this.canvas.offsetTop
			);
		});

		// Update canvas
		requestAnimationFrame(this.update.bind(this));
	}

	// Initialise boids according to options
	public initialiseBoids() {
		this.boids = [];
		for (
			var i = 0;
			i < (this.canvas.width * this.canvas.height) / this.options.density;
			i++
		) {
			var position = new Vector(
				Math.floor(Math.random() * (this.canvas.width + 1)),
				Math.floor(Math.random() * (this.canvas.height + 1))
			);
			var max_velocity = 5;
			var min_velocity = -5;
			var velocity = new Vector(
				Math.floor(
					Math.random() * (max_velocity - min_velocity + 1) +
						min_velocity
				),
				Math.floor(
					Math.random() * (max_velocity - min_velocity + 1) +
						min_velocity
				)
			);
			var size = this.options.mixedSizes
				? Math.floor(Math.random() * (3 - 1 + 1) + 1)
				: 1;
			var colourIdx = Math.floor(
				Math.random() * (this.options.boidColours.length - 1 + 1)
			);
			this.boids.push(
				new Boid(
					this,
					position,
					velocity,
					size,
					this.options.boidColours[colourIdx]
				)
			);
		}
	}

	public update() {
		// Clear canvas
		this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
		this.ctx.fillStyle = this.options.background;
		this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)
		this.ctx.globalAlpha = 1;

		// Update and draw boids
		for (var i = 0; i < this.boids.length; i++) {
			this.boids[i].update();
			this.boids[i].draw();
		}

		// Request next frame
		requestAnimationFrame(this.update.bind(this));
	}

	// Helper method to set multiple styles
	public setStyles(div, styles) {
		for (var property in styles) {
			div.style[property] = styles[property];
		}
	}
}

export { BoidsCanvas };

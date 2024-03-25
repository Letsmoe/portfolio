function hexToRgb(hex) {
	const r = parseInt(hex.substring(0, 2), 16);
	const g = parseInt(hex.substring(2, 4), 16);
	const b = parseInt(hex.substring(4, 6), 16);
	return { r, g, b };
}

function rgbToHex({ r, g, b }) {
	return `#${r.toString(16).padStart(2, "0")}${g
		.toString(16)
		.padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function interpolateColor(color1, color2, fraction) {
	const r = Math.round(color1.r * (1 - fraction) + color2.r * fraction);
	const g = Math.round(color1.g * (1 - fraction) + color2.g * fraction);
	const b = Math.round(color1.b * (1 - fraction) + color2.b * fraction);
	return { r, g, b };
}

const colorGenerator = function* () {
	const rainbowColors = [
		"FF0000", // Red
		"FFA500", // Orange
		"FFFF00", // Yellow
		"008000", // Green
		"0000FF", // Blue
		"4B0082", // Indigo
		"EE82EE", // Violet
	];

	let index = Math.round(Math.random() * 20);

	while (true) {
		const currentColor = hexToRgb(
			rainbowColors[Math.floor(index) % rainbowColors.length]
		);
		const nextColor = hexToRgb(
			rainbowColors[Math.ceil(index) % rainbowColors.length]
		);

		const color = interpolateColor(
			currentColor,
			nextColor,
			index - Math.floor(index)
		);

		index += 0.01;
		yield rgbToHex(color);
	}
};

function randomIntFromInterval(min: number, max: number) {
	// min and max included
	return Math.floor(Math.random() * (max - min + 1) + min);
}

class Bird {
	public color = colorGenerator();
	public wingPosition = randomIntFromInterval(-1, 1);
	public mouse = {
		x: 0,
		y: 0,
	};

	public speed = Math.random() * 0.005;

	constructor(
		public x: number,
		public y: number,
		public vx: number,
		public vy: number,
		public size: number,
		public canvas: HTMLCanvasElement,
		public ctx: CanvasRenderingContext2D
	) {}

	draw() {
		// Draw a simple bird shape
		const wingAngle = Math.atan2(this.vy, this.vx);
		const sizeX = Math.max(5, Math.abs(Math.sin(this.wingPosition)) * 20);
		const sizeY = this.size;
		const color = this.color.next().value;

		this.ctx.save();
		this.ctx.fillStyle = color as string;
		this.ctx.translate(this.x + sizeX / 2, this.y + sizeY / 2);
		this.ctx.rotate(wingAngle - Math.PI * 1.5);
		this.ctx.beginPath();
		this.ctx.lineTo(sizeX, -sizeY / 2);
		this.ctx.lineTo(sizeX, sizeY / 2 + sizeY * 0.3);
		this.ctx.lineTo(0, 0);
		this.ctx.closePath();
		this.ctx.fill();
		this.ctx.beginPath();
		this.ctx.lineTo(-sizeX, -sizeY / 2);
		this.ctx.lineTo(-sizeX, sizeY / 2 + sizeY * 0.3);
		this.ctx.lineTo(0, 0);
		this.ctx.closePath();
		this.ctx.fill();
		this.ctx.restore();
	}

	update() {
		this.x += this.vx * this.speed;
		this.y += this.vy * this.speed;

		let dx = this.mouse.x - this.x;
		let dy = this.mouse.y - this.y;
		let angle = Math.atan2(dy, dx);
		this.vx = Math.max(Math.cos(angle) * 0.8 + this.vx, 0.1);
		this.vy = Math.max(Math.sin(angle) * 0.8 + this.vy, 0.1);
		if (
			this.x < -(this.size / 2) ||
			this.x > this.canvas.width + this.size ||
			this.y < -(this.size / 2) ||
			this.y > this.canvas.height + this.size
		) {
			this.reset();
		}

		this.wingPosition += 0.1;
	}

	reset() {
		this.x = this.canvas.width - this.x;
		this.y = this.canvas.height - this.y;
	}
}

// Set up an animation loop
function animate(canvas: HTMLCanvasElement) {
	const ctx = canvas.getContext("2d");
	canvas.width = window.innerWidth;
	canvas.height = window.innerHeight - 80;
	// Create an array to hold the birds
	const birds = [];
	const numBirds = 75;
	window.addEventListener("resize", () => {
		canvas.width = window.innerWidth;
		canvas.height = window.innerHeight - 80;
	});

	canvas.addEventListener("mousemove", (e) => {
		const mouseX = e.clientX - canvas.getBoundingClientRect().left;
		const mouseY = e.clientY - canvas.getBoundingClientRect().top;
		birds.forEach((bird) => {
			bird.mouse.x = mouseX;
			bird.mouse.y = mouseY;
		});
	});

	let addBirdInterval: NodeJS.Timeout;

	canvas.addEventListener("mousedown", (e) => {
		// Add birds when the mouse is held down (10/s) as long as there are less than 2000 birds.
		console.log(e)
		addBirdInterval = setInterval(() => {
			if (birds.length < 2000) {
				const vx = Math.random() * 2;
				const vy = Math.random() * -2;
				const size = 20 + Math.random() * 20;
				birds.push(
					new Bird(
						e.clientX - canvas.getBoundingClientRect().left,
						e.clientY - canvas.getBoundingClientRect().top,
						vx,
						vy,
						size,
						canvas,
						ctx
					)
				);
			}
		}, 1000 / 10);
	})

	canvas.addEventListener("mouseup", () => {
		clearInterval(addBirdInterval);
	});

	function draw() {
		if (birds.length < numBirds) {
			for (let i = 0; i < numBirds; i++) {
				const vx = Math.random() * 2;
				const vy = Math.random() * -2;
				const size = 20 + Math.random() * 20;
				birds.push(
					new Bird(Math.random() * canvas.width, Math.random() * canvas.height, vx, vy, size, canvas, ctx)
				);
			}
		}

		// Clear the canvas
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		ctx.globalAlpha = 0.1;

		// Update and draw each bird
		birds.forEach((bird) => {
			bird.update();
			bird.draw();
		});

		requestAnimationFrame(draw);
	}

	// Request another frame of animation
	requestAnimationFrame(draw);
}

export { animate };

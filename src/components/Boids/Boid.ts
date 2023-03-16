import { BoidsCanvas } from "./BoidsCanvas";
import { Vector } from "./Vector";

class Boid {
	public acceleration: Vector;
	public position: Vector;
	public velocity: Vector;
	radius: number;

	public constructor(
		public parent: BoidsCanvas,
		position: { x: number; y: number },
		velocity: { x: number; y: number },
		public size: number,
		public colour: string
	) {
		// Initialise the boid parameters
		this.position = new Vector(position.x, position.y);
		this.velocity = new Vector(velocity.x, velocity.y);
		this.acceleration = new Vector(0, 0);

		// Check if valid colour
		if (!/(^#[0-9A-F]{6}$)|(^#[0-9A-F]{3}$)/i.test(colour)) {
			throw new Error("Please specify a valid boid hexadecimal color");
		}
		this.size = size;
		this.colour = colour;
		this.parent = parent;
		this.radius = this.parent.boidRadius * this.size;
	}

	public draw() {
		// Draw boid
		this.parent.ctx.beginPath();
		this.parent.ctx.fillStyle = this.colour;
		this.parent.ctx.globalAlpha = 0.7;
		this.parent.ctx.arc(
			this.position.x,
			this.position.y,
			this.radius,
			0,
			2 * Math.PI
		);
		this.parent.ctx.fill();
	}

	/* Update the boid positions according to Reynold's rules.
	 ** Called on every frame  */
	public update() {
		var v1 = this.cohesion();
		var v2 = this.separation();
		var v3 = this.alignment();
		var v4 = this.interactivity();

		// Weight rules to get best behaviour
		v1 = v1.mul(new Vector(1, 1));
		v2 = v2.mul(new Vector(1.5, 1.5));
		v3 = v3.mul(new Vector(1, 1));
		v4 = v4.mul(new Vector(1.8, 1.8));

		this.applyForce(v1);
		this.applyForce(v2);
		this.applyForce(v3);
		this.applyForce(v4);

		this.velocity = this.velocity.add(this.acceleration);
		this.velocity = this.velocity.limit(this.parent.options.speed);

		this.position = this.position.add(this.velocity);
		this.acceleration = this.acceleration.mul(new Vector(0, 0));
		this.borders();
	}

	// BOIDS FLOCKING RULES

	/* Cohesion rule: steer towards average position of local flockmates */
	public cohesion() {
		var sum = new Vector(0, 0); // Average flockmate position
		var count = 0; // number of local flockmates

		// For each boid close enough to be seen...
		for (var i = 0; i < this.parent.boids.length; i++) {
			var d = this.position.dist(this.parent.boids[i].position);
			if (d > 0 && d < this.parent.visibleRadius) {
				sum = sum.add(this.parent.boids[i].position);
				count++;
			}
		}

		if (count > 0) {
			// Calculate average position and return the force required to steer towards it
			sum = sum.div(new Vector(count, count));
			sum = this.seek(sum);
			return sum;
		} else {
			return new Vector(0, 0);
		}
	}

	/* Separation rule: steer to avoid crowding local flockmates */
	public separation() {
		var steer = new Vector(0, 0); // Average steer
		var count = 0; // number of flockmates considered "too close"

		// For each boid which is too close, calculate a vector pointing
		// away from it weighted by the distance to it
		for (var i = 0; i < this.parent.boids.length; i++) {
			var d =
				this.position.dist(this.parent.boids[i].position) -
				this.size * this.parent.boidRadius;
			if (d > 0 && d < this.parent.separationDist) {
				var diff = this.position.sub(this.parent.boids[i].position);
				diff = diff.normalise();
				diff = diff.div(new Vector(d, d));
				steer = steer.add(diff);
				count++;
			}
		}
		// Calculate average
		if (count > 0) {
			steer = steer.div(new Vector(count, count));
		}

		// Steering = Desired - Velocity
		if (steer.mag() > 0) {
			steer = steer.normalise();
			steer = steer.mul(
				new Vector(this.parent.options.speed, this.parent.options.speed)
			);
			steer = steer.sub(this.velocity);
			steer = steer.limit(this.parent.maxForce);
		}
		return steer;
	}

	/* Alignment rule: steer toward average heading of local flockmates */
	public alignment() {
		var sum = new Vector(0, 0); // Average velocity
		var count = 0; // number of local flockmates

		// For each boid which is close enough to be seen
		for (var i = 0; i < this.parent.boids.length; i++) {
			var d = this.position.dist(this.parent.boids[i].position);
			if (d > 0 && d < this.parent.visibleRadius) {
				sum = sum.add(this.parent.boids[i].velocity);
				count++;
			}
		}

		if (count > 0) {
			// Calculate average and limit
			sum = sum.div(new Vector(count, count));
			sum = sum.normalise();
			sum = sum.mul(
				new Vector(this.parent.options.speed, this.parent.options.speed)
			);

			// Steering = Desired - Velocity
			var steer = sum.sub(this.velocity);
			steer = steer.limit(this.parent.maxForce);
			return steer;
		} else {
			return new Vector(0, 0);
		}
	}

	public interactivity() {
		if (
			this.parent.options.interactive &&
			this.parent.mousePos !== undefined &&
			this.position.dist(this.parent.mousePos) < this.parent.visibleRadius
		) {
			return this.seek(this.parent.mousePos);
		} else {
			return new Vector(0, 0);
		}
	}

	// Implement torus boundaries
	public borders() {
		if (this.position.x < -this.radius * 2) this.position.x = this.parent.canvas.width;
		if (this.position.y < -this.radius * 2) this.position.y = this.parent.canvas.height;
		if (this.position.x > this.parent.canvas.width + this.radius * 2) this.position.x = -this.radius * 2;
		if (this.position.y > this.parent.canvas.height + this.radius * 2) this.position.y = -this.radius * 2;
	}

	/* Calculate a force to apply to a boid to steer
	 ** it towards a target position */
	public seek(target) {
		var desired = target.sub(this.position);
		desired = desired.normalise();
		desired = desired.mul(
			new Vector(this.parent.options.speed, this.parent.options.speed)
		);

		var steer = desired.sub(this.velocity);
		steer = steer.limit(this.parent.maxForce);
		return steer;
	}

	// Adjust the acceleration by applying a force, using A = F / M
	// with M = boid size so that larger boids have more inertia
	public applyForce(force: Vector) {
		this.acceleration = this.acceleration.add(
			force.div(new Vector(this.size, this.size))
		);
	}
}

export { Boid };

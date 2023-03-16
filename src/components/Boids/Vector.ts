class Vector {
	public constructor(public x = 0, public y = 0) {

	}

	public add(v: Vector) {
		return new Vector(this.x + v.x, this.y + v.y);
	};
	public sub(v: Vector) {
		return new Vector(this.x - v.x, this.y - v.y);
	};
	public mul(v: Vector) {
		return new Vector(this.x * v.x, this.y * v.y);
	};
	public div(v: Vector) {
		return new Vector(this.x / v.x, this.y / v.y);
	};
	public mag() {
		return Math.sqrt((this.x * this.x) + (this.y * this.y));
	};
	public normalise() {
		var mag = this.mag();
		return new Vector(this.x / mag, this.y / mag);
	};
	public dist(v: Vector) {
		return Math.sqrt((this.x - v.x)*(this.x - v.x) + (this.y - v.y)*(this.y - v.y));
	};
	public limit(limit: number) {
		let v: Vector;
		if(this.mag() > limit) {
			v = this.normalise().mul(new Vector(limit, limit));
		} else {
			v = this;
		}
		return v;
	};
}

export { Vector }
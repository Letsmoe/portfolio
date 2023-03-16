
// Convert rgba array to hex
function rgbToHex(rgb: number[]): string {
	var hex = [];

	for (var i = 0; i < rgb.length - 1; i++) {
		hex[i] = rgb[i].toString(16);

		if (hex[i].length < 2) {
			hex[i] = "0" + hex[i]; // Pad with leading zero
		}
	}

	return "#" + hex.join("");
};

function hslToHex(hsl: number[]) {
	let [h,s,l] = hsl;
  l /= 100;
  const a = s * Math.min(l, 1 - l) / 100;
  const f = n => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');   // convert to Hex and prefix "0" if needed
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

export { Color } from "./Color";
export { rgbToHex, hslToHex }
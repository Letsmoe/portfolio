# Check if pandoc is installed
if ! command -v pandoc &> /dev/null
then
		echo "Please install pandoc https://github.com/jgm/pandoc/releases/ and try again"
		exit
fi

# We need to get the models from the following link:
mkdir -p ./audio

# Check if the models exist
if [ ! -f ./audio/de_DE-thorsten-high.onnx ]; then
		echo "Downloading models"
		curl -o ./audio/de_DE-thorsten-high.onnx https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/de/de_DE/thorsten/high/de_DE-thorsten-high.onnx?download=true
		curl -o ./audio/de_DE-thorsten-high.onnx.json https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/de/de_DE/thorsten/high/de_DE-thorsten-high.onnx.json?download=true.json
else
		echo "Models already exist"
fi

# Check if piper is installed
if ! command -v piper &> /dev/null
then
		pip install piper
fi


# And generate a transcription of all markdown articles.

for file in $(find ./src/content/blog/ -name "*.md"); do
		echo "Processing $file"

		# Check if the file has changed since last commit ($(git diff --quiet --exit-code HEAD~1 HEAD $file && echo $?))
		if [ $(git diff --quiet --exit-code HEAD~1 HEAD $file && echo $?) -eq 0 ]; then
				echo "File has not changed since last commit, skipping"
				continue;
		fi

		# Strip all HTML content and links from the file and only leave headings and paragraphs
		pandoc $file -t markdown -o $file.tmp --strip-comments --lua-filter=./remove_html_links_images.lua
		echo "$(cat $file.tmp)" | piper --model ./audio/de_DE-thorsten-high.onnx --output_file ./public/audio/$(basename $file .md).wav
		rm $file.tmp
done

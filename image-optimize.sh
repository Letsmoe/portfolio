#!/bin/bash

rm -r ./public/images/gallery/;
mkdir ./public/images/gallery/;
cp -r ./images/gallery/* ./public/images/gallery;

rm -r ./public/images/blog/;
mkdir ./public/images/blog/;
cp -r ./images/blog/* ./public/images/blog;

for image in ./public/images/{gallery,blog}/**/*.{jpg,JPG}; do
	echo "Processing $image";
	if [ -f $image ]
	then
		convert -resize 1800x1200 $image $image;
		jpegoptim --max=75 $image --overwrite;
	fi
done;
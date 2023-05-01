#!/bin/bash

rename 's/\.JPG$/.jpg/' ./*.JPG

rm -r ./src/assets/gallery/;
mkdir ./src/assets/gallery/;
cp -r ./images/gallery/* ./src/assets/gallery;

rm -r ./public/images/blog/;
mkdir ./public/images/blog/;
cp -r ./images/blog/* ./public/images/blog;

for image in ./public/images/blog/**/*.{jpg,JPG}; do
	echo "Processing $image";
	if [ -f $image ]
	then
		convert -resize 1800x1200 $image $image;
		jpegoptim --max=75 $image --overwrite;
	fi
done;

for image in ./src/assets/gallery/**/*.{jpg,JPG}; do
	echo "Processing $image";
	if [ -f $image ]
	then
		convert -resize 1800x1200 $image $image;
		jpegoptim --max=75 $image --overwrite;
	fi
done;
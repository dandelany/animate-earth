#!/bin/bash

#path=/media/dan/Galactica/earth/img/full-disk-true-color/crop1080
path=/home/dan/Documents/repos/animate-earth/img/full-disk-true-color/crop1080

#for file in /media/dan/Galactica/earth/img/full-disk-true-color/high5/*.jpg; do
for file in /home/dan/Documents/repos/animate-earth/img/full-disk-true-color/high5/*.jpg; do
 echo "cropping $file";
 convert "$file" -crop 1920x1080+1500+1000 "$path/${file##*/}";
done
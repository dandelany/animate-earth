#!/bin/bash

#path=/media/dan/Galactica/earth/img/full-disk-true-color/crop1080
#path=/home/dan/Documents/repos/animate-earth/img/full-disk-true-color/crop1080
#path=/Users/danieldelany/Documents/animate\ earth/img/full-disk-true-color/crop1080
path=/Volumes/Galactica/earth/img/full-disk-true-color/skiptest/crop

#for file in /media/dan/Galactica/earth/img/full-disk-true-color/high5/*.jpg; do
#for file in /Users/danieldelany/Documents/animate\ earth/img/full-disk-true-color/high5/*.jpg; do
#for file in /Users/danieldelany/Documents/animate\ earth/img/full-disk-true-color/high5/*.jpg; do
for file in /Volumes/Galactica/earth/img/full-disk-true-color/skiptest/*.jpg; do
 echo "cropping $file";
# convert "$file" -crop 1920x1080+1500+1000 "$path/${file##*/}";
 convert "$file" -crop 640x480+1000+2220 "$path/${file##*/}";
done

# ffmpeg -i video_smv/crop1080-2x60c.mp4 -i video/crop1080-2x60.mp4 -filter_complex "[0:v]setpts=PTS-STARTPTS[bg]; [1:v]setpts=PTS-STARTPTS[fg]; [bg][fg]overlay=w/2" video/sbs4.mp4
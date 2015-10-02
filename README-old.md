# Animate Earth
### Motion interpolated videos from Himawari-8 full-disk true-color images

## Dependencies
FFmpeg, Imagemagick, and Butterflow. On a Mac, this should be as easy as:

```
brew update
brew upgrade
brew install ffmpeg imagemagick
brew install homebrew/science/butterflow
```

## useful commands

```
# make video
ffmpeg -framerate 30 -pattern_type glob -i './*.jpg' -c:v libx264 -r 30 -pix_fmt yuv420p orig.mp4

# interpolate
butterflow -s full,spd=0.05 -r 60 -o interp.mp4 orig.mp4

# gif
ffmpeg -i 30-interp.mp4 -pix_fmt rgb24 -s 320x240 output.gif

# side by side comparison
# A left side vs A left side
ffmpeg -i video_smv/crop1080-2x60c.mp4 -i video/crop1080-2x60.mp4 -filter_complex "[0:v]setpts=PTS-STARTPTS[bg]; [1:v]setpts=PTS-STARTPTS[fg]; [bg][fg]overlay=w/2" video/sbs4.mp4

# A right side vs B right side
ffmpeg -i a.mov -i b.mov -filter_complex "[0:v]setpts=PTS-STARTPTS[l]; [1:v]setpts=PTS-STARTPTS[r]; [l]crop=iw/2:ih:iw/2:0[l]; [r][l]overlay=0" sbs.mp4

# A left side vs B right side
ffmpeg -i 30-interp.mov -i 30-interp-gauss.mov -filter_complex "[0:v]setpts=PTS-STARTPTS[l]; [1:v]setpts=PTS-STARTPTS[r]; [l]crop=iw/2:ih:0:0[l]; [r][l]overlay=0" sbs2.mp4

# missing-frame-adjusted pipeline:

# crop images with crop.sh

# make video
ffmpeg -framerate 30 -pattern_type glob -i './crop/*.jpg' -c:v libx264 -r 30 -pix_fmt yuv420p 30-orig.mp4

# use sessions.js to generate adjusted butterflow command & run it

# extract frames from adjusted butterflow video
ffmpeg -i adj3.mp4 -r 30 -f image2 img/f%3d.png

# use ffdupes to remove duplicate frames
ffdupes -d ./img/

# make new video from de-duped frames

ffmpeg -framerate 30 -pattern_type glob -i './img/*.jpg' -c:v libx264 -r 30 -pix_fmt yuv420p 30-adj.mp4

```

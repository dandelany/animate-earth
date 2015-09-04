```
# make video
ffmpeg -framerate 6 -pattern_type glob -i './img/full-disk-true-color/crop1080/*.jpg' -c:v libx264 -r 6 -pix_fmt yuv420p video/crop1080.mp4

ffmpeg -framerate 5 -pattern_type glob -i './*.jpg' -c:v libx264 -r 5 -pix_fmt yuv420p 5fps.mp4

# interpolate
butterflow -s full,spd=0.25 -r 60 -o 60fps.mp4 5fps.mp4

# gif
ffmpeg -i 30-interp.mp4 -pix_fmt rgb24 -s 320x240 output.gif

# side by side comparison
ffmpeg -i video_smv/crop1080-2x60c.mp4 -i video/crop1080-2x60.mp4 -filter_complex "[0:v]setpts=PTS-STARTPTS[bg]; [1:v]setpts=PTS-STARTPTS[fg]; [bg][fg]overlay=w/2" video/sbs4.mp4
```
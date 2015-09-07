Hi dthpham,

First off, thanks for making Butterflow - it's pretty awesome. I've been using it on satellite photos from [Himawari 8](https://en.wikipedia.org/wiki/Himawari_8) with great results. The only other open source tool I've found that is similar is [slowMoVideo](https://github.com/slowmoVideo/slowmoVideo), and your Farneback algorithm seems to perform a lot better than their Kanade-Lucas algorithm, at least for my purposes - [here's a test I did to compare them](https://www.youtube.com/watch?v=Skk58D3waQg&feature=youtu.be).

Anyway, I've run into a bit of a problem - As you can see a few times in that example, there are a few missing images which cause some distracting time shifts. Normally the satellite takes images once every 10 minutes, but it misses a few observations every day in order to do 'housekeeping' - ie. checking itself out, reporting diagnostic data to Earth, making sure it is in the right orbit, etc. Here's another example in gif form, the original images at 2fps:

![original images at 2 FPS](http://i.imgur.com/VOY5eDR.gif)

It's not super obvious here, but there are 4 missing frames in this sequence - a set of 2 near the beginning, then 1, then another near the end. Here's the result when I Butterflow interpolate it to 30fps. Everything looks great, but the missing frames become more apparent, since the now-smooth video appears to speed up during these segments:

![butterflow interpolation of original, not adjusted for missing frames](http://i.imgur.com/SaI47Mu.gif)

OK, no problem, I thought. Butterflow has an option to have different segments interpolated at different speeds, so I wrote a little script that parses through the image timestamps and searches for gaps, then generates a butterflow command to interpolate them at the right speeds. So if we are normally interpolating to 0.05x speed but there is one image missing, that segment would get interpolated at 0.025x instead, or at (0.05/n)x when n images are missing. Cool, it works, and gives me something like the following:

```
butterflow -l -r 30 -o time-adjusted.mp4 -s \
a=0,b=0.36666666666666664,spd=0.05:\
a=0.36666666666666664,b=0.4,spd=0.016666666666666666:\
a=0.4,b=0.5,spd=0.05:\
a=0.5,b=0.5333333333333333,spd=0.025:\
a=0.5333333333333333,b=0.8666666666666667,spd=0.05:\
a=0.8666666666666667,b=0.9,spd=0.025:\
a=0.9,b=end,spd=0.05 \
```

However, here's the problem - when I actually run this command, Butterflow seems to create some duplicate frames between the segments which cause the video to pause and be even less smooth than before. Here's the result:

![butterflow interpolation with time adjustment, butterflow added duplicate frames](http://i.imgur.com/VXGQjgG.gif)

I've tried it a few different ways but I always seem to get these pauses, which seems to be a bug. However, I watched the preview window closely during the video creation and it does seem to correctly apply the time shifts at the right parts, they are just broken up by the pauses. This allowed me to find a workaround which seems to work for now to remove the duplicate frames:

 - Create the above video with Butterflow in lossless (`-l`) mode.
 - Extract the frames to PNG files using `ffmpeg`
 - Run `fdupes -d` on the frames to delete duplicate frames
 - `ffmpeg` the frames back into a video

If I do all of that, I to get a nice beautiful result which nearly matches what I'd expect:

![butterflow interpolation with time adjustment and duplicate frames removed](http://i.imgur.com/TREMzhN.gif)

However, it would be nice not to have to do this in my pipeline if Butterflow handled it better.

I've just noticed something else which may be the root cause of this bug - Butterflow seems to add extra frames at the end of all videos to satisfy the "speed" parameter, which I think is incorrect. For example, lets say I have a 1 second video which I want to butterflow to 0.1x speed - I would naively expect the result to be 10 seconds long, and indeed, that's what Butterflow gives me. But let's say I have a video only 3 frames long. Butterflow returns 30 frames - but the last 9 frames are just duplicates of the last real frame. I think the correct result is actually to return a video with 22 frames - 1 real, 9 interpolated, 1 real, 9 interpolated, 1 real - even though 22 is not truly `3/0.1`.

Anyway, apologies for the giant ticket, and thanks again :) Hope it's helpful.

-d

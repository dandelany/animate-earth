export default {
    // base URI of the remote data source from which we retrieve images
    baseSrcURI: 'http://rammb.cira.colostate.edu/ramsdis/online',
    // sub-URI of the index page which contains links to all of the image files
    srcIndexPage: 'archive_hi_res.asp?data_folder=himawari-8/full_disk_ahi_true_color',

    // time, in seconds, for the scraper to sleep between requests
    // (to avoid making too many requests)
    scrapeSleep: 6,
    // max total number of images to save
    scrapeLimit: 5000,
    // scrapeLimit: 5,

    // path containing full-size retrieved jpgs
    imgPath: '/media/dan/Galactica/earth/img/full-disk-true-color/high', // linux
    //imgPath: '/Volumes/Galactica/earth/img/full-disk-true-color/high', // os x
    // imgPath: './testimg',

    // output path for finished video & cropped images
    outPath: '/media/dan/Galactica/earth/output', // linux
    //outPath: '/Volumes/Galactica/earth/output', // os x
    // outPath: './testout',

    // list of crop coordinates for the different cropped videos we're creating
    // string format: 'WIDTHxHEIGHT+XOFFSET+YOFFSET'
    cropCoords: [
        '1920x1080+1558+327', // #1 japan & korea
        '1920x1080+265+1675', // #2 thailand, malaysia, singapore, laos, cambodia, vietnam, philippines
        '1920x1080+540+2310' // #3 indonesia, malaysia, singapore
    ],

    // expected time between images, in seconds. 10 minutes for himawari-8
    imgInterval: 60 * 10,

    // max # of missing frames to try to adjust for via extra interpolation
    // gaps > than this number of frames will ne split into separate sessions
    maxFrameGap: 5,

    // desired fps of the intermediate uninterpolated video
    origFPS: 2,

    // speed by which to slow down the original video
    speed: 0.666667,
    // speed: 1,

    // desired fps of final interpolated video
    finalFPS: 60,

    // limit max # of sessions (days) to make video from, starting from most recent
    maxSessions: 40
};

//const cropCoords = ['800x600+2000+200', '800x600+3000+1000'];
//const cropCoords = ['2800x1576+1100+3260']; // australia - too big...
//const cropCoords = ['2800x1600+1100+3250']; // australia - too big...
//const cropCoords = ['800x600+2100+4260']; // australia small part
//const cropCoords = ['5500x5500+0+0'] // whole thing
//const cropCoords = ['1920x1080+3500+327'] // ocean?

// const cropCoords = ['1920x1080+1558+327']; // #1 japan & korea
//const cropCoords = ['1920x1080+265+1675']; // #2 thailand, malaysia, singapore, laos, cambodia, vietnam, philippines
//const cropCoords = ['1920x1080+540+2310']; // #3 west indonesia, malaysia
//const cropCoords = ['1920x1080+1558+327', '1920x1080+265+1675', '1920x1080+540+2310']; // #1 #2 #3
//const cropCoords = ['250x250+1265+2175']; // test crop
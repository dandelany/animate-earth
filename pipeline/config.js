export default {
    // base URI of the remote data source from which we retrieve images
    baseSrcURI: 'http://rammb.cira.colostate.edu/ramsdis/online',
    // sub-URI of the index page which contains links to all of the image files
    srcIndexPage: 'archive_hi_res.asp?data_folder=himawari-8/full_disk_ahi_true_color',

    // time, in seconds, for the scraper to sleep between requests
    // (to avoid making too many requests)
    scrapeSleep: 1,
    // max total number of images to save
    //scrapeLimit: 5000,
    // scrapeLimit: 5,
    scrapeLimit: 200000,

    // path containing full-size retrieved jpgs
    //imgPath: '/media/dan/Galactica/earth/img/full-disk-true-color/high', // linux
    imgPath: '/Volumes/Galactica/earth/img/full-disk-true-color/high', // os x
     //imgPath: '../testimg',

    // output path for finished video & cropped images
    //outPath: '/media/dan/Galactica/earth/output', // linux
     outPath: '/Volumes/Galactica/earth/output', // os x
     //outPath: '../testout',

    tmpPath: '/tmp/animate-earth',

    // expected time between images, in seconds. 10 minutes for himawari-8
    imgInterval: 60 * 10,

    // max # of missing frames to try to adjust for via extra interpolation
    // gaps > than this number of frames will be split into separate sessions
    maxFrameGap: 5,

    // desired fps of the intermediate uninterpolated video
    origFPS: 2,

    // speed by which to slow down the original video
    //speed: 0.666667,
    // speed: 1,
    speed: 0.75,

    // desired fps of final interpolated video
    finalFPS: 60,

    // limit max # of sessions (days) to make video from, starting from most recent
    maxSessions: 3,

    projectTitle: "Earth From Space",

    // video title/description template, to be filled in at time of video creation
    videoTitle: '${projectTitle} - ${date}: ${product.title}',
    videoDescription: [
        "1080p highly recommended!",
        "Images of ${product.title} taken every 10 minutes on ${date} from the Himawari 8 spacecraft.",
        "Video motion interpolated (smoothed) to 60 FPS using dthpham's Butterflow library.",
        "Images courtesy of Japanese Meteorological Agency/NOAA/RAMMB/CSU/CIRA."
    ].join(" "),
    
    // common tags for all videos
    videoTags: [
        'Satellite imagery', 'Spaceflight', 'Earth', 'Clouds',
        'Space', 'Satellite', 'Himawari-8', 'Earth From Space',
        'Motion interpolation', 'Smoothed video', 'Butterflow'
    ],

    // description template for playlists
    playlistDescription: 'Daily interpolated Himawari-8 satellite images of <TITLE>. Images courtesy of JMA/NOAA/CSU/CIRA.',
    // common tags for the youtube playlists
    playlistTags: [],

    // all video products we create
    products: [
        //{
        //    id: 'TEST',
        //    title: 'Japan, Korea, Beijing & Shanghai',
        //    tags: ['Japan', 'Korea', 'Beijing', 'Shanghai'],
        //    // list of crop coordinates for the cropped videos we're creating
        //    // string format: 'WIDTHxHEIGHT+XOFFSET+YOFFSET'
        //    crop: '420x240+1558+327',
        //    startTime: '20:00:00Z',
        //    endTime: '09:30:00Z',
        //    startDate: '2015-10-13',
        //    endDate: '2015-10-13'
        //},
        {
            id: 'A',
            title: 'Japan, Korea, Beijing & Shanghai',
            tags: ['Japan', 'Korea', 'Beijing', 'Shanghai'],
            // list of crop coordinates for the cropped videos we're creating
            // string format: 'WIDTHxHEIGHT+XOFFSET+YOFFSET'
            crop: '1920x1080+1558+327',
            startTime: '20:00:00Z',
            endTime: '09:30:00Z',
            startDate: '2015-10-14',
            endDate: '2015-10-31'
        },
        //{
        //    id: 'B',
        //    title: 'Thailand, Malaysia, Singapore, Laos, Cambodia, Vietnam, Philippines',
        //    tags: ['Thailand', 'Malaysia', 'Singapore', 'Laos', 'Cambodia', 'Vietnam', 'Philippines'],
        //    crop: '1920x1080+265+1675'
        //},
        //{
        //    id: 'C',
        //    title: 'Indonesia, Malaysia & Singapore',
        //    tags: ['Indonesia', 'Malaysia', 'Singapore'],
        //    crop: '1920x1080+540+2310'
        //},
        //{
        //    id: 'D',
        //    title: 'Eastern China, Taiwan & Korea',
        //    tags: ['China', 'Taiwan', 'Korea'],
        //    crop: '1920x1080+516+754'
        //}
        // {
        //     id: 'DUJUAN',
        //     title: 'Typhoon Dujuan',
        //     crop: '1920x1080+1100+950'
        // }
        // {
        //     id: 'GONI-ATSANI',
        //     title: 'Twin Typhoons Goni and Atsani',
        //     crop: '1920x1080+2280+1102'
        // }
        // {
        //     id: 'TEST',
        //     title: 'Test patch',
        //     crop: '400x400+2280+1100'
        // }
    ]
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

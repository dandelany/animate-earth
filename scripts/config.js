import WebLinkLister from './listers/webPageLister';

const HIMAWARI = {
    // base URI of the remote data source from which we retrieve images
    BASE_URI: 'http://rammb.cira.colostate.edu/ramsdis/online',
    // sub-URI of the index page which contains links to all of the image files
    INDEX_PATH: 'archive_hi_res.asp?data_folder=himawari-8/full_disk_ahi_true_color',
}

const config = {

    projects: {
        himawari: {
            /*
            base img uri
            src index page

            */
            scrape: {
                lister: new WebLinkLister()
            }
        }
    },
}

